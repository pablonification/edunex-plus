// Reads SIX's public curriculum pages (Kurikulum 2024): the list of Sarjana
// programs (/pub/kur2024) and one program's page (/pub/kur2024/{id}) with its
// tabs: required courses by semester, specializations, minors,
// multidisciplinary packages and its own course catalog. A page that doesn't
// look the way it did when this was written is a vendor change.
import { type Cheerio, type CheerioAPI, load } from "cheerio";
import type { CatalogMinor, CatalogTrack } from "../../../core/models";
import { EngineError } from "../../errors";

export interface ListedProgram {
  id: string;
  name: string;
  faculty: string;
}

export interface PageCourse {
  code: string;
  name: string;
  sks: number;
  /** Only the catalog tab says. */
  category: string | null;
}

export interface ProgramPage {
  required: { code: string; semester: number }[];
  specializations: CatalogTrack[];
  multidisciplinary: CatalogTrack[];
  minors: CatalogMinor[];
  /** The catalog tab: the courses the program offers, with their category. */
  catalog: PageCourse[];
  /** Every course seen anywhere on the page. */
  courses: PageCourse[];
}

/** "II2210", and ITB-wide ones like "WI201X" (one course, many religions). */
const CODE = /^[A-Z]{2}\d{3}[0-9X]$/;
const PROGRAM_ID = /^\d{3}$/;

// cheerio doesn't export its element type; take it from a selection.
const pick = ($: CheerioAPI, selector: string) => $(selector).first();
type Selection = ReturnType<typeof pick>;
type Element = Selection extends Cheerio<infer T> ? T : never;

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

const changed = (what: string) => new EngineError("VendorChanged", `SIX's catalog ${what}`);

function sksOf(text: string, where: string): number {
  const sks = Number(clean(text));
  if (!Number.isFinite(sks) || clean(text) === "") throw changed(`${where}: "${clean(text)}" isn't a number of SKS`);
  return sks;
}

function headerOf($: CheerioAPI, table: Selection): string[] {
  return table
    .find("tr")
    .filter((_, tr) => $(tr).children("th").length > 0 && !$(tr).hasClass("warning"))
    .first()
    .children("th")
    .map((_, th) => clean($(th).text()))
    .get();
}

function expectHeader($: CheerioAPI, table: Selection, expected: string[], where: string): void {
  const header = headerOf($, table);
  if (header.join("|") !== expected.join("|")) throw changed(`${where}: columns are "${header.join(", ")}"`);
}

/** The Sarjana programs on /pub/kur2024. */
export function readProgramList(html: string): ListedProgram[] {
  const $ = load(html);
  const table = $("#sarjana table").first();
  if (table.length === 0) throw changed("program list has no Sarjana table");
  expectHeader($, table, ["Fakultas", "No Prodi", "Program Studi"], "program list");
  const programs: ListedProgram[] = [];
  table.find("tr").each((_, tr) => {
    const cells = $(tr).children("td");
    if (cells.length === 0) return;
    const [faculty, id, name] = cells.map((_, td) => clean($(td).text())).get();
    if (cells.length !== 3 || !id || !PROGRAM_ID.test(id) || !name) throw changed(`program list: unexpected row "${clean($(tr).text())}"`);
    programs.push({ id, name, faculty: faculty ?? "" });
  });
  if (programs.length === 0) throw changed("program list is empty");
  return programs;
}

/** A row's cells, with a colspan cell repeated so both semester columns line up. */
function cellsOf($: CheerioAPI, tr: Element): string[] {
  const out: string[] = [];
  $(tr)
    .children("td, th")
    .each((_, cell) => {
      const span = Math.max(1, Number($(cell).attr("colspan") ?? 1));
      for (let i = 0; i < span; i++) out.push(i === 0 ? clean($(cell).text()) : "");
    });
  return out;
}

function readRequired($: CheerioAPI, courses: PageCourse[]): ProgramPage["required"] {
  const table = $("#wajib table").first();
  if (table.length === 0) throw changed("program page has no required-courses table");
  const required: ProgramPage["required"] = [];
  let semesters: number[] = [];
  table.find("tr").each((_, tr) => {
    const cells = cellsOf($, tr);
    const heads = cells.filter(Boolean).map((c) => /^Semester (\d+)$/.exec(c)?.[1]);
    if (heads.length > 0 && heads.every(Boolean)) {
      semesters = heads.map(Number);
      return;
    }
    if (cells[0] === "Kode") {
      const expected = semesters.flatMap(() => ["Kode", "Mata Kuliah", "SKS"]);
      if (cells.join("|") !== expected.join("|")) throw changed(`required courses: columns are "${cells.join(", ")}"`);
      return;
    }
    if (semesters.length === 0) throw changed("required courses: a course before any semester");
    semesters.forEach((semester, side) => {
      const [code = "", name = "", sks = ""] = cells.slice(side * 3, side * 3 + 3);
      if (!code && !name && !sks) return; // this side of the row is empty
      if (!CODE.test(code)) throw changed(`required courses: "${code}" isn't a course code`);
      required.push({ code, semester });
      courses.push({ code, name, sks: sksOf(sks, `required course ${code}`), category: null });
    });
  });
  if (required.length === 0) throw changed("program page lists no required courses");
  return required;
}

/** A course table inside a panel: Kode | Mata Kuliah | SKS. */
function readCourseTable($: CheerioAPI, table: Selection, where: string, courses: PageCourse[]): string[] {
  expectHeader($, table, ["Kode", "Mata Kuliah", "SKS"], where);
  const codes: string[] = [];
  table.find("tr").each((_, tr) => {
    const cells = $(tr).children("td");
    if (cells.length === 0) return;
    const [code = "", name = "", sks = ""] = cells.map((_, td) => clean($(td).text())).get();
    if (!CODE.test(code)) throw changed(`${where}: "${code}" isn't a course code`);
    codes.push(code);
    courses.push({ code, name, sks: sksOf(sks, `${where} ${code}`), category: null });
  });
  return codes;
}

/** The named panels of a tab ("Keamanan dan Privasi Siber (12 SKS)" with its courses). */
function readPanels($: CheerioAPI, pane: string, courses: PageCourse[]): { id: string; title: string; sks: number; courses: string[] }[] {
  return $(`#${pane} .panel`)
    .map((_, panel) => {
      const raw = clean($(panel).find(".panel-title").first().text());
      const head = /^(.*?)\s*\((\d+) SKS\)$/.exec(raw);
      if (!head) throw changed(`${pane}: "${raw}" has no SKS`);
      const table = $(panel).find("table").first();
      const id = /(\d+)$/.exec($(panel).parent().attr("id") ?? "")?.[1] ?? "";
      return { id, title: head[1]!, sks: Number(head[2]), courses: table.length ? readCourseTable($, table, `${pane} "${head[1]}"`, courses) : [] };
    })
    .get();
}

/** One program's page. */
export function readProgramPage(html: string): ProgramPage {
  const $ = load(html);
  for (const pane of ["wajib", "spesialisasi", "minor", "katalog"]) if ($(`#${pane}`).length === 0) throw changed(`program page has no "${pane}" tab`);
  const courses: PageCourse[] = [];
  const required = readRequired($, courses);
  const tracks = (pane: string) => readPanels($, pane, courses).map(({ title, sks, courses: codes }) => ({ name: title, sks, courses: codes }));
  const minors = readPanels($, "minor", courses).map(({ id, title, sks, courses: codes }) => {
    // "Matematika - Program Minor Matematika": the offering program, then the package.
    const at = title.indexOf(" - ");
    if (at < 0 || !id) throw changed(`minor "${title}" doesn't name its program`);
    return { id, program: title.slice(0, at), name: title.slice(at + 3), sks, courses: codes };
  });

  const table = $("#katalog table").first();
  if (table.length === 0) throw changed("program page has no catalog table");
  expectHeader($, table, ["Kode", "Mata Kuliah", "Kategori", "SKS"], "catalog");
  const catalog: PageCourse[] = [];
  table.find("tr").each((_, tr) => {
    const cells = $(tr).children("td");
    if (cells.length === 0) return;
    const [code = "", name = "", category = "", sks = ""] = cells.map((_, td) => clean($(td).text())).get();
    if (!CODE.test(code)) throw changed(`catalog: "${code}" isn't a course code`);
    catalog.push({ code, name, category: category || null, sks: sksOf(sks, `catalog ${code}`) });
  });
  if (catalog.length === 0) throw changed("program page's catalog is empty");

  return { required, specializations: tracks("spesialisasi"), multidisciplinary: tracks("multidisiplin"), minors, catalog, courses: [...catalog, ...courses] };
}
