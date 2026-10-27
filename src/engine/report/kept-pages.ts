// The pages behind a read that went wrong, kept for "Laporkan masalah" (./report.ts): a page whose
// layout the app doesn't know, or one with rows it left out. They're the Student's own pages as SIX
// and Edunex sent them, so they stay in memory only: never on disk, never sent to the window, the
// latest read per feed, and gone when its source signs out. A read that goes right again forgets
// its feed's, since there's nothing left to report.
//
// Which pages a read got is noted as it runs: the engine runs each feed's read inside `during`, and
// its door to the network (`saw`) and to the store (`leftOut`) note what passes, for the read
// they're part of, whichever feed it is and however its requests queue.
import { AsyncLocalStorage } from "node:async_hooks";
import { type DatasetName, Datasets, type SkippedRow, type SourceId } from "../../core/models";
import { type EngineError, isEngineError } from "../errors";
import type { AnswerCheck } from "../http/transport";

/** A response as it came: where from, its status, its body (SIX's HTML, Edunex's JSON). */
export interface KeptPage {
  url: string;
  status: number;
  body: string;
  /** How its caller checked it (an Edunex answer against its schema), to check the scrubbed one the same way. */
  check?: AnswerCheck;
}

/** One feed's latest read that went wrong. */
export interface Kept {
  feed: string;
  /** Its page changed (`check`: what didn't fit), or it read with rows left out (`rows`). */
  kind: "changed" | "skipped";
  check: string;
  rows: SkippedRow[];
  /** What the feed fills (FeedSpec.shows), or the datasets its rows were left out of. */
  datasets: DatasetName[];
  at: number;
  pages: KeptPage[];
  /** What the Student lost: the datasets its rows were left out of, or for a page that changed, every one the feed fills, as far as the app knows. */
  affects: DatasetName[];
  /** When this feed last read with nothing wrong; null: never, as far as the app knows. */
  lastGoodAt: number | null;
}

/** What the app knows of a feed's reads besides the one kept: what they store, and when one last went right. Saved with the app's state. */
export interface FeedHistory {
  fills: DatasetName[];
  goodAt: number | null;
}

/** A page this big isn't kept: no SIX page the app reads comes near it. */
const MAX_PAGE = 2_000_000;
/** The last pages a read got are the ones it was reading when it stopped. */
const MAX_PAGES = 6;

interface Read {
  pages: KeptPage[];
  leftOut: { dataset: DatasetName; rows: readonly SkippedRow[] }[];
  /** Every dataset the read stored. */
  stored: Set<DatasetName>;
}

/** A page change, as the engine counts one (VendorChanged, Failed, Rejected): not a session or a connection. */
export const isChange = (error: unknown): error is EngineError =>
  isEngineError(error) && (error.kind === "VendorChanged" || error.kind === "Failed" || error.kind === "Rejected");

/** Who hears when a problem is kept (again) and when it's forgotten: the reports that send themselves (./outbox.ts). */
export interface KeptEvents {
  kept?(kept: Kept): void;
  /** `readWell`: its page read well again (not its source signing out). */
  forgotten?(kept: Kept, readWell: boolean): void;
}

export class KeptPages {
  private readonly reads = new AsyncLocalStorage<Read>();
  private readonly kept = new Map<string, Kept>();
  private readonly history = new Map<string, FeedHistory>();

  constructor(private readonly events: KeptEvents = {}) {}

  /**
   * Runs one read of `feed`, noting the pages it gets, then keeps them if it went wrong (an error
   * that's a page change, or rows left out) or forgets the feed's if it went right. `shows`: what
   * the feed fills. A read whose session ended meanwhile (`current()` false) keeps nothing: its
   * Student may have signed out. Errors pass through as they are.
   */
  async during(
    { feed, shows, now, current }: { feed: string; shows: readonly DatasetName[] | undefined; now: () => number; current: () => boolean },
    read: () => Promise<void>,
  ): Promise<void> {
    const notes: Read = { pages: [], leftOut: [], stored: new Set() };
    try {
      await this.reads.run(notes, read);
    } catch (error) {
      if (isChange(error) && current()) {
        const datasets = [...(shows ?? [])];
        // Every dataset the page fills is out of date: what the feed says, or what its reads have stored.
        const fills = shows ?? this.history.get(feed)?.fills ?? (Object.hasOwn(Datasets, feed) ? [feed as DatasetName] : []);
        this.keep(feed, { kind: "changed", check: error.message, rows: [], datasets, affects: [...fills], at: now() }, pagesFor(feed, error, notes.pages));
      }
      throw error;
    }
    if (!current()) return;
    const rows = notes.leftOut.flatMap((left) => left.rows);
    const before = this.history.get(feed);
    const fills = notes.stored.size ? [...notes.stored] : (before?.fills ?? []);
    if (!rows.length) {
      const was = this.kept.get(feed);
      if (was && this.kept.delete(feed)) this.events.forgotten?.(was, true);
      this.history.set(feed, { fills, goodAt: now() });
      return;
    }
    this.history.set(feed, { fills, goodAt: before?.goodAt ?? null });
    const datasets = [...new Set(notes.leftOut.filter((left) => left.rows.length).map((left) => left.dataset))];
    this.keep(feed, { kind: "skipped", check: rows[0]!.why, rows, datasets, affects: datasets, at: now() }, notes.pages);
  }

  /** A response came for the read under way (if any). */
  saw(page: KeptPage): void {
    const notes = this.reads.getStore();
    if (!notes || page.body.length > MAX_PAGE) return;
    notes.pages.push(page);
    if (notes.pages.length > MAX_PAGES) notes.pages.shift();
  }

  /** The read under way stored `dataset`, with these rows left out. */
  leftOut(dataset: DatasetName, rows: readonly SkippedRow[]): void {
    const notes = this.reads.getStore();
    notes?.stored.add(dataset);
    if (rows.length) notes?.leftOut.push({ dataset, rows });
  }

  /** What's kept for `source`'s feeds (every source without one), the latest first. */
  list(source?: SourceId): Kept[] {
    return [...this.kept.values()].filter((kept) => !source || kept.feed.startsWith(`${source}.`)).sort((a, b) => b.at - a.at);
  }

  /** The source signed out, its session ended or another Student's began: its pages go. */
  forget(source: SourceId): void {
    for (const [feed, was] of [...this.kept])
      if (feed.startsWith(`${source}.`)) {
        this.kept.delete(feed);
        this.events.forgotten?.(was, false);
      }
  }

  /** The source signed out, or another Student's data arrived: what its feeds' reads did before is no one's now. */
  forgetReads(source: SourceId): void {
    for (const feed of [...this.history.keys()]) if (feed.startsWith(`${source}.`)) this.history.delete(feed);
  }

  /** Every feed's history, to save with the app's state. */
  histories(): Record<string, FeedHistory> {
    return Object.fromEntries(this.history);
  }

  /** The feeds' history as it was saved. */
  remember(saved: Record<string, FeedHistory>): void {
    for (const [feed, history] of Object.entries(saved)) this.history.set(feed, history);
  }

  private keep(feed: string, kept: Omit<Kept, "feed" | "pages" | "lastGoodAt">, pages: KeptPage[]): void {
    const whole = { feed, ...kept, pages, lastGoodAt: this.history.get(feed)?.goodAt ?? null };
    this.kept.set(feed, whole);
    this.events.kept?.(whole);
  }
}

/**
 * The pages to keep from a read that failed. Edunex's checks name the call that didn't fit
 * ("/course/tasks: 0.title Required"), so that answer alone; a SIX read gets a page or three, and
 * a check on one is often about another (the transcript's rows against the IPK on the progress
 * page), so all of them.
 */
function pagesFor(feed: string, error: EngineError, pages: KeptPage[]): KeptPage[] {
  if (!feed.startsWith("edunex.")) return pages;
  const named = pages.filter((page) => {
    const path = new URL(page.url).pathname;
    return error.message.startsWith(`${path}:`) || error.message.endsWith(` ${path}`);
  });
  return named.length ? named.slice(-1) : pages.slice(-1);
}
