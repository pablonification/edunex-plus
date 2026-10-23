// @vitest-environment jsdom
// Notes on a page ("Catatan halaman"). "Catatanku" in the PDF viewer opens a
// panel beside the pages with the note on the page being read, saved as it's
// typed (and when the box is left), on this computer only, kept with the
// file's highlights by its content; a page with a note is marked, and the
// panel lists the file's other notes, each a way to its page. Hapus has
// Urungkan, emptying a note removes it, Escape gives the keyboard back to the
// pages, and ⌘Z in the note is the typing's. Notes come back after a restart,
// and the panel opens as it was left. A text file has one note, for the whole
// file. pdf.js can't lay out text in jsdom: a stand-in lays out each page's
// lines, as in highlights.test.tsx.
import { createHash } from "node:crypto";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HighlightedFile } from "../../src/core/models";
import { MemoryStorage } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

vi.mock("../../src/app/ui/pdf-engine", () => {
  class PdfOpenError extends Error {}
  const page = (n: number) => ({
    size: { width: 842, height: 595 },
    render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
    text: (container: HTMLElement) => {
      const span = document.createElement("span");
      span.textContent = `Slide ${n}: Proposal Tugas Akhir`;
      container.replaceChildren(span);
      return { promise: Promise.resolve(), cancel: () => undefined };
    },
    links: async () => [],
    fields: async () => [],
    release: () => undefined,
  });
  return {
    PdfOpenError,
    LINE_HEIGHT: 1.35,
    OFF: "Off",
    preparePdf: async () => undefined,
    openPdf: async (bytes: Uint8Array) => ({
      pages: Number(/Pages: (\d+)/.exec(new TextDecoder().decode(bytes))?.[1] ?? 1),
      form: null,
      page: async (n: number) => page(n),
      save: async () => new Uint8Array(),
      destroy: () => undefined,
    }),
  };
});

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const BLOB = "https://edunexfixture.blob.core.windows.net/edunex/fixture-1";
const PDF = "%PDF-1.7 Pages: 3";
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const viewer = () => document.querySelector<HTMLElement>("[role=dialog]");
const pages = () => viewer()!.querySelector<HTMLElement>("section[tabindex='0']")!;
const panel = () => viewer()?.querySelector<HTMLElement>("[data-page-notes]") ?? null;
const note = () => panel()!.querySelector("textarea")!;
const title = () => panel()?.querySelector("h2")?.textContent;
/** The notes the app saved last, as "file page text". */
const savedNotes = (s: Awaited<ReturnType<typeof openApp>>) => {
  const value = s.calls.findLast((call) => call.name === "local.set" && (call.input as { name: string }).name === "local.highlights")?.input as
    | { value: HighlightedFile[] }
    | undefined;
  return (value?.value ?? []).flatMap((file) => (file.notes ?? []).map((n) => `${file.file.slice(0, 8)} ${n.page ?? "-"} ${n.text}`));
};

async function tick() {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

/** The Student types in a box: what's in it becomes `value`. */
async function type(target: HTMLTextAreaElement, value: string) {
  await act(async () => {
    target.focus();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(target, value);
    target.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function press(target: Element, key: string, init: KeyboardEventInit = {}) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
  });
  await tick();
}

/** The Student leaves the note for the pages: what they typed is saved. */
async function leave() {
  await act(async () => pages().focus());
  await tick();
}

/** "Catatanku" pressed, unless the panel is open already (it stays as it was left, for as long as the app runs: across these tests too). */
async function openNotes(s: Awaited<ReturnType<typeof openApp>>) {
  if (s.button("Catatanku").getAttribute("aria-pressed") === "true") await s.click("Catatanku");
  await s.click("Catatanku");
}

/** PL3032's outline (a three-page PDF here) open in the viewer, read in and told apart. */
async function openOutline(options: { world?: PretendWorld; storage?: MemoryStorage } = {}) {
  const world = options.world ?? new PretendWorld();
  world.putFile(BLOB, PDF);
  const s = await openApp({ signedIn: true, world, storage: options.storage });
  screen = s;
  const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3032"));
  await s.click(card!);
  await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
  await tick();
  return s;
}

describe("notes on a PDF's pages", () => {
  it("Catatanku opens the note on the page being read, saved as it's typed by the file's content, and the page is marked", async () => {
    const s = await openOutline();
    if (panel()) await s.click("Tutup catatan");
    expect(s.button("Catatanku").getAttribute("aria-pressed")).toBe("false");
    await s.click("Catatanku");
    expect(s.button("Catatanku").getAttribute("aria-pressed")).toBe("true");
    expect(title()).toBe("Catatan halaman 1");
    // The keyboard is in the note, ready to type.
    expect(document.activeElement).toBe(note());
    expect(note().placeholder).toBe("Tulis catatan untuk halaman ini");
    expect(panel()!.textContent).toContain("Tersimpan otomatis, hanya di komputer ini");

    await type(note(), "Pilih topik yang datanya sudah ada.");
    // Saved a moment after the typing stops.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 700)));
    expect(savedNotes(s)).toEqual([`${sha(PDF).slice(0, 8)} 1 Pilih topik yang datanya sudah ada.`]);
    expect(viewer()!.querySelector('[data-page="1"]')!.contains(s.button("Catatan halaman 1"))).toBe(true);
    expect(s.has("Catatan halaman 2")).toBe(false);
    // It's kept on this computer, and goes nowhere else.
    expect(s.calls.filter((call) => call.name !== "local.set" && JSON.stringify(call.input ?? null).includes("topik"))).toEqual([]);
  });

  it("follows the page in view; the file's other notes take the Student to their page, and a page's mark opens its note", async () => {
    const s = await openOutline();
    await openNotes(s);
    await type(note(), "Definisi");
    await press(pages(), "End");
    // What was typed on page 1 is saved as page 3 comes into view, with its own (empty) note.
    expect(title()).toBe("Catatan halaman 3");
    expect(note().value).toBe("");
    expect(savedNotes(s).map((n) => n.slice(9))).toEqual(["1 Definisi"]);
    await type(note(), "Tanya dosen soal jadwal bimbingan\nLalu isi formulir");
    await leave();
    expect(savedNotes(s).map((n) => n.slice(9))).toEqual(["1 Definisi", "3 Tanya dosen soal jadwal bimbingan\nLalu isi formulir"]);
    // The others, by their first line.
    expect(panel()!.textContent).toContain("Catatan di halaman lain");
    await s.click("Halaman 1: Definisi");
    expect(title()).toBe("Catatan halaman 1");
    expect(note().value).toBe("Definisi");

    await s.click("Catatan halaman 3");
    expect(title()).toBe("Catatan halaman 3");
    expect(document.activeElement).toBe(note());
  });

  it("Hapus has Urungkan, emptying a note removes it too; Escape gives the keyboard to the pages, and ⌘Z in a note is the typing's", async () => {
    const s = await openOutline();
    await openNotes(s);
    await type(note(), "Catatan sementara");
    await leave();
    await s.click("Hapus catatan");
    expect(savedNotes(s)).toEqual([]);
    expect(note().value).toBe("");
    expect(s.has("Catatan halaman 1")).toBe(false);
    expect(s.text()).toContain("Catatan dihapus");
    await s.click("Urungkan");
    expect(savedNotes(s).map((n) => n.slice(9))).toEqual(["1 Catatan sementara"]);
    expect(note().value).toBe("Catatan sementara");

    await type(note(), "   ");
    await leave();
    expect(savedNotes(s)).toEqual([]);

    // ⌘Z in the note doesn't reach the viewer (nothing filled in to undo, nothing said).
    await type(note(), "Satu");
    await press(note(), "z", { metaKey: true });
    expect(note().value).toBe("Satu");
    // Escape leaves the note for the pages; the next closes the viewer.
    await press(note(), "Escape");
    expect(document.activeElement).toBe(pages());
    expect(viewer()).not.toBeNull();
    expect(savedNotes(s).map((n) => n.slice(9))).toEqual(["1 Satu"]);
  });

  it("come back after a restart, and the panel opens again as it was left; closing it gives the keyboard to the pages", async () => {
    const world = new PretendWorld();
    const storage = new MemoryStorage();
    const s = await openOutline({ world, storage });
    await openNotes(s);
    await type(note(), "Ringkasan slide pertama");
    await leave();
    await s.click("Tutup");
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    await tick();
    // Open as it was left, without taking the keyboard from the pages.
    expect(note().value).toBe("Ringkasan slide pertama");
    expect(document.activeElement).not.toBe(note());
    s.close();

    const again = await openOutline({ world, storage });
    expect(again.has("Catatan halaman 1")).toBe(true);
    expect(note().value).toBe("Ringkasan slide pertama");
    await again.click("Tutup catatan");
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(pages());
  });
});

describe("a note on a text file", () => {
  it("is one, for the whole file, kept by its content", async () => {
    const s = await openApp({ signedIn: true });
    screen = s;
    const url = `${BLOB}-catatan.txt`;
    const text = "Catatan kuliah\nRumus utama: biaya total = biaya tetap + biaya variabel\n";
    s.world.edunex.postMaterial(95001, { name: "Catatan", type: "file", content: url });
    s.world.putFile(url, text);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3002"));
    await s.click(card!);
    const nav = document.querySelector("nav[aria-label='Daftar isi']")!;
    await s.click([...nav.querySelectorAll("button")].find((b) => b.textContent?.includes("Pengantar"))!);
    await s.click("Lihat: Catatan");
    for (let i = 0; i < 200 && (!viewer() || viewer()!.querySelector("[role=status]")); i++)
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    await tick();

    await openNotes(s);
    expect(title()).toBe("Catatan berkas ini");
    expect(note().placeholder).toBe("Tulis catatan untuk berkas ini");
    await type(note(), "Hafalkan rumus biaya total");
    await act(async () => viewer()!.querySelector<HTMLElement>("section[tabindex='0']")!.focus());
    await tick();
    expect(savedNotes(s)).toEqual([`${sha(text).slice(0, 8)} - Hafalkan rumus biaya total`]);
    // No other pages to list.
    expect(panel()!.textContent).not.toContain("Catatan di halaman lain");
  });
});
