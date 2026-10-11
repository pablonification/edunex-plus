// Reads SIX's transcript by semester (/statusmhs/transkrip/historis/{sid}):
// every course per term with its grade, SIX's IP per term, and SKS totals.
// Works out how each row counts (retakes, rows off the transcript, T and
// missing grades) and checks SIX's IP and IPK against the rows.
import { checkIndex, cumulativeIndex, isLetterGrade, type Standing, termIndex, type Transcript, type TranscriptCourse } from "../../../../core/models";
import { cellsOf, changed, codeWithCurriculum, type Elem, expectLabels, indexValue, int, intOrNull, openPage, type Page, rowsOf, termFromHeading, textOf } from "./records-common";

const HEADER = ["", "Kode", "Mata Kuliah", "SKS", "Nilai", "Semester Kurikulum", "Masuk Transkrip"];

/** SIX's IPK and the SKS it says it covers, from the curriculum-position page. */
export interface SixIpk {
  value: number | null;
  sks: number | null;
}

type Row = Omit<TranscriptCourse, "standing" | "attempt">;
interface RawTerm {
  term: string;
  rows: Row[];
  footer: { sks: number; ip: number | null } | null;
}

export function readTranscript(html: string, sixIpk: SixIpk): Transcript {
  const page = openPage(html, "transcript");
  const tables = page.$("table").filter((_, table) => page.$(table).find("tr.info").length > 0);
  if (tables.length !== 1) changed(page, "no table of semesters");

  const terms: RawTerm[] = [];
  let sksTaken: number | null = null;
  for (const row of rowsOf(page, tables.first())) {
    const cells = cellsOf(page, row);
    const current = terms.at(-1);
    if (row.hasClass("info")) {
      if (cells.length !== 1) changed(page, "a semester heading has several cells");
      terms.push({ term: termFromHeading(page, textOf(cells[0]!), "semester heading"), rows: [], footer: null });
    } else if (row.hasClass("warning")) {
      if (!current || cells.length !== 3) changed(page, "a total row is out of place");
      if (current.footer) sksTaken = int(page, textOf(cells[1]!), "SKS taken");
      else current.footer = { sks: int(page, textOf(cells[1]!), "semester SKS"), ip: termIp(page, textOf(cells[2]!)) };
    } else if (cells.every((cell) => cell.is("th"))) {
      expectLabels(page, cells.map(textOf), HEADER, "the course header");
    } else {
      if (!current || current.footer) changed(page, "a course row is outside a semester");
      current.rows.push(readRow(page, cells));
    }
  }
  if (terms.some((t) => !t.footer) || sksTaken === null) changed(page, "a total row is missing");
  if (new Set(terms.map((t) => t.term)).size !== terms.length) changed(page, "a semester appears twice");
  // Oldest first, whatever SIX's order: which attempt of a course is the newest depends on it.
  return assemble(terms.sort((a, b) => a.term.localeCompare(b.term)), sksTaken, sixIpk);
}

function termIp(page: Page, text: string): number | null {
  const match = /^(\S+)\s+(\S+)$/.exec(text);
  if (!match || (page.lang === "id" && match[1] !== "NR")) changed(page, `semester IP "${text}" isn't readable`);
  return indexValue(page, match[2]!, "semester IP");
}

function readRow(page: Page, cells: Elem[]): Row {
  if (cells.length !== HEADER.length) changed(page, `a course row has ${cells.length} cells`);
  const [codeCell, name, sks, grade, semester, mark] = cells.slice(1) as [Elem, Elem, Elem, Elem, Elem, Elem];
  const gradeText = textOf(grade);
  if (gradeText !== "" && !/^[A-Z]{1,2}$/.test(gradeText)) changed(page, `grade "${gradeText}" isn't a grade`);
  const onTranscript = mark.find(".fa-check").length > 0;
  if (!onTranscript && mark.find(".fa-times").length === 0) changed(page, "a transcript mark is neither ✓ nor ✗");
  return {
    ...codeWithCurriculum(page, codeCell, "course code"),
    name: textOf(name),
    sks: int(page, textOf(sks), "SKS"),
    grade: gradeText || null,
    curriculumSemester: intOrNull(page, textOf(semester), "curriculum semester"),
    onTranscript,
  };
}

/** How each row counts, attempt numbers, and SIX's figures next to the app's. */
function assemble(terms: RawTerm[], sksTaken: number, sixIpk: SixIpk): Transcript {
  const all = terms.flatMap((term) => term.rows);
  const attempts = new Map<string, Row[]>();
  for (const row of all) attempts.set(row.code, [...(attempts.get(row.code) ?? []), row]);

  const standingOf = (row: Row): Standing => {
    if (row.grade === null) return "pending";
    if (!isLetterGrade(row.grade)) return "no-points";
    const same = attempts.get(row.code)!;
    if (row.onTranscript) return same.findLast((r) => r.onTranscript && isLetterGrade(r.grade)) === row ? "counted" : "replaced";
    return same.slice(same.indexOf(row) + 1).some((r) => isLetterGrade(r.grade)) ? "replaced" : "off-transcript";
  };

  const built = terms.map((term) => {
    const courses = term.rows.map((row) => ({ ...row, standing: standingOf(row), attempt: attempts.get(row.code)!.indexOf(row) + 1 }));
    return { term: term.term, courses, sks: term.footer!.sks, ip: checkIndex(term.footer!.ip, null, termIndex(courses)) };
  });
  const counted = built.flatMap((t) => t.courses).filter((c) => c.standing === "counted");
  return { terms: built, sksTaken, ipk: checkIndex(sixIpk.value, sixIpk.sks, cumulativeIndex(counted)) };
}
