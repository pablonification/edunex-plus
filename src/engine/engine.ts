// The engine: sources, feeds, the dataset store and per-source status, with
// the network, time, disk and keychain injected. The desktop shell runs it in
// Electron's main process; tests run it whole against the pretend world.
import type { Event, Snapshot } from "../core/contract";
import { DEFAULT_SETTINGS, Settings, type SourceId, SourceStatus } from "../core/models";
import type { Clock } from "./clock";
import { EngineError, isEngineError } from "./errors";
import type { Transport } from "./http/transport";
import { EdunexClient } from "./sources/edunex/client";
import { fetchAccount, fetchCourses } from "./sources/edunex/feeds";
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
}

export interface Engine {
  /** Loads saved data and sessions from disk. No network. */
  load(): Promise<void>;
  /** Starts the feeds. */
  start(): void;
  stop(): void;
  snapshot(): Snapshot;
  signIn(source: SourceId, session: { token: string }): Promise<void>;
  /** Without a source: sign out of everything. */
  signOut(source?: SourceId): Promise<void>;
  refresh(source?: SourceId): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
}

const MINUTE = 60_000;
const SESSION_KEY: Record<SourceId, string> = { edunex: "edunex.session", six: "six.session" };
/** The one call whose 401 means the EduNex session has ended. */
const LIVENESS: Record<SourceId, string> = { edunex: "edunex.account", six: "six.status" };
const STATE_FORMAT = 1;

/** A saved session, or null when there is none or it can't be read. */
function readSession(saved: string | null): { token: string } | null {
  try {
    const parsed: unknown = JSON.parse(saved ?? "null");
    const token = (parsed as { token?: unknown } | null)?.token;
    return typeof token === "string" && token ? { token } : null;
  } catch {
    return null;
  }
}

export function createEngine(deps: EngineDeps): Engine {
  const { clock, storage, vault } = deps;
  const store = new DatasetStore(storage, deps.emit);
  const statuses = new Map<SourceId, SourceStatus>(
    (["edunex", "six"] as const).map((source) => [source, { source, state: "signed-out", updatedAt: null, detail: null }]),
  );
  let settings: Settings = DEFAULT_SETTINGS;
  /** The latest outcome of every feed: null when it worked. */
  const outcomes = new Map<string, EngineError | null>();
  /** Each source's current session. Work that started under an earlier one is dropped when it finishes. */
  const sessions: Record<SourceId, number> = { edunex: 0, six: 0 };
  // Feeds report their own outcome (see feed()); the scheduler only uses failures to back off.
  const scheduler = new Scheduler(clock, () => undefined, deps.random);
  const userAgent = `EdunexPlus/${deps.version} (+https://github.com/pablonification/edunex-plus)`;
  const sourceOf = (feed: string) => feed.split(".")[0] as SourceId;

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
      if (feed === LIVENESS[source]) return expire(source);
      // Any other refusal: ask the liveness check, which alone may end the session.
      void scheduler.runNow((name) => name === LIVENESS[source]);
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

  /** Stops a source's feeds and makes anything still running from them land nowhere. */
  function endSession(source: SourceId): void {
    sessions[source] += 1;
    for (const name of [...outcomes.keys()].filter((feed) => sourceOf(feed) === source)) {
      scheduler.remove(name);
      outcomes.delete(name);
    }
  }

  async function expire(source: SourceId): Promise<void> {
    endSession(source);
    await vault.delete(SESSION_KEY[source]);
    setStatus(source, { state: "expired", detail: null });
  }

  /**
   * A feed: fetches, stores its result and reports how it went. `current()`
   * turns false once the session it started under has ended (signed out,
   * expired, or replaced); such a run stores nothing and reports nothing.
   */
  function feed(name: string, every: number, jitter: number, work: (current: () => boolean) => Promise<void>): void {
    const source = sourceOf(name);
    outcomes.set(name, null);
    scheduler.add({
      name,
      every,
      jitter,
      run: async () => {
        const session = sessions[source];
        const current = () => sessions[source] === session;
        try {
          await work(current);
        } catch (error) {
          if (current()) await settle(name, error);
          throw error; // so the scheduler backs this feed off
        }
        if (current()) await settle(name, null);
      },
    });
  }

  function startEdunex(token: string): void {
    const client = new EdunexClient(deps.transport, token, userAgent);
    feed("edunex.account", 10 * MINUTE, MINUTE, async (current) => {
      const account = await fetchAccount(client);
      if (!current()) return;
      const previous = store.get("edunex.account");
      // A different Student signed in on this computer: nothing of the last one may show.
      if (previous && previous.nim !== account.nim) await store.remove("edunex.");
      if (current()) await store.set("edunex.account", account, clock.now());
    });
    feed("edunex.courses", 30 * MINUTE, 3 * MINUTE, async (current) => {
      const courses = await fetchCourses(client);
      if (current()) await store.set("edunex.courses", courses, clock.now());
    });
  }

  return {
    async load() {
      await store.load();
      try {
        const saved = JSON.parse((await storage.read("state.json")) ?? "null");
        if (saved?.format === STATE_FORMAT) {
          const parsedSettings = Settings.safeParse(saved.settings);
          if (parsedSettings.success) settings = parsedSettings.data;
          for (const status of saved.statuses ?? []) {
            const parsed = SourceStatus.safeParse(status);
            if (parsed.success) statuses.set(parsed.data.source, parsed.data);
          }
        }
      } catch {
        // Unreadable state: start from defaults.
      }
      for (const source of ["edunex", "six"] as const) {
        const session = readSession(await vault.get(SESSION_KEY[source]));
        const status = statuses.get(source)!;
        if (session && source === "edunex") {
          startEdunex(session.token);
          // A saved session counts as signed in at once; the feeds check it in the background.
          statuses.set(source, { ...status, state: "connecting", detail: null });
        } else if (!session && status.state !== "expired") {
          statuses.set(source, { ...status, state: "signed-out", detail: null });
        }
      }
    },

    start() {
      scheduler.start();
    },

    stop() {
      scheduler.stop();
    },

    snapshot() {
      return { version: deps.version, datasets: store.snapshot(), statuses: [...statuses.values()], settings };
    },

    async signIn(source, session) {
      if (source !== "edunex") throw new EngineError("Rejected", `${source} sign-in isn't available yet`);
      endSession(source);
      await vault.set(SESSION_KEY[source], JSON.stringify({ token: session.token, savedAt: clock.now() }));
      setStatus(source, { state: "connecting", detail: null });
      startEdunex(session.token);
      // Whose session this is comes first: a different Student's data must be gone before anything new lands.
      await scheduler.runNow((name) => name === LIVENESS[source]);
      await scheduler.runNow((name) => sourceOf(name) === source && name !== LIVENESS[source]);
    },

    async signOut(source) {
      for (const each of source ? [source] : (["edunex", "six"] as const)) {
        endSession(each);
        await vault.delete(SESSION_KEY[each]);
        await store.remove(`${each}.`);
        setStatus(each, { state: "signed-out", updatedAt: null, detail: null });
      }
    },

    async refresh(source) {
      await scheduler.runNow((name) => !source || sourceOf(name) === source);
    },

    async updateSettings(patch) {
      settings = { ...settings, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
      await saveState();
      deps.emit({ type: "settings", settings });
      return settings;
    },
  };
}
