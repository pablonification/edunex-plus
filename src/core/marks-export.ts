// One file's highlights and notes as Markdown, for the Student to keep in
// their own notes app (the viewer's "Salin sorotan dan catatan" and "Simpan
// sebagai Markdown"): the file's name, its course, when it was exported, then
// page by page the note and the highlighted text with its color, in reading
// order. A Word document's or text file's have no pages. Pure: the viewer
// finds each highlight's whole text in the file (only its first words are
// kept) and hands over the words in the Student's language.
import { colorOf } from "./highlights";
import type { Highlight, PageNote } from "./models";
import type { StringKey, Vars } from "./strings";

/** A highlight to export: as saved, with its whole text where the viewer found it in the file. */
export type ExportedHighlight = Pick<Highlight, "page" | "start" | "end" | "color" | "text"> & { whole?: string };

export interface MarksExport {
  /** The file's name, as its title. */
  name: string;
  /** "II4091 Proposal Tugas Akhir"; none where the file isn't a course's. */
  course?: string;
  /** When, already written out ("23 Oktober 2026"). */
  date: string;
  highlights: readonly ExportedHighlight[];
  notes: readonly PageNote[];
}

/** What a highlight says: its whole text, else what was kept of it (with "…" where that's only its start), on one line. */
function words(highlight: ExportedHighlight): string {
  const text = highlight.whole ?? (highlight.end - highlight.start > highlight.text.length ? `${highlight.text.trimEnd()}…` : highlight.text);
  return text.replace(/\s+/g, " ").trim();
}

/** The file's highlights and notes as Markdown, in the Student's words (`t`). Empty sections are left out. */
export function marksMarkdown(input: MarksExport, t: (key: StringKey, vars?: Vars) => string): string {
  const out = [`# ${input.name}`, ""];
  if (input.course) out.push(t("export.md.course", { course: input.course }), "");
  out.push(t("export.md.exported", { date: input.date }), "");

  const pages = [...new Set([...input.highlights.map((h) => h.page ?? 0), ...input.notes.map((n) => n.page ?? 0)])].sort((a, b) => a - b);
  for (const page of pages) {
    if (page) out.push(`## ${t("export.md.page", { page })}`, "");
    const note = input.notes.find((n) => (n.page ?? 0) === page);
    // The note as written, its lines kept: the first after its label.
    if (note?.text.trim()) out.push(`**${t("export.md.note")}:** ${note.text.trim()}`, "");
    const marked = input.highlights.filter((h) => (h.page ?? 0) === page).sort((a, b) => a.start - b.start);
    for (const highlight of marked) {
      const color = colorOf(highlight.color);
      out.push(`- ${words(highlight)} _(${t(`highlight.color.${color}`)})_`);
    }
    if (marked.length) out.push("");
  }
  return `${out.join("\n").trimEnd()}\n`;
}
