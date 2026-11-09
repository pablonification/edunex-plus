// One line per website. Everything the app reads from a site (SIX's signed-in
// pages and its public course catalog both live on six.itb.ac.id) waits its
// turn in the same line, keeps its gap since the last request to that site
// started, and stops while the site has asked to be left alone (429). A line
// lets one request through at a time, or a few for a site built for it
// (Edunex's API: 2, as SITE_LIMITS says).
import { type Clock, sleep, type TimerHandle } from "../clock";

/** How many requests a site gets at once; 1 for any other. Never more than 2: the app is one Student's. */
export const SITE_LIMITS: Readonly<Record<string, number>> = { "api-edunex.cognisia.id": 2 };
/**
 * The shortest gap a site keeps between requests (SIX's 2 s, ./six/client.ts): the line chooses who goes next
 * only once it's over, so a page asked for meanwhile (today's timetable, once the status page says whose it is)
 * can still go first. It never lets a request go sooner: each still keeps its own gap.
 */
export const SITE_GAPS: Readonly<Record<string, number>> = { "six.itb.ac.id": 2_000 };

/**
 * Where a request waits: "first", before everything (what the Student just did, and waits on); "normal", in the
 * order asked; "behind", after every normal one (SIX's records, and the public catalog's pages that name the Student's courses);
 * "background", after all the others (the rest of the catalog, read for the planner).
 */
export type Place = "first" | "normal" | "behind" | "background";
const PLACES: readonly Place[] = ["first", "normal", "behind", "background"];

export class Pace {
  private readonly waiting: { work: () => Promise<unknown>; place: Place; done(run: Promise<unknown>): void }[] = [];
  private running = 0;
  private lastStart = Number.NEGATIVE_INFINITY;
  private holding: TimerHandle | null = null;
  /** Until when the site asked to be left alone (ms). */
  pausedUntil = 0;

  constructor(
    private readonly clock: Clock,
    /** At most this many at once. */
    private readonly limit = 1,
    /** Who goes next is chosen this long after the last request started (SITE_GAPS). */
    private readonly holdMs = 0,
  ) {}

  /**
   * The site didn't answer at all (no connection, or too slow): every feed's request still waiting fails with `error`
   * without being sent, instead of each waiting its turn to time out too. They're tried again on their own schedule.
   * The Student's own ("first": a hand-in, a comment) stay in line and are sent: they'd only fail without being tried.
   */
  giveUp(error: Error): void {
    const kept = this.waiting.filter((entry) => entry.place === "first");
    for (const entry of this.waiting.splice(0)) if (entry.place !== "first") entry.done(Promise.reject(error));
    this.waiting.push(...kept);
  }

  /** Runs `work` once a request before it on this site is done (one at a time, or `limit`), in its `place`. */
  turn<T>(work: () => Promise<T>, place: Place = "normal"): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiting.push({ work, place, done: (run: Promise<unknown>) => (run as Promise<T>).then(resolve, reject) });
      this.next();
    });
  }

  private next(): void {
    if (this.running >= this.limit || !this.waiting.length || this.holding) return;
    const hold = this.lastStart + this.holdMs - this.clock.now();
    if (hold > 0) {
      this.holding = this.clock.setTimeout(() => {
        this.holding = null;
        this.next();
      }, hold);
      return;
    }
    const rank = Math.min(...this.waiting.map((entry) => PLACES.indexOf(entry.place)));
    const at = this.waiting.findIndex((entry) => PLACES.indexOf(entry.place) === rank);
    const [entry] = this.waiting.splice(at, 1);
    this.running++;
    const run = Promise.resolve().then(entry!.work);
    entry!.done(run);
    void run
      .catch(() => undefined)
      .then(() => {
        this.running--;
        this.next();
      });
    this.next();
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
