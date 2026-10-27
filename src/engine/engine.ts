// The engine: sources, feeds, the dataset store and per-source status, with
// the network, time, disk and keychain injected. The desktop shell runs it in
// Electron's main process; tests run it whole against the pretend world.
import { z } from "zod";
import type { Event, Snapshot } from "../core/contract";
import { REPORT_RELAY_URL } from "../core/links";
import {
  type DatasetName,
  Datasets,
  DEFAULT_SETTINGS,
  type ProblemReport,
  type ReportAbout,
  reportSendingOf,
  Settings,
  type SkippedRow,
  SourceId,
  SourceStatus,
  type UpdateCheckResult,
} from "../core/models";
import { isNewerRelease } from "../core/updates";
import { AlertCenter, type AlertNotice } from "./alerts/center";
import type { Detector } from "./alerts/detector";
import { DETECTORS } from "./alerts/detectors";
import { type Ntfy, PhoneChannel } from "./alerts/phone";
import { AppLog, errorLine } from "./app-log";
import type { Clock } from "./clock";
import { EngineError, isEngineError, PartChanged } from "./errors";
import { Pace } from "./http/pace";
import type { Transport } from "./http/transport";
import { type FeedHistory, KeptPages } from "./report/kept-pages";
import { type Noted, Outbox, type Sent } from "./report/outbox";
import { relayBase } from "./report/relay";
import { buildReport } from "./report/report";
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
  /** The app's own log, which main writes to as well (the window's errors, the updater). One of its own without it. */
  log?: AppLog;
  /** The maintainer's report relay (ADR 0014); REPORT_RELAY_URL by default, which ships empty: no relay. */
  relay?: string;
  /** The computer's system, as a report that sends itself names it ("macOS 15.3 (arm64)"). */
  os?(): string;
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
  /**
   * "Laporkan masalah": what the app couldn't read about `about`, scrubbed of everything personal
   * (report/report.ts). The pages behind it are kept in memory only, until their source signs out.
   */
  report(about: ReportAbout): Promise<ProblemReport>;
  /**
   * Problem reports to the maintainer's relay (report/outbox.ts): "Kirim" with the report the
   * Student was shown, their note on one sent this session, closing the question the app asked,
   * and (for tests) waiting until what's due has gone.
   */
  readonly reports: {
    send(report: ProblemReport, details: { note: string; os: string }): Promise<Sent>;
    note(id: string, note: string): Promise<Noted>;
    dismiss(): Promise<void>;
    /** Whether a report this app sent was filed as that issue. */
    filed(issue: number): boolean;
    idle(): Promise<void>;
  };
  /** The Student's phone, through ntfy: link it, a test, unlink it. */
  readonly phone: Pick<PhoneChannel, "link" | "connect" | "test" | "disconnect" | "idle">;
  /**
   * The session a source is signed in with now (Edunex: { token }, SIX: { cookie }), or null.
   * For the desktop's SIX window ("Tandai Hadir"), which shows SIX signed in; never for the page.
   */
  session(source: SourceId): unknown;
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
  // Saved before the guide: a Student whose first-run scan was done already knows the app, so it isn't offered.
  const defaults: Settings = { ...DEFAULT_SETTINGS, guideDone: fields.firstScanDone === true };
  const whole = Settings.safeParse({ ...defaults, ...fields });
  if (whole.success) return whole.data;
  // Every field, the optional ones too (a choice the Student made, not yet made). One not saved takes its default, as above.
  const each = Object.keys(Settings.shape).map((key) => {
    const parsed = Settings.shape[key as keyof Settings].safeParse(fields[key]);
    return [key, parsed.success && fields[key] !== undefined ? parsed.data : defaults[key as keyof Settings]];
  });
  return Settings.parse(Object.fromEntries(each.filter(([, value]) => value !== undefined)));
}

/** Source states that are the app going about its work; the others are worth a warning in the log. */
const QUIET_STATES = new Set<SourceStatus["state"]>(["connecting", "live", "signed-out"]);

/** How much a failure matters in the log: a page that changed or a refusal is an error, no answer or an ended session a warning. */
const levelOf = (error: unknown) => (isEngineError(error, "Offline") || isEngineError(error, "Unauthorized") ? "warn" : "error");

/** When each feed last read well and what it stores (report/kept-pages.ts), as saved with the state. */
const FeedHistories = z.record(z.string().max(60), z.object({ fills: z.array(z.string().max(60)).max(30), goodAt: z.number().nullable() }));

/** Where each source keeps the rows its reads left out. */
const SKIPPED: Partial<Record<SourceId, "six.skipped">> = { six: "six.skipped" };

export function createEngine(deps: EngineDeps): Engine {
  const { clock, storage, vault } = deps;
  const log = deps.log ?? new AppLog(() => clock.now());
  const sources = new Map((deps.sources ?? SOURCES).map((source) => [source.id, source]));
  const store = new DatasetStore(storage, (event) => {
    deps.emit(event);
    alerts.observe(event);
    followStudent(event);
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
    log: log.for("phone"),
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
    log: log.for("alerts"),
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
  /** Feeds whose page changing is said on their screens, not as the whole source's (FeedSpec.shows): what each fills. */
  const pages = new Map<string, readonly DatasetName[]>();
  /** Feeds whose page has a part that can change alone (FeedSpec.part): what that part fills. */
  const parts = new Map<string, readonly DatasetName[]>();
  /** The pages behind each feed's latest read that went wrong, for a report. In memory only. */
  const kept = new KeptPages({ kept: (problem) => outbox.onKept(problem), forgotten: (problem, readWell) => outbox.onForgotten(problem, readWell) });
  /** Each source's current session number. Work started under an earlier one lands nowhere. */
  const generations = new Map<SourceId, number>(SourceId.options.map((source) => [source, 0]));
  /** The session each source runs with now (for actions). */
  const sessions = new Map<SourceId, unknown>();
  // Feeds report their own outcome (see addFeed); the scheduler only uses failures to back off.
  const scheduler = new Scheduler(clock, () => undefined, deps.random);
  const userAgent = `EdunexPlus/${deps.version} (+https://github.com/pablonification/edunex-plus)`;
  /** The report about what `about` names, from what's kept (`chosen`: only those). */
  const reportOf = (about: ReportAbout, chosen = kept.list()) =>
    buildReport({
      kept: chosen,
      about,
      get: (name) => store.get(name),
      fetchedAt: (name) => store.fetchedAt(name),
      statuses: [...statuses.values()],
      log: log.entries(),
      version: deps.version,
      now: clock.now(),
      seed: Math.floor((deps.random ?? Math.random)() * 2 ** 32),
    });
  const relay = relayBase(deps.relay ?? REPORT_RELAY_URL);
  const outbox = new Outbox({
    clock,
    storage,
    relay: relay ? { base: relay, transport: deps.transport, userAgent } : null,
    os: () => deps.os?.() ?? "",
    settings: () => settings,
    keptFor: (feed) => kept.list().find((one) => one.feed === feed),
    build: (feed) =>
      reportOf(
        {},
        kept.list().filter((one) => one.feed === feed),
      ),
    get: () => store.get("app.reports"),
    set: async (state) => void (await store.set("app.reports", state, clock.now())),
    // Nothing goes while every source the Student is signed in to gets no answer.
    online: () => [...statuses.values()].some((status) => status.source !== "itb" && ["connecting", "live", "changed"].includes(status.state)),
    log: log.for("reports"),
  });
  const updates = deps.checkForUpdates
    ? createUpdateCheck({
        transport: deps.transport,
        clock,
        storage,
        version: deps.version,
        userAgent,
        log: log.for("update"),
        publish: async (notice) => {
          if (notice) await store.set("app.update", notice, clock.now());
          else await store.remove("app.update");
        },
      })
    : null;
  const sourceOf = (feed: string) => feed.split(".")[0] as SourceId;
  const generation = (source: SourceId) => generations.get(source) ?? 0;

  async function saveState(): Promise<void> {
    await storage.write("state.json", JSON.stringify({ format: STATE_FORMAT, settings, statuses: [...statuses.values()], feeds: kept.histories() }));
  }

  /** Whose data each source holds now (their NIM). */
  const students = new Map<SourceId, string>();
  /**
   * Another Student's data arriving on this computer: what the app did and read for the one before
   * isn't this one's to report (the log, when each feed last read well).
   */
  function followStudent(event: Event): void {
    if (event.type !== "dataset") return;
    const source = event.dataset.name === "edunex.account" ? "edunex" : event.dataset.name === "six.student" ? "six" : null;
    const nim = (event.dataset.value as { nim?: unknown } | null)?.nim;
    if (!source || typeof nim !== "string") return;
    const before = students.get(source);
    students.set(source, nim);
    if (!before || before === nim) return;
    log.clear();
    kept.forgetReads(source);
  }

  function setStatus(source: SourceId, patch: Partial<SourceStatus>): void {
    const current = statuses.get(source)!;
    const next = { ...current, ...patch };
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    if (next.state !== current.state) log.add(QUIET_STATES.has(next.state) ? "info" : "warn", source, `${current.state} → ${next.state}`);
    // Answering again: a report that waited for a connection goes now.
    if (next.state === "live" && current.state !== "live") outbox.wake();
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

    const mine = [...outcomes.entries()].filter(([name]) => sourceOf(name) === source);
    const isChange = (o: EngineError | null) => o?.kind === "VendorChanged" || o?.kind === "Failed" || o?.kind === "Rejected";
    // A page whose screens say it changed (FeedSpec.shows), or the part of a page that changed alone (FeedSpec.part), isn't the
    // whole source changing: the rest reads on.
    const saidOn = (name: string, o: EngineError) => pages.get(name) ?? (o instanceof PartChanged ? parts.get(name) : undefined);
    const changedPages = mine
      .filter(([name, o]) => isChange(o) && saidOn(name, o!))
      .map(([name, o]) => ({ datasets: [...saidOn(name, o!)!], detail: o!.message }));
    const pagesPatch = { changedPages: changedPages.length ? changedPages : undefined };
    const changed = mine.find(([name, o]) => isChange(o) && !saidOn(name, o!))?.[1];
    const offline = mine.find(([, o]) => o?.kind === "Offline")?.[1];
    if (changed) setStatus(source, { state: "changed", detail: changed.message, ...pagesPatch });
    else if (offline) setStatus(source, { state: "offline", detail: offline.message, ...pagesPatch });
    else {
      setStatus(source, { state: "live", detail: null, updatedAt: clock.now(), ...pagesPatch });
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
    kept.forget(source);
    for (const name of [...outcomes.keys()].filter((feed) => sourceOf(feed) === source)) {
      scheduler.remove(name);
      outcomes.delete(name);
      unreachableAt.delete(name);
    }
  }

  async function expire(source: SourceId): Promise<void> {
    endSession(source);
    await vault.delete(sessionKey(source));
    setStatus(source, { state: "expired", detail: null, changedPages: undefined });
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
    if (spec.shows) pages.set(spec.name, spec.shows);
    else pages.delete(spec.name);
    if (spec.part) parts.set(spec.name, spec.part);
    else parts.delete(spec.name);
    scheduler.add({
      name: spec.name,
      every: spec.every,
      jitter: spec.jitter,
      run: async () => {
        const session = generation(source);
        const current = () => generation(source) === session;
        // Only a signed-in Student's pages are worth a report (ITB's public pages are the same for everyone). A page whose
        // part can change alone is reported for what that part fills, so the screens listing it can send it.
        const read = () => spec.run(current);
        try {
          if (sources.get(source)?.session) await kept.during({ feed: spec.name, shows: spec.shows ?? spec.part, now: () => clock.now(), current }, read);
          else await read();
        } catch (error) {
          if (current()) {
            log.add(levelOf(error), spec.name, errorLine(error));
            await settle(spec.name, error);
          }
          throw error; // so the scheduler backs this feed off
        }
        if (current()) {
          log.add("info", spec.name, "ok");
          await settle(spec.name, null);
        }
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
          if (request.method === "GET" && (response.status < 300 || response.status >= 400))
            kept.saw({ url: request.url, status: response.status, body: response.body, check: request.check });
          if (response.status < 500 && response.status !== 429) answered.set(source, Math.max(answered.get(source) ?? 0, sent));
          return response;
        },
      };
      transports.set(source, transport);
    }
    return transport;
  }

  /**
   * What a read left out, for its source's "<source>.skipped" (only SIX keeps one); a read that left
   * nothing out clears its entry. Null when there's nothing to keep or clear, as for almost every read.
   */
  function skippedNotes(source: SourceId, name: DatasetName, skipped: readonly SkippedRow[]) {
    const notes = SKIPPED[source];
    if (!notes) return null;
    const { [name]: earlier, ...others } = store.get(notes) ?? {};
    if (!earlier && !skipped.length) return null;
    return { name: notes, value: skipped.length ? { ...others, [name]: [...skipped] } : others };
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
      set: async (name, value, skipped = []) => {
        if (!current()) return false;
        const changed = await store.set(name, value, clock.now());
        kept.leftOut(name, skipped);
        if (skipped.length) log.add("warn", name, skipped.length === 1 ? "1 row left out" : `${skipped.length} rows left out`);
        // Read again but unchanged: plans that look at when it was read still need to know.
        if (!changed) alerts.touched(name);
        const notes = skippedNotes(source, name, skipped);
        if (notes) await store.set(notes.name, notes.value, clock.now());
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

  async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const before = settings;
    settings = Settings.parse({ ...settings, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) });
    await saveState();
    deps.emit({ type: "settings", settings });
    if (reportSendingOf(settings) !== reportSendingOf(before) || settings.reportAsked !== before.reportAsked) outbox.chose(reportSendingOf(settings));
    return settings;
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
      await outbox.load();
      for (const [source, name] of [
        ["edunex", "edunex.account"],
        ["six", "six.student"],
      ] as const) {
        const nim = store.get(name)?.nim;
        if (nim) students.set(source, nim);
      }
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
          const feeds = FeedHistories.safeParse(saved.feeds ?? {});
          if (feeds.success) kept.remember(feeds.data as Record<string, FeedHistory>);
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
      outbox.stop();
    },

    session(source) {
      return sessions.get(source) ?? null;
    },

    snapshot() {
      return { version: deps.version, datasets: store.snapshot(), statuses: [...statuses.values()], settings, relay: outbox.on };
    },

    async signIn(id, raw) {
      const source = sources.get(id);
      if (!source?.session) throw new EngineError("Rejected", `${id} has no sign-in`);
      const parsed = source.session.safeParse(raw);
      if (!parsed.success) throw new EngineError("Rejected", `That isn't a ${id} session`);
      log.add("info", id, "signing in");
      endSession(id);
      await vault.set(sessionKey(id), JSON.stringify({ ...parsed.data, savedAt: clock.now() }));
      setStatus(id, { state: "connecting", detail: null, changedPages: undefined });
      startSource(source, parsed.data);
      // Whose session this is comes first: a different Student's data must be gone before anything new lands.
      await checkLiveness(id);
      await scheduler.runNow((name) => sourceOf(name) === id && name !== source.liveness);
    },

    async signOut(only) {
      // What the app did for this Student is theirs alone: the next one's reports start without it.
      log.clear();
      for (const source of sources.values()) {
        if (!source.session || (only && source.id !== only)) continue;
        endSession(source.id);
        kept.forgetReads(source.id);
        students.delete(source.id);
        await vault.delete(sessionKey(source.id));
        await store.remove(`${source.id}.`);
        setStatus(source.id, { state: "signed-out", updatedAt: null, detail: null, changedPages: undefined });
        // Nothing reads Edunex any more: no warning that it hasn't.
        if (source.id === "edunex") phone.checked(null);
      }
      // Signing out of everything also forgets what the Student entered (their
      // courses' own attendance targets too), and the next Student on this
      // computer gets their own first-run scan and guide.
      if (!only) {
        await store.remove("local.");
        await alerts.reset();
        // Whether reports go by themselves was this Student's to say: the next one is asked again.
        await outbox.reset();
        if (
          settings.firstScanDone ||
          settings.guideDone !== false ||
          Object.keys(settings.attendanceTargets).length > 0 ||
          reportSendingOf(settings) !== "ask" ||
          settings.reportAsked
        ) {
          settings = { ...settings, firstScanDone: false, guideDone: false, attendanceTargets: {}, reportSending: "ask", reportAsked: false };
          await saveState();
          deps.emit({ type: "settings", settings });
        }
      }
    },

    async setLocal(name, value) {
      if (!name.startsWith("local.") || !Object.hasOwn(Datasets, name)) throw new EngineError("Rejected", `${name} isn't kept on this computer`);
      // The window saves the courses' remembered colors by itself, as they show: one that arrives after signing out of
      // everything (or before anyone signed in) belongs to nobody, and would outlive the data it came from. So would a
      // highlight made in a file still open as everything was signed out.
      if ((name === "local.courseColors" || name === "local.highlights") && !store.get("edunex.account") && !store.get("six.student"))
        throw new EngineError("Rejected", `${name} is kept only while someone is signed in`);
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
        const done = await action(contextFor(id), sessions.get(id), input);
        log.add("info", `${id}.${name}`, "ok");
        return done;
      } catch (error) {
        log.add(levelOf(error), `${id}.${name}`, errorLine(error));
        // A refusal asks the liveness check, which alone may end the session. No answer at all asks every
        // signed-in source, so the status says what's reachable within seconds, not at the next sync.
        if (isEngineError(error, "Unauthorized")) void checkLiveness(id);
        else if (isEngineError(error, "Offline") && error.unreachable) for (const signedIn of sessions.keys()) void checkLiveness(signedIn);
        throw error;
      }
    },

    updateSettings,

    markAlertsRead() {
      return alerts.markRead();
    },

    async checkForUpdates() {
      return updates ? updates.checkNow() : "off";
    },

    report(about) {
      return reportOf(about);
    },

    reports: {
      send: (report, details) => outbox.send(report, details),
      note: (id, note) => outbox.note(id, note),
      async dismiss() {
        // Closing the question asked once answers it with the default: ask each time.
        if ((await outbox.dismiss()) && !settings.reportAsked) await updateSettings({ reportAsked: true });
      },
      filed: (issue) => outbox.filed(issue),
      idle: () => outbox.idle(),
    },

    phone,
  };
}
