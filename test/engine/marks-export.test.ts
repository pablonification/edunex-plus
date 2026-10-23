// A file's highlights and notes as Markdown, the rules alone: its name, its
// course and when, then page by page the note and the highlights in reading
// order with their colors, each highlight's whole text where the viewer found
// it (else what was kept, marked as cut), on one line. A Word document's or
// text file's have no pages. In the Student's language. Made-up slides.
import { describe, expect, it } from "vitest";
import { type ExportedHighlight, marksMarkdown } from "../../src/core/marks-export";
import { MAX_QUOTE } from "../../src/core/models";
import { translate } from "../../src/core/strings";

const id = (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) => translate("id", key, vars);
const en = (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) => translate("en", key, vars);
const mark = (page: number | undefined, start: number, text: string, color = "yellow", extra: Partial<ExportedHighlight> = {}): ExportedHighlight => ({
  page,
  start,
  end: start + text.length,
  color,
  text,
  ...extra,
});

describe("a file's highlights and notes as Markdown", () => {
  it("page by page: the note first, then the highlights in reading order with their colors", () => {
    const text = marksMarkdown(
      {
        name: "Slide Pengantar Proposal TA.pdf",
        course: "II4091 Proposal Tugas Akhir",
        date: "23 Oktober 2026",
        highlights: [
          mark(3, 40, "Jadwal bimbingan tiap Kamis.", "green"),
          mark(1, 50, "Pertanyaan untuk diskusi.", "pink"),
          mark(1, 10, "Poin utama untuk pertemuan ini."),
        ],
        notes: [
          { page: 3, text: "Kirim draf H-2.", at: 1 },
          { page: 1, text: "Ambil topik yang datanya sudah ada.\nTanya Pak Hadi soal pembimbing kedua.", at: 1 },
          { page: 2, text: "Contoh latar belakang yang baik.", at: 1 },
        ],
      },
      id,
    );
    expect(text).toBe(
      [
        "# Slide Pengantar Proposal TA.pdf",
        "",
        "Mata kuliah: II4091 Proposal Tugas Akhir",
        "",
        "Diekspor dari Edunex Plus, 23 Oktober 2026",
        "",
        "## Halaman 1",
        "",
        "**Catatanku:** Ambil topik yang datanya sudah ada.\nTanya Pak Hadi soal pembimbing kedua.",
        "",
        "- Poin utama untuk pertemuan ini. _(kuning)_",
        "- Pertanyaan untuk diskusi. _(merah muda)_",
        "",
        "## Halaman 2",
        "",
        "**Catatanku:** Contoh latar belakang yang baik.",
        "",
        "## Halaman 3",
        "",
        "**Catatanku:** Kirim draf H-2.",
        "",
        "- Jadwal bimbingan tiap Kamis. _(hijau)_",
        "",
      ].join("\n"),
    );
  });

  it("a highlight's whole text where it was found, else what was kept, marked as cut; on one line", () => {
    const long = `${"Kata ".repeat(50)}akhir.`;
    const kept = long.slice(0, MAX_QUOTE);
    const text = marksMarkdown(
      {
        name: "Bab 2.pdf",
        date: "23 Oktober 2026",
        highlights: [
          mark(1, 0, kept, "blue", { end: long.length, whole: long }),
          mark(1, 400, kept, "blue", { end: 400 + long.length }),
          mark(1, 900, "baris satu\ndan dua", "blue"),
        ],
        notes: [],
      },
      id,
    );
    expect(text).toContain(`- ${long.trim()} _(biru)_`);
    expect(text).toContain(`- ${kept.trim()}… _(biru)_`);
    expect(text).toContain("- baris satu dan dua _(biru)_");
    // No course: no line for it.
    expect(text).not.toContain("Mata kuliah");
  });

  it("a Word document's or text file's have no pages; in English for a Student who reads it in English", () => {
    const text = marksMarkdown(
      {
        name: "Notulen.docx",
        course: "PL3002 Economics and Innovation in Planning",
        date: "23 October 2026",
        highlights: [mark(undefined, 12, "Pembagian tugas", "orange-2")],
        notes: [{ text: "Bagian saya: bab 3.", at: 1 }],
      },
      en,
    );
    expect(text).toBe(
      [
        "# Notulen.docx",
        "",
        "Course: PL3002 Economics and Innovation in Planning",
        "",
        "Exported from Edunex Plus, 23 October 2026",
        "",
        "**My note:** Bagian saya: bab 3.",
        "",
        // A color a later version adds goes out as yellow, as it's drawn.
        "- Pembagian tugas _(yellow)_",
        "",
      ].join("\n"),
    );
  });
});
