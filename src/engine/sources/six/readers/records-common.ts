// What the SIX record readers share: opening a page, the rows and cells of
// one table, its columns by their labels, SIX's numbers, days and WIB times,
// term codes, and the checks that turn a layout the app doesn't know into
// "SIX changed something".
//
// What says which row it is (a course's code and name, a bill's term) and
// what holds the rows (tables, headings) stay strict: a row whose code can't
// be read is left out and kept in the page's `skipped` (../../skipped.ts), so
// the rest of the page still reads. Any other cell the app can't read is left
// blank and the row noted the same way (ADR 0011): a surprise costs a cell.
//
// Columns are found by their labels, in Indonesian or English on any page (a
// Student's Indonesian page can carry English headers), so a column the app
// doesn't know is passed over and SIX's order doesn't matter. On SIX's English
// variant, whose labels were never recorded, a label the app doesn't know is
// taken from where the recorded page has it.
import { type Cheerio, type CheerioAPI, load } from "cheerio/slim";
import type { Element } from "domhandler";
import { EngineError, isEngineError } from "../../../errors";
import { Skipped } from "../../skipped";

export type Elem = Cheerio<Element>;

export interface Page {
  $: CheerioAPI;
  /** The page's language, from SIX's language switch; Indonesian unless it says otherwise. */
  lang: "id" | "en";
  /** "transcript", "KRS", … for error messages. */
  name: string;
  /** The rows the reader left out. */
  skipped: Skipped;
}

export function openPage(html: string, name: string, skipped = new Skipped()): Page {
  const $ = load(html);
  const active = $('li.active > a[href^="/pub/locale/"]').attr("href") ?? "";
  return { $, lang: /^\/pub\/locale\/en\b/.test(active) ? "en" : "id", name, skipped };
}

/** What didn't fit, with the page it's on: "SIX finance page: …". */
const onPage = (page: Page | string, what: string) => `SIX ${typeof page === "string" ? page : page.name} page: ${what}`;

/** SIX answered a page the app doesn't know how to read. */
export function changed(page: Page | string, what: string): never {
  throw new EngineError("VendorChanged", onPage(page, what));
}

/** Text with whitespace collapsed (no-break spaces included). */
export const clean = (value: string) => value.replace(/\s+/g, " ").trim();

export const textOf = (node: Elem) => clean(node.text());

/** The rows of this table itself, not of tables nested in its cells, with or without thead and tbody. */
export function rowsOf(page: Page, table: Elem): Elem[] {
  const { $ } = page;
  return table
    .find("tr")
    .filter((_, tr) => $(tr).closest("table").is(table))
    .toArray()
    .map((tr) => $(tr));
}

/** A row as the Student would find it on SIX: its cells' text, the empty ones left out. */
export const rowText = (cells: readonly Elem[]) => cells.map(textOf).filter(Boolean).join(" · ");

export function cellsOf(page: Page, row: Elem): Elem[] {
  return row
    .children("th,td")
    .toArray()
    .map((cell) => page.$(cell));
}

const fold = (label: string) => clean(label).toLowerCase();
const sameLabels = (actual: readonly string[], expected: readonly string[]) =>
  actual.length === expected.length && actual.every((label, i) => fold(label) === fold(expected[i]!));

/**
 * Checks a header row: on Indonesian pages its labels must be the recorded ones; in English only how many there are.
 * Only the syllabus reader, which nothing calls yet, still reads this way; the others find columns by label (`columns`).
 */
export function expectLabels(page: Page, actual: readonly string[], expected: readonly string[], where: string): void {
  if (actual.length !== expected.length) changed(page, `${where} has ${actual.length} columns, expected ${expected.length}`);
  if (page.lang === "id" && !sameLabels(actual, expected)) changed(page, `${where} reads "${actual.join(" | ")}"`);
}

/** How many columns a cell covers. */
const span = (cell: Elem) => Math.max(1, Number(cell.attr("colspan")) || 1);

/** How many columns a row's cells cover. */
export const widthOf = (cells: readonly Elem[]) => cells.reduce((sum, cell) => sum + span(cell), 0);

/** The column each of a row's cells starts at. */
export function startsOf(cells: readonly Elem[]): number[] {
  let at = 0;
  return cells.map((cell) => {
    const start = at;
    at += span(cell);
    return start;
  });
}

/** The cell that starts at a column; null when a wider cell before it covers that column. */
function cellAt(cells: readonly Elem[], column: number): Elem | null {
  let at = 0;
  for (const cell of cells) {
    if (at === column) return cell;
    at += span(cell);
    if (at > column) return null;
  }
  return null;
}

/** A column a reader reads. */
export interface Column {
  /** Its label as recorded first, then the other ways SIX writes it, in Indonesian or English. */
  labels: readonly string[];
  /**
   * The page can't be read without it, so a header without it is refused: it says which row it is (a course's
   * code, a bill's term), or holds what no blank can stand for (whether a course was taken at all).
   */
  required?: true;
}

/** The columns most record tables share: a course's code and name say which row it is; its SKS is a detail. */
export const COURSE_COLUMNS = {
  code: { labels: ["Kode", "Code", "Course Code"], required: true },
  name: { labels: ["Mata Kuliah", "Course", "Course Name"], required: true },
  sks: { labels: ["SKS", "Credits", "Credit"] },
} satisfies Record<string, Column>;

export interface Columns<K extends string> {
  /** How many columns the header has: a row with another number isn't one the app can place. */
  width: number;
  /** A row's cell under `key`'s column; null when the header has no such column (that detail is blank). */
  cell(cells: readonly Elem[], key: K): Elem | null;
  /** A row's cell under a required column: a row without one (a cell spanning it) isn't one the app can place. */
  need(cells: readonly Elem[], key: K): Elem;
}

/**
 * Finds each column a reader reads in a header, by its labels (`labels`, one
 * a column, wider headers spread over the columns they cover). A column the
 * app doesn't know is passed over. One that says which row it is must be
 * there, once; a detail's that isn't leaves that detail blank in every row,
 * noted once. `recorded`: the header as recorded, for SIX's English pages.
 */
export function columns<K extends string>(
  page: Page,
  labels: readonly string[],
  spec: Record<K, Column>,
  recorded: readonly string[],
  where: string,
): Columns<K> {
  if (!labels.length) changed(page, `${where} is missing`);
  const folded = labels.map(fold);
  const keys = Object.keys(spec) as K[];
  const matches = new Map(keys.map((key) => [key, folded.flatMap((label, i) => (spec[key].labels.some((known) => fold(known) === label) ? [i] : []))]));
  const found = new Map<K, number>();
  for (const [key, at] of matches) if (at.length === 1) found.set(key, at[0]!);
  // SIX's English labels were never recorded: a label the app doesn't know is taken from where the recorded page has it.
  if (page.lang === "en" && labels.length === recorded.length) {
    const taken = new Set(found.values());
    for (const [key, at] of matches) {
      const place = recorded.indexOf(spec[key].labels[0]!);
      if (at.length || place < 0 || taken.has(place)) continue;
      found.set(key, place);
      taken.add(place);
    }
  }
  for (const [key, at] of matches) {
    if (found.has(key)) continue;
    const what = `${where} has ${at.length ? `${at.length} "${spec[key].labels[0]}" columns` : `no "${spec[key].labels[0]}" column`}`;
    if (spec[key].required) changed(page, what);
    noteBlank(page, labels.filter(Boolean).join(" · "), what);
  }
  const cell = (cells: readonly Elem[], key: K) => {
    const at = found.get(key);
    return at === undefined ? null : cellAt(cells, at);
  };
  return {
    width: labels.length,
    cell,
    need: (cells, key) => cell(cells, key) ?? changed(page, `a row has no "${spec[key].labels[0]}" cell`),
  };
}

/** A header row's labels, one a column (a cell over several columns labels each). */
export const labelsOf = (cells: readonly Elem[]) => cells.flatMap((cell) => Array.from({ length: span(cell) }, () => textOf(cell)));

/**
 * The labels of a header over several rows ("Persetujuan" over "Dosen Wali" and "Prodi
 * Penyelenggara"), one a column: the label nearest the rows under it.
 */
export function stackedLabels(page: Page, rows: readonly Elem[]): string[] {
  const labels: string[] = [];
  const below: number[] = []; // How many more rows each column's cell still covers.
  rows.forEach((row) => {
    let at = 0;
    for (const cell of cellsOf(page, row)) {
      while ((below[at] ?? 0) > 0) at += 1;
      const rowspan = Math.max(1, Number(cell.attr("rowspan")) || 1);
      for (let i = 0; i < span(cell); i++, at++) {
        labels[at] = textOf(cell);
        below[at] = rowspan;
      }
    }
    for (let i = 0; i < below.length; i++) below[i] = Math.max(0, (below[i] ?? 0) - 1);
  });
  return labels;
}

/**
 * Notes a row kept with something blank in it that's said once for the page however many
 * times it's met (a header SIX repeats per semester without a column): `what` didn't fit.
 */
export function noteBlank(page: Page, row: string, what: string): void {
  const why = onPage(page, what);
  if (!page.skipped.rows.some((noted) => noted.why === why)) page.skipped.blanked(row, why);
}

export interface Details {
  /**
   * What `read` makes of a row's cell: null when the header has no such column,
   * or when SIX writes it in a way the app can't read yet (VendorChanged). Either
   * way the detail `name` is blank; the second is noted with the row (`note`).
   */
  of<T>(name: string, cell: Elem | null, read: (cell: Elem) => T): T | null;
  /** Whether the detail `name` was left blank. */
  blank(name: string): boolean;
  /** After the row: a row with a detail the app couldn't read is noted, with what it shows. */
  note(row: string): void;
}

/** A row's details, read one by one: one the app can't read is left blank and the row kept (ADR 0011). */
export function details(page: Page): Details {
  const blank = new Set<string>();
  const why: string[] = [];
  return {
    of(name, cell, read) {
      if (!cell) {
        blank.add(name);
        return null;
      }
      try {
        return read(cell);
      } catch (error) {
        if (!isEngineError(error, "VendorChanged")) throw error;
        blank.add(name);
        why.push(error.message);
        return null;
      }
    },
    blank: (name) => blank.has(name),
    note(row) {
      if (why.length) page.skipped.blanked(row, why.join("; "));
    },
  };
}

/** A whole number. */
export function int(page: Page, value: string, what: string): number {
  const text = clean(value);
  if (!/^\d+$/.test(text)) changed(page, `${what} "${text}" isn't a number`);
  return Number(text);
}

/** A whole number or nothing (an empty cell). */
export function intOrNull(page: Page, value: string, what: string): number | null {
  return clean(value) === "" ? null : int(page, value, what);
}

/** Rupiah as SIX writes it ("10.500.000", "Rp 5.250.000"); null for "-" or an empty cell. */
export function rupiah(page: Page, value: string, what: string): number | null {
  const text = clean(value).replace(/^Rp\.?\s*/i, "");
  if (text === "" || text === "-") return null;
  if (!/^\d{1,3}([.,]\d{3})*$/.test(text)) changed(page, `${what} "${clean(value)}" isn't an amount`);
  return Number(text.replace(/[.,]/g, ""));
}

/** An IP or IPK ("3.26"); null for "-". */
export function indexValue(page: Page, value: string, what: string): number | null {
  const text = clean(value);
  if (text === "-") return null;
  if (!/^\d[.,]\d{2}$/.test(text)) changed(page, `${what} "${text}" isn't an index`);
  return Number(text.replace(",", "."));
}

// Months by their first three letters, in Indonesian and English ("Agu", "Agustus", "Aug").
const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  mei: 5,
  may: 5,
  jun: 6,
  jul: 7,
  agu: 8,
  agt: 8,
  aug: 8,
  sep: 9,
  okt: 10,
  oct: 10,
  nov: 11,
  des: 12,
  dec: 12,
};
const DATE = /(?<!\d)(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})(?:,?\s+(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?)?(?!\d)/g;
const pad = (n: number) => String(n).padStart(2, "0");

/** The one date a cell holds, with or without words around it, or written twice ("16 Agu 2026 / 16 Agu 2026"). */
function dateParts(page: Page, value: string, what: string) {
  const text = clean(value);
  const found = new Map([...text.matchAll(DATE)].map((match) => [match[0], match] as const));
  const match = found.size === 1 ? [...found.values()][0]! : null;
  const month = match ? MONTHS[match[2]!.slice(0, 3).toLowerCase()] : undefined;
  if (!match || !month) return changed(page, `${what} "${text}" isn't a date`);
  const [y, d] = [Number(match[3]), Number(match[1])];
  const time = match[4] === undefined ? null : { h: Number(match[4]), m: Number(match[5]), s: Number(match[6] ?? 0) };
  return { y, mo: month, d, time };
}

/** A day ("24 Agu 2026" → "2026-08-24"); null for "-" or an empty cell. */
export function day(page: Page, value: string, what: string): string | null {
  const text = clean(value);
  if (text === "" || text === "-") return null;
  const { y, mo, d } = dateParts(page, text, what);
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** A moment in WIB ("16 Agu 2026 10.45.42") as ms; null when the cell holds no date (a step not taken yet). */
export function stamp(page: Page, value: string, what: string): number | null {
  const text = clean(value);
  if (!/\d{4}/.test(text)) return null;
  const { y, mo, d, time } = dateParts(page, text, what);
  if (!time) changed(page, `${what} "${text}" has no time`);
  return Date.UTC(y, mo - 1, d, time.h - 7, time.m, time.s);
}

/** The last moment of a day in WIB (UTC+7), as ms. */
export const endOfDayWib = (dayText: string): number => {
  const [y, mo, d] = dayText.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, mo - 1, d + 1, -7) - 1;
};

/**
 * A term code from a heading with a semester number and an academic year:
 * "Semester 1 Tahun 2023/2024" → "2023-1", "Semester 2 (Genap) - 2026/2027"
 * → "2026-2". A short semester may be written without its number.
 */
export function termFromHeading(page: Page, value: string, what: string): string {
  const text = clean(value);
  const years = /(\d{4})\s*\/\s*(\d{4})/.exec(text);
  const semester = /\b([123])(?:st|nd|rd)?\b/.exec(text.replace(/\d{4}\s*\/\s*\d{4}/, ""))?.[1] ?? (/pendek|short/i.test(text) ? "3" : undefined);
  if (!years || !semester || Number(years[2]) !== Number(years[1]) + 1) changed(page, `${what} "${text}" names no term`);
  return `${years[1]}-${semester}`;
}

/** A course code as SIX shows it in a cell, "FI1101" with its curriculum suffix "-19" in a muted span: the code alone. */
export function courseCode(page: Page, cell: Elem, what: string): string {
  const code = clean(cell.clone().children().remove().end().text());
  if (!COURSE_CODE.test(code)) changed(page, `${what} "${textOf(cell)}" isn't a course code`);
  return code;
}

/** The curriculum a course code's suffix names ("-19": 2019); null without one. */
export function curriculumMark(page: Page, cell: Elem, what: string): number | null {
  const suffix = clean(cell.find("span").text());
  if (suffix && !/^-\d{2}$/.test(suffix)) changed(page, `${what} "${textOf(cell)}" has an unknown curriculum mark`);
  return suffix ? 2000 + Number(suffix.slice(1)) : null;
}

/** ITB course codes: two letters and four digits; a slot several courses can fill ends in X ("WI201X"). */
export const COURSE_CODE = /^[A-Z]{2}\d{3}[\dX]$/;

/** A course link's id: "/pub/matakuliah/47837" → "47837". */
export function courseIdOf(cell: Elem): string | null {
  return /\/matakuliah\/(\d+)\b/.exec(cell.find("a").attr("href") ?? "")?.[1] ?? null;
}

/**
 * A value cell of a key-value table ("Data Mahasiswa"): by its label, Indonesian
 * or English on any page (`labels`, the recorded one first), or on SIX's English
 * pages, whose labels were never recorded, by the row's recorded position.
 */
export function field(page: Page, table: Elem, labels: readonly string[], position: number): Elem | null {
  const rows = rowsOf(page, table).map((row) => cellsOf(page, row));
  const known = labels.map(fold);
  const labelled = rows.find((cells) => cells[0] && known.includes(fold(textOf(cells[0]))));
  const row = labelled ?? (page.lang === "en" ? rows[position] : undefined);
  return row?.length === 2 && row[0]!.is("th") ? row[1]! : null;
}
