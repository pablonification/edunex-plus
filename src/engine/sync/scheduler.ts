// One scheduler for every feed. Each feed keeps its own cadence (with jitter,
// so the app never hits a service on the dot) and its own back-off: a feed
// that keeps failing slows down alone and never delays the others.
import type { Clock, TimerHandle } from "../clock";

export interface FeedSpec {
  name: string;
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
  ) {}

  add(spec: FeedSpec): void {
    this.remove(spec.name);
    const state: FeedState = { spec, timer: null, failures: 0, running: null };
    this.feeds.set(spec.name, state);
    if (this.started) this.plan(state, 0);
  }

  remove(name: string): void {
    const state = this.feeds.get(name);
    if (state?.timer) this.clock.clearTimeout(state.timer);
    this.feeds.delete(name);
  }

  /** Starts every feed now, a few seconds apart. */
  start(): void {
    this.started = true;
    let delay = 0;
    for (const state of this.feeds.values()) {
      this.plan(state, delay);
      delay += 500;
    }
  }

  stop(): void {
    this.started = false;
    for (const state of this.feeds.values()) if (state.timer) this.clock.clearTimeout(state.timer);
  }

  /** Runs the matching feeds right away (a manual refresh, or a new session). */
  async runNow(match: (name: string) => boolean = () => true): Promise<void> {
    const runs = [...this.feeds.values()].filter((s) => match(s.spec.name)).map((s) => this.run(s));
    await Promise.all(runs);
  }

  /** Whether a feed has a run planned (for tests). */
  isPlanned(name: string): boolean {
    const state = this.feeds.get(name);
    return Boolean(state && state.timer !== null);
  }

  private plan(state: FeedState, delay: number): void {
    if (state.timer) this.clock.clearTimeout(state.timer);
    state.timer = this.clock.setTimeout(() => {
      state.timer = null;
      void this.run(state);
    }, delay);
  }

  private run(state: FeedState): Promise<void> {
    if (state.running) return state.running;
    if (state.timer) {
      this.clock.clearTimeout(state.timer);
      state.timer = null;
    }
    state.running = (async () => {
      try {
        await state.spec.run();
        state.failures = 0;
      } catch (error) {
        state.failures += 1;
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
