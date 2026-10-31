// One line per website. Everything the app reads from a site (SIX's signed-in
// pages and its public course catalog both live on six.itb.ac.id) waits its
// turn in the same line, keeps its gap since the last request to that site
// started, and stops while the site has asked to be left alone (429).
import { type Clock, sleep } from "../clock";

export class Pace {
  private readonly waiting: { work: () => Promise<unknown>; background: boolean; done(run: Promise<unknown>): void }[] = [];
  private busy = false;
  private lastStart = Number.NEGATIVE_INFINITY;
  /** Until when the site asked to be left alone (ms). */
  pausedUntil = 0;

  constructor(private readonly clock: Clock) {}

  /**
   * Runs `work` once the requests before it on this site are done, one at a time. A `background` request (the
   * public catalog, read for the planner) waits while any other is waiting: the Student's own pages go first.
   */
  turn<T>(work: () => Promise<T>, background = false): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiting.push({ work, background, done: (run) => (run as Promise<T>).then(resolve, reject) });
      this.next();
    });
  }

  private next(): void {
    if (this.busy || !this.waiting.length) return;
    const at = Math.max(
      0,
      this.waiting.findIndex((entry) => !entry.background),
    );
    const [entry] = this.waiting.splice(at, 1);
    this.busy = true;
    const run = Promise.resolve().then(entry!.work);
    entry!.done(run);
    void run
      .catch(() => undefined)
      .then(() => {
        this.busy = false;
        this.next();
      });
  }

  /** Waits until `gapMs` have passed since the last request to the site started, then marks this one's start. */
  async gap(gapMs: number): Promise<void> {
    const wait = this.lastStart + gapMs - this.clock.now();
    if (wait > 0) await sleep(this.clock, wait);
    this.lastStart = this.clock.now();
  }

  /** Counts the next gap from now: for callers whose slow answers must never shorten it. */
  touch(): void {
    this.lastStart = this.clock.now();
  }

  get paused(): boolean {
    return this.clock.now() < this.pausedUntil;
  }

  /** The site said "too many requests": nobody asks it anything before `until`. */
  pause(until: number): void {
    this.pausedUntil = Math.max(this.pausedUntil, until);
  }
}
