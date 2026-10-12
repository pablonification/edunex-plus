// Reads a curriculum's structure (/kurikulum/kurikulum/{id}/struktur): the
// required courses by recommended semester, the program's specializations,
// the minors open to the Student, and the program's course catalog. Every
// course carries SIX's id, which leads to its syllabus.
import type { Curriculum, CurriculumCourse } from "../../../../core/models";
import { COURSE_CODE, cellsOf, changed, clean, courseIdOf, type Elem, expectLabels, int, openPage, type Page, rowsOf, textOf } from "./records-common";

const COURSE_HEADER = ["Kode", "Mata Kuliah", "SKS"];
const CATALOG_HEADER = ["Kode", "Mata Kuliah", "Kategori", "SKS"];

export type CurriculumStructure = Pick<Curriculum, "name" | "required" | "specializations" | "minors" | "catalog">;

export function readCurriculumStructure(html: string): CurriculumStructure {
  const page = openPage(html, "curriculum structure");
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
    specializations: pane("spesialisasi")
      .find(".panel")
      .toArray()
      .map((panel) => readPackage(page, page.$(panel))),
    minors: readMinors(page, pane("minor")),
    catalog: readCatalog(page, pane("katalog")),
  };
}

function course(page: Page, code: Elem, name: Elem, sks: Elem): CurriculumCourse {
  const text = textOf(code);
  if (!COURSE_CODE.test(text)) changed(page, `"${text}" isn't a course code`);
  return { code: text, name: textOf(name), sks: int(page, textOf(sks), `SKS of ${text}`), courseId: courseIdOf(code) };
}

/** Semesters side by side: a heading row names them, then each row holds one course (or an empty slot) per semester. */
function readRequired(page: Page, pane: Elem): Curriculum["required"] {
  const out: Curriculum["required"] = [];
  let semesters: number[] = [];
  for (const table of pane.find("table").toArray()) {
    for (const row of rowsOf(page, page.$(table))) {
      const cells = cellsOf(page, row);
      if (row.hasClass("warning")) {
        semesters = cells.map((cell) => {
          const text = textOf(cell);
          if (page.lang === "id" && !/^Semester \d+$/.test(text)) changed(page, `semester heading "${text}" isn't readable`);
          return int(page, /(\d+)$/.exec(text)?.[1] ?? text, "semester");
        });
      } else if (cells.every((cell) => cell.is("th"))) {
        expectLabels(
          page,
          cells.map(textOf),
          semesters.flatMap(() => COURSE_HEADER),
          "the required courses header",
        );
      } else {
        let at = 0;
        for (const semester of semesters) {
          const cell = cells[at];
          if (!cell) changed(page, "a row of required courses is short");
          if (cell.attr("colspan") === "3" && textOf(cell) === "") {
            at += 1;
            continue;
          }
          const [code, name, sks] = cells.slice(at, at + 3);
          if (!code || !name || !sks) changed(page, "a row of required courses is short");
          out.push({ ...course(page, code, name, sks), semester });
          at += 3;
        }
        if (at !== cells.length) changed(page, "a row of required courses is too long");
      }
    }
  }
  if (out.length === 0) changed(page, "no required courses");
  // Rows hold two semesters side by side; list them semester by semester, in SIX's order within each.
  return out.sort((a, b) => a.semester - b.semester);
}

/** A package panel: "Sistem Informasi Cerdas (12 SKS)", a note, and its courses. */
function readPackage(page: Page, panel: Elem): Curriculum["specializations"][number] {
  const title = textOf(panel.find(".panel-title").first());
  const heading = /^(.*?)\s*\((\d+)\s*\S*\)$/.exec(title);
  const table = panel.find("table");
  if (!title || table.length !== 1) changed(page, `package "${title}" isn't readable`);
  const [header, ...rows] = rowsOf(page, table).map((row) => cellsOf(page, row));
  expectLabels(page, (header ?? []).map(textOf), COURSE_HEADER, `the header of "${title}"`);
  return {
    name: heading ? heading[1]! : title,
    sks: heading ? Number(heading[2]) : null,
    note: clean(panel.find(".panel-body").text()) || null,
    courses: rows.map((cells) => {
      if (cells.length !== 3) changed(page, `a course of "${title}" has ${cells.length} cells`);
      return course(page, cells[0]!, cells[1]!, cells[2]!);
    }),
  };
}

/** Minors by faculty: a faculty heading, then its programs' minors ("Matematika - Program Minor Matematika (16 SKS)"). */
function readMinors(page: Page, pane: Elem): Curriculum["minors"] {
  const out: Curriculum["minors"] = [];
  let faculty: string | null = null;
  for (const child of pane.children().toArray()) {
    const node = page.$(child);
    if (node.is("h2")) faculty = textOf(node);
    for (const panel of node.find(".panel").toArray()) {
      const minor = readPackage(page, page.$(panel));
      const split = minor.name.indexOf(" - ");
      if (!faculty || split < 0) changed(page, `minor "${minor.name}" isn't readable`);
      out.push({ ...minor, faculty, program: minor.name.slice(0, split), name: minor.name.slice(split + 3) });
    }
  }
  return out;
}

function readCatalog(page: Page, pane: Elem): Curriculum["catalog"] {
  const table = pane.find("table");
  if (table.length !== 1) changed(page, "the catalog has no table");
  const [header, ...rows] = rowsOf(page, table).map((row) => cellsOf(page, row));
  expectLabels(page, (header ?? []).map(textOf), CATALOG_HEADER, "the catalog header");
  return rows.map((cells) => {
    if (cells.length !== 4) changed(page, `a catalog row has ${cells.length} cells`);
    return { ...course(page, cells[0]!, cells[1]!, cells[3]!), category: textOf(cells[2]!) };
  });
}
