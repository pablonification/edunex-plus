// How SIX-reading code asks for pages. The SIX client (#76) implements it:
// one page at a time at human pace, a redirect to /login ends the session
// (Unauthorized), a rate-limit answer pauses SIX (Offline).
import type { FeedRead } from "../../report/kept-pages";

export interface SixIdentity {
  nim: string;
  /** SIX's own id for the Student, used in page addresses. */
  studentId: string;
  /** "2026-1". */
  term: string;
}

export interface SixPages {
  /** Who is signed in, found from SIX's first pages (cached for the session). */
  who(): Promise<SixIdentity>;
  /**
   * The HTML of a SIX page, by path ("/app/mahasiswa:18223901/statusmhs").
   * `popup`: a piece SIX's own page loads into a popup (a class meeting on the
   * timetable), asked for the way that page asks.
   */
  page(path: string, options?: { popup?: boolean }): Promise<string>;
  /**
   * These pages for one feed run, noted for its report (FeedSpec.run). The SIX client has it; pages
   * that don't come through the engine's door to the network (a test's) have nothing to note.
   */
  for?(read: FeedRead): SixPages;
}

/** `pages` for one feed run (SixPages.for), or as they are when there's nothing to note. */
export const pagesFor = (pages: SixPages, read: FeedRead): SixPages => pages.for?.(read) ?? pages;
