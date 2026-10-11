// Reads the term's study plan (/registrasi/rencanastudi/{sid}): when it was
// sent, approved by the academic advisor and made official, its change round
// (URS), the UKT payment, and its courses with the advisor's approval per
// course. The advisor chat on the same page is never read.
import type { KrsCourse, KrsPlan, KrsState, KrsSteps } from "../../../../core/models";
import { cellsOf, changed, type Elem, expectLabels, field, int, openPage, type Page, rowsOf, rupiah, stamp, termFromHeading, textOf } from "./records-common";

const COURSE_HEADER = ["Kode", "Mata Kuliah", "Kelas", "SKS", "Disetujui"];
type Step = keyof KrsSteps | "ukt";
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

export function readKrs(html: string): KrsPlan {
  const page = openPage(html, "KRS");
  const heading = page.$(".page-header h1 small").first();
  if (heading.length !== 1) changed(page, "it names no term");
  const tables = page.$("table").toArray().map((table) => page.$(table));
  // Student data, the registration status, then the courses.
  const [data, status, courses] = tables as [Elem | undefined, Elem | undefined, Elem | undefined];
  if (!data || !status || !courses) changed(page, "its tables moved");
  const advisor = field(page, data, "Dosen Wali", 6);
  const maxSks = field(page, data, "Maksimal Beban", 10);

  const { plan, change, ukt } = readStatus(page, status);
  const { list, sks } = readCourses(page, courses);
  const latest = change?.sentAt ? change : plan;
  const state: KrsState = latest.legalizedAt ? "official" : latest.approvedAt ? "approved" : latest.sentAt ? "sent" : "not-sent";
  return {
    term: termFromHeading(page, textOf(heading), "plan heading"),
    advisor: advisor ? textOf(advisor) || null : null,
    maxSks: maxSks ? int(page, /^\d+/.exec(textOf(maxSks))?.[0] ?? textOf(maxSks), "maximum SKS") : null,
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
    const seen = new Set<Step>();
    if (page.lang !== "id" && rows.length !== known.length) changed(page, "a status round has unknown rows");
    rows.forEach(([head, value], i) => {
      const label = textOf(head!);
      const step = page.lang === "id" ? known.find(([name]) => name === label)?.[1] : known[i]![1];
      if (!step) return; // A row the app doesn't use.
      seen.add(step);
      if (step === "ukt") ukt = { paid: head!.parent().hasClass("success"), amount: /\d/.test(textOf(value!)) ? rupiah(page, textOf(value!), "UKT") : null };
      else steps[step] = stamp(page, value!.text(), label);
    });
    // Sent, approved and made official are what the app shows: without one of them the state would be wrong.
    const missing = known.find(([, step]) => step !== "ukt" && !seen.has(step));
    if (missing) changed(page, `the ${round === 0 ? "plan" : "change"} round has no ${missing[0]} row`);
    return steps;
  });
  return { plan: plan!, change: change ?? null, ukt };
}

function readCourses(page: Page, table: Elem): { list: KrsCourse[]; sks: number } {
  const [header, ...rows] = rowsOf(page, table).map((row) => cellsOf(page, row));
  expectLabels(page, (header ?? []).map(textOf), COURSE_HEADER, "the course header");
  const total = rows.pop();
  // The total row: an empty cell over three columns, the SKS, an empty cell.
  if (total?.length !== 3 || total[0]!.attr("colspan") !== "3") changed(page, "the SKS total is missing");
  const list = rows.map((cells) => {
    if (cells.length !== COURSE_HEADER.length) changed(page, `a course row has ${cells.length} cells`);
    const [code, name, classNo, sks, approved] = cells as [Elem, Elem, Elem, Elem, Elem];
    if (!/^[A-Z]{2}\d{4}$/.test(textOf(code))) changed(page, `"${textOf(code)}" isn't a course code`);
    return { code: textOf(code), name: textOf(name), classNo: textOf(classNo), sks: int(page, textOf(sks), "SKS"), approved: approved.find(".fa-check").length > 0 };
  });
  return { list, sks: int(page, textOf(total[1]!), "SKS total") };
}
