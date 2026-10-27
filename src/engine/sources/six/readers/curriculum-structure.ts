// Reads a curriculum's structure (/kurikulum/kurikulum/{id}/struktur): the
// required courses by recommended semester, the program's specializations,
// the minors open to the Student, and the program's course catalog. Every
// course carries SIX's id, which leads to its syllabus. A course whose code it
// can't read, or a package or a minor it can't, is left out (skipped); an SKS
// or category it can't read is left blank and the row noted.
import type { Curriculum, CurriculumCourse } from "../../../../core/models";
import type { Skipped } from "../../skipped";
import {
  COURSE_CODE,
  COURSE_COLUMNS,
  type Column,
  type Columns,
  cellsOf,
  changed,
  clean,
  columns,
  courseIdOf,
  details,
  type Elem,
  int,
  labelsOf,
  openPage,
  type Page,
  rowsOf,
  rowText,
  startsOf,
  textOf,
  widthOf,
} from "./records-common";

const COURSE_HEADER = ["Kode", "Mata Kuliah", "SKS"];
const CATALOG_HEADER = ["Kode", "Mata Kuliah", "Kategori", "SKS"];
const CATALOG_COLUMNS = { ...COURSE_COLUMNS, category: { labels: ["Kategori", "Category"] } } satisfies Record<string, Column>;
type CourseColumns = Columns<keyof typeof COURSE_COLUMNS>;

export type CurriculumStructure = Pick<Curriculum, "name" | "required" | "specializations" | "minors" | "catalog">;

export function readCurriculumStructure(html: string, skipped?: Skipped): CurriculumStructure {
  const page = openPage(html, "curriculum structure", skipped);
  const pane = (id: string) => {
    const node = page.$(`.tab-pane#${id}`);
    if (node.length !== 1) changed(page, `the ${id} tab is missing`);
    return node;
  };
  const name = textOf(page.$(".page-header h1").first());
  if (!name) changed(page, "it has no title");
  return {
    name,
    required: readRequired(page, pane("wajib")),
    specializations: page.skipped.each(
      pane("spesialisasi")
        .find(".panel")
        .toArray()
        .map((panel) => page.$(panel)),
      panelTitle,
      (panel) => readPackage(page, panel),
    ),
    minors: readMinors(page, pane("minor")),
    catalog: readCatalog(page, pane("katalog")),
  };
}

/** A course's code, name and SKS: a code it can't read leaves the course out; an SKS, blank and its row noted. */
function course(page: Page, under: CourseColumns, cells: Elem[]): CurriculumCourse {
  const code = under.need(cells, "code");
  const text = textOf(code);
  if (!COURSE_CODE.test(text)) changed(page, `"${text}" isn't a course code`);
  const name = textOf(under.need(cells, "name"));
  const detail = details(page);
  const sks = detail.of("sks", under.cell(cells, "sks"), (cell) => int(page, textOf(cell), `SKS of ${text}`));
  detail.note(rowText(cells));
  return { code: text, name, sks, courseId: courseIdOf(code) };
}

/**
 * Semesters side by side: a heading row names them, each over its columns; a row holds one course (or an empty slot)
 * per semester. Each course is read on its own: one the app doesn't understand leaves only itself out.
 */
function readRequired(page: Page, pane: Elem): Curriculum["required"] {
  const out: Curriculum["required"] = [];
  const list = page.skipped.list();
  let semesters: { semester: number; width: number }[] = [];
  let groups: CourseColumns[] = [];
  for (const table of pane.find("table").toArray()) {
    for (const row of rowsOf(page, page.$(table))) {
      const cells = cellsOf(page, row);
      if (row.hasClass("warning")) {
        semesters = cells.map((cell) => {
          const text = textOf(cell);
          if (page.lang === "id" && !/^Semester \d+$/.test(text)) changed(page, `semester heading "${text}" isn't readable`);
          return { semester: int(page, /(\d+)$/.exec(text)?.[1] ?? text, "semester"), width: widthOf([cell]) };
        });
        groups = [];
      } else if (cells.every((cell) => cell.is("th"))) {
        // Each semester's own columns, found by their labels.
        const labels = labelsOf(cells);
        if (labels.length !== semesters.reduce((sum, s) => sum + s.width, 0)) changed(page, "the required courses header doesn't fit its semesters");
        let at = 0;
        groups = semesters.map(({ width }) => {
          const group = columns(page, labels.slice(at, at + width), COURSE_COLUMNS, COURSE_HEADER, "the required courses header");
          at += width;
          return group;
        });
      } else {
        if (!groups.length) changed(page, "a row of required courses comes before its header");
        if (widthOf(cells) !== semesters.reduce((sum, s) => sum + s.width, 0)) changed(page, "a row of required courses doesn't fit its semesters");
        // Each semester's cells: those that start in its columns. Blank cells (one may span several semesters) are an empty slot.
        const starts = startsOf(cells);
        let from = 0;
        semesters.forEach(({ semester, width }, i) => {
          const slot = cells.filter((_, k) => starts[k]! >= from && starts[k]! < from + width);
          from += width;
          if (slot.every((cell) => textOf(cell) === "")) return;
          const read = list.item(rowText(slot), () => {
            if (widthOf(slot) !== width) changed(page, "a row of required courses doesn't fit its semesters");
            return { ...course(page, groups[i]!, slot), semester };
          });
          if (read) out.push(read);
        });
      }
    }
  }
  list.done();
  if (out.length === 0) changed(page, "no required courses");
  // Rows hold two semesters side by side; list them semester by semester, in SIX's order within each.
  return out.sort((a, b) => a.semester - b.semester);
}

const panelTitle = (panel: Elem) => textOf(panel.find(".panel-title").first());

/** A package panel: "Sistem Informasi Cerdas (12 SKS)", a note, and its courses. */
function readPackage(page: Page, panel: Elem): Curriculum["specializations"][number] {
  const title = panelTitle(panel);
  const heading = /^(.*?)\s*\((\d+)\s*\S*\)$/.exec(title);
  const table = panel.find("table");
  if (!title || table.length !== 1) changed(page, `package "${title}" isn't readable`);
  const [header, ...rows] = rowsOf(page, table).map((row) => cellsOf(page, row));
  const under = columns(page, header ? labelsOf(header) : [], COURSE_COLUMNS, COURSE_HEADER, `the header of "${title}"`);
  return {
    name: heading ? heading[1]! : title,
    sks: heading ? Number(heading[2]) : null,
    note: clean(panel.find(".panel-body").text()) || null,
    courses: page.skipped.each(rows, rowText, (cells) => {
      if (widthOf(cells) !== under.width) changed(page, `a course of "${title}" has ${cells.length} cells`);
      return course(page, under, cells);
    }),
  };
}

/** Minors by faculty: a faculty heading, then its programs' minors ("Matematika - Program Minor Matematika (16 SKS)"). */
function readMinors(page: Page, pane: Elem): Curriculum["minors"] {
  const out: Curriculum["minors"] = [];
  const list = page.skipped.list();
  let faculty: string | null = null;
  for (const child of pane.children().toArray()) {
    const node = page.$(child);
    if (node.is("h2")) faculty = textOf(node);
    for (const element of node.find(".panel").toArray()) {
      const panel = page.$(element);
      const minor = list.item(panelTitle(panel), () => {
        const read = readPackage(page, panel);
        const split = read.name.indexOf(" - ");
        if (!faculty || split < 0) changed(page, `minor "${read.name}" isn't readable`);
        return { ...read, faculty, program: read.name.slice(0, split), name: read.name.slice(split + 3) };
      });
      if (minor) out.push(minor);
    }
  }
  list.done();
  return out;
}

function readCatalog(page: Page, pane: Elem): Curriculum["catalog"] {
  const table = pane.find("table");
  if (table.length !== 1) changed(page, "the catalog has no table");
  const [header, ...rows] = rowsOf(page, table).map((row) => cellsOf(page, row));
  const under = columns(page, header ? labelsOf(header) : [], CATALOG_COLUMNS, CATALOG_HEADER, "the catalog header");
  return page.skipped.each(rows, rowText, (cells) => {
    if (widthOf(cells) !== under.width) changed(page, `a catalog row has ${cells.length} cells`);
    const category = under.cell(cells, "category");
    return { ...course(page, under, cells), category: category ? textOf(category) : null };
  });
}
