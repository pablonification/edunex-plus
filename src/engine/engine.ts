// The engine: sources, feeds, the dataset store and per-source status, with
// the network, time, disk and keychain injected. The desktop shell runs it in
// Electron's main process; tests run it whole against the pretend world.
import type { Event, Snapshot } from "../core/contract";
import { type DatasetName, Datasets, DEFAULT_SETTINGS, Settings, SourceId, SourceStatus, type UpdateCheckResult } from "../core/models";
import { isNewerRelease } from "../core/updates";
import { AlertCenter, type AlertNotice } from "./alerts/center";
import type { Detector } from "./alerts/detector";
import { DETECTORS } from "./alerts/detectors";
import { type Ntfy, PhoneChannel } from "./alerts/phone";
import type { Clock } from "./clock";
import { EngineError, isEngineError } from "./errors";
import { Pace } from "./http/pace";
import type { Transport } from "./http/transport";
import { type AnySource, SOURCES } from "./sources";
import type { FeedSpec, SourceContext } from "./sources/source";
import { DatasetStore } from "./store/datasets";
import type { Storage, Vault } from "./store/storage";
import { Scheduler } from "./sync/scheduler";
import { createUpdateCheck } from "./updates";

export interface EngineDeps {
  transport: Transport;
  clock: Clock;
  storage: Storage;
  vault: Vault;
  version: string;
  emit(event: Event): void;
  random?: () => number;
  /** Defaults to every source (Edunex, SIX, ITB's public pages). */
  sources?: readonly AnySource[];
  /** Shows an alert to the Student (an OS notification). Its text is catalog keys, in no language yet. */
  alert?(notice: AlertNotice): void;
  /** Alerts on the Student's phone through ntfy (src/desktop/ntfy.ts). Without it, no phone can be linked. */
  phone?: { ntfy: Ntfy; newTopic?: () => string };
  /** Defaults to every alert detector. */
  detectors?: readonly Detector[];
  /** Asks GitHub once a day for a newer release (packaged builds only). */
  checkForUpdates?: boolean;
}

export interface Engine {
  /** Loads saved data and sessions from disk. No network. */
  load(): Promise<void>;
  /** Starts the feeds. */
  start(): void;
  stop(): void;
  snapshot(): Snapshot;
  /** Starts a session from what the source's sign-in captured (Edunex: { token }, SIX: { cookie }). */
  signIn(source: SourceId, session: unknown): Promise<void>;
  /** Without a source: sign out of everything. */
  signOut(source?: SourceId): Promise<void>;
  /** Reads again now ("Perbarui sekarang", waking from sleep): every feed but the background ones (FeedSpec.background). */
  refresh(source?: SourceId): Promise<void>;
  /** Runs a write the Student asked for (save a draft, submit) with the source's current session. */
  act(source: SourceId, action: string, input: unknown): Promise<unknown>;
  /** Keeps something the Student entered (course weights, a study plan) on this computer: a "local.*" dataset. */
  setLocal(name: string, value: unknown): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  /** The Student opened the alert history. */
  markAlertsRead(): Promise<void>;
  /** Asks GitHub for a newer release now ("Periksa pembaruan"); "off" where the app never asks (development, the demo). */
  checkForUpdates(): Promise<UpdateCheckResult>;
  /** The Student's phone, through ntfy: link it, a test, unlink it. */
  readonly phone: Pick<PhoneChannel, "link" | "connect" | "test" | "disconnect" | "idle">;
}

const sessionKey = (source: SourceId) => `${source}.session`;
const STATE_FORMAT = 1;

/**
 * Settings saved by any version. One field that no longer fits (a value a
 * newer version allowed, a hand-edited file) falls back to its default
 * alone, so it never resets the Student's theme, language or alerts.
 */
function loadSettings(saved: unknown): Settings {
  const fields = saved !== null && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  const whole = Settings.safeParse({ ...DEFAULT_SETTINGS, ...fields });
  if (whole.success) return whole.data;
  const each = Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => {
    const parsed = Settings.shape[key as keyof Settings].safeParse(fields[key]);
    return [key, parsed.success ? parsed.data : fallback];
  });
  return Settings.parse(Object.fromEntries(each));
}

export function createEngine(deps: EngineDeps): Engine {
  const { clock, storage, vault } = deps;
  const sources = new Map((deps.sources ?? SOURCES).map((source) => [source.id, source]));
  const store = new DatasetStore(storage, (event) => {
    deps.emit(event);
    alerts.observe(event);
  });
  const statuses = new Map<SourceId, SourceStatus>(SourceId.options.map((source) => [source, { source, state: "signed-out", updatedAt: null, detail: null }]));
  let settings: Settings = DEFAULT_SETTINGS;
  const phone = new PhoneChannel({
    ntfy: deps.phone?.ntfy,
    newTopic: deps.phone?.newTopic,
    clock,
    vault,
    lang: () => settings.lang,
    quiet: () => settings.phoneQuietHours,
    courses: () => store.get("edunex.courses") ?? [],
  });
  const alerts = new AlertCenter({
    clock,
    storage,
    detectors: deps.detectors ?? DETECTORS,
    get: (name) => store.get(name),
    fetchedAt: (name) => store.fetchedAt(name),
    set: (name, value) => store.set(name, value, clock.now()),
    remove: (prefix) => store.remove(prefix),
    settings: () => settings,
    deliver: (notice) => {
      // The OS notification first; the phone's copy goes even if that one fails.
      try {
        deps.alert?.(notice);
      } finally {
        phone.deliver(notice);
      }
    },
    upcoming: (planned) => phone.upcoming(planned),
    forget: async () => void (await phone.disconnect()),
  });
  /** The latest outcome of every feed: null when it worked. */
  const outcomes = new Map<string, EngineError | null>();
  /** Orders requests leaving and lost connections landing, so an answer only speaks for what came before it. */
  let tick = 0;
  /** When each feed's current "no answer at all" outcome landed (a `tick`). */
  const unreachableAt = new Map<string, number>();
  /** Per source: when the request behind its latest answer left (a `tick`). */
  const answered = new Map<SourceId, number>();
  /** Feeds a manual refresh leaves to their own schedule (FeedSpec.background). */
  const background = new Set<string>();
  /** Each source's current session number. Work started under an earlier one lands nowhere. */
  const generations = new Map<SourceId, number>(SourceId.options.map((source) => [source, 0]));
  /** The session each source runs with now (for actions). */
  const sessions = new Map<SourceId, unknown>();
  // Feeds report their own outcome (see addFeed); the scheduler only uses failures to back off.
  const scheduler = new Scheduler(clock, () => undefined, deps.random);
  const userAgent = `EdunexPlus/${deps.version} (+https://github.com/pablonification/edunex-plus)`;
  const updates = deps.checkForUpdates
    ? createUpdateCheck({
        transport: deps.transport,
        clock,
        storage,
        version: deps.version,
        userAgent,
        publish: async (notice) => {
          if (notice) await store.set("app.update", notice, clock.now());
          else await store.remove("app.update");
        },
      })
    : null;
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

  /**
   * A feed finished. The source's status is the worst of its feeds' latest
   * outcomes, except that an answer to a request sent after a feed got no
   * answer at all ends that outcome: one answer is enough to know the source
   * is reachable again, without waiting minutes for every feed's next turn.
   */
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
    // A background feed that got no answer just tries again on its own: nothing the Student can act on.
    const quiet = failure?.kind === "Offline" && failure.unreachable && background.has(feed);
    outcomes.set(feed, quiet ? null : failure);
    if (failure?.kind === "Offline" && failure.unreachable && !quiet) unreachableAt.set(feed, ++tick);
    else unreachableAt.delete(feed);
    const reached = answered.get(source) ?? 0;
    for (const [name, at] of unreachableAt) {
      if (sourceOf(name) !== source || at > reached) continue;
      outcomes.set(name, null);
      unreachableAt.delete(name);
    }
    if (statuses.get(source)?.state === "expired" || statuses.get(source)?.state === "signed-out") return;

    const mine = [...outcomes.entries()].filter(([name]) => sourceOf(name) === source).map(([, outcome]) => outcome);
    const changed = mine.find((o) => o && (o.kind === "VendorChanged" || o.kind === "Failed" || o.kind === "Rejected"));
    const offline = mine.find((o) => o?.kind === "Offline");
    if (changed) setStatus(source, { state: "changed", detail: changed.message });
    else if (offline) setStatus(source, { state: "offline", detail: offline.message });
    else {
      setStatus(source, { state: "live", detail: null, updatedAt: clock.now() });
      // A good read of Edunex: the phone's "laptop hasn't checked" warning moves on.
      if (source === "edunex") phone.checked(clock.now());
    }
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
      unreachableAt.delete(name);
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
    unreachableAt.delete(spec.name);
    if (spec.background) background.add(spec.name);
    else background.delete(spec.name);
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

  /** One line per website, shared by every source and kept across sessions (a 429 pause outlives a sign-in). */
  const paces = new Map<string, Pace>();
  const pace = (site: string) => {
    let line = paces.get(site);
    if (!line) paces.set(site, (line = new Pace(clock)));
    return line;
  };

  /**
   * A source's door to the network. Any answer that isn't "unreachable" (a
   * 5xx or 429, as the clients read it) proves the source can be reached.
   * A feed that reads nothing (its data still fresh) proves nothing. One per
   * source for the engine's life: writes queue per transport (hand-in.ts).
   */
  const transports = new Map<SourceId, Transport>();
  function transportFor(source: SourceId): Transport {
    let transport = transports.get(source);
    if (!transport) {
      transport = {
        async request(request) {
          const sent = ++tick;
          const response = await deps.transport.request(request);
          if (response.status < 500 && response.status !== 429) answered.set(source, Math.max(answered.get(source) ?? 0, sent));
          return response;
        },
      };
      transports.set(source, transport);
    }
    return transport;
  }

  /** What a source reaches during one session. Writes from an ended session are dropped. */
  function contextFor(source: SourceId): SourceContext {
    const session = generation(source);
    const current = () => generation(source) === session;
    return {
      transport: transportFor(source),
      clock,
      userAgent,
      settings: () => settings,
      get: (name) => store.get(name),
      set: async (name, value) => {
        if (!current()) return false;
        const changed = await store.set(name, value, clock.now());
        // Read again but unchanged: plans that look at when it was read still need to know.
        if (!changed) alerts.touched(name);
        return changed;
      },
      remove: async (prefix) => {
        if (current()) await store.remove(prefix);
      },
      feed: (spec) => {
        if (current()) addFeed(source, spec);
      },
      runNow: (match) => scheduler.runNow((name) => sourceOf(name) === source && match(name)),
      pace,
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
      await phone.load();
      // A notice saved before this version was installed.
      const notice = store.get("app.update");
      if (notice && !isNewerRelease(notice.version, deps.version)) await store.remove("app.update");
      try {
        const saved = JSON.parse((await storage.read("state.json")) ?? "null");
        if (saved?.format === STATE_FORMAT) {
          settings = loadSettings(saved.settings);
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
      updates?.start();
    },

    stop() {
      scheduler.stop();
      alerts.stop();
      updates?.stop();
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
        // Nothing reads Edunex any more: no warning that it hasn't.
        if (source.id === "edunex") phone.checked(null);
      }
      // Signing out of everything also forgets what the Student entered (their
      // courses' own attendance targets too), and the next Student on this
      // computer gets their own first-run scan.
      if (!only) {
        await store.remove("local.");
        await alerts.reset();
        if (settings.firstScanDone || Object.keys(settings.attendanceTargets).length > 0) {
          settings = { ...settings, firstScanDone: false, attendanceTargets: {} };
          await saveState();
          deps.emit({ type: "settings", settings });
        }
      }
    },

    async setLocal(name, value) {
      if (!name.startsWith("local.") || !Object.hasOwn(Datasets, name)) throw new EngineError("Rejected", `${name} isn't kept on this computer`);
      const parsed = Datasets[name as DatasetName].safeParse(value);
      if (!parsed.success) throw new EngineError("Rejected", `That isn't a valid ${name}`);
      await store.set(name as DatasetName, parsed.data as never, clock.now());
    },

    async refresh(source) {
      await scheduler.runNow((name) => (!source || sourceOf(name) === source) && !background.has(name));
    },

    async act(id, name, input) {
      const source = sources.get(id);
      const action = source?.actions?.[name];
      if (!source || !action) throw new EngineError("Rejected", `Unknown action ${id}.${name}`);
      if (source.session && !sessions.has(id)) throw new EngineError("Unauthorized", `Sign in to ${id} first`);
      try {
        return await action(contextFor(id), sessions.get(id), input);
      } catch (error) {
        // A refusal asks the liveness check, which alone may end the session. No answer at all asks every
        // signed-in source, so the status says what's reachable within seconds, not at the next sync.
        if (isEngineError(error, "Unauthorized")) void checkLiveness(id);
        else if (isEngineError(error, "Offline") && error.unreachable) for (const signedIn of sessions.keys()) void checkLiveness(signedIn);
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

    async checkForUpdates() {
      return updates ? updates.checkNow() : "off";
    },

    phone,
  };
}
