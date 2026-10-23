// The Student's highlights in the files they read in the app ("Sorotan"), and
// their notes on a PDF's pages or on a whole Word document or text file
// ("Catatan halaman"), kept on this computer ("local.highlights", saved with
// "local.set"), never sent to Edunex, and removed when they sign out of
// everything or a different Student signs in. By file: the SHA-256 of its
// bytes, so a file is the same one wherever it's listed and however Edunex
// signs its link today. A highlight is where its text is, not where it's
// drawn: the characters it covers in a PDF page's text (or a document's), so
// it survives zoom and redrawing, with its first words to find it again if the
// text has moved. A note is the page's, or the file's. The rules live in
// core/highlights.ts.
import { z } from "zod";

/**
 * A highlighter color's name ("yellow"), never renamed once released. The
 * format is checked, not the name: one a later version adds still loads (and
 * shows as yellow). Never narrow it.
 */
export const HighlightColorId = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);

/** The most highlights kept in all, the most in one file, and the most files: the oldest files go first past them. */
export const MAX_HIGHLIGHTS = 2_000;
export const MAX_FILE_HIGHLIGHTS = 500;
export const MAX_HIGHLIGHT_FILES = 300;
/** How much of a highlight's text is kept: enough to find it again and to name it to a screen reader. */
export const MAX_QUOTE = 160;
/** The most page notes kept in all and in one file, and the longest one (in characters): a slide's worth of thoughts, not a chapter. */
export const MAX_NOTES = 1_000;
export const MAX_FILE_NOTES = 500;
export const MAX_NOTE = 2_000;

export const Highlight = z
  .object({
    id: z.string().min(1).max(40),
    /** The PDF page (from 1) it's on; none in a file read as one text (a Word document, a text file). */
    page: z.number().int().min(1).max(100_000).optional(),
    /** The characters it covers in that page's text: from `start`, up to (not including) `end`. */
    start: z.number().int().min(0),
    end: z.number().int().min(1),
    color: HighlightColorId,
    /** Its text, up to MAX_QUOTE characters. */
    text: z.string().max(MAX_QUOTE),
    /** When it was made or last changed (ms). */
    at: z.number(),
  })
  .refine((highlight) => highlight.end > highlight.start, "A highlight covers some text");
export type Highlight = z.infer<typeof Highlight>;

export const PageNote = z.object({
  /** The PDF page (from 1) it's on; none for the note on a file read as one text (a Word document, a text file). */
  page: z.number().int().min(1).max(100_000).optional(),
  /** What the Student wrote, as they wrote it. */
  text: z.string().min(1).max(MAX_NOTE),
  /** When it was last changed (ms). */
  at: z.number(),
});
export type PageNote = z.infer<typeof PageNote>;

export const HighlightedFile = z.object({
  /** The file's SHA-256, in hex. */
  file: z.string().regex(/^[0-9a-f]{64}$/),
  /** When one of its highlights or notes last changed (ms): the files changed longest ago go first past the caps. */
  at: z.number(),
  highlights: z.array(Highlight).max(MAX_FILE_HIGHLIGHTS),
  /** Its notes, one a page at most (one in all for a file read as one text). Older versions saved none: left out means none. */
  notes: z.array(PageNote).max(MAX_FILE_NOTES).optional(),
});
export type HighlightedFile = z.infer<typeof HighlightedFile>;

export const highlightDatasets = {
  "local.highlights": z
    .array(HighlightedFile)
    .max(MAX_HIGHLIGHT_FILES)
    .refine((files) => files.reduce((sum, file) => sum + file.highlights.length, 0) <= MAX_HIGHLIGHTS, "Too many highlights")
    .refine((files) => files.reduce((sum, file) => sum + (file.notes?.length ?? 0), 0) <= MAX_NOTES, "Too many notes"),
} as const;
