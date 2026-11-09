// One scheduler for every feed. Each feed keeps its own cadence (with jitter,
// so the app never hits a service on the dot) and its own back-off: a feed
// that keeps failing slows down alone and never delays the others. When many
// run at once (a start, a refresh), each source reads in turns: what Beranda
// shows for today and what's due first, the rest once that's in (FeedSpec.priority).
import type { Clock, TimerHandle } from "../clock";

/** A feed's turn when many run at once: "now" (today and what's due), "soon" (the rest), "later" (records that change by the day). */
export type Priority = "now" | "soon" | "later";
const TURNS: readonly Priority[] = ["now", "soon", "later"];

export interface FeedSpec {
  name: string;
  /** Its turn when many run at once; "soon" by default. */
  priority?: Priority;
  /** Normal time between runs (ms). */
  every: number;
  /** Up to this much is added or removed at random each time (ms). */
  jitter: number;
  run(): Promise<void>;
}

interface FeedState {
  spec: FeedSpec;
  timer: TimerHandle | null;
  failures: number;
  running: Promise<void> | null;
  /** What its last run failed with; null when it worked. */
  lastError: unknown;
  /** Waiting for its turn in a start's or a refresh's turns (inTurns). */
  queued: boolean;
}

const FIRST_RETRY = 30_000;
const MAX_BACKOFF = 15 * 60_000;

export class Scheduler {
  private readonly feeds = new Map<string, FeedState>();
  private started = false;

  constructor(
    private readonly clock: Clock,
    private readonly onError: (feed: string, error: unknown) => void,
    private readonly random: () => number = Math.random,
    /** Whether a failure says the site can't be reached at all: when every feed of a turn failed so, the rest wait. */
    private readonly unreachable: (error: unknown) => boolean = () => false,
  ) {}

  add(spec: FeedSpec): void {
    this.remove(spec.name);
    const state: FeedState = { spec, timer: null, failures: 0, running: null, lastError: null, queued: false };
    this.feeds.set(spec.name, state);
    // Added while running: a sign-in, which runs its source's feeds in turns at once (runNow). Its next run otherwise.
    if (this.started) this.plan(state, spec.every);
  }

  remove(name: string): void {
    const state = this.feeds.get(name);
    if (state?.timer) this.clock.clearTimeout(state.timer);
    if (state) state.queued = false;
    this.feeds.delete(name);
  }

  /**
   * Starts every feed now, in turns (inTurns). `wait`, when given, says how long a feed may still wait (its data is
   * fresh): those run when they're due instead of now.
   */
  start(wait?: (spec: FeedSpec) => number): void {
    this.started = true;
    const due: FeedState[] = [];
    for (const state of this.feeds.values()) {
      const fresh = wait ? wait(state.spec) : 0;
      if (fresh > 0) this.plan(state, fresh);
      else due.push(state);
    }
    for (const state of due) state.queued = true;
    // On the clock, as every run is: started, nothing has gone out yet.
    this.clock.setTimeout(() => void this.inTurns(due), 0);
  }

  stop(): void {
    this.started = false;
    for (const state of this.feeds.values()) {
      if (state.timer) this.clock.clearTimeout(state.timer);
      state.timer = null;
      state.queued = false;
    }
  }

  /** Runs the matching feeds right away, in turns (a manual refresh, or a new session). */
  async runNow(match: (name: string) => boolean = () => true): Promise<void> {
    const states = [...this.feeds.values()].filter((s) => match(s.spec.name));
    for (const state of states) state.queued = true;
    await this.inTurns(states);
  }

  /** Whether a feed has a run planned (for tests). */
  isPlanned(name: string): boolean {
    const state = this.feeds.get(name);
    return Boolean(state && (state.timer !== null || state.queued));
  }

  /**
   * Runs `states` source by source, each source in turns: its "now" feeds together, then its "soon" ones once those
   * are done, then its "later" ones. Sources don't wait for each other (they're different sites). Within a turn the
   * most frequent go first: on a site that answers one request at a time, what changes by the minute isn't kept
   * waiting behind what changes once a day. A feed that ran meanwhile (another one started it) isn't run again. When
   * every feed of a turn got no answer at all, the source's later turns are left to their own schedule.
   */
  private async inTurns(states: readonly FeedState[]): Promise<void> {
    const bySource = new Map<string, FeedState[]>();
    for (const state of states) {
      const source = state.spec.name.split(".")[0]!;
      bySource.set(source, [...(bySource.get(source) ?? []), state]);
    }
    await Promise.all(
      [...bySource.values()].map(async (feeds) => {
        for (const turn of TURNS) {
          const now = this.byCadence(feeds.filter((s) => (s.spec.priority ?? "soon") === turn));
          await Promise.all(now.map((s) => (s.queued && this.feeds.get(s.spec.name) === s ? this.run(s) : (s.running ?? undefined))));
          // Every feed of the turn got no answer at all: the rest would wait for none too. They run on their own schedule.
          if (now.length > 0 && now.every((s) => s.failures > 0 && this.unreachable(s.lastError))) {
            for (const state of feeds) {
              if (!state.queued) continue;
              state.queued = false;
              // Started with nothing else planned for it: it tries again as a failed feed would.
              if (this.started && !state.timer && this.feeds.get(state.spec.name) === state) this.plan(state, FIRST_RETRY);
            }
            break;
          }
        }
      }),
    );
  }

  private byCadence(states: FeedState[]): FeedState[] {
    return states.sort((a, b) => a.spec.every - b.spec.every);
  }

  private plan(state: FeedState, delay: number): void {
    if (state.timer) this.clock.clearTimeout(state.timer);
    state.timer = this.clock.setTimeout(() => {
      state.timer = null;
      void this.run(state);
    }, delay);
  }

  private run(state: FeedState): Promise<void> {
    state.queued = false;
    if (state.running) return state.running;
    if (state.timer) {
      this.clock.clearTimeout(state.timer);
      state.timer = null;
    }
    state.running = (async () => {
      try {
        await state.spec.run();
        state.failures = 0;
        state.lastError = null;
      } catch (error) {
        state.failures += 1;
        state.lastError = error;
        this.onError(state.spec.name, error);
      } finally {
        state.running = null;
        if (this.started && this.feeds.get(state.spec.name) === state) this.plan(state, this.delayAfter(state));
      }
    })();
    return state.running;
  }

  private delayAfter(state: FeedState): number {
    const { every, jitter } = state.spec;
    const wobble = (this.random() * 2 - 1) * jitter;
    if (state.failures === 0) return Math.max(1_000, every + wobble);
    // After a failure: try again soon, then less and less often (30 s, 1, 2, 4, 8, 15 min).
    return Math.min(MAX_BACKOFF, FIRST_RETRY * 2 ** (state.failures - 1)) + Math.abs(wobble) / 4;
  }
}
