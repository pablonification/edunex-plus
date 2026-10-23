// Highlights ("Sorotan") as the Student makes and changes them in a file they
// read in the app: the highlighter's colors, adding (the same text again only
// takes the new color), changing a color, removing one or all of a file's and
// putting them back, the caps, and finding a highlight's text again where the
// page's text reads a little differently now (a later pdf.js splitting a line
// another way). Pure: the viewer works out the text and its offsets, and saves
// what these return.
import { type Highlight, type HighlightedFile, MAX_FILE_HIGHLIGHTS, MAX_HIGHLIGHT_FILES, MAX_HIGHLIGHTS, MAX_QUOTE } from "./models/highlights";

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

/** Every highlight in a file, removed at once. */
export const clearHighlights = (files: readonly HighlightedFile[], file: string, now: number): HighlightedFile[] => change(files, file, now, () => []);

/** Highlights removed, put back (Undo); no second copy of one that's back already. */
export const restoreHighlights = (files: readonly HighlightedFile[], file: string, highlights: readonly Highlight[], now: number): HighlightedFile[] =>
  addHighlights(files, file, highlights, now);

function change(files: readonly HighlightedFile[], file: string, now: number, update: (list: readonly Highlight[]) => Highlight[]): HighlightedFile[] {
  const highlights = update(highlightsIn(files, file)).slice(-MAX_FILE_HIGHLIGHTS);
  const rest = files.filter((entry) => entry.file !== file);
  return pruneHighlights(highlights.length ? [{ file, at: now, highlights }, ...rest] : rest);
}

/** Within the caps, the files changed most recently first: past them, the ones changed longest ago go, whole. */
export function pruneHighlights(files: readonly HighlightedFile[]): HighlightedFile[] {
  const kept: HighlightedFile[] = [];
  let total = 0;
  for (const entry of [...files].sort((a, b) => b.at - a.at)) {
    if (!entry.highlights.length) continue;
    if (kept.length === MAX_HIGHLIGHT_FILES || total + entry.highlights.length > MAX_HIGHLIGHTS) break;
    kept.push(entry);
    total += entry.highlights.length;
  }
  return kept;
}

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
