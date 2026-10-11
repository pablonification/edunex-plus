// Reads SIX's list of curricula for the Student's program
// (/kurikulum/kurikulum/list): each curriculum's year, SKS to graduate,
// normal length, whether it is the one in force, and where its structure is.
import { cellsOf, changed, type Elem, expectLabels, int, intOrNull, openPage, rowsOf, textOf } from "./records-common";

const HEADER = ["", "", "No Prodi", "Program Studi", "Fakultas", "Nama Kurikulum", "Tahun", "SKS Lulus", "Masa Studi (Semester)", "Aktif"];

export interface CurriculumListEntry {
  /** SIX's id, from a structure link like /kurikulum/kurikulum/1047/struktur; null where the link has none. */
  id: string | null;
  /** "Kurikulum 2024 - Sarjana Sistem dan Teknologi Informasi". */
  name: string;
  year: number;
  /** "182", "S1 Sistem dan Teknologi Informasi", "STEI". */
  program: { code: string; name: string; faculty: string };
  graduationSks: number | null;
  semesters: number | null;
  /** The curriculum in force (SIX's ✓). */
  active: boolean;
  /** The structure page, without SIX's returnTo. */
  structurePath: string;
}

export function readCurriculumList(html: string): CurriculumListEntry[] {
  const page = openPage(html, "curriculum list");
  const tables = page.$("table").filter((_, table) => page.$(table).find('a[href*="/struktur"]').length > 0);
  if (tables.length !== 1) changed(page, "no list of curricula");
  const [header, ...rows] = rowsOf(page, tables.first()).map((row) => cellsOf(page, row));
  if (!header) changed(page, "the list is empty");
  expectLabels(page, header.map(textOf), HEADER, "the list header");
  if (rows.length === 0) changed(page, "the list is empty");
  return rows.map((cells) => {
    if (cells.length !== HEADER.length) changed(page, `a curriculum row has ${cells.length} cells`);
    const [, , code, program, faculty, name, year, sks, semesters, active] = cells as Elem[];
    const href = name!.find("a").attr("href");
    if (!href) changed(page, `"${textOf(name!)}" has no structure link`);
    const path = new URL(href, "https://six.itb.ac.id");
    path.searchParams.delete("returnTo");
    const on = active!.find(".fa-check").length > 0;
    if (!on && active!.find(".fa-times").length === 0) changed(page, "an active mark is neither ✓ nor ✗");
    return {
      id: /\/kurikulum\/(\d+)\/struktur$/.exec(path.pathname)?.[1] ?? null,
      name: textOf(name!),
      year: int(page, textOf(year!), "curriculum year"),
      program: { code: textOf(code!), name: textOf(program!), faculty: textOf(faculty!) },
      graduationSks: intOrNull(page, textOf(sks!), "SKS to graduate"),
      semesters: intOrNull(page, textOf(semesters!), "study length"),
      active: on,
      structurePath: path.pathname + path.search,
    };
  });
}
