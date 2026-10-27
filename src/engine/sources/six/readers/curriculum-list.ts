// Reads SIX's list of curricula for the Student's program
// (/kurikulum/kurikulum/list): each curriculum's year, SKS to graduate,
// normal length, whether it is the one in force, and where its structure is.
// A curriculum whose name, link or year it can't read is left out (skipped);
// another detail it can't read is left blank and the row noted.
import type { Skipped } from "../../skipped";
import {
  type Column,
  cellsOf,
  changed,
  columns,
  details,
  type Elem,
  int,
  intOrNull,
  labelsOf,
  openPage,
  rowsOf,
  rowText,
  textOf,
  widthOf,
} from "./records-common";

const HEADER = ["", "", "No Prodi", "Program Studi", "Fakultas", "Nama Kurikulum", "Tahun", "SKS Lulus", "Masa Studi (Semester)", "Aktif"];
const COLUMNS = {
  code: { labels: ["No Prodi", "Program No"] },
  program: { labels: ["Program Studi", "Study Program"] },
  faculty: { labels: ["Fakultas", "Faculty", "Fakultas / Sekolah"] },
  // The curriculum's name and year say which curriculum a row is, and which one is the newest in force.
  name: { labels: ["Nama Kurikulum", "Curriculum Name", "Curriculum"], required: true },
  year: { labels: ["Tahun", "Year"], required: true },
  sks: { labels: ["SKS Lulus", "Graduation SKS", "Credits to Graduate"] },
  semesters: { labels: ["Masa Studi (Semester)", "Study Length (Semester)", "Study Period (Semester)"] },
  active: { labels: ["Aktif", "Active"] },
} satisfies Record<string, Column>;

export interface CurriculumListEntry {
  /** SIX's id, from a structure link like /kurikulum/kurikulum/1047/struktur; null where the link has none. */
  id: string | null;
  /** "Kurikulum 2024 - Sarjana Sistem dan Teknologi Informasi". */
  name: string;
  year: number;
  /** "182", "S1 Sistem dan Teknologi Informasi", "STEI"; null where the page has no such column. */
  program: { code: string | null; name: string | null; faculty: string | null };
  graduationSks: number | null;
  semesters: number | null;
  /** The curriculum in force (SIX's ✓); null when SIX marks it in a way the app can't read yet. */
  active: boolean | null;
  /** The structure page, without SIX's returnTo. */
  structurePath: string;
}

export function readCurriculumList(html: string, skipped?: Skipped): CurriculumListEntry[] {
  const page = openPage(html, "curriculum list", skipped);
  const tables = page.$("table").filter((_, table) => page.$(table).find('a[href*="/struktur"]').length > 0);
  if (tables.length !== 1) changed(page, "no list of curricula");
  const [header, ...rows] = rowsOf(page, tables.first()).map((row) => cellsOf(page, row));
  if (!header) changed(page, "the list is empty");
  const list = columns(page, labelsOf(header), COLUMNS, HEADER, "the list header");
  if (rows.length === 0) changed(page, "the list is empty");
  return page.skipped.each(rows, rowText, (cells) => {
    if (widthOf(cells) !== list.width) changed(page, `a curriculum row has ${cells.length} cells`);
    const name = list.need(cells, "name");
    const href = name.find("a").attr("href");
    if (!href) changed(page, `"${textOf(name)}" has no structure link`);
    const path = new URL(href, "https://six.itb.ac.id");
    path.searchParams.delete("returnTo");
    const year = int(page, textOf(list.need(cells, "year")), "curriculum year");
    const detail = details(page);
    const text = (key: "code" | "program" | "faculty") => detail.of(key, list.cell(cells, key), textOf);
    const entry: CurriculumListEntry = {
      id: /\/kurikulum\/(\d+)\/struktur$/.exec(path.pathname)?.[1] ?? null,
      name: textOf(name),
      year,
      program: { code: text("code"), name: text("program"), faculty: text("faculty") },
      graduationSks: detail.of("sks", list.cell(cells, "sks"), (cell) => intOrNull(page, textOf(cell), "SKS to graduate")),
      semesters: detail.of("semesters", list.cell(cells, "semesters"), (cell) => intOrNull(page, textOf(cell), "study length")),
      active: detail.of("active", list.cell(cells, "active"), (cell: Elem) => {
        if (cell.find(".fa-check").length > 0) return true;
        if (cell.find(".fa-times").length > 0) return false;
        return changed(page, "an active mark is neither ✓ nor ✗");
      }),
      structurePath: path.pathname + path.search,
    };
    detail.note(rowText(cells));
    return entry;
  });
}
