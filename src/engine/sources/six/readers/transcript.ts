// Reads SIX's transcript by semester (/statusmhs/transkrip/historis/{sid}):
// every course per term with its grade, SIX's IP per term, and SKS totals.
// Works out how each row counts (retakes, rows off the transcript, T and
// missing grades) and checks SIX's IP and IPK against the rows. A course whose
// code it can't read is left out (skipped); the IP checks then say the app's
// count differs from SIX's, as they do for any row the app can't count. A
// grade, SKS or mark it can't read is left blank and the row noted: SIX's IP
// and IPK then show unchecked, never next to a figure worked out without it.

import { checkIndex, cumulativeIndex, isLetterGrade, type Standing, type Transcript, type TranscriptCourse, termIndex } from "../../../../core/models";
import type { Skipped } from "../../skipped";
import {
  COURSE_COLUMNS,
  type Column,
  type Columns,
  cellsOf,
  changed,
  columns,
  courseCode,
  curriculumMark,
  details,
  type Elem,
  indexValue,
  int,
  intOrNull,
  labelsOf,
  openPage,
  type Page,
  rowsOf,
  rowText,
  termFromHeading,
  textOf,
  widthOf,
} from "./records-common";

const HEADER = ["", "Kode", "Mata Kuliah", "SKS", "Nilai", "Semester Kurikulum", "Masuk Transkrip"];
const COLUMNS = {
  ...COURSE_COLUMNS,
  grade: { labels: ["Nilai", "Grade"] },
  semester: { labels: ["Semester Kurikulum", "Curriculum Semester"] },
  mark: { labels: ["Masuk Transkrip", "In Transcript", "On Transcript"] },
} satisfies Record<string, Column>;
type Header = Columns<keyof typeof COLUMNS>;
/** How SIX labels a term's IP ("NR 3.69"), in either language; on English pages any one word. */
const IP_LABELS = ["NR", "GPA", "IP", "IPS"];

/** SIX's IPK and the SKS it says it covers, from the curriculum-position page. */
export interface SixIpk {
  value: number | null;
  sks: number | null;
}

type Row = Omit<TranscriptCourse, "standing" | "attempt"> & {
  /** SIX writes its grade, or its transcript mark, in a way the app can't read yet: how it counts isn't known. */
  unread: { grade: boolean; mark: boolean };
};
interface RawTerm {
  term: string;
  rows: Row[];
  /** SIX's totals for the term; `ipBlank`: its IP is written in a way the app can't read yet. */
  footer: { sks: number | null; ip: number | null; ipBlank: boolean } | null;
}

/** `sixIpk`: null when the curriculum-position page writes it in a way the app can't read yet. */
export function readTranscript(html: string, sixIpk: SixIpk | null, skipped?: Skipped): Transcript {
  const page = openPage(html, "transcript", skipped);
  const tables = page.$("table").filter((_, table) => page.$(table).find("tr.info").length > 0);
  if (tables.length !== 1) changed(page, "no table of semesters");

  const terms: RawTerm[] = [];
  const list = page.skipped.list();
  let header: Header | null = null;
  let sksTaken: { value: number | null } | null = null;
  for (const row of rowsOf(page, tables.first())) {
    const cells = cellsOf(page, row);
    const current = terms.at(-1);
    if (row.hasClass("info")) {
      if (cells.length !== 1) changed(page, "a semester heading has several cells");
      terms.push({ term: termFromHeading(page, textOf(cells[0]!), "semester heading"), rows: [], footer: null });
    } else if (row.hasClass("warning")) {
      if (!current || !header || widthOf(cells) !== header.width) changed(page, "a total row is out of place");
      // The SKS under the SKS column, the IP in the cell after it.
      const sksCell = header.cell(cells, "sks");
      const ipCell = sksCell ? (cells[cells.indexOf(sksCell) + 1] ?? null) : null;
      const detail = details(page);
      if (current.footer) sksTaken = { value: detail.of("taken", sksCell, (cell) => int(page, textOf(cell), "SKS taken")) };
      else {
        const sks = detail.of("sks", sksCell, (cell) => int(page, textOf(cell), "semester SKS"));
        const ip = detail.of("ip", ipCell, (cell) => termIp(page, textOf(cell)));
        current.footer = { sks, ip, ipBlank: detail.blank("ip") };
      }
      detail.note(rowText(cells));
    } else if (cells.every((cell) => cell.is("th"))) {
      header = columns(page, labelsOf(cells), COLUMNS, HEADER, "the course header");
    } else {
      if (!current || current.footer) changed(page, "a course row is outside a semester");
      if (!header) changed(page, "a course row comes before its header");
      const under = header;
      const course = list.item(rowText(cells), () => readRow(page, under, cells));
      if (course) current.rows.push(course);
    }
  }
  list.done();
  if (terms.some((t) => !t.footer) || sksTaken === null) changed(page, "a total row is missing");
  if (new Set(terms.map((t) => t.term)).size !== terms.length) changed(page, "a semester appears twice");
  // Oldest first, whatever SIX's order: which attempt of a course is the newest depends on it.
  return assemble(
    terms.sort((a, b) => a.term.localeCompare(b.term)),
    sksTaken.value,
    sixIpk,
  );
}

function termIp(page: Page, text: string): number | null {
  const match = /^(\S+)\s+(\S+)$/.exec(text);
  if (!match || (page.lang === "id" && !IP_LABELS.includes(match[1]!))) changed(page, `semester IP "${text}" isn't readable`);
  return indexValue(page, match[2]!, "semester IP");
}

function readRow(page: Page, header: Header, cells: Elem[]): Row {
  if (widthOf(cells) !== header.width) changed(page, `a course row has ${cells.length} cells`);
  const codeCell = header.need(cells, "code");
  const code = courseCode(page, codeCell, "course code");
  const name = textOf(header.need(cells, "name"));
  const detail = details(page);
  const row = {
    code,
    curriculumYear: detail.of("curriculum", codeCell, (cell) => curriculumMark(page, cell, "course code")),
    name,
    sks: detail.of("sks", header.cell(cells, "sks"), (cell) => int(page, textOf(cell), "SKS")),
    grade: detail.of("grade", header.cell(cells, "grade"), (cell) => {
      const grade = textOf(cell);
      if (grade !== "" && !/^[A-Z]{1,2}$/.test(grade)) changed(page, `grade "${grade}" isn't a grade`);
      return grade || null;
    }),
    curriculumSemester: detail.of("semester", header.cell(cells, "semester"), (cell) => intOrNull(page, textOf(cell), "curriculum semester")),
    onTranscript: detail.of("mark", header.cell(cells, "mark"), (cell) => {
      if (cell.find(".fa-check").length > 0) return true;
      if (cell.find(".fa-times").length > 0) return false;
      return changed(page, "a transcript mark is neither ✓ nor ✗");
    }),
  };
  detail.note(rowText(cells));
  return { ...row, unread: { grade: detail.blank("grade"), mark: detail.blank("mark") } };
}

/** How each row counts, attempt numbers, and SIX's figures next to the app's. */
function assemble(terms: RawTerm[], sksTaken: number | null, sixIpk: SixIpk | null): Transcript {
  const all = terms.flatMap((term) => term.rows);
  const attempts = new Map<string, Row[]>();
  for (const row of all) attempts.set(row.code, [...(attempts.get(row.code) ?? []), row]);

  const standingOf = (row: Row): Standing => {
    if (row.unread.grade || row.unread.mark) return "unknown";
    if (row.grade === null) return "pending";
    if (!isLetterGrade(row.grade)) return "no-points";
    const same = attempts.get(row.code)!;
    if (row.onTranscript) return same.findLast((r) => r.onTranscript && isLetterGrade(r.grade)) === row ? "counted" : "replaced";
    return same.slice(same.indexOf(row) + 1).some((r) => isLetterGrade(r.grade)) ? "replaced" : "off-transcript";
  };
  // A term's IP counts every letter grade, on the transcript or not: a grade or SKS the app can't read leaves it
  // unchecked. The IPK also depends on the mark: a row whose grade or mark it can't read might count in it.
  const sksBlank = (course: TranscriptCourse) => course.sks === null && isLetterGrade(course.grade);
  const built = terms.map((term) => {
    const courses = term.rows.map((raw) => {
      const { unread: _, ...row } = raw;
      return { ...row, standing: standingOf(raw), attempt: attempts.get(raw.code)!.indexOf(raw) + 1 };
    });
    const { sks, ip, ipBlank } = term.footer!;
    const blank = ipBlank || term.rows.some((row) => row.unread.grade) || courses.some(sksBlank);
    return { term: term.term, courses, sks, ip: checkIndex(ip, null, termIndex(courses), blank) };
  });
  const rows = built.flatMap((t) => t.courses);
  const counted = rows.filter((c) => c.standing === "counted");
  const unchecked = sixIpk === null || rows.some((c) => c.standing === "unknown") || counted.some(sksBlank);
  return { terms: built, sksTaken, ipk: checkIndex(sixIpk?.value ?? null, sixIpk?.sks ?? null, cumulativeIndex(counted), unchecked) };
}
