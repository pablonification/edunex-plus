// Reading past a row the app doesn't understand. A service's page lists rows the app reads one by
// one (a term's bill, a course, a curriculum); a new kind of row the service starts showing some
// Students shouldn't make the whole page unreadable. That row is left out and kept, with what it
// shows and what didn't fit, so the screens can say so; the rest of the page still reads.
//
// What holds the rows stays strict: a table that's gone, its columns, a heading the rows under it
// belong to (a row read under the wrong term is worse than none). And a list with more rows the app
// didn't understand than rows it did isn't odd rows: the list itself changed (SIX writing every grade
// another way, say, with only this term's ungraded courses still read), and that's "SIX changed something".
import type { SkippedRow } from "../../core/models";
import { type EngineError, isEngineError } from "../errors";

/** Enough of a row to find it on the service's page. */
const ROW_LENGTH = 120;

/** The rows a read left out, across its page's lists. */
export class Skipped {
  readonly rows: SkippedRow[] = [];

  /** A list whose rows are read one by one with `SkipList.item`; `done()` after the last. */
  list(): SkipList {
    return new SkipList(this.rows);
  }

  /** Each of `items`, read with `read`; one it doesn't understand is left out. `row`: what that item shows. */
  each<I, T>(items: readonly I[], row: (item: I) => string, read: (item: I) => T): T[] {
    const list = this.list();
    const out: T[] = [];
    for (const item of items) {
      const value = list.item(row(item), () => read(item));
      if (value !== undefined) out.push(value);
    }
    list.done();
    return out;
  }
}

export class SkipList {
  private read = 0;
  private left = 0;
  private first: EngineError | null = null;

  constructor(private readonly into: SkippedRow[]) {}

  /**
   * One row: what `read` returns (never undefined), or undefined when it threw VendorChanged, the
   * row then kept as left out. Any other error isn't the row's: it goes on.
   */
  item<T>(row: string, read: () => T): T | undefined {
    try {
      const value = read();
      this.read += 1;
      return value;
    } catch (error) {
      if (!isEngineError(error, "VendorChanged")) throw error;
      this.first ??= error;
      this.left += 1;
      const text = row.replace(/\s+/g, " ").trim();
      this.into.push({ row: text.length > ROW_LENGTH ? `${text.slice(0, ROW_LENGTH - 1)}…` : text, why: error.message });
      return undefined;
    }
  }

  /** After the last row: when fewer were understood than left out, the list changed, not a row (the first row's reason is thrown). */
  done(): void {
    if (this.first && this.left > this.read) throw this.first;
  }
}
