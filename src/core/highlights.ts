// Highlights ("Sorotan") as the Student makes and changes them in a file they
// read in the app: the highlighter's colors, adding (the same text again only
// takes the new color), changing a color, removing and putting back, the caps,
// and finding a highlight's text again where the page's text reads a little
// differently now (a later pdf.js splitting a line another way). And the notes
// kept with them ("Catatan halaman"): one a PDF page, or one for a whole Word
// document or text file, written, emptied away and put back. Pure: the viewer
// works out the text and its offsets, and saves what these return.
import {
  type Highlight,
  type HighlightedFile,
  MAX_FILE_HIGHLIGHTS,
  MAX_FILE_NOTES,
  MAX_HIGHLIGHT_FILES,
  MAX_HIGHLIGHTS,
  MAX_NOTE,
  MAX_NOTES,
  MAX_QUOTE,
  type PageNote,
} from "./models/highlights";

/** The highlighter's colors, in the order the toolbar offers them; yellow first, as a highlighter is. */
export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];
export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = "yellow";

/** The color a highlight is drawn in: one this version doesn't know (a later one's) as yellow. */
export function colorOf(id: string): HighlightColor {
  return (HIGHLIGHT_COLORS as readonly string[]).includes(id) ? (id as HighlightColor) : DEFAULT_HIGHLIGHT_COLOR;
}

/** What's kept of a highlight's text. */
export const quoteOf = (text: string): string => text.slice(0, MAX_QUOTE);

/** One file's highlights, in the order they were made. */
export function highlightsIn(files: readonly HighlightedFile[] | undefined, file: string): readonly Highlight[] {
  return files?.find((entry) => entry.file === file)?.highlights ?? [];
}

/** The same text: the same page, from the same character to the same one. */
const sameText = (a: Highlight, b: Highlight) => a.page === b.page && a.start === b.start && a.end === b.end;

/** Highlights made in a file. One over text already highlighted the same way takes its place (its color changes); the rest join. */
export function addHighlights(files: readonly HighlightedFile[], file: string, added: readonly Highlight[], now: number): HighlightedFile[] {
  return change(files, file, now, (list) =>
    added.reduce<Highlight[]>((next, highlight) => [...next.filter((old) => old.id !== highlight.id && !sameText(old, highlight)), highlight], [...list]),
  );
}

export function recolorHighlight(files: readonly HighlightedFile[], file: string, id: string, color: string, now: number): HighlightedFile[] {
  return change(files, file, now, (list) => list.map((highlight) => (highlight.id === id ? { ...highlight, color, at: now } : highlight)));
}

export function removeHighlight(files: readonly HighlightedFile[], file: string, id: string, now: number): HighlightedFile[] {
  return change(files, file, now, (list) => list.filter((highlight) => highlight.id !== id));
}

/** A highlight removed, put back (Undo); no second copy when it's back already. */
export const restoreHighlight = (files: readonly HighlightedFile[], file: string, highlight: Highlight, now: number): HighlightedFile[] =>
  addHighlights(files, file, [highlight], now);

const change = (files: readonly HighlightedFile[], file: string, now: number, update: (list: readonly Highlight[]) => Highlight[]): HighlightedFile[] =>
  changeFile(files, file, now, (entry) => ({ ...entry, highlights: update(entry.highlights) }));

interface Marks {
  highlights: readonly Highlight[];
  notes: readonly PageNote[];
}

/** One file's highlights and notes changed: it's first now, and it's kept while it has either. */
function changeFile(files: readonly HighlightedFile[], file: string, now: number, update: (entry: Marks) => Marks): HighlightedFile[] {
  const next = update({ highlights: highlightsIn(files, file), notes: notesIn(files, file) });
  const highlights = next.highlights.slice(-MAX_FILE_HIGHLIGHTS);
  const notes = next.notes.slice(0, MAX_FILE_NOTES);
  const rest = files.filter((entry) => entry.file !== file);
  // No notes, no field: what's saved stays as older versions read it.
  const entry: HighlightedFile = { file, at: now, highlights, ...(notes.length ? { notes } : {}) };
  return pruneHighlights(highlights.length || notes.length ? [entry, ...rest] : rest);
}

/** Within the caps, the files changed most recently first: past them, the ones changed longest ago go, whole. */
export function pruneHighlights(files: readonly HighlightedFile[]): HighlightedFile[] {
  const kept: HighlightedFile[] = [];
  let total = 0;
  let noted = 0;
  for (const entry of [...files].sort((a, b) => b.at - a.at)) {
    const notes = entry.notes?.length ?? 0;
    if (!entry.highlights.length && !notes) continue;
    if (kept.length === MAX_HIGHLIGHT_FILES || total + entry.highlights.length > MAX_HIGHLIGHTS || noted + notes > MAX_NOTES) break;
    kept.push(entry);
    total += entry.highlights.length;
    noted += notes;
  }
  return kept;
}

/** One file's notes, by page (the whole file's, which has none, first). */
export function notesIn(files: readonly HighlightedFile[] | undefined, file: string): readonly PageNote[] {
  return files?.find((entry) => entry.file === file)?.notes ?? [];
}

/** The note on a page (`page` none: on the whole file). */
export const noteOn = (notes: readonly PageNote[], page: number | undefined): PageNote | undefined => notes.find((note) => note.page === page);

const byPage = (a: PageNote, b: PageNote) => (a.page ?? 0) - (b.page ?? 0);
const changeNotes = (files: readonly HighlightedFile[], file: string, now: number, update: (notes: readonly PageNote[]) => PageNote[]) =>
  changeFile(files, file, now, (entry) => ({ ...entry, notes: update(entry.notes).sort(byPage) }));

/**
 * What the Student wrote on a page (`page` none: on the whole file), kept as
 * written, up to MAX_NOTE characters; nothing but spaces and line breaks
 * removes the note.
 */
export function setNote(files: readonly HighlightedFile[], file: string, page: number | undefined, text: string, now: number): HighlightedFile[] {
  const kept = text.slice(0, MAX_NOTE);
  return changeNotes(files, file, now, (notes) => {
    const others = notes.filter((note) => note.page !== page);
    return kept.trim() ? [...others, { ...(page ? { page } : {}), text: kept, at: now }] : others;
  });
}

export const removeNote = (files: readonly HighlightedFile[], file: string, page: number | undefined, now: number): HighlightedFile[] =>
  setNote(files, file, page, "", now);

/** A note removed, put back (Undo); not over one written on its page since, which stays. */
export const restoreNote = (files: readonly HighlightedFile[], file: string, note: PageNote, now: number): HighlightedFile[] =>
  changeNotes(files, file, now, (notes) => (noteOn(notes, note.page) ? [...notes] : [...notes, note]));

/** The part of `text` from `start` to `end` without the spaces and line breaks at its ends; null when that's all it is. */
export function trimmed(text: string, start: number, end: number): { start: number; end: number } | null {
  let from = Math.max(0, start);
  let to = Math.min(text.length, end);
  while (from < to && /\s/.test(text[from])) from++;
  while (to > from && /\s/.test(text[to - 1])) to--;
  return to > from ? { start: from, end: to } : null;
}

/**
 * Where a highlight is in `text`, a page's text as the viewer reads it now:
 * where it was saved while that still reads the same, else the nearest place
 * its text is found; null when it isn't there any more (not drawn, still kept).
 */
export function locate(text: string, highlight: Pick<Highlight, "start" | "end" | "text">): { start: number; end: number } | null {
  const { text: quote } = highlight;
  const length = highlight.end - highlight.start;
  if (!quote || length < quote.length) return null;
  if (highlight.end <= text.length && text.startsWith(quote, highlight.start)) return { start: highlight.start, end: highlight.end };
  let best = -1;
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1))
    if (best === -1 || Math.abs(at - highlight.start) < Math.abs(best - highlight.start)) best = at;
  if (best === -1) return null;
  // Its whole text was kept: it ends where that does. Only its start was: it's as long as it was.
  return { start: best, end: quote.length === length ? best + length : Math.min(best + length, text.length) };
}
