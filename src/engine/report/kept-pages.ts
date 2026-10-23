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
import type { DatasetName, SkippedRow, SourceId } from "../../core/models";
import { type EngineError, isEngineError } from "../errors";

/** A response as it came: where from, its status, its body (SIX's HTML, Edunex's JSON). */
export interface KeptPage {
  url: string;
  status: number;
  body: string;
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
}

/** A page this big isn't kept: no SIX page the app reads comes near it. */
const MAX_PAGE = 2_000_000;
/** The last pages a read got are the ones it was reading when it stopped. */
const MAX_PAGES = 6;

interface Read {
  pages: KeptPage[];
  leftOut: { dataset: DatasetName; rows: readonly SkippedRow[] }[];
}

/** A page change, as the engine counts one (VendorChanged, Failed, Rejected): not a session or a connection. */
const isChange = (error: unknown): error is EngineError =>
  isEngineError(error) && (error.kind === "VendorChanged" || error.kind === "Failed" || error.kind === "Rejected");

export class KeptPages {
  private readonly reads = new AsyncLocalStorage<Read>();
  private readonly kept = new Map<string, Kept>();

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
    const notes: Read = { pages: [], leftOut: [] };
    try {
      await this.reads.run(notes, read);
    } catch (error) {
      if (isChange(error) && current())
        this.keep(feed, { kind: "changed", check: error.message, rows: [], datasets: [...(shows ?? [])], at: now() }, pagesFor(feed, error, notes.pages));
      throw error;
    }
    if (!current()) return;
    const rows = notes.leftOut.flatMap((left) => left.rows);
    if (!rows.length) {
      this.kept.delete(feed);
      return;
    }
    const datasets = [...new Set(notes.leftOut.filter((left) => left.rows.length).map((left) => left.dataset))];
    this.keep(feed, { kind: "skipped", check: rows[0]!.why, rows, datasets, at: now() }, notes.pages);
  }

  /** A response came for the read under way (if any). */
  saw(page: KeptPage): void {
    const notes = this.reads.getStore();
    if (!notes || page.body.length > MAX_PAGE) return;
    notes.pages.push(page);
    if (notes.pages.length > MAX_PAGES) notes.pages.shift();
  }

  /** The read under way stored `dataset` with these rows left out. */
  leftOut(dataset: DatasetName, rows: readonly SkippedRow[]): void {
    if (rows.length) this.reads.getStore()?.leftOut.push({ dataset, rows });
  }

  /** What's kept for `source`'s feeds (every source without one), the latest first. */
  list(source?: SourceId): Kept[] {
    return [...this.kept.values()].filter((kept) => !source || kept.feed.startsWith(`${source}.`)).sort((a, b) => b.at - a.at);
  }

  /** The source signed out, its session ended or another Student's began: its pages go. */
  forget(source: SourceId): void {
    for (const feed of [...this.kept.keys()]) if (feed.startsWith(`${source}.`)) this.kept.delete(feed);
  }

  private keep(feed: string, kept: Omit<Kept, "feed" | "pages">, pages: KeptPage[]): void {
    this.kept.set(feed, { feed, ...kept, pages });
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
