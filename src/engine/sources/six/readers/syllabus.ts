// Reads a course's syllabus (/kurikulum/silabus/{id}/view): name, summary,
// content, outcomes, assessment and references in Indonesian and English, and
// the weekly plan. Read on demand, not by a feed (one page per course).
import type { Syllabus } from "../../../../core/models";
import { cellsOf, changed, clean, type Elem, expectLabels, int, openPage, type Page, rowsOf, textOf } from "./records-common";

/** The rows of the syllabus table, in order: a label, then one cell (both languages) or two (Indonesian, English). */
const ROWS = [
  "Kode Mata Kuliah",
  "Penyelenggara",
  "", // the language heading
  "Nama Mata Kuliah",
  "Silabus Ringkas",
  "Silabus Lengkap",
  "Luaran (Outcomes)",
  "Mata Kuliah Terkait",
  "Kegiatan Penunjang",
  "Pustaka",
  "Panduan Penilaian",
  "Catatan Tambahan",
];
const WEEK_HEADER = ["Minggu", "Topik", "Subtopik", "Capaian Belajar", "Sumber Materi"];

export function readSyllabus(html: string, courseId: string): Syllabus {
  const page = openPage(html, "syllabus");
  const [main, weeks] = page
    .$("table")
    .toArray()
    .map((table) => page.$(table));
  if (!main || !weeks) changed(page, "its tables moved");
  const rows = rowsOf(page, main).map((row) => cellsOf(page, row));
  expectLabels(
    page,
    rows.map((cells) => (cells[0] ? textOf(cells[0]) : "")),
    ROWS,
    "the syllabus rows",
  );

  // "II1200 - 2024"
  const heading = /^([A-Z]{2}\d{4})\s*-\s*(\d{4})$/.exec(textOf(page.$(".page-header h1 small").first()));
  // "II1200 / 3 SKS"
  const codeSks = /^([A-Z]{2}\d{4})\s*\/\s*(\d+)\b/.exec(text(rows[0]![1]) ?? "");
  if (!codeSks) changed(page, "its code and SKS aren't readable");
  const one = (at: number) => text(rows[at]![1]);
  const two = (at: number) => {
    if (rows[at]!.length !== 3) changed(page, `"${ROWS[at]}" isn't in two languages`);
    return { id: text(rows[at]![1]), en: text(rows[at]![2]) };
  };
  const name = two(3);
  if (!name.id) changed(page, "the course has no name");
  return {
    courseId,
    code: codeSks[1]!,
    curriculumYear: heading ? Number(heading[2]) : null,
    sks: int(page, codeSks[2]!, "SKS"),
    organizer: one(1),
    name: { id: name.id, en: name.en },
    summary: two(4),
    content: two(5),
    outcomes: two(6),
    related: one(7),
    activities: two(8),
    references: one(9),
    assessment: two(10),
    notes: two(11),
    weeks: readWeeks(page, weeks),
  };
}

/** A cell's text with its line breaks kept; null when empty. */
function text(cell: Elem | undefined): string | null {
  if (!cell) return null;
  const copy = cell.clone();
  copy.find("br").replaceWith("\n");
  copy.find("p, li, div, tr").append("\n");
  const lines = copy.text().split("\n").map(clean).filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

function readWeeks(page: Page, table: Elem): Syllabus["weeks"] {
  const rows = rowsOf(page, table).map((row) => cellsOf(page, row));
  const header = rows.findIndex((cells) => cells.length === WEEK_HEADER.length && cells.every((cell) => cell.is("th")));
  if (header < 0) changed(page, "the weekly plan has no header");
  expectLabels(page, rows[header]!.map(textOf), WEEK_HEADER, "the weekly plan header");
  const out: Syllabus["weeks"] = [];
  for (const cells of rows.slice(header + 1)) {
    if (cells.length === 1) continue; // "Belum ada": none yet.
    if (cells.length !== WEEK_HEADER.length) changed(page, `a week has ${cells.length} cells`);
    const [week, topic, subtopics, outcomes, sources] = cells.map(text);
    out.push({ week: week ?? "", topic: topic ?? "", subtopics: subtopics ?? null, outcomes: outcomes ?? null, sources: sources ?? null });
  }
  return out;
}
