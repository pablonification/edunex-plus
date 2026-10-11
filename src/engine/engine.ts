// The engine: sources, feeds, the dataset store and per-source status, with
// the network, time, disk and keychain injected. The desktop shell runs it in
// Electron's main process; tests run it whole against the pretend world.
import type { Event, Snapshot } from "../core/contract";
import { type DatasetName, Datasets, DEFAULT_SETTINGS, Settings, SourceId, SourceStatus } from "../core/models";
import { type AlertNotice, AlertCenter } from "./alerts/center";
import type { Detector } from "./alerts/detector";
import { DETECTORS } from "./alerts/detectors";
import type { Clock } from "./clock";
import { EngineError, isEngineError } from "./errors";
import type { Transport } from "./http/transport";
import { type AnySource, SOURCES } from "./sources";
import type { FeedSpec, SourceContext } from "./sources/source";
import { DatasetStore } from "./store/datasets";
import type { Storage, Vault } from "./store/storage";
import { Scheduler } from "./sync/scheduler";

export interface EngineDeps {
  transport: Transport;
  clock: Clock;
  storage: Storage;
  vault: Vault;
  version: string;
  emit(event: Event): void;
  random?: () => number;
  /** Defaults to every source (EduNex, SIX, ITB's public pages). */
  sources?: readonly AnySource[];
  /** Shows an alert to the Student (an OS notification). Its text is catalog keys, in no language yet. */
  alert?(notice: AlertNotice): void;
  /** Defaults to every alert detector. */
  detectors?: readonly Detector[];
}

export interface Engine {
  /** Loads saved data and sessions from disk. No network. */
  load(): Promise<void>;
  /** Starts the feeds. */
  start(): void;
  stop(): void;
  snapshot(): Snapshot;
  /** Starts a session from what the source's sign-in captured (EduNex: { token }, SIX: { cookie }). */
  signIn(source: SourceId, session: unknown): Promise<void>;
  /** Without a source: sign out of everything. */
  signOut(source?: SourceId): Promise<void>;
  refresh(source?: SourceId): Promise<void>;
  /** Runs a write the Student asked for (save a draft, submit) with the source's current session. */
  act(source: SourceId, action: string, input: unknown): Promise<unknown>;
  /** Keeps something the Student entered (course weights, a study plan) on this computer: a "local.*" dataset. */
  setLocal(name: string, value: unknown): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  /** The Student opened the alert history. */
  markAlertsRead(): Promise<void>;
}

const sessionKey = (source: SourceId) => `${source}.session`;
const STATE_FORMAT = 1;

export function createEngine(deps: EngineDeps): Engine {
  const { clock, storage, vault } = deps;
  const sources = new Map((deps.sources ?? SOURCES).map((source) => [source.id, source]));
  const store = new DatasetStore(storage, (event) => {
    deps.emit(event);
    alerts.observe(event);
  });
  const statuses = new Map<SourceId, SourceStatus>(SourceId.options.map((source) => [source, { source, state: "signed-out", updatedAt: null, detail: null }]));
  let settings: Settings = DEFAULT_SETTINGS;
  const alerts = new AlertCenter({
    clock,
    storage,
    detectors: deps.detectors ?? DETECTORS,
    get: (name) => store.get(name),
    fetchedAt: (name) => store.fetchedAt(name),
    set: (name, value) => store.set(name, value, clock.now()),
    remove: (prefix) => store.remove(prefix),
    settings: () => settings,
    deliver: (notice) => deps.alert?.(notice),
  });
  /** The latest outcome of every feed: null when it worked. */
  const outcomes = new Map<string, EngineError | null>();
  /** Each source's current session number. Work started under an earlier one lands nowhere. */
  const generations = new Map<SourceId, number>(SourceId.options.map((source) => [source, 0]));
  /** The session each source runs with now (for actions). */
  const sessions = new Map<SourceId, unknown>();
  // Feeds report their own outcome (see addFeed); the scheduler only uses failures to back off.
  const scheduler = new Scheduler(clock, () => undefined, deps.random);
  const userAgent = `EdunexPlus/${deps.version} (+https://github.com/pablonification/edunex-plus)`;
  const sourceOf = (feed: string) => feed.split(".")[0] as SourceId;
  const generation = (source: SourceId) => generations.get(source) ?? 0;

  async function saveState(): Promise<void> {
    await storage.write("state.json", JSON.stringify({ format: STATE_FORMAT, settings, statuses: [...statuses.values()] }));
  }

  function setStatus(source: SourceId, patch: Partial<SourceStatus>): void {
    const current = statuses.get(source)!;
    const next = { ...current, ...patch };
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    statuses.set(source, next);
    deps.emit({ type: "status", status: next });
    void saveState();
  }

  /** A feed finished. The source's status is the worst of its feeds' latest outcomes. */
  async function settle(feed: string, error: unknown): Promise<void> {
    const source = sourceOf(feed);
    if (error && !isEngineError(error)) error = new EngineError("Failed", String(error));
    const failure = (error as EngineError | null) ?? null;

    if (failure?.kind === "Unauthorized") {
      if (feed === sources.get(source)?.liveness) return expire(source);
      // Any other refusal: ask the liveness check, which alone may end the session.
      void checkLiveness(source);
      return;
    }
    outcomes.set(feed, failure);
    if (statuses.get(source)?.state === "expired" || statuses.get(source)?.state === "signed-out") return;

    const mine = [...outcomes.entries()].filter(([name]) => sourceOf(name) === source).map(([, outcome]) => outcome);
    const changed = mine.find((o) => o && (o.kind === "VendorChanged" || o.kind === "Failed" || o.kind === "Rejected"));
    const offline = mine.find((o) => o?.kind === "Offline");
    if (changed) setStatus(source, { state: "changed", detail: changed.message });
    else if (offline) setStatus(source, { state: "offline", detail: offline.message });
    else setStatus(source, { state: "live", detail: null, updatedAt: clock.now() });
  }

  function checkLiveness(source: SourceId): Promise<void> {
    const liveness = sources.get(source)?.liveness;
    return liveness ? scheduler.runNow((name) => name === liveness) : Promise.resolve();
  }

  /** Stops a source's feeds and makes anything still running from them land nowhere. */
  function endSession(source: SourceId): void {
    generations.set(source, generation(source) + 1);
    sessions.delete(source);
    for (const name of [...outcomes.keys()].filter((feed) => sourceOf(feed) === source)) {
      scheduler.remove(name);
      outcomes.delete(name);
    }
  }

  async function expire(source: SourceId): Promise<void> {
    endSession(source);
    await vault.delete(sessionKey(source));
    setStatus(source, { state: "expired", detail: null });
  }

  /**
   * A feed: fetches, stores its result and reports how it went. A run whose
   * session has ended (signed out, expired, replaced) stores and reports nothing.
   */
  function addFeed(source: SourceId, spec: FeedSpec): void {
    if (sourceOf(spec.name) !== source) throw new Error(`Feed ${spec.name} doesn't belong to ${source}`);
    outcomes.set(spec.name, null);
    scheduler.add({
      name: spec.name,
      every: spec.every,
      jitter: spec.jitter,
      run: async () => {
        const session = generation(source);
        const current = () => generation(source) === session;
        try {
          await spec.run(current);
        } catch (error) {
          if (current()) await settle(spec.name, error);
          throw error; // so the scheduler backs this feed off
        }
        if (current()) await settle(spec.name, null);
      },
    });
  }

  /** What a source reaches during one session. Writes from an ended session are dropped. */
  function contextFor(source: SourceId): SourceContext {
    const session = generation(source);
    const current = () => generation(source) === session;
    return {
      transport: deps.transport,
      clock,
      userAgent,
      settings: () => settings,
      get: (name) => store.get(name),
      set: async (name, value) => (current() ? store.set(name, value, clock.now()) : false),
      remove: async (prefix) => {
        if (current()) await store.remove(prefix);
      },
      feed: (spec) => {
        if (current()) addFeed(source, spec);
      },
      runNow: (match) => scheduler.runNow((name) => sourceOf(name) === source && match(name)),
    };
  }

  function startSource(source: AnySource, session: unknown): void {
    sessions.set(source.id, session);
    source.start(contextFor(source.id), session);
  }

  function readSession(source: AnySource, saved: string | null): unknown {
    if (!source.session || saved === null) return null;
    try {
      const parsed = source.session.safeParse(JSON.parse(saved));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  return {
    async load() {
      await store.load();
      await alerts.load();
      try {
        const saved = JSON.parse((await storage.read("state.json")) ?? "null");
        if (saved?.format === STATE_FORMAT) {
          const parsedSettings = Settings.safeParse({ ...DEFAULT_SETTINGS, ...saved.settings });
          if (parsedSettings.success) settings = parsedSettings.data;
          for (const status of saved.statuses ?? []) {
            const parsed = SourceStatus.safeParse(status);
            if (parsed.success) statuses.set(parsed.data.source, parsed.data);
          }
        }
      } catch {
        // Unreadable state: start from defaults.
      }
      for (const source of sources.values()) {
        const status = statuses.get(source.id)!;
        if (!source.session) {
          startSource(source, null);
          statuses.set(source.id, { ...status, state: status.state === "signed-out" ? "connecting" : status.state });
          continue;
        }
        const session = readSession(source, await vault.get(sessionKey(source.id)));
        if (session) {
          startSource(source, session);
          // A saved session counts as signed in at once; the feeds check it in the background.
          statuses.set(source.id, { ...status, state: "connecting", detail: null });
        } else if (status.state !== "expired") {
          statuses.set(source.id, { ...status, state: "signed-out", detail: null });
        }
      }
    },

    start() {
      scheduler.start();
      alerts.start();
    },

    stop() {
      scheduler.stop();
      alerts.stop();
    },

    snapshot() {
      return { version: deps.version, datasets: store.snapshot(), statuses: [...statuses.values()], settings };
    },

    async signIn(id, raw) {
      const source = sources.get(id);
      if (!source?.session) throw new EngineError("Rejected", `${id} has no sign-in`);
      const parsed = source.session.safeParse(raw);
      if (!parsed.success) throw new EngineError("Rejected", `That isn't a ${id} session`);
      endSession(id);
      await vault.set(sessionKey(id), JSON.stringify({ ...parsed.data, savedAt: clock.now() }));
      setStatus(id, { state: "connecting", detail: null });
      startSource(source, parsed.data);
      // Whose session this is comes first: a different Student's data must be gone before anything new lands.
      await checkLiveness(id);
      await scheduler.runNow((name) => sourceOf(name) === id && name !== source.liveness);
    },

    async signOut(only) {
      for (const source of sources.values()) {
        if (!source.session || (only && source.id !== only)) continue;
        endSession(source.id);
        await vault.delete(sessionKey(source.id));
        await store.remove(`${source.id}.`);
        setStatus(source.id, { state: "signed-out", updatedAt: null, detail: null });
      }
      // Signing out of everything also forgets what the Student entered.
      if (!only) {
        await store.remove("local.");
        await alerts.reset();
      }
    },

    async setLocal(name, value) {
      if (!name.startsWith("local.") || !Object.hasOwn(Datasets, name)) throw new EngineError("Rejected", `${name} isn't kept on this computer`);
      const parsed = Datasets[name as DatasetName].safeParse(value);
      if (!parsed.success) throw new EngineError("Rejected", `That isn't a valid ${name}`);
      await store.set(name as DatasetName, parsed.data as never, clock.now());
    },

    async refresh(source) {
      await scheduler.runNow((name) => !source || sourceOf(name) === source);
    },

    async act(id, name, input) {
      const source = sources.get(id);
      const action = source?.actions?.[name];
      if (!source || !action) throw new EngineError("Rejected", `Unknown action ${id}.${name}`);
      if (source.session && !sessions.has(id)) throw new EngineError("Unauthorized", `Sign in to ${id} first`);
      try {
        return await action(contextFor(id), sessions.get(id), input);
      } catch (error) {
        // A refusal asks the liveness check, which alone may end the session.
        if (isEngineError(error, "Unauthorized")) void checkLiveness(id);
        throw error;
      }
    },

    async updateSettings(patch) {
      settings = Settings.parse({ ...settings, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) });
      await saveState();
      deps.emit({ type: "settings", settings });
      return settings;
    },

    markAlertsRead() {
      return alerts.markRead();
    },
  };
}
