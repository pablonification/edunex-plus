// SIX's student status page (/app/mahasiswa:{nim}/statusmhs): who the
// Student is, this term, and the term's courses with class, SKS and the exact
// attendance count. Also the NIM, from SIX's home page. Who the Student is and
// the term must read, or SIX changed the page; the course table can change
// alone, and then the rest still reads (ADR 0012). Its columns are found by
// their labels. A course row it doesn't understand is left out (skipped); one
// with a detail it can't read is kept with that detail blank.
import type { SixCourse, SixStudent, SkippedRow } from "../../../core/models";
import { type EngineError, isEngineError } from "../../errors";
import { Skipped } from "../skipped";
import { COURSE_CODE, changed, clean, links, type Nodes, type Page, parse } from "./html";

/** Who the Student is and the term, and this term's courses, or why the course table itself can't be read. */
export type StatusPage = {
  student: SixStudent;
  /** The course rows left out, and the ones kept with a detail blank. */
  skipped: SkippedRow[];
} & ({ courses: SixCourse[]; tableChanged: null } | { courses: null; tableChanged: EngineError });

const PAGE = "statusmhs";
/** "Semester 1-2026/2027" in the course list's title: term 1 of 2026/2027 is "2026-1". */
const TERM = /\b([123])\s*-\s*(\d{4})\s*\/\s*(\d{4})\b/;
/** Links that carry SIX's own id for the Student. */
const STUDENT_ID = [/\/kelas\/jadwal\/mahasiswa\/(\d+)/, /\/transkrip\/(?:historis|kurikulum)\/(\d+)/, /[?&]mahasiswa_id=(\d+)/];
/** A percentage as SIX shows it: "66.67%". */
const PERCENT = /^(\d{1,3})(?:[.,](\d+))?\s*%$/;

/**
 * The course table's columns the app reads: their labels in SIX's Indonesian and English, any case
 * (SIX's English wording was never recorded, so those are likely ones), where each was recorded
 * (row number, code, name, class, SKS, attendance, grade, in 7 columns), and what a note calls it.
 * The grade (Nilai) isn't read. Without a code or name the table can't be read; the others are details.
 */
const COLUMNS = {
  code: { labels: ["kode", "kode mk", "kode mata kuliah", "code", "course code"], recorded: 1, called: "code" },
  name: { labels: ["mata kuliah", "nama mata kuliah", "nama mk", "course", "course name", "course title", "subject"], recorded: 2, called: "name" },
  classNo: { labels: ["kelas", "no kelas", "class", "section"], recorded: 3, called: "class" },
  sks: { labels: ["sks", "credits", "credit", "credit units"], recorded: 4, called: "SKS" },
  attendance: { labels: ["kehadiran", "presensi", "attendance", "presence"], recorded: 5, called: "attendance" },
} as const satisfies Record<string, { labels: readonly string[]; recorded: number; called: string }>;
type Column = keyof typeof COLUMNS;
const RECORDED_COLUMNS = 7;
const DETAILS = ["classNo", "sks", "attendance"] as const satisfies readonly Column[];

/** The Student's NIM, from the links on SIX's home page (or any page signed in as a student). */
export function readNim(html: string): string {
  const $ = parse(html);
  const brand = /[?&]context=mahasiswa:(\d+)/.exec($("a.navbar-brand").attr("href") ?? "")?.[1];
  const nim =
    brand ??
    links($)
      .map((href) => /(?:\/app\/|[?&]context=)mahasiswa:(\d+)/.exec(href)?.[1])
      .find(Boolean);
  if (!nim) throw changed("home", "no student pages are linked");
  return nim;
}

export function readStatusPage(html: string, nim: string): StatusPage {
  const $ = parse(html);
  const hrefs = links($);
  if (!hrefs.some((href) => href.startsWith(`/app/mahasiswa:${nim}`))) throw changed(PAGE, "not this Student's page");

  const ids = new Set(hrefs.flatMap((href) => STUDENT_ID.map((pattern) => pattern.exec(href)?.[1]).filter((id): id is string => Boolean(id))));
  if (ids.size !== 1) throw changed(PAGE, ids.size ? "more than one student id" : "no student id");
  const [studentId] = ids;

  // The signed-in person, next to their icon in the top bar.
  const name = clean(
    $("a.dropdown-toggle")
      .filter((_, el) => $(el).find(".fa-user-circle-o").length > 0)
      .first()
      .text(),
  );
  if (!name) throw changed(PAGE, "no name");

  const { term, panel } = readTerm($);
  const program = readProgram($, nim);
  const student = { nim, name, studentId, term, program: program?.name ?? null, programCode: program?.code ?? null };
  // The course table on its own: when it can't be read, who the Student is and the term still are.
  const skipped = new Skipped();
  try {
    return { student, courses: readCourseTable($, panel, skipped), tableChanged: null, skipped: skipped.rows };
  } catch (error) {
    if (!isEngineError(error, "VendorChanged")) throw error;
    return { student, courses: null, tableChanged: error, skipped: [] };
  }
}

/** "182 / Sistem dan Teknologi Informasi" in the Student's details table. */
function readProgram($: Page, nim: string): { code: string; name: string } | null {
  const details = $("table")
    .filter((_, table) =>
      $(table)
        .find("td")
        .toArray()
        .some((td) => clean($(td).text()) === nim),
    )
    .first();
  for (const td of details.find("td").toArray()) {
    const match = /^(\d{3})\s*\/\s*(\S.*)$/.exec(clean($(td).text()));
    if (match) return { code: match[1], name: match[2] };
  }
  return null;
}

/** This term, from the course list's title, and the panel that holds the list. */
function readTerm($: Page): { term: string; panel: Nodes } {
  const panel = $(".panel")
    .filter((_, el) => TERM.test(clean($(el).find(".panel-title").first().text())))
    .first();
  const title = TERM.exec(clean(panel.find(".panel-title").first().text()));
  if (!title) throw changed(PAGE, "this term's course list is missing");
  const [, half, first, second] = title;
  if (Number(second) !== Number(first) + 1) throw changed(PAGE, "the term's years don't follow each other");
  return { term: `${first}-${half}`, panel };
}

const label = (text: string) =>
  clean(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Where each column is, by its label: a label the app doesn't know is a column it doesn't read. A
 * header all in the recorded layout but with words it doesn't know (SIX's English, say) reads a
 * column where it was recorded. A column that isn't there, or is there twice, is missing.
 */
function columnsOf(headings: readonly string[]): Partial<Record<Column, number>> {
  const labels = headings.map(label);
  const known = (text: string) => Object.values(COLUMNS).some((column) => (column.labels as readonly string[]).includes(text));
  const at: Partial<Record<Column, number>> = {};
  for (const [column, { labels: words, recorded }] of Object.entries(COLUMNS) as [Column, (typeof COLUMNS)[Column]][]) {
    const found = labels.flatMap((text, index) => ((words as readonly string[]).includes(text) ? [index] : []));
    if (found.length === 1) at[column] = found[0];
    else if (!found.length && labels.length === RECORDED_COLUMNS && !known(labels[recorded]!)) at[column] = recorded;
  }
  return at;
}

function readCourseTable($: Page, panel: Nodes, skipped: Skipped): SixCourse[] {
  const rows = panel
    .find("table")
    .first()
    .find("tr")
    .toArray()
    .map((tr) => $(tr).children("th, td"));
  const header = rows[0];
  if (!header || header.filter("td").length > 0) throw changed(PAGE, "the course table has a different layout");
  const headings = header.toArray().map((cell) => clean($(cell).text()));
  const at = columnsOf(headings);
  for (const column of ["code", "name"] as const) if (at[column] === undefined) throw changed(PAGE, `the course table has no ${COLUMNS[column].called} column`);
  // A detail column that isn't there leaves that detail blank for every course, noted once.
  const missing = DETAILS.filter((column) => at[column] === undefined);
  if (missing.length)
    skipped.blanked(
      headings.filter(Boolean).join(" · "),
      missing.map((column) => `SIX ${PAGE}: the course table has no ${COLUMNS[column].called} column`).join("; "),
    );

  const numbered = rows.slice(1).map((cells, index) => ({ cells, at: `course ${index + 1}` }));
  const shown = ({ cells }: (typeof numbered)[number]) =>
    cells
      .toArray()
      .map((cell) => clean($(cell).text()))
      .filter(Boolean)
      .join(" · ");
  // The code and name say which course a row is: without them it's left out. Its class, SKS and
  // attendance are details: one SIX writes another way (a second percentage for sick days, #237)
  // is left blank, and the row noted, so the course still shows here and on Edunex's side.
  return skipped.each(numbered, shown, (row) => {
    const { cells, at: where } = row;
    if (cells.length !== header.length) throw changed(PAGE, `${where} has ${cells.length} cells`);
    const text = (column: number) => clean(cells.eq(column).text());
    const code = text(at.code!);
    const name = text(at.name!);
    if (!COURSE_CODE.test(code)) throw changed(PAGE, `${where} has no course code`);
    if (!name || COURSE_CODE.test(name)) throw changed(PAGE, `${where} has no name`);
    const blanked: string[] = [];
    const detail = <T>(column: number | undefined, read: (column: number) => T): T | null => {
      if (column === undefined) return null;
      try {
        return read(column);
      } catch (error) {
        if (!isEngineError(error, "VendorChanged")) throw error;
        blanked.push(error.message);
        return null;
      }
    };
    const classNo = detail(at.classNo, (column) => {
      const classNo = text(column);
      if (classNo !== "" && !/^\d{1,3}$/.test(classNo)) throw changed(PAGE, `${where} has no class number`);
      return classNo || null;
    });
    const sks = detail(at.sks, (column) => {
      const sks = text(column);
      if (!/^\d{1,2}$/.test(sks)) throw changed(PAGE, `${where} has no SKS`);
      return Number(sks);
    });
    const attendance = detail(at.attendance, (column) => readAttendance($, cells.eq(column), where));
    if (blanked.length) skipped.blanked(shown(row), blanked.join("; "));
    return { code, name, classNo, sks, attendance };
  });
}

/**
 * The attendance cell shows a percentage; its tooltip has the exact count
 * ("Hadir 4 dari 6 pertemuan"). The count is read as two numbers in a row in a
 * tooltip, whatever the wording, and must agree with the percentage shown. With
 * sick days SIX shows a second percentage ("82.35% / 94.12%", #237), with its
 * own tooltip counting days off sick or excused too ("Hadir (termasuk izin dan
 * sakit) 16 dari 17 pertemuan"): the first is the meetings attended, as for
 * everyone else, and is the one read.
 */
function readAttendance($: Page, cell: Nodes, at: string): SixCourse["attendance"] {
  const shown = clean(cell.text());
  const counts = cell
    .find("[title]")
    .toArray()
    .map(
      (el) =>
        clean($(el).attr("title") ?? "")
          .match(/\d+/g)
          ?.map(Number) ?? [],
    )
    .filter((numbers) => numbers.length > 0);
  if (shown === "" || shown === "-") {
    if (counts.length) throw changed(PAGE, `${at}: attendance count without a percentage`);
    return null;
  }
  if (!counts.some((numbers) => numbers.length >= 2)) throw changed(PAGE, `${at}: attendance without its count`);
  // No meeting held yet: whatever percentage SIX shows.
  if (counts.length === 1 && counts[0]!.join() === "0,0") return { attended: 0, held: 0 };
  const percents = shown.split("/").map((part) => PERCENT.exec(part.trim()));
  if (percents.some((percent) => !percent)) throw changed(PAGE, `${at}: attendance isn't a percentage`);
  const [, whole, decimals] = percents[0]!;
  const value = Number(`${whole}.${decimals ?? "0"}`);
  // Within the rounding of the digits SIX shows.
  const tolerance = 0.5 * 10 ** -(decimals?.length ?? 0) + 1e-9;
  const fits = new Map<string, { attended: number; held: number }>();
  for (const numbers of counts) {
    for (let i = 1; i < numbers.length; i++) {
      const [attended, held] = [numbers[i - 1]!, numbers[i]!];
      if (held > 0 && attended <= held && Math.abs((attended / held) * 100 - value) <= tolerance) fits.set(`${attended}/${held}`, { attended, held });
    }
  }
  if (fits.size === 1) return [...fits.values()][0]!;
  throw changed(PAGE, fits.size ? `${at}: attendance has more than one count that fits` : `${at}: attendance count and percentage disagree`);
}
