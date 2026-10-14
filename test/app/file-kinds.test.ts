// @vitest-environment jsdom
// Which files open in the app's viewer, by their name, and how a spreadsheet
// reads: an Excel workbook's visible sheets with their cells as Excel shows
// them, and a CSV split as spreadsheets write it. The workbooks are tiny
// made-up ones (../kit/office-files.ts).
import { describe, expect, it } from "vitest";
import { canView, isPdfName, viewerKind } from "../../src/app/pdf";
import { readCsv, readWorkbook } from "../../src/app/ui/sheets";
import { anXlsx, aZip } from "../kit/office-files";

describe("which files the viewer shows", () => {
  it("knows each kind by its extension, in any case", () => {
    expect(viewerKind("Modul 1.pdf")).toBe("pdf");
    expect(viewerKind("Notulen.DOCX")).toBe("docx");
    expect(viewerKind("Nilai kuis.xlsx")).toBe("xlsx");
    expect(viewerKind("Slide 3.pptx")).toBe("pptx");
    expect(viewerKind("Kuliah.PPSX")).toBe("pptx");
    expect(viewerKind("data.csv")).toBe("csv");
    expect(viewerKind("data.tsv")).toBe("tsv");
    for (const name of ["catatan.txt", "README.md", "main.py", "Main.java", "tugas.c", "tugas.cpp", "app.js", "data.json", "query.sql"])
      expect(viewerKind(name), name).toBe("text");
    for (const name of ["papan.png", "foto.JPG", "foto.jpeg", "anim.gif", "gambar.webp"]) expect(viewerKind(name), name).toBe("image");
    expect(viewerKind(" Modul 1.pdf ")).toBe("pdf");
  });

  it("leaves what it can't show to the computer's own app: old Word, Excel and PowerPoint files, archives, videos, no extension", () => {
    for (const name of ["Modul.doc", "Nilai.xls", "Slide.ppt", "Template.zip", "Rekaman.mp4", "Gambar.svg", "Halaman.html", "README", "pdf"])
      expect(canView(name), name).toBe(false);
    expect(isPdfName("Modul.pdf")).toBe(true);
    expect(isPdfName("Modul.docx")).toBe(false);
  });
});

describe("reading a workbook", () => {
  it("gives each visible sheet's cells as text, with numbers and dates as Excel shows them", async () => {
    const bytes = await anXlsx(
      {
        Kuis: [
          ["NIM", "Nilai", "Tanggal"],
          ["10000001", 87.5, { date: 46309 }],
          ["10000002", 0.1 + 0.2, { date: 46309.5625 }],
        ],
        Rahasia: [["tersembunyi"]],
        Catatan: [["Rata-rata", 43.9]],
      },
      { hidden: ["Rahasia"] },
    );
    const sheets = await readWorkbook(bytes);
    expect(sheets.map((s) => s.name)).toEqual(["Kuis", "Catatan"]);
    expect(sheets[0].rows).toEqual([
      ["NIM", "Nilai", "Tanggal"],
      ["10000001", "87.5", "2026-10-14"],
      ["10000002", "0.3", "2026-10-14 13:30"],
    ]);
    expect(sheets[1].rows).toEqual([["Rata-rata", "43.9"]]);
  });

  it("keeps empty cells and rows in their places", async () => {
    const sheets = await readWorkbook(await anXlsx({ Lembar1: [["A1", "", "C1"], [], ["", "B3"]] }));
    expect(sheets[0].rows).toEqual([["A1", "", "C1"], [], ["", "B3"]]);
  });

  it("refuses what isn't a workbook", async () => {
    await expect(readWorkbook(await aZip({ "word/document.xml": "<w:document/>" }))).rejects.toThrow();
    await expect(readWorkbook(new TextEncoder().encode("bukan zip"))).rejects.toThrow();
  });
});

describe("reading a CSV", () => {
  it("splits on commas, keeps quoted commas, quotes and line breaks, and takes Windows line ends", () => {
    expect(readCsv('Nama,Catatan\r\nAni,"Hadir, terlambat"\r\nBudi,"Kata ""ok""\nbaris dua"\r\n')).toEqual([
      ["Nama", "Catatan"],
      ["Ani", "Hadir, terlambat"],
      ["Budi", 'Kata "ok"\nbaris dua'],
    ]);
  });

  it("splits on semicolons when the first line has more of them, as Excel writes CSV where a comma is the decimal mark", () => {
    expect(readCsv("Nama;Nilai\nAni;87,5")).toEqual([
      ["Nama", "Nilai"],
      ["Ani", "87,5"],
    ]);
  });

  it("splits a TSV on tabs", () => {
    expect(readCsv("a\tb,c\n1\t2", true)).toEqual([
      ["a", "b,c"],
      ["1", "2"],
    ]);
  });
});
