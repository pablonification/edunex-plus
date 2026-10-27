// Reads SIX's graduation progress (/statusmhs/transkrip/kurikulum/{sid},
// "Transkrip Posisi Kurikulum"): the Student's courses placed in their
// curriculum by stage and recommended semester, SIX's IP and passed SKS per
// stage, the IPK, and SKS by kind of course. A course whose code or status it
// can't read, or an SKS by kind row whose kind it can't, is left out
// (skipped); an SKS, grade or term it can't read is left blank and the row
// noted.

import { type CourseKind, checkIndex, isLetterGrade, type Progress, type ProgressCourse, type ProgressStage, termIndex } from "../../../../core/models";
import type { Skipped } from "../../skipped";
import {
  COURSE_COLUMNS,
  type Column,
  type Columns,
  cellsOf,
  changed,
  clean,
  columns,
  courseCode,
  curriculumMark,
  details,
  type Elem,
  field,
  indexValue,
  int,
  labelsOf,
  noteBlank,
  openPage,
  type Page,
  rowsOf,
  rowText,
  textOf,
  widthOf,
} from "./records-common";
import type { SixIpk } from "./transcript";

const HEADER = ["", "Kode", "Mata Kuliah", "Sifat", "SKS", "Nilai", "Semester Pengambilan"];
// Without the grade column a course can't be told graded from in progress, and without the kind the planner can't tell
// a required course from an elective: no blank fits either, so a page without them is refused.
const COLUMNS = {
  ...COURSE_COLUMNS,
  kind: { labels: ["Sifat", "Type"], required: true },
  grade: { labels: ["Nilai", "Grade"], required: true },
  term: { labels: ["Semester Pengambilan", "Term Taken", "Semester Taken"] },
} satisfies Record<string, Column>;
type Header = Columns<keyof typeof COLUMNS>;
const KINDS_HEADER = ["Jenis Mata Kuliah", "SKS"];
const KINDS_COLUMNS = {
  label: { labels: ["Jenis Mata Kuliah", "Course Type"], required: true },
  sks: { labels: ["SKS", "Credits", "Credit"] },
} satisfies Record<string, Column>;
/** "Sifat": W wajib, PD pilihan dalam prodi, PL pilihan luar prodi. */
const KIND_CODES: Record<string, CourseKind> = { W: "required", PD: "program-elective", PL: "outside-elective" };
const KIND_LABELS: Record<string, CourseKind> = { wajib: "required", "pilihan dalam prodi": "program-elective", "pilihan luar prodi": "outside-elective" };

/** The progress, and SIX's IPK with the SKS it covers (to check the transcript's); null when the app can't read it. */
export function readProgress(html: string, skipped?: Skipped): { progress: Progress; ipk: SixIpk | null } {
  const page = openPage(html, "curriculum position", skipped);
  const tables = page
    .$("table")
    .toArray()
    .map((table) => page.$(table));
  const maps = tables.filter((table) => table.find("tr.info").length > 0);
  if (tables.length < 3 || maps.length !== 1) changed(page, "its tables moved");
  const [data, kinds] = tables as [Elem, Elem];

  // The Student's figures: each one SIX writes another way, or doesn't show, is blank, and noted.
  const figure = <T>(labels: string[], position: number, parse: (cell: Elem) => T) => {
    const cell = field(page, data, labels, position);
    if (!cell) {
      noteBlank(page, labels[0]!, `the student data has no ${labels[0]} row`);
      return { cell, value: null, blank: true };
    }
    const detail = details(page);
    const value = detail.of("figure", cell, parse);
    detail.note(rowText(cellsOf(page, cell.parent())));
    return { cell, value, blank: detail.blank("figure") };
  };
  const entry = figure(["Tahun Masuk", "Year of Entry", "Entry Year"], 5, (cell) => entryTerm(page, textOf(cell)));
  const ipk = figure(["Indeks Prestasi Kumulatif", "GPA", "Cumulative GPA"], 7, (cell) => indexValue(page, textOf(cell), "IPK"));
  const sks = figure(["SKS", "Credits"], 8, (cell) => passedAndIncomplete(page, textOf(cell)));
  // SIX says what its IPK covers in a tooltip: "dari 125 SKS".
  const ipkSks = /(\d+)/.exec(ipk.cell?.find("[title]").attr("title") ?? "")?.[1];

  return {
    progress: {
      entryTerm: entry.value,
      ipk: ipk.value,
      sksPassed: sks.value?.[0] ?? null,
      sksIncomplete: sks.value?.[1] ?? null,
      sksByKind: readKinds(page, kinds),
      stages: readStages(page, maps[0]!),
    },
    ipk: ipk.blank ? null : { value: ipk.value, sks: ipkSks === undefined ? null : Number(ipkSks) },
  };
}

/** "2023 semester 1" → "2023-1". */
function entryTerm(page: Page, text: string): string | null {
  if (text === "") return null;
  const match = /^(\d{4})\D+([123])$/.exec(text);
  if (!match) changed(page, `entry term "${text}" isn't a term`);
  return `${match[1]}-${match[2]}`;
}

/** "Lulus 125 SKS / Nilai T 0 SKS": SKS passed and SKS graded T. */
function passedAndIncomplete(page: Page, text: string): [number, number] {
  const numbers = text.match(/\d+/g) ?? [];
  if (numbers.length !== 2 || (page.lang === "id" && !/^Lulus \d+ SKS \/ Nilai T \d+ SKS$/.test(text))) changed(page, `SKS "${text}" isn't readable`);
  return [Number(numbers[0]), Number(numbers[1])];
}

function readKinds(page: Page, table: Elem): Progress["sksByKind"] {
  const [header, ...rows] = rowsOf(page, table).map((row) => cellsOf(page, row));
  const kind = columns(page, header ? labelsOf(header) : [], KINDS_COLUMNS, KINDS_HEADER, "the SKS by kind header");
  return page.skipped.each(rows, rowText, (cells) => {
    if (widthOf(cells) !== kind.width) changed(page, "an SKS by kind row has the wrong cells");
    const label = textOf(kind.cell(cells, "label")!);
    const detail = details(page);
    const sks = detail.of("sks", kind.cell(cells, "sks"), (cell) => int(page, textOf(cell), "SKS by kind"));
    detail.note(rowText(cells));
    return { kind: (page.lang === "id" && KIND_LABELS[label.toLowerCase()]) || "other", label, sks };
  });
}

interface StageDraft {
  name: string;
  ip: number | null;
  sksPassed: number | null;
  semesters: { semester: number; courses: ProgressCourse[] }[];
  /** SIX's IP for the stage, or a course's grade in it, is written in a way the app can't read yet: its IP goes unchecked. */
  unread: boolean;
}

function readStages(page: Page, table: Elem): ProgressStage[] {
  const stages: StageDraft[] = [];
  const list = page.skipped.list();
  let header: Header | null = null;
  let total = false;
  for (const row of rowsOf(page, table)) {
    const cells = cellsOf(page, row);
    const stage = stages.at(-1);
    if (total || cells.length === 0) changed(page, "a row is out of place");
    if (row.hasClass("info")) {
      // A stage heading has one cell; the overall total ("Semua (IPK … / SKS Lulus …)") has two, and nothing in it is read.
      if (cells.length === 1) stages.push({ ...readStageHeading(page, cells[0]!), semesters: [] });
      else if (cells.length === 2) total = true;
      else changed(page, "a stage heading has the wrong cells");
    } else if (row.hasClass("warning")) {
      if (!stage || cells.length !== 1) changed(page, "a semester heading is out of place");
      const text = textOf(cells[0]!);
      if (page.lang === "id" && !/^Kurikulum Semester \d+$/.test(text)) changed(page, `semester heading "${text}" isn't readable`);
      stage.semesters.push({ semester: int(page, /(\d+)$/.exec(text)?.[1] ?? text, "curriculum semester"), courses: [] });
    } else if (cells.every((cell) => cell.is("th"))) {
      header = columns(page, labelsOf(cells), COLUMNS, HEADER, "the course header");
    } else {
      const semester = stage?.semesters.at(-1);
      if (!semester) changed(page, "a course row is outside a semester");
      if (!header) changed(page, "a course row comes before its header");
      const under = header;
      const course = list.item(rowText(cells), () => readCourse(page, under, cells));
      if (course) {
        semester.courses.push(course.course);
        if (course.unread) stage!.unread = true;
      }
    }
  }
  list.done();
  if (!total) changed(page, "the overall total is missing");
  return stages.map((stage) => {
    const courses = stage.semesters.flatMap((s) => s.courses);
    const blank = stage.unread || courses.some((c) => c.sks === null && isLetterGrade(c.grade));
    return { name: stage.name, ip: checkIndex(stage.ip, null, termIndex(courses), blank), sksPassed: stage.sksPassed, semesters: stage.semesters };
  });
}

/**
 * "Tahap Sarjana (IP 3.18 / SKS Lulus 107)": the stage's name, which its rows sit under, then SIX's IP and passed SKS.
 * A figure the app can't read is blank, and the heading noted.
 */
function readStageHeading(page: Page, cell: Elem): Omit<StageDraft, "semesters"> {
  const text = textOf(cell);
  const match = /^(.*?)\s*\((.*)\)$/.exec(text);
  if (!match?.[1]) changed(page, `stage "${text}" isn't readable`);
  const [ip, sks] = match[2]!.split("/").map(clean);
  const detail = details(page);
  const figures = {
    name: match[1],
    ip: detail.of("ip", cell, () => {
      if (ip === undefined || (page.lang === "id" && !/^IP \S+$/.test(ip))) changed(page, `stage IP "${ip ?? ""}" isn't readable`);
      return indexValue(page, ip.split(" ").at(-1)!, "stage IP");
    }),
    sksPassed: detail.of("sks", cell, () => {
      if (sks === undefined || (page.lang === "id" && !/^SKS Lulus \d+$/.test(sks))) changed(page, `stage SKS "${sks ?? ""}" isn't readable`);
      return int(page, sks.split(" ").at(-1)!, "stage SKS");
    }),
  };
  detail.note(text);
  return { ...figures, unread: detail.blank("ip") };
}

function readCourse(page: Page, header: Header, cells: Elem[]): { course: ProgressCourse; unread: boolean } {
  if (widthOf(cells) !== header.width) changed(page, `a course row has ${cells.length} cells`);
  const codeCell = header.need(cells, "code");
  const code = courseCode(page, codeCell, "course code");
  const name = textOf(header.need(cells, "name"));
  const kindCode = textOf(header.need(cells, "kind"));
  const gradeCell = header.need(cells, "grade");
  // Not graded, in one cell over the grade and the term: a green label for exempt (its title says why), a red one for not
  // taken. A label it doesn't know leaves the row out: it says whether the course is taken at all, and no blank fits.
  const label = Number(gradeCell.attr("colspan")) > 1 ? gradeCell.find(".label") : null;
  if (label && label.length !== 1) changed(page, `course ${code} has an unknown status`);
  if (label && !label.hasClass("label-success") && !label.hasClass("label-danger")) changed(page, `course ${code} has an unknown status "${textOf(label)}"`);
  const detail = details(page);
  const base = {
    code,
    curriculumYear: detail.of("curriculum", codeCell, (cell) => curriculumMark(page, cell, "course code")),
    name,
    kind: KIND_CODES[kindCode] ?? ("other" as const),
    kindCode,
    sks: detail.of("sks", header.cell(cells, "sks"), (cell) => int(page, textOf(cell), "SKS")),
  };
  let course: ProgressCourse;
  if (label) {
    course = label.hasClass("label-success")
      ? { ...base, status: "exempt", grade: null, term: null, note: label.attr("title")?.trim() || null }
      : { ...base, status: "not-taken", grade: null, term: null, note: null };
  } else {
    const grade = detail.of("grade", gradeCell, (cell) => {
      const text = textOf(cell);
      if (text !== "" && !/^[A-Z]{1,2}$/.test(text)) changed(page, `course ${code}'s grade "${text}" isn't a grade`);
      return text || null;
    });
    const term = detail.of("term", header.cell(cells, "term"), (cell) => {
      const text = textOf(cell);
      if (!/^\d{4}-[123]$/.test(text)) changed(page, `course ${code}'s term "${text}" isn't a term`);
      return text;
    });
    // Graded when SIX shows anything there, even a grade the app can't read yet.
    course = { ...base, status: textOf(gradeCell) ? "graded" : "in-progress", grade, term, note: null };
  }
  detail.note(rowText(cells));
  return { course, unread: detail.blank("grade") };
}
