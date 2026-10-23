// Text for taking a file's highlights and notes out of the app, as Markdown:
// the viewer's menu, what's said back, and the words in the file itself (its
// course, when it was exported, a page, the Student's note).
import type { Entry } from "./entry";

export const marksExportStrings = {
  // The viewer's "⋯" menu ("viewer.more")
  "export.copy": { id: "Salin sorotan dan catatan", en: "Copy highlights and notes" },
  "export.save": { id: "Simpan sebagai Markdown…", en: "Save as Markdown…" },
  "export.saveHint": { id: "Berkas .md untuk aplikasi catatanmu", en: "A .md file for your notes app" },
  "export.highlights": { id: "{count} sorotan", en: { one: "{count} highlight", other: "{count} highlights" } },
  "export.notes": { id: "{count} catatan", en: { one: "{count} note", other: "{count} notes" } },
  "export.none": { id: "Belum ada sorotan atau catatan di berkas ini", en: "No highlights or notes in this file yet" },
  // The file's name: "Slide Pengantar (catatan).md"
  "export.fileName": { id: "{name} (catatan)", en: "{name} (notes)" },
  // Said back
  "export.copied": { id: "Sorotan dan catatan disalin", en: "Highlights and notes copied" },
  "export.failed": {
    id: "Sorotan dan catatan tidak bisa disimpan. Coba lagi, atau simpan ke folder lain.",
    en: "Couldn't save the highlights and notes. Try again, or save them to another folder.",
  },
  "export.copyFailed": { id: "Sorotan dan catatan tidak bisa disalin. Coba lagi.", en: "Couldn't copy the highlights and notes. Try again." },
  // In the Markdown file
  "export.md.course": { id: "Mata kuliah: {course}", en: "Course: {course}" },
  "export.md.exported": { id: "Diekspor dari Edunex Plus, {date}", en: "Exported from Edunex Plus, {date}" },
  "export.md.page": { id: "Halaman {page}", en: "Page {page}" },
  "export.md.note": { id: "Catatanku", en: "My note" },
} as const satisfies Record<string, Entry>;
