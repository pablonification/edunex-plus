// @vitest-environment jsdom
// Course files that aren't PDFs read in the app too: a Word document as its
// pages, a workbook as a table per sheet, a CSV, text and code, a picture.
// Each is read in by main's real reader from the pretend storage, as tiny
// made-up files (../kit/office-files.ts); what can't be shown keeps
// downloading and opening in the computer's own app.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { aDocx, anXlsx } from "../kit/office-files";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const BLOB = "https://edunexfixture.blob.core.windows.net/edunex/fixture-1";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const viewer = () => document.querySelector<HTMLElement>("[role=dialog]");
/** What the viewer shows, the Word document's pages (in their shadow root) included. */
const shown = () => {
  const pages = viewer()?.querySelector("section > div")?.shadowRoot;
  return `${viewer()?.textContent ?? ""}${pages?.textContent ?? ""}`;
};

/** PL3002's Pengantar with these files posted in it, as a lecturer's uploads, open on screen. */
async function openWith(files: { name: string; ext: string; bytes: Uint8Array | string }[]) {
  const s = await openApp({ signedIn: true });
  screen = s;
  for (const file of files) {
    const url = `${BLOB}-${file.name.toLowerCase().replace(/\W+/g, "-")}.${file.ext}`;
    s.world.edunex.postMaterial(95001, { name: file.name, type: "file", content: url });
    s.world.putFile(url, file.bytes);
  }
  await s.engineDoes(() => s.engine.refresh("edunex"));
  const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3002"));
  await s.click(card!);
  const nav = document.querySelector("nav[aria-label='Daftar isi']")!;
  await s.click([...nav.querySelectorAll("button")].find((b) => b.textContent?.includes("Pengantar"))!);
  return s;
}

/** Waits for the viewer to load (its first time), and to have read the file in (main reads it, then a reader draws it). */
async function settle() {
  for (let i = 0; i < 200 && (!viewer() || viewer()!.querySelector("[role=status]")); i++)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
}

describe("files other than PDFs in the viewer", () => {
  it("a Word document opens as its pages, its links go through the app's link rules, and it can still be downloaded", async () => {
    const docx = await aDocx({ lines: ["Notulen rapat kelompok", "Pembagian tugas minggu ini"], link: { text: "formulir", url: "https://forms.gle/fixture" } });
    const s = await openWith([{ name: "Notulen", ext: "docx", bytes: docx }]);
    await s.click("Lihat: Notulen");
    await settle();
    expect(s.calls).toContainEqual({ name: "files.read", input: { url: `${BLOB}-notulen.docx`, as: "docx" } });
    expect(viewer()?.textContent).toContain("Notulen.docx");
    expect(shown()).toContain("Notulen rapat kelompok");
    expect(shown()).toContain("Pembagian tugas minggu ini");
    // Its styles stay in its own shadow root, not the app's page.
    expect(document.head.querySelector("style")?.textContent ?? "").not.toContain(".docx-wrapper");
    const pages = viewer()!.querySelector("section > div")!.shadowRoot!;
    const link = [...pages.querySelectorAll("a")].find((a) => a.textContent === "formulir")!;
    await act(async () => {
      link.click();
    });
    expect(s.calls.at(-1)).toEqual({ name: "shell.openLink", input: { url: "https://forms.gle/fixture" } });
    await s.click("Unduh");
    expect(s.calls.at(-1)).toEqual({ name: "files.download", input: { url: `${BLOB}-notulen.docx`, name: "Notulen.docx" } });
  });

  it("a workbook opens as a table per sheet, with Excel's column letters and row numbers", async () => {
    const xlsx = await anXlsx({
      Kuis: [
        ["NIM", "Nilai"],
        ["10000001", 87.5],
      ],
      Rekap: [["Rata-rata", 43.9]],
    });
    const s = await openWith([{ name: "Nilai kuis", ext: "xlsx", bytes: xlsx }]);
    await s.click("Lihat: Nilai kuis");
    await settle();
    expect(s.calls).toContainEqual({ name: "files.read", input: { url: `${BLOB}-nilai-kuis.xlsx`, as: "xlsx" } });
    const cells = () => [...viewer()!.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((cell) => cell.textContent));
    expect([...viewer()!.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["", "A", "B"]);
    expect(cells()).toEqual([
      ["1", "NIM", "Nilai"],
      ["2", "10000001", "87.5"],
    ]);
    const tabs = [...viewer()!.querySelectorAll<HTMLElement>("[role=tab]")];
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Kuis", "Rekap"]);
    await act(async () => {
      tabs[1].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    });
    expect(cells()).toEqual([["1", "Rata-rata", "43.9"]]);
  });

  it("a CSV is a table, code and text are shown as they are, and a picture whole", async () => {
    const s = await openWith([
      { name: "Presensi", ext: "csv", bytes: 'Nama,Hadir\nAni,"Ya, terlambat"' },
      { name: "Contoh program", ext: "py", bytes: "def halo():\n    print('<b>Halo</b>')\n" },
      { name: "Papan", ext: "png", bytes: PNG },
    ]);
    await s.click("Lihat: Presensi");
    await settle();
    expect(s.calls).toContainEqual({ name: "files.read", input: { url: `${BLOB}-presensi.csv`, as: "text" } });
    expect([...viewer()!.querySelectorAll("tbody td")].map((td) => td.textContent)).toEqual(["Nama", "Hadir", "Ani", "Ya, terlambat"]);
    await s.click("Tutup");

    await s.click("Lihat: Contoh program");
    await settle();
    // Text is only ever text: markup in it is shown, never made into elements.
    expect(viewer()!.querySelector("pre")?.textContent).toBe("def halo():\n    print('<b>Halo</b>')\n");
    expect(viewer()!.querySelector("pre b")).toBeNull();
    await s.click("Tutup");

    await s.click("Lihat: Papan");
    await settle();
    expect(s.calls).toContainEqual({ name: "files.read", input: { url: `${BLOB}-papan.png`, as: "image" } });
    expect(viewer()!.querySelector("img")?.getAttribute("alt")).toBe("Papan.png");
  });

  it("a file that isn't what its name says can't be shown, and downloading it is the way forward", async () => {
    const s = await openWith([{ name: "Rusak", ext: "docx", bytes: "bukan dokumen Word" }]);
    await s.click("Lihat: Rusak");
    await settle();
    expect(viewer()?.textContent).toContain("Berkas ini tidak bisa ditampilkan");
    expect(viewer()?.textContent).toContain("Berkas ini tidak bisa ditampilkan di aplikasi.");
    await s.click("Unduh");
    expect(s.calls.at(-1)).toEqual({ name: "files.download", input: { url: `${BLOB}-rusak.docx`, name: "Rusak.docx" } });
  });

  it("what the viewer can't show keeps downloading: PowerPoint, old Word files", async () => {
    const s = await openWith([
      { name: "Slide", ext: "pptx", bytes: "PK" },
      { name: "Modul lama", ext: "doc", bytes: "x" },
    ]);
    expect(s.has("Lihat: Slide")).toBe(false);
    expect(s.has("Lihat: Modul lama")).toBe(false);
    await s.click("Unduh: Slide");
    expect(s.calls.at(-1)).toMatchObject({ name: "files.download", input: { name: "Slide.pptx" } });
  });
});
