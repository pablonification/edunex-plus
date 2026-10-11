// What the SIX record readers share: opening a page, the rows and cells of
// one table, SIX's numbers, days and WIB times, term codes, and the checks
// that turn a layout the app doesn't know into "SIX changed something".
//
// Readers find things by structure (tables, classes, icons, links). Header
// labels are checked against the recorded Indonesian pages; on SIX's English
// variant, which has no recording yet, only the structure is checked.
import { type Cheerio, type CheerioAPI, load } from "cheerio/slim";
import type { Element } from "domhandler";
import { EngineError } from "../../../errors";

export type Elem = Cheerio<Element>;

export interface Page {
  $: CheerioAPI;
  /** The page's language, from SIX's language switch; Indonesian unless it says otherwise. */
  lang: "id" | "en";
  /** "transcript", "KRS", … for error messages. */
  name: string;
}

export function openPage(html: string, name: string): Page {
  const $ = load(html);
  const active = $('li.active > a[href^="/pub/locale/"]').attr("href") ?? "";
  return { $, lang: /^\/pub\/locale\/en\b/.test(active) ? "en" : "id", name };
}

/** SIX answered a page the app doesn't know how to read. */
export function changed(page: Page | string, what: string): never {
  throw new EngineError("VendorChanged", `SIX ${typeof page === "string" ? page : page.name} page: ${what}`);
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
 * Checks a header row: on Indonesian pages its labels must be the recorded
 * ones; in English only how many there are.
 */
export function expectLabels(page: Page, actual: readonly string[], expected: readonly string[], where: string): void {
  if (actual.length !== expected.length) changed(page, `${where} has ${actual.length} columns, expected ${expected.length}`);
  if (page.lang === "id" && !sameLabels(actual, expected)) changed(page, `${where} reads "${actual.join(" | ")}"`);
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
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
const DATE = /^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})(?:,?\s+(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?)?$/;
const pad = (n: number) => String(n).padStart(2, "0");

function dateParts(page: Page, value: string, what: string) {
  const text = clean(value);
  const match = DATE.exec(text);
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

/** A course code as SIX shows it in a cell, "FI1101" with its curriculum suffix "-19" in a muted span. */
export function codeWithCurriculum(page: Page, cell: Elem, what: string): { code: string; curriculumYear: number | null } {
  const suffix = clean(cell.find("span").text());
  const code = clean(cell.clone().children().remove().end().text());
  if (!COURSE_CODE.test(code)) changed(page, `${what} "${textOf(cell)}" isn't a course code`);
  if (suffix && !/^-\d{2}$/.test(suffix)) changed(page, `${what} "${textOf(cell)}" has an unknown curriculum mark`);
  return { code, curriculumYear: suffix ? 2000 + Number(suffix.slice(1)) : null };
}

/** ITB course codes: two letters and four digits; a slot several courses can fill ends in X ("WI201X"). */
export const COURSE_CODE = /^[A-Z]{2}\d{3}[\dX]$/;

/** A course link's id: "/pub/matakuliah/47837" → "47837". */
export function courseIdOf(cell: Elem): string | null {
  return /\/matakuliah\/(\d+)\b/.exec(cell.find("a").attr("href") ?? "")?.[1] ?? null;
}

/**
 * A value cell of a key-value table ("Data Mahasiswa"): by its Indonesian
 * label, or on English pages by its recorded row position.
 */
export function field(page: Page, table: Elem, label: string, position: number): Elem | null {
  const rows = rowsOf(page, table).map((row) => cellsOf(page, row));
  const row = page.lang === "id" ? rows.find((cells) => cells[0] && fold(textOf(cells[0])) === fold(label)) : rows[position];
  return row?.length === 2 && row[0]!.is("th") ? row[1]! : null;
}
