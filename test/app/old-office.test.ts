// Old Word, Excel and PowerPoint files (97–2003: .doc, .xls, .ppt) read for
// the viewer: the compound file they're kept in, then each one's text,
// cells or slides. The files are tiny made-up ones (../kit/old-office-files.ts);
// broken and hostile ones throw rather than hang, so the viewer can offer
// Download instead.
import { describe, expect, it } from "vitest";
import { readDoc } from "../../src/app/ui/doc";
import { readPpt } from "../../src/app/ui/ppt";
import { readXls } from "../../src/app/ui/xls";
import { readCompoundFile } from "../../src/core/compound-file";
import { aCompoundFile, aDoc, anXls, aPpt, setFatEntry } from "../kit/old-office-files";

const bytes = (length: number, seed = 1) => Uint8Array.from({ length }, (_, i) => (i * 7 + seed) & 0xff);

describe("reading a compound file", () => {
  it("gives a stream at its root by name, small ones from the mini stream and big ones from the file's own sectors", () => {
    const small = bytes(100);
    const big = bytes(9000, 3);
    for (const version of [3, 4]) {
      const file = readCompoundFile(aCompoundFile({ Kecil: small, Besar: big, Kosong: new Uint8Array() }, { version }));
      expect(file.stream("Kecil"), `version ${version}`).toEqual(small);
      expect(file.stream("besar"), `version ${version}`).toEqual(big);
      expect(file.stream("Kosong")).toEqual(new Uint8Array());
      expect(file.has("KECIL")).toBe(true);
      expect(file.has("Lain")).toBe(false);
      expect(file.stream("Lain")).toBeNull();
    }
  });

  it("finds the FAT past the header's list of 109 sectors, through the DIFAT", () => {
    const big = bytes(5000);
    const file = aCompoundFile({ Besar: big }, { fatSectors: 300 });
    expect(new DataView(file.buffer).getUint32(72, true)).toBe(2);
    expect(readCompoundFile(file).stream("Besar")).toEqual(big);
  });

  it("throws, rather than hang or read past the end, when a chain loops or points outside the file", () => {
    const file = aCompoundFile({ Besar: bytes(9000) });
    const view = new DataView(file.buffer);
    const directory = view.getUint32(48, true);
    // The big stream's sectors come after the directory, the mini FAT and the mini stream (none here).
    const first = directory + 1;
    expect(() => readCompoundFile(setFatEntry(file, first + 3, first)).stream("Besar")).toThrow();
    expect(() => readCompoundFile(setFatEntry(file, first + 3, 0x00ffffff)).stream("Besar")).toThrow();
    // A directory whose chain loops on itself.
    expect(() => readCompoundFile(setFatEntry(file, directory, directory))).toThrow();
    // A header claiming more FAT sectors than the file has, and bytes that aren't a compound file at all.
    const lying = file.slice();
    new DataView(lying.buffer).setUint32(44, 0x7fffffff, true);
    expect(() => readCompoundFile(lying)).toThrow();
    expect(() => readCompoundFile(new TextEncoder().encode("bukan berkas Office".repeat(40)))).toThrow();
    expect(() => readCompoundFile(file.subarray(0, 600))).toThrow();
  });
});

describe("reading an old Word document", () => {
  it("gives its paragraphs from both kinds of piece, fields as their results, Word's marks tidied", () => {
    const doc = aDoc([
      "Panduan Praktikum – Modul 2",
      "Kumpulkan “laporan” paling lambat\u000bJumat, 23.59",
      "Nilai: \u0013 = 40 + 45 \u001485\u0015 dari 100",
      "Gambar\u0001 di bawah\u0008 ini; catatan kaki\u0002; ber\u001ftanda non\u001ebreaking",
      "Biaya cetak €5",
      "\u000cBab 2: Pengukuran",
      "",
      "Halaman kedua",
    ]);
    expect(readDoc(doc)).toEqual([
      [
        "Panduan Praktikum – Modul 2",
        "Kumpulkan “laporan” paling lambat\nJumat, 23.59",
        "Nilai: 85 dari 100",
        "Gambar di bawah ini; catatan kaki; bertanda non-breaking",
        "Biaya cetak €5",
      ],
      ["Bab 2: Pengukuran", "", "Halaman kedua"],
    ]);
  });

  it("starts a new page at a paragraph set to start one, as LibreOffice writes a page break", () => {
    expect(readDoc(aDoc(["Bab 1", "", { newPage: "Bab 2" }, "Isi bab 2"]))).toEqual([["Bab 1"], ["Bab 2", "Isi bab 2"]]);
  });

  it("reads text written two bytes a character", () => {
    expect(readDoc(aDoc(["Bahasa: 日本語, ελληνικά"], { wide: true }))).toEqual([["Bahasa: 日本語, ελληνικά"]]);
  });

  it("lays a table out as rows of cells, empty cells and cells of two lines in their places", () => {
    const doc = aDoc([
      "Jadwal asistensi",
      [
        ["Hari", "Jam", "Ruang"],
        ["Senin", "", "Lab 1\rLantai 2"],
        ["", "13.00", ""],
      ],
      "Datang tepat waktu",
    ]);
    expect(readDoc(doc)).toEqual([
      [
        "Jadwal asistensi",
        {
          rows: [
            ["Hari", "Jam", "Ruang"],
            ["Senin", "", "Lab 1\nLantai 2"],
            ["", "13.00", ""],
          ],
        },
        "Datang tepat waktu",
      ],
    ]);
  });

  it("without the paragraphs' properties, still lays a table out as best it can", () => {
    const doc = aDoc(
      [
        "Sebelum",
        [
          ["A1", "B1"],
          ["A2", "B2"],
        ],
        "Sesudah",
      ],
      { marks: false },
    );
    expect(readDoc(doc)).toEqual([
      [
        "Sebelum",
        {
          rows: [
            ["A1", "B1"],
            ["A2", "B2"],
          ],
        },
        "Sesudah",
      ],
    ]);
  });

  it("refuses a locked document, one from Word 95 or older, and what isn't a Word document", () => {
    expect(() => readDoc(aDoc(["Rahasia"], { locked: true }))).toThrow();
    expect(() => readDoc(aDoc(["Lama"], { word95: true }))).toThrow();
    expect(() => readDoc(anXls({ Lembar1: [["a"]] }))).toThrow();
    expect(() => readDoc(new Uint8Array(1024))).toThrow();
  });
});

describe("reading an old Excel workbook", () => {
  it("gives each visible sheet's cells as text, with numbers, dates and formulas' results as Excel shows them", () => {
    const xls = anXls(
      {
        Nilai: [
          ["NIM", "Tugas", "UTS", "Tanggal", "Lulus"],
          ["10000001", 87.5, { rk: 90 }, { date: 46309 }, true],
          ["10000002", 0.1 + 0.2, { rk: 75.25 }, { date: 46309.5625, custom: true }, false],
          [{ label: "Rata-rata" }, { formula: 43.9 }, { rk: 1 }, { rk: -2 }, { rk: 3.5 }],
          [{ formula: "Lulus semua" }, { formula: true }, { error: 0x07 }, null, ""],
        ],
        Rahasia: [["tersembunyi"]],
        Catatan: [[], ["", "B2"]],
      },
      { hidden: ["Rahasia"] },
    );
    const sheets = readXls(xls);
    expect(sheets.map((s) => s.name)).toEqual(["Nilai", "Catatan"]);
    expect(sheets[0].rows).toEqual([
      ["NIM", "Tugas", "UTS", "Tanggal", "Lulus"],
      ["10000001", "87.5", "90", "2026-10-14", "TRUE"],
      ["10000002", "0.3", "75.25", "2026-10-14 13:30", "FALSE"],
      ["Rata-rata", "43.9", "1", "-2", "3.5"],
      ["Lulus semua", "TRUE", "#DIV/0!"],
    ]);
    expect(sheets[1].rows).toEqual([[], ["", "B2"]]);
  });

  it("counts days from 1904 when the workbook does", () => {
    expect(readXls(anXls({ Lembar1: [[{ date: 44847 }]] }, { date1904: true }))[0].rows).toEqual([["2026-10-14"]]);
  });

  it("reads shared strings cut across CONTINUE records, each part with its own flag byte", () => {
    const long = "Penjelasan tugas besar yang cukup panjang untuk terpotong";
    const mixed = "Ringkasan 日本語 lalu teks biasa lagi sampai habis";
    const sheets = readXls(anXls({ Lembar1: [[long, mixed, "pendek"], ["Ελληνικά"]] }, { recordSize: 24 }));
    expect(sheets[0].rows).toEqual([[long, mixed, "pendek"], ["Ελληνικά"]]);
  });

  it("refuses a locked workbook, one from Excel 95 or older, and what isn't a workbook", () => {
    expect(() => readXls(anXls({ Lembar1: [["a"]] }, { locked: true }))).toThrow();
    expect(() => readXls(anXls({ Lembar1: [["a"]] }, { excel95: true }))).toThrow();
    expect(() => readXls(aDoc(["bukan buku kerja"]))).toThrow();
    expect(() => readXls(anXls({ Lembar1: [["a"]] }, { hidden: ["Lembar1"] }))).toThrow();
  });
});

describe("reading an old PowerPoint presentation", () => {
  const slides = [
    { title: "Pengantar Kuliah", body: ["Tujuan pembelajaran", "Aturan kelas\u000bdan penilaian"] },
    { title: "Jadwal", body: ["Minggu 1–7: teori"], boxes: ["Catatan: bawa laptop"] },
    { body: ["Slide tanpa judul"], boxes: ["Ελληνικά 日本語"] },
  ];

  it("gives each slide's title and text, in the order they're presented, its own text boxes after its placeholders", () => {
    expect(readPpt(aPpt(slides))).toEqual([
      { title: "Pengantar Kuliah", text: ["Tujuan pembelajaran", "Aturan kelas\ndan penilaian"] },
      { title: "Jadwal", text: ["Minggu 1–7: teori", "Catatan: bawa laptop"] },
      { title: "", text: ["Slide tanpa judul", "Ελληνικά 日本語"] },
    ]);
  });

  it("reads a slide as it was last saved", () => {
    const edited = readPpt(aPpt(slides, { edit: { slide: 1, boxes: ["Catatan: bawa kalkulator"] } }));
    expect(edited[1]).toEqual({ title: "Jadwal", text: ["Minggu 1–7: teori", "Catatan: bawa kalkulator"] });
  });

  it("without the record of its last save, still reads the slides in the order they're in the file", () => {
    const read = readPpt(aPpt(slides, { currentUser: false }));
    expect(read.map((slide) => slide.title)).toEqual(["Pengantar Kuliah", "Jadwal", ""]);
    expect(read[0].text).toContain("Tujuan pembelajaran");
  });

  it("refuses a locked presentation and what isn't one", () => {
    expect(() => readPpt(aPpt(slides, { locked: true }))).toThrow();
    expect(() => readPpt(aDoc(["bukan presentasi"]))).toThrow();
  });
});
