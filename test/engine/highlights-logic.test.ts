// Highlights, seam 1: the rules alone. Making, recoloring, removing and
// putting back a highlight in a file; the notes kept with them, one a page
// (or one for a whole file); the caps, which let the files changed longest ago
// go first; and finding a highlight's text again in a page whose text reads a
// little differently now. Made-up lines of a course outline.
import { describe, expect, it } from "vitest";
import {
  addHighlights,
  colorOf,
  HIGHLIGHT_COLORS,
  highlightsIn,
  locate,
  notesIn,
  pruneHighlights,
  quoteOf,
  recolorHighlight,
  removeHighlight,
  removeNote,
  restoreHighlight,
  restoreNote,
  setNote,
  trimmed,
} from "../../src/core/highlights";
import {
  Datasets,
  type Highlight,
  type HighlightedFile,
  MAX_FILE_HIGHLIGHTS,
  MAX_HIGHLIGHT_FILES,
  MAX_HIGHLIGHTS,
  MAX_NOTE,
  MAX_NOTES,
} from "../../src/core/models";

const FILE = "a".repeat(64);
const OTHER = "b".repeat(64);
const PAGE = "Minggu 1: Pengantar\nCapaian: mahasiswa mampu menjelaskan konsep utama.";
const mark = (id: string, start: number, end: number, extra: Partial<Highlight> = {}): Highlight => ({
  id,
  page: 1,
  start,
  end,
  color: "yellow",
  text: quoteOf(PAGE.slice(start, end)),
  at: 1,
  ...extra,
});
const ids = (files: readonly HighlightedFile[], file = FILE) => highlightsIn(files, file).map((h) => `${h.id} ${h.color}`);

describe("the highlighter's colors", () => {
  it("are yellow first, then green, blue and pink; one a later version adds shows as yellow", () => {
    expect(HIGHLIGHT_COLORS).toEqual(["yellow", "green", "blue", "pink"]);
    expect(colorOf("green")).toBe("green");
    expect(colorOf("orange-2")).toBe("yellow");
  });
});

describe("making and changing highlights", () => {
  it("adds them to their file, newest last, and keeps other files as they were", () => {
    let files = addHighlights([], OTHER, [mark("o1", 0, 6)], 1);
    files = addHighlights(files, FILE, [mark("h1", 0, 6)], 2);
    files = addHighlights(files, FILE, [mark("h2", 20, 27, { color: "green" })], 3);
    expect(ids(files)).toEqual(["h1 yellow", "h2 green"]);
    expect(ids(files, OTHER)).toEqual(["o1 yellow"]);
    expect(files.map((f) => f.file)).toEqual([FILE, OTHER]);
    expect(Datasets["local.highlights"].safeParse(files).success).toBe(true);
  });

  it("the same text highlighted again takes the new color instead of a second highlight on top", () => {
    let files = addHighlights([], FILE, [mark("h1", 0, 6)], 1);
    files = addHighlights(files, FILE, [mark("h2", 0, 6, { color: "pink" })], 2);
    expect(ids(files)).toEqual(["h2 pink"]);
    // A part of it is a highlight of its own.
    files = addHighlights(files, FILE, [mark("h3", 0, 3, { color: "blue" })], 3);
    expect(ids(files)).toEqual(["h2 pink", "h3 blue"]);
  });

  it("changes a color, removes one, and puts it back once however often Undo is pressed", () => {
    let files = addHighlights([], FILE, [mark("h1", 0, 6), mark("h2", 20, 27)], 1);
    files = recolorHighlight(files, FILE, "h1", "blue", 5);
    expect(ids(files)).toEqual(["h1 blue", "h2 yellow"]);
    expect(highlightsIn(files, FILE)[0].at).toBe(5);
    const removed = highlightsIn(files, FILE)[1];
    files = removeHighlight(files, FILE, "h2", 6);
    expect(ids(files)).toEqual(["h1 blue"]);
    files = restoreHighlight(files, FILE, removed, 7);
    files = restoreHighlight(files, FILE, removed, 8);
    expect(ids(files)).toEqual(["h1 blue", "h2 yellow"]);
  });

  it("a file whose last highlight goes isn't kept at all", () => {
    let files = addHighlights([], FILE, [mark("h1", 0, 6)], 1);
    files = removeHighlight(files, FILE, "h1", 2);
    expect(files).toEqual([]);
  });
});

describe("notes on a page", () => {
  const notes = (files: readonly HighlightedFile[], file = FILE) => notesIn(files, file).map((n) => `${n.page ?? "-"} ${n.text}`);

  it("one a page, by page, kept with the file's highlights; writing again changes it", () => {
    let files = addHighlights([], FILE, [mark("h1", 0, 6)], 1);
    files = setNote(files, FILE, 3, "Tanya dosen soal rumus ini", 2);
    files = setNote(files, FILE, 1, "Definisi biaya tetap", 3);
    files = setNote(files, FILE, 3, "Tanya dosen soal rumus ini.\nLihat juga Bab 2.", 4);
    expect(notes(files)).toEqual(["1 Definisi biaya tetap", "3 Tanya dosen soal rumus ini.\nLihat juga Bab 2."]);
    expect(ids(files)).toEqual(["h1 yellow"]);
    expect(files[0].at).toBe(4);
    expect(Datasets["local.highlights"].safeParse(files).success).toBe(true);
  });

  it("a Word document or text file has one, for the whole file", () => {
    let files = setNote([], FILE, undefined, "Ringkasan untuk UTS", 1);
    files = setNote(files, FILE, undefined, "Ringkasan untuk UTS dan UAS", 2);
    expect(notes(files)).toEqual(["- Ringkasan untuk UTS dan UAS"]);
  });

  it("a file with notes and no highlights is kept; emptied (spaces only) or removed, the note goes, and the file with its last", () => {
    let files = setNote([], FILE, 2, "Catat contoh ini", 1);
    files = addHighlights(files, FILE, [mark("h1", 0, 6)], 2);
    files = removeHighlight(files, FILE, "h1", 3);
    expect(notes(files)).toEqual(["2 Catat contoh ini"]);
    files = setNote(files, FILE, 2, "  \n ", 4);
    expect(files).toEqual([]);
    files = setNote(files, FILE, 2, "Catat contoh ini", 5);
    files = removeNote(files, FILE, 2, 6);
    expect(files).toEqual([]);
  });

  it("put back once however often Undo is pressed, but never over a note written on its page since", () => {
    let files = setNote([], FILE, 4, "Catatan lama", 1);
    const removed = notesIn(files, FILE)[0];
    files = removeNote(files, FILE, 4, 2);
    files = restoreNote(files, FILE, removed, 3);
    files = restoreNote(files, FILE, removed, 4);
    expect(notes(files)).toEqual(["4 Catatan lama"]);
    files = removeNote(files, FILE, 4, 5);
    files = setNote(files, FILE, 4, "Catatan baru", 6);
    files = restoreNote(files, FILE, removed, 7);
    expect(notes(files)).toEqual(["4 Catatan baru"]);
  });

  it("are kept to MAX_NOTE characters; a file saved before notes existed loads, and keeps no empty field when written", () => {
    const files = setNote([], FILE, 1, "a".repeat(MAX_NOTE + 10), 1);
    expect(notesIn(files, FILE)[0].text).toHaveLength(MAX_NOTE);
    const older: HighlightedFile[] = [{ file: FILE, at: 1, highlights: [mark("h1", 0, 6)] }];
    expect(Datasets["local.highlights"].safeParse(older).data).toEqual(older);
    expect(notesIn(older, FILE)).toEqual([]);
    expect(Object.keys(addHighlights(older, FILE, [mark("h2", 20, 27)], 2)[0])).toEqual(["file", "at", "highlights"]);
  });

  it("past the most notes in all, the files changed longest ago go first, whole", () => {
    let files: HighlightedFile[] = [];
    for (let n = 0; n < 3; n++)
      for (let page = 1; page <= MAX_NOTES / 2; page++) files = setNote(files, n.toString(16).padStart(64, "0"), page, `Catatan ${page}`, n * 1000 + page);
    expect(files.map((f) => f.file.slice(-1))).toEqual(["2", "1"]);
    expect(Datasets["local.highlights"].safeParse(files).success).toBe(true);
    expect(Datasets["local.highlights"].safeParse([...files, { file: FILE, at: 0, highlights: [], notes: [{ page: 1, text: "x", at: 0 }] }]).success).toBe(
      false,
    );
  });
});

describe("the caps", () => {
  const many = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => mark(`${prefix}${i}`, i, i + 1));
  const file = (n: number, at: number, count = 1): HighlightedFile => ({ file: n.toString(16).padStart(64, "0"), at, highlights: many(`f${n}-`, count) });

  it("a file keeps its newest highlights", () => {
    const files = addHighlights([], FILE, many("h", MAX_FILE_HIGHLIGHTS + 3), 1);
    const kept = highlightsIn(files, FILE);
    expect(kept).toHaveLength(MAX_FILE_HIGHLIGHTS);
    expect(kept[0].id).toBe("h3");
  });

  it("past the most files or highlights in all, the files changed longest ago go first, whole", () => {
    const files = Array.from({ length: MAX_HIGHLIGHT_FILES + 2 }, (_, n) => file(n, n));
    const kept = pruneHighlights(files);
    expect(kept).toHaveLength(MAX_HIGHLIGHT_FILES);
    expect(kept.at(-1)?.at).toBe(2);

    const big = [file(1, 1, 400), file(2, 2, 400), file(3, 3, 400), file(4, 4, 400), file(5, 5, 400), file(6, 6, 10)];
    const fitting = pruneHighlights(big);
    expect(fitting.map((f) => f.at)).toEqual([6, 5, 4, 3, 2]);
    expect(fitting.reduce((sum, f) => sum + f.highlights.length, 0)).toBeLessThanOrEqual(MAX_HIGHLIGHTS);
    expect(Datasets["local.highlights"].safeParse(fitting).success).toBe(true);
  });

  it("the saved list refuses more than the caps, a highlight with no text, and a file named any other way", () => {
    const tooMany = Array.from({ length: 5 }, (_, n) => file(n, n, MAX_FILE_HIGHLIGHTS));
    expect(Datasets["local.highlights"].safeParse(tooMany).success).toBe(false);
    expect(Datasets["local.highlights"].safeParse([{ file: FILE, at: 1, highlights: [mark("h1", 4, 4)] }]).success).toBe(false);
    expect(Datasets["local.highlights"].safeParse([{ file: "fixture.pdf", at: 1, highlights: [mark("h1", 0, 4)] }]).success).toBe(false);
  });
});

describe("finding a highlight's text", () => {
  it("is where it was saved while the page reads the same", () => {
    const h = mark("h1", 20, 27);
    expect(PAGE.slice(20, 27)).toBe("Capaian");
    expect(locate(PAGE, h)).toEqual({ start: 20, end: 27 });
  });

  it("moved a little (a line split another way): the nearest place its text is", () => {
    const h = mark("h1", 20, 27);
    const now = `Minggu 1: Pengantar \n Capaian: Capaian ${PAGE.slice(27)}`;
    expect(locate(now, h)).toEqual({ start: 22, end: 29 });
  });

  it("a long highlight is found by the start of its text, and keeps its length", () => {
    const long = `${"Kata ".repeat(60)}akhir.`;
    const h: Highlight = { id: "h1", start: 0, end: long.length, color: "yellow", text: quoteOf(long), at: 1 };
    expect(h.text.length).toBeLessThan(long.length);
    expect(locate(`Judul\n${long}`, h)).toEqual({ start: 6, end: 6 + long.length });
  });

  it("gone from the page: not drawn", () => {
    expect(locate("Halaman lain sama sekali.", mark("h1", 20, 27))).toBeNull();
  });

  it("a selection's spaces and line breaks at its ends aren't highlighted", () => {
    expect(trimmed(" kata \n", 0, 7)).toEqual({ start: 1, end: 5 });
    expect(trimmed(" \n ", 0, 3)).toBeNull();
  });
});
