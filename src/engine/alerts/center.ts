// The alert center: runs the detectors whenever a dataset they watch changes,
// raises time-based alerts on the engine's clock (re-planned when the data
// changes), and decides what reaches the Student. Rules:
// - never twice: every raised id goes into the seen-ledger, kept on disk;
// - the first value after sign-in is silent: what's already there counts as seen;
// - a burst is grouped into one notification per kind ("8 new Tasks");
//   urgent alerts (Presence opening, short-window Tasks) go out at once, alone;
// - a group turned off in Settings sends no OS notification but still lands
//   in the history ("app.alerts", newest first).
import type { Event } from "../../core/contract";
import { ALERT_GROUP, type Alert, type AlertHistory, type AlertKind, type AlertText, type DatasetName, type DatasetValue, type Settings } from "../../core/models";
import type { StringKey } from "../../core/strings";
import type { Clock, TimerHandle } from "../clock";
import type { Storage } from "../store/storage";
import type { AlertDraft, DatasetChange, Detector, DetectorContext, PlannedAlert } from "./detector";
import { SeenLedger } from "./ledger";

/** What goes out as one OS notification: a single alert, or a burst of one kind (`count` > 1). */
export interface AlertNotice extends Omit<Alert, "at"> {
  count: number;
}

/** Alerts that aren't urgent wait this long for others to group with. */
export const GROUP_WINDOW = 20_000;
/** How often the plan is checked again anyway (time passes, the computer slept). */
const HEARTBEAT = 5 * 60_000;
/** A detector's plan is worked out again at least this often, and when the WIB day turns. */
const PLAN_TTL = 60 * 60_000;
const DAY = 24 * 60 * 60_000;
const WIB = 7 * 60 * 60_000;
const wibDayIndex = (ms: number) => Math.floor((ms + WIB) / DAY);

/** A detector's plan as last worked out, and what it was worked out from. */
interface CachedPlan {
  items: PlannedAlert[];
  at: number;
  settings: Settings;
}
const HISTORY_LIMIT = 200;
const EMPTY: AlertHistory = { items: [], readAt: 0 };

export interface AlertCenterDeps {
  clock: Clock;
  storage: Storage;
  detectors: readonly Detector[];
  get<N extends DatasetName>(name: N): DatasetValue<N> | undefined;
  fetchedAt(name: DatasetName): number | null;
  set<N extends DatasetName>(name: N, value: DatasetValue<N>): Promise<unknown>;
  remove(prefix: string): Promise<void>;
  settings(): Settings;
  deliver(notice: AlertNotice): void;
}

export class AlertCenter {
  private readonly ledger: SeenLedger;
  private readonly watched: Set<DatasetName>;
  /** Plans change only with their data, the settings or the day: the 5-minute check reuses them. */
  private readonly plans = new Map<Detector, CachedPlan>();
  /** The last value of every watched dataset, to diff the next one against. */
  private readonly last = new Map<DatasetName, unknown>();
  private lastNim: string | null = null;
  private pending: Alert[] = [];
  private flushTimer: TimerHandle | null = null;
  private planTimers: TimerHandle[] = [];
  private running = false;
  private writes: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: AlertCenterDeps) {
    this.ledger = new SeenLedger(deps.storage);
    this.watched = new Set(deps.detectors.flatMap((detector) => detector.watches));
  }

  async load(): Promise<void> {
    await this.ledger.load();
    for (const name of this.watched) {
      const value = this.deps.get(name);
      if (value !== undefined) this.last.set(name, value);
    }
    this.lastNim = this.deps.get("edunex.account")?.nim ?? null;
  }

  start(): void {
    this.running = true;
    this.replan();
  }

  stop(): void {
    this.running = false;
    this.clearPlan();
    if (this.flushTimer) this.deps.clock.clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  /** Every dataset event the store sends. */
  observe(event: Event): void {
    if (event.type === "dataset.removed") {
      this.last.delete(event.name as DatasetName);
      this.touched(event.name as DatasetName);
      return;
    }
    if (event.type !== "dataset") return;
    const name = event.dataset.name as DatasetName;
    const next = event.dataset.value;
    if (name === "edunex.account") {
      // Another Student signed in on this computer: the last one's alerts go.
      const nim = (next as DatasetValue<"edunex.account">).nim;
      if (this.lastNim && nim !== this.lastNim) void this.reset();
      this.lastNim = nim;
    }
    if (!this.watched.has(name)) return;
    this.touched(name);
    const previous = this.last.get(name);
    this.last.set(name, next);
    const baseline = previous === undefined;
    const context = this.context();
    const change = { name, previous, next } as DatasetChange;
    const watching = this.deps.detectors.filter((detector) => detector.watches.includes(name));
    for (const detector of watching) this.accept(detector.changed?.(change, context) ?? [], baseline);
    this.replan(baseline ? new Set(watching) : undefined);
  }

  /** A dataset was read from its source, changed or not: plans built on it are worked out again. */
  touched(name: DatasetName): void {
    for (const detector of this.plans.keys()) if (detector.watches.includes(name)) this.plans.delete(detector);
  }

  async markRead(): Promise<void> {
    await this.writeHistory((history) => ({ ...history, readAt: this.deps.clock.now() }));
  }

  /** Signing out of everything, or another Student: forget every alert and what was seen. */
  async reset(): Promise<void> {
    this.pending = [];
    this.plans.clear();
    this.lastNim = null;
    this.writes = this.writes.then(async () => {
      await this.ledger.clear();
      await this.deps.remove("app.alerts");
    });
    await this.writes;
  }

  private context(): DetectorContext {
    return { now: this.deps.clock.now(), get: (name) => this.deps.get(name), fetchedAt: (name) => this.deps.fetchedAt(name), settings: this.deps.settings() };
  }

  /**
   * Takes in what detectors proposed. `silent`: a first sync, so it only
   * counts as seen. An id already waiting to go out is replaced by the newer
   * version (the Tasks dataset knows a Task better than Edunex's feed).
   */
  private accept(drafts: readonly AlertDraft[], silent: boolean): void {
    const now = this.deps.clock.now();
    const raised: Alert[] = [];
    for (const draft of drafts) {
      const { urgent, ...fields } = draft;
      const alert: Alert = { ...fields, at: now };
      if (this.ledger.has(draft.id)) {
        const waiting = this.pending.findIndex((p) => p.id === draft.id);
        if (silent || waiting < 0) continue;
        raised.push(alert);
        if (urgent) {
          this.pending.splice(waiting, 1);
          this.deliver([alert]);
        } else this.pending[waiting] = alert;
        continue;
      }
      this.ledger.add(draft.id, now);
      if (silent) continue;
      raised.push(alert);
      if (this.muted(alert.kind)) continue;
      if (urgent) this.deliver([alert]);
      else this.pending.push(alert);
    }
    if (this.pending.length && !this.flushTimer) this.flushTimer = this.deps.clock.setTimeout(() => this.flush(), GROUP_WINDOW);
    if (drafts.length) this.queue(() => this.ledger.save());
    if (raised.length) {
      void this.writeHistory((history) => {
        const ids = new Set(raised.map((a) => a.id));
        const items = [...raised.reverse(), ...history.items.filter((item) => !ids.has(item.id))].slice(0, HISTORY_LIMIT);
        return { ...history, items };
      });
    }
  }

  private muted(kind: AlertKind): boolean {
    return this.deps.settings().mutedAlerts.includes(ALERT_GROUP[kind]);
  }

  /** Sends what waited, one notification per kind. */
  private flush(): void {
    if (this.flushTimer) this.deps.clock.clearTimeout(this.flushTimer);
    this.flushTimer = null;
    const waiting = this.pending;
    this.pending = [];
    const kinds = [...new Set(waiting.map((alert) => alert.kind))];
    for (const kind of kinds) this.deliver(waiting.filter((alert) => alert.kind === kind));
  }

  private deliver(alerts: readonly Alert[]): void {
    const [first] = alerts;
    if (!first) return;
    const { at: _at, ...single } = first;
    try {
      this.deps.deliver(alerts.length === 1 ? { ...single, count: 1 } : grouped(alerts, this.deps.clock.now()));
    } catch (error) {
      // An OS notification that fails must never stop syncing; the history still has it.
      console.error("[alerts] delivery failed:", error);
    }
  }

  /** Raises the time-based alerts that are due and sets timers for the ones coming soon. */
  private replan(silentFor?: ReadonlySet<Detector>): void {
    this.clearPlan();
    if (!this.running) return;
    const { clock } = this.deps;
    const context = this.context();
    const now = context.now;
    for (const detector of this.deps.detectors) {
      if (!detector.plan) continue;
      const due: AlertDraft[] = [];
      for (const planned of this.planOf(detector, context)) {
        if (this.ledger.has(planned.id) || now >= planned.until) continue;
        const { at, until: _until, ...draft } = planned;
        if (at <= now) due.push(draft);
        else if (at - now <= HEARTBEAT) this.planTimers.push(clock.setTimeout(() => this.replan(), at - now));
      }
      // A watched dataset already stored but not yet announced (its write is still finishing) is a first sync too.
      const unseen = detector.watches.some((name) => !this.last.has(name) && this.deps.get(name) !== undefined);
      if (due.length) this.accept(due, unseen || (silentFor?.has(detector) ?? false));
    }
    this.planTimers.push(clock.setTimeout(() => this.replan(), HEARTBEAT));
  }

  private planOf(detector: Detector, context: DetectorContext): PlannedAlert[] {
    const cached = this.plans.get(detector);
    if (cached && cached.settings === context.settings && context.now - cached.at < PLAN_TTL && wibDayIndex(cached.at) === wibDayIndex(context.now)) return cached.items;
    const items = detector.plan!(context);
    this.plans.set(detector, { items, at: context.now, settings: context.settings });
    return items;
  }

  private clearPlan(): void {
    for (const timer of this.planTimers) this.deps.clock.clearTimeout(timer);
    this.planTimers = [];
  }

  private writeHistory(change: (history: AlertHistory) => AlertHistory): Promise<unknown> {
    return this.queue(() => this.deps.set("app.alerts", change(this.deps.get("app.alerts") ?? EMPTY)));
  }

  /** Disk writes happen one after another, in order. */
  private queue(work: () => Promise<unknown>): Promise<unknown> {
    this.writes = this.writes.then(work).catch((error) => console.error("[alerts] saving failed:", error));
    return this.writes;
  }
}

const GROUP_TITLE: Partial<Record<AlertKind, StringKey>> = {
  newTask: "alert.group.newTask",
  newMaterial: "alert.group.newMaterial",
  deadline: "alert.group.deadline",
  grade: "alert.group.grade",
};

/** One notification for a burst of one kind: "8 new Tasks", naming the first few. */
function grouped(alerts: readonly Alert[], now: number): AlertNotice {
  const kind = alerts[0].kind;
  const names = alerts.map((alert) => alert.body?.vars?.title ?? alert.title.vars?.course).filter((name) => name !== undefined).map(String);
  const body: AlertText =
    names.length > 3 ? { key: "alert.group.more", vars: { list: names.slice(0, 3).join(", "), count: names.length - 3 } } : { key: "alert.plain", vars: { title: names.join(", ") } };
  const targets = new Set(alerts.map((alert) => JSON.stringify(alert.target)));
  const target =
    targets.size === 1 ? alerts[0].target : kind === "newTask" || kind === "deadline" ? ({ screen: "tasks" } as const) : ({ screen: "home" } as const);
  return {
    id: `group:${kind}:${now}`,
    kind,
    source: alerts[0].source,
    title: { key: GROUP_TITLE[kind] ?? "alert.group.other", vars: { count: alerts.length } },
    body,
    target,
    count: alerts.length,
  };
}
