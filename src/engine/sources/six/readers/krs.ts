// Reads the term's study plan (/registrasi/rencanastudi/{sid}): when it was
// sent, approved by the academic advisor and made official, its change round
// (URS), the UKT payment, and its courses with the advisor's approval per
// course. The advisor chat on the same page is never read. A course whose
// code it can't read is left out (skipped); a class, SKS, approval or time it
// can't read is left blank and its row noted.
import { type KrsCourse, type KrsPlan, type KrsState, type KrsSteps, type KrsStepTime, stepDone } from "../../../../core/models";
import type { Skipped } from "../../skipped";
import {
  COURSE_COLUMNS,
  type Column,
  cellsOf,
  changed,
  columns,
  details,
  type Elem,
  field,
  int,
  labelsOf,
  noteBlank,
  openPage,
  type Page,
  rowsOf,
  rowText,
  rupiah,
  stamp,
  termFromHeading,
  textOf,
  widthOf,
} from "./records-common";

const COURSE_HEADER = ["Kode", "Mata Kuliah", "Kelas", "SKS", "Disetujui"];
const PLAN_COLUMNS = {
  ...COURSE_COLUMNS,
  classNo: { labels: ["Kelas", "Class"] },
  approved: { labels: ["Disetujui", "Approved"] },
} satisfies Record<string, Column>;
type Step = KrsStepTime | "ukt";
/** The status rows of each round, as recorded; on English pages they're taken in this order. */
const PLAN_STEPS: [string, Step][] = [
  ["Pengiriman Rencana Studi", "sentAt"],
  ["Persetujuan Dosen Wali", "approvedAt"],
  ["Pembayaran UKT", "ukt"],
  ["Pengesahan KSM", "legalizedAt"],
];
const CHANGE_STEPS: [string, Step][] = [
  ["Pengiriman Rencana Studi", "sentAt"],
  ["Persetujuan Dosen Wali", "approvedAt"],
  ["Pengesahan KSM Pengganti", "legalizedAt"],
];
const CHANGE_HEADING = "Penggantian Rencana Studi (URS)";

export function readKrs(html: string, skipped?: Skipped): KrsPlan {
  const page = openPage(html, "KRS", skipped);
  const heading = page.$(".page-header h1 small").first();
  if (heading.length !== 1) changed(page, "it names no term");
  const tables = page
    .$("table")
    .toArray()
    .map((table) => page.$(table));
  // Student data, the registration status, then the courses.
  const [data, status, courses] = tables as [Elem | undefined, Elem | undefined, Elem | undefined];
  if (!data || !status || !courses) changed(page, "its tables moved");
  const advisor = field(page, data, ["Dosen Wali", "Academic Advisor", "Advisor"], 6);
  const maxSks = field(page, data, ["Maksimal Beban", "Maximum Load", "Max Load"], 10);
  const detail = details(page);
  const max = detail.of("maxSks", maxSks, (cell) => int(page, /^\d+/.exec(textOf(cell))?.[0] ?? textOf(cell), "maximum SKS"));
  detail.note(maxSks ? rowText(cellsOf(page, maxSks.parent())) : "");

  const { plan, change, ukt } = readStatus(page, status);
  const { list, sks } = readCourses(page, courses);
  const latest = change && stepDone(change, "sentAt") ? change : plan;
  const state: KrsState = stepDone(latest, "legalizedAt")
    ? "official"
    : stepDone(latest, "approvedAt")
      ? "approved"
      : stepDone(latest, "sentAt")
        ? "sent"
        : "not-sent";
  return {
    term: termFromHeading(page, textOf(heading), "plan heading"),
    advisor: advisor ? textOf(advisor) || null : null,
    maxSks: max,
    state,
    plan,
    change,
    ukt,
    courses: list,
    sks,
  };
}

function readStatus(page: Page, table: Elem): { plan: KrsSteps; change: KrsSteps | null; ukt: KrsPlan["ukt"] } {
  // The plan's rows, then (after its heading row) the change round's.
  const rounds: Elem[][][] = [[]];
  for (const row of rowsOf(page, table)) {
    const cells = cellsOf(page, row);
    if (cells.length === 1) {
      if (page.lang === "id" && textOf(cells[0]!) !== CHANGE_HEADING) changed(page, `status heading "${textOf(cells[0]!)}" isn't known`);
      rounds.push([]);
    } else if (cells.length === 2 && cells[0]!.is("th")) {
      rounds.at(-1)!.push(cells);
    } else changed(page, "a status row has the wrong cells");
  }
  if (rounds.length > 2) changed(page, "it shows more than one change round");

  let ukt: KrsPlan["ukt"] = null;
  const [plan, change] = rounds.map((rows, round) => {
    const known = round === 0 ? PLAN_STEPS : CHANGE_STEPS;
    const steps: KrsSteps = { sentAt: null, approvedAt: null, legalizedAt: null };
    const undated: KrsStepTime[] = [];
    const seen = new Set<Step>();
    if (page.lang !== "id" && rows.length !== known.length) changed(page, "a status round has unknown rows");
    rows.forEach(([head, value], i) => {
      const label = textOf(head!);
      const step = page.lang === "id" ? known.find(([name]) => name === label)?.[1] : known[i]![1];
      if (!step) return; // A row the app doesn't use.
      seen.add(step);
      const detail = details(page);
      if (step === "ukt")
        ukt = {
          paid: head!.parent().hasClass("success"),
          amount: /\d/.test(textOf(value!)) ? detail.of(step, value!, (cell) => rupiah(page, textOf(cell), "UKT")) : null,
        };
      else {
        // A time it can't read: SIX shows the step done (the cell holds a date), just not when.
        steps[step] = detail.of(step, value!, (cell) => stamp(page, cell.text(), label));
        if (detail.blank(step)) undated.push(step);
      }
      detail.note(rowText([head!, value!]));
    });
    // Sent, approved and made official are what the app shows: without one of them the state would be wrong.
    const missing = known.find(([, step]) => step !== "ukt" && !seen.has(step));
    if (missing) changed(page, `the ${round === 0 ? "plan" : "change"} round has no ${missing[0]} row`);
    return undated.length ? { ...steps, undated } : steps;
  });
  return { plan: plan!, change: change ?? null, ukt };
}

function readCourses(page: Page, table: Elem): { list: KrsCourse[]; sks: number | null } {
  const [header, ...rows] = rowsOf(page, table).map((row) => cellsOf(page, row));
  const course = columns(page, header ? labelsOf(header) : [], PLAN_COLUMNS, COURSE_HEADER, "the course header");
  // The total row: an empty cell over the columns before SKS, the SKS, an empty cell.
  const total = Number(rows.at(-1)?.[0]?.attr("colspan")) > 1 ? rows.pop()! : null;
  const list = page.skipped.each(rows, rowText, (cells) => {
    if (widthOf(cells) !== course.width) changed(page, `a course row has ${cells.length} cells`);
    const code = textOf(course.need(cells, "code"));
    if (!/^[A-Z]{2}\d{4}$/.test(code)) changed(page, `"${code}" isn't a course code`);
    const detail = details(page);
    const read: KrsCourse = {
      code,
      name: textOf(course.need(cells, "name")),
      classNo: detail.of("classNo", course.cell(cells, "classNo"), textOf),
      sks: detail.of("sks", course.cell(cells, "sks"), (cell) => int(page, textOf(cell), "SKS")),
      approved: detail.of("approved", course.cell(cells, "approved"), (cell) => cell.find(".fa-check").length > 0),
    };
    detail.note(rowText(cells));
    return read;
  });
  if (!total) {
    noteBlank(page, (header ?? []).map(textOf).filter(Boolean).join(" · "), "the SKS total is missing");
    return { list, sks: null };
  }
  const detail = details(page);
  const sks = detail.of("sks", course.cell(total, "sks"), (cell) => int(page, textOf(cell), "SKS total"));
  detail.note(rowText(total));
  return { list, sks };
}
