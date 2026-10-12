// SIX's student status page (/app/mahasiswa:{nim}/statusmhs): who the
// Student is, this term, and the term's courses with class, SKS and the exact
// attendance count. Also the NIM, from SIX's home page.
import type { SixCourse, SixStudent } from "../../../core/models";
import { COURSE_CODE, changed, clean, links, type Nodes, type Page, parse } from "./html";

export interface StatusPage {
  student: SixStudent;
  courses: SixCourse[];
}

const PAGE = "statusmhs";
/** "Semester 1-2026/2027" in the course list's title: term 1 of 2026/2027 is "2026-1". */
const TERM = /\b([123])\s*-\s*(\d{4})\s*\/\s*(\d{4})\b/;
/** Links that carry SIX's own id for the Student. */
const STUDENT_ID = [/\/kelas\/jadwal\/mahasiswa\/(\d+)/, /\/transkrip\/(?:historis|kurikulum)\/(\d+)/, /[?&]mahasiswa_id=(\d+)/];
/** The course table: row number, code, name, class, SKS, attendance, grade. */
const COLUMNS = 7;

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

  const { term, courses } = readCourseList($);
  const program = readProgram($, nim);
  return { student: { nim, name, studentId, term, program: program?.name ?? null, programCode: program?.code ?? null }, courses };
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

function readCourseList($: Page): { term: string; courses: SixCourse[] } {
  const panel = $(".panel")
    .filter((_, el) => TERM.test(clean($(el).find(".panel-title").first().text())))
    .first();
  const title = TERM.exec(clean(panel.find(".panel-title").first().text()));
  if (!title) throw changed(PAGE, "this term's course list is missing");
  const [, half, first, second] = title;
  if (Number(second) !== Number(first) + 1) throw changed(PAGE, "the term's years don't follow each other");

  const rows = panel
    .find("table")
    .first()
    .find("tr")
    .toArray()
    .map((tr) => $(tr).children("th, td"));
  const header = rows[0];
  if (!header || header.length !== COLUMNS || header.filter("td").length > 0) throw changed(PAGE, "the course table has a different layout");

  const courses = rows.slice(1).map((cells, index) => {
    const at = `course ${index + 1}`;
    if (cells.length !== COLUMNS) throw changed(PAGE, `${at} has ${cells.length} cells`);
    const text = (column: number) => clean(cells.eq(column).text());
    const code = text(1);
    const name = text(2);
    const classNo = text(3);
    const sks = text(4);
    if (!COURSE_CODE.test(code)) throw changed(PAGE, `${at} has no course code`);
    if (!name || COURSE_CODE.test(name)) throw changed(PAGE, `${at} has no name`);
    if (classNo !== "" && !/^\d{1,3}$/.test(classNo)) throw changed(PAGE, `${at} has no class number`);
    if (!/^\d{1,2}$/.test(sks)) throw changed(PAGE, `${at} has no SKS`);
    return { code, name, classNo: classNo || null, sks: Number(sks), attendance: readAttendance($, cells.eq(5), at) };
  });
  return { term: `${first}-${half}`, courses };
}

/**
 * The attendance cell shows a percentage; its tooltip has the exact count
 * ("Hadir 4 dari 6 pertemuan"). The two numbers are read whatever the wording,
 * and must agree with the percentage shown.
 */
function readAttendance($: Page, cell: Nodes, at: string): SixCourse["attendance"] {
  const shown = clean(cell.text());
  const titles = cell
    .find("[title]")
    .toArray()
    .map((el) => clean($(el).attr("title") ?? ""))
    .filter((title) => /\d/.test(title));
  if (shown === "" || shown === "-") {
    if (titles.length) throw changed(PAGE, `${at}: attendance count without a percentage`);
    return null;
  }
  const numbers = titles.length === 1 ? titles[0].match(/\d+/g) : null;
  if (numbers?.length !== 2) throw changed(PAGE, `${at}: attendance without its count`);
  const [attended, held] = numbers.map(Number);
  if (attended > held) throw changed(PAGE, `${at}: attended more meetings than were held`);
  if (held === 0) return { attended, held };
  const percent = /^(\d{1,3})(?:[.,](\d+))?\s*%$/.exec(shown);
  if (!percent) throw changed(PAGE, `${at}: attendance isn't a percentage`);
  const value = Number(`${percent[1]}.${percent[2] ?? "0"}`);
  // Within the rounding of the digits SIX shows.
  const tolerance = 0.5 * 10 ** -(percent[2]?.length ?? 0) + 1e-9;
  if (Math.abs((attended / held) * 100 - value) > tolerance) throw changed(PAGE, `${at}: attendance count and percentage disagree`);
  return { attended, held };
}
