// Reads SIX's graduation progress (/statusmhs/transkrip/kurikulum/{sid},
// "Transkrip Posisi Kurikulum"): the Student's courses placed in their
// curriculum by stage and recommended semester, SIX's IP and passed SKS per
// stage, the IPK, and SKS by kind of course.
import { type CourseKind, checkIndex, type Progress, type ProgressCourse, type ProgressStage, termIndex } from "../../../../core/models";
import {
  cellsOf,
  changed,
  clean,
  codeWithCurriculum,
  type Elem,
  expectLabels,
  field,
  indexValue,
  int,
  openPage,
  type Page,
  rowsOf,
  textOf,
} from "./records-common";
import type { SixIpk } from "./transcript";

const HEADER = ["", "Kode", "Mata Kuliah", "Sifat", "SKS", "Nilai", "Semester Pengambilan"];
const KINDS_HEADER = ["Jenis Mata Kuliah", "SKS"];
/** "Sifat": W wajib, PD pilihan dalam prodi, PL pilihan luar prodi. */
const KIND_CODES: Record<string, CourseKind> = { W: "required", PD: "program-elective", PL: "outside-elective" };
const KIND_LABELS: Record<string, CourseKind> = { wajib: "required", "pilihan dalam prodi": "program-elective", "pilihan luar prodi": "outside-elective" };

/** The progress, and SIX's IPK with the SKS it covers (to check the transcript's). */
export function readProgress(html: string): { progress: Progress; ipk: SixIpk } {
  const page = openPage(html, "curriculum position");
  const tables = page
    .$("table")
    .toArray()
    .map((table) => page.$(table));
  const maps = tables.filter((table) => table.find("tr.info").length > 0);
  if (tables.length < 3 || maps.length !== 1) changed(page, "its tables moved");
  const [data, kinds] = tables as [Elem, Elem];

  const entry = field(page, data, "Tahun Masuk", 5);
  const ipk = field(page, data, "Indeks Prestasi Kumulatif", 7);
  const sks = field(page, data, "SKS", 8);
  if (!entry || !ipk || !sks) changed(page, "the student data lost a row");
  const [sksPassed, sksIncomplete] = passedAndIncomplete(page, textOf(sks));
  const ipkValue = indexValue(page, textOf(ipk), "IPK");
  // SIX says what its IPK covers in a tooltip: "dari 125 SKS".
  const ipkSks = /(\d+)/.exec(ipk.find("[title]").attr("title") ?? "")?.[1];

  return {
    progress: {
      entryTerm: entryTerm(page, textOf(entry)),
      ipk: ipkValue,
      sksPassed,
      sksIncomplete,
      sksByKind: readKinds(page, kinds),
      stages: readStages(page, maps[0]!),
    },
    ipk: { value: ipkValue, sks: ipkSks === undefined ? null : Number(ipkSks) },
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
  if (!header) changed(page, "the SKS by kind table is empty");
  expectLabels(page, header.map(textOf), KINDS_HEADER, "the SKS by kind header");
  return rows.map((cells) => {
    if (cells.length !== 2) changed(page, "an SKS by kind row has the wrong cells");
    const label = textOf(cells[0]!);
    return { kind: (page.lang === "id" && KIND_LABELS[label.toLowerCase()]) || "other", label, sks: int(page, textOf(cells[1]!), "SKS by kind") };
  });
}

interface StageDraft {
  name: string;
  ip: number | null;
  sksPassed: number;
  semesters: { semester: number; courses: ProgressCourse[] }[];
}

function readStages(page: Page, table: Elem): ProgressStage[] {
  const stages: StageDraft[] = [];
  let total = false;
  for (const row of rowsOf(page, table)) {
    const cells = cellsOf(page, row);
    const stage = stages.at(-1);
    if (total || cells.length === 0) changed(page, "a row is out of place");
    if (row.hasClass("info")) {
      // A stage heading has one cell; the overall total ("Semua (IPK … / SKS Lulus …)") has two.
      const figures = stageFigures(page, textOf(cells[0]!), cells.length === 1 ? "IP" : "IPK");
      if (cells.length === 1) stages.push({ ...figures, semesters: [] });
      else if (cells.length === 2) total = true;
      else changed(page, "a stage heading has the wrong cells");
    } else if (row.hasClass("warning")) {
      if (!stage || cells.length !== 1) changed(page, "a semester heading is out of place");
      const text = textOf(cells[0]!);
      if (page.lang === "id" && !/^Kurikulum Semester \d+$/.test(text)) changed(page, `semester heading "${text}" isn't readable`);
      stage.semesters.push({ semester: int(page, /(\d+)$/.exec(text)?.[1] ?? text, "curriculum semester"), courses: [] });
    } else if (cells.every((cell) => cell.is("th"))) {
      expectLabels(page, cells.map(textOf), HEADER, "the course header");
    } else {
      const semester = stage?.semesters.at(-1);
      if (!semester) changed(page, "a course row is outside a semester");
      semester.courses.push(readCourse(page, cells));
    }
  }
  if (!total) changed(page, "the overall total is missing");
  return stages.map((stage) => {
    const courses = stage.semesters.flatMap((s) => s.courses);
    return { name: stage.name, ip: checkIndex(stage.ip, null, termIndex(courses)), sksPassed: stage.sksPassed, semesters: stage.semesters };
  });
}

/** "Tahap Sarjana (IP 3.18 / SKS Lulus 107)" → the name, SIX's IP and passed SKS. */
function stageFigures(page: Page, text: string, index: "IP" | "IPK"): Omit<StageDraft, "semesters"> {
  const match = /^(.*?)\s*\((.*)\)$/.exec(text);
  const [ip, sks] = match?.[2]?.split("/").map(clean) ?? [];
  if (!match || ip === undefined || sks === undefined) changed(page, `stage "${text}" isn't readable`);
  if (page.lang === "id" && !(new RegExp(`^${index} \\S+$`).test(ip) && /^SKS Lulus \d+$/.test(sks))) changed(page, `stage "${text}" isn't readable`);
  return { name: match[1]!, ip: indexValue(page, ip.split(" ").at(-1)!, "stage IP"), sksPassed: int(page, sks.split(" ").at(-1)!, "stage SKS") };
}

function readCourse(page: Page, cells: Elem[]): ProgressCourse {
  const [, codeCell, name, kindCell, sks, ...rest] = cells as [Elem, Elem, Elem, Elem, Elem, ...Elem[]];
  if (cells.length < 6) changed(page, `a course row has ${cells.length} cells`);
  const kindCode = textOf(kindCell);
  const base = {
    ...codeWithCurriculum(page, codeCell, "course code"),
    name: textOf(name),
    kind: KIND_CODES[kindCode] ?? ("other" as const),
    kindCode,
    sks: int(page, textOf(sks), "SKS"),
  };
  if (rest.length === 2) {
    const grade = textOf(rest[0]!);
    const term = textOf(rest[1]!);
    if (!/^\d{4}-[123]$/.test(term) || (grade !== "" && !/^[A-Z]{1,2}$/.test(grade))) changed(page, `course ${base.code} reads "${grade}" in "${term}"`);
    return { ...base, status: grade ? "graded" : "in-progress", grade: grade || null, term, note: null };
  }
  // Not graded, in one cell over two columns: a green label for exempt (its title says why), a red one for not taken.
  const label = rest[0]?.find(".label");
  if (rest.length !== 1 || rest[0]!.attr("colspan") !== "2" || label?.length !== 1) changed(page, `course ${base.code} has an unknown status`);
  if (label.hasClass("label-success")) return { ...base, status: "exempt", grade: null, term: null, note: label.attr("title")?.trim() || null };
  if (label.hasClass("label-danger")) return { ...base, status: "not-taken", grade: null, term: null, note: null };
  return changed(page, `course ${base.code} has an unknown status "${textOf(label)}"`);
}
