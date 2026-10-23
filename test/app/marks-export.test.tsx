// @vitest-environment jsdom
// Taking a file's highlights and notes out of the app. The viewer's "⋯" menu
// copies them as Markdown or saves them as a .md file where the Student
// chooses: the file's name, its course, each page's note and highlights with
// their colors, each highlight's text whole (found again in the file, though
// only its start is kept). With nothing marked, both say why they can't run.
// A text file's go out without pages. pdf.js can't lay out text in jsdom: a
// stand-in lays out each page's lines, as in highlights.test.tsx.
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_QUOTE } from "../../src/core/models";
import { openApp } from "./harness";

const LONG = `Capaian: mahasiswa mampu menjelaskan konsep utama ekonomi transportasi, ${"menghitung biaya dan manfaat proyek infrastruktur, ".repeat(3)}lalu menilainya.`;

vi.mock("../../src/app/ui/pdf-engine", () => {
  class PdfOpenError extends Error {}
  const lines = (n: number) => [`Minggu ${n}: Pengantar`, n === 1 ? LONG : "Rangkuman minggu ini."];
  const page = (n: number) => ({
    size: { width: 595, height: 842 },
    render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
    text: (container: HTMLElement) => {
      container.replaceChildren(
        ...lines(n).flatMap((line, i) => {
          const span = document.createElement("span");
          span.textContent = line;
          return i ? [document.createElement("br"), span] : [span];
        }),
      );
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
    openPdf: async () => ({ pages: 2, form: null, page: async (n: number) => page(n), save: async () => new Uint8Array(), destroy: () => undefined }),
  };
});

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const BLOB = "https://edunexfixture.blob.core.windows.net/edunex/fixture-1";
const viewer = () => document.querySelector<HTMLElement>("[role=dialog]");
const pages = () => viewer()!.querySelector<HTMLElement>("section[tabindex='0']")!;
const page = (n: number) => viewer()!.querySelector<HTMLElement>(`[data-page="${n}"]`)!;
/** The viewer's own "⋯" (the course page behind it has one too). */
const more = () => viewer()!.querySelector<HTMLButtonElement>("button[aria-label=Lainnya]")!;
const item = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("[role=menuitem]")].find((el) => el.textContent?.startsWith(label))!;

async function tick() {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

/** The Student selects `words` under `within` with the mouse. */
async function select(within: ParentNode, words: string) {
  const walker = document.createTreeWalker(within, NodeFilter.SHOW_TEXT);
  let node: Text | null = null;
  for (let at = walker.nextNode(); at; at = walker.nextNode()) if ((at as Text).data.includes(words)) node = at as Text;
  if (!node) throw new Error(`No "${words}" to select`);
  const range = document.createRange();
  range.setStart(node, node.data.indexOf(words));
  range.setEnd(node, node.data.indexOf(words) + words.length);
  await act(async () => {
    node.parentElement!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    node.parentElement!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
}

/** Writes a note in the open panel and leaves it, so it's saved. */
async function writeNote(text: string) {
  const box = viewer()!.querySelector<HTMLTextAreaElement>("[data-page-notes] textarea")!;
  await act(async () => {
    box.focus();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, text);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => pages().focus());
  await tick();
}

async function openNotes(s: Awaited<ReturnType<typeof openApp>>) {
  if (!viewer()!.querySelector("[data-page-notes]")) await s.click("Catatanku");
}

describe("highlights and notes going out", () => {
  it("copied as Markdown, or saved where the Student chooses: the course, each page's note and whole highlights", async () => {
    const s = await openApp({ signedIn: true });
    screen = s;
    s.world.putFile(BLOB, "%PDF-1.7");
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3032"));
    await s.click(card!);
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    await tick();

    // Nothing marked yet: both stay, dimmed, and say why.
    await s.click(more());
    expect(item("Salin sorotan dan catatan").disabled).toBe(true);
    expect(item("Salin sorotan dan catatan").textContent).toContain("Belum ada sorotan atau catatan di berkas ini");
    expect(item("Simpan sebagai Markdown…").disabled).toBe(true);
    await s.key("Escape");

    await select(page(1), LONG);
    await s.click("Sorot kuning");
    await select(page(2), "Rangkuman");
    await s.click("Sorot hijau");
    await openNotes(s);
    await act(async () => pages().dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true })));
    await writeNote("Ulang rumus biaya total sebelum kuis.\nTanya asisten soal tugas 2.");

    await s.click(more());
    expect(item("Salin sorotan dan catatan").textContent).toBe("Salin sorotan dan catatan2 sorotan · 1 catatan");
    await s.click(item("Salin sorotan dan catatan"));
    await tick();
    const markdown = s.copied.at(-1)!;
    expect(markdown.split("\n").slice(0, 3)).toEqual([
      "# K1. SAP Ekonomi Infrastruktur dan Transportasi.pdf",
      "",
      expect.stringMatching(/^Mata kuliah: PL3032 \S/),
    ]);
    // With the year: the file is read later, away from the app.
    expect(markdown).toMatch(/\nDiekspor dari Edunex Plus, \d{1,2} \S+ \d{4}\n/);
    // The highlight goes out whole, though only its start is kept.
    expect(LONG.length).toBeGreaterThan(MAX_QUOTE);
    expect(markdown).toContain(
      `## Halaman 1\n\n- ${LONG} _(kuning)_\n\n## Halaman 2\n\n**Catatanku:** Ulang rumus biaya total sebelum kuis.\nTanya asisten soal tugas 2.\n\n- Rangkuman _(hijau)_\n`,
    );
    expect(s.text()).toContain("Sorotan dan catatan disalin");

    await s.click(more());
    await s.click(item("Simpan sebagai Markdown…"));
    await tick();
    expect(s.savedCopies.at(-1)).toEqual({ name: "K1. SAP Ekonomi Infrastruktur dan Transportasi (catatan).md", text: markdown });
    expect(s.text()).toContain("Tersimpan: K1. SAP Ekonomi Infrastruktur dan Transportasi (catatan).md");

    // The dialog closed: nothing saved, nothing said.
    s.closeSaveDialog();
    const saved = s.savedCopies.length;
    await s.click(more());
    await s.click(item("Simpan sebagai Markdown…"));
    await tick();
    expect(s.savedCopies).toHaveLength(saved);
  });

  it("a text file's go out without pages", async () => {
    const s = await openApp({ signedIn: true });
    screen = s;
    const url = `${BLOB}-catatan.txt`;
    s.world.edunex.postMaterial(95001, { name: "Catatan", type: "file", content: url });
    s.world.putFile(url, "Catatan kuliah\nRumus utama: biaya total = biaya tetap + biaya variabel\n");
    await s.engineDoes(() => s.engine.refresh("edunex"));
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3002"));
    await s.click(card!);
    const nav = document.querySelector("nav[aria-label='Daftar isi']")!;
    await s.click([...nav.querySelectorAll("button")].find((b) => b.textContent?.includes("Pengantar"))!);
    await s.click("Lihat: Catatan");
    for (let i = 0; i < 200 && (!viewer() || viewer()!.querySelector("[role=status]")); i++)
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    await tick();

    await select(viewer()!.querySelector("pre")!, "biaya tetap");
    await s.click("Sorot biru");
    await openNotes(s);
    await writeNote("Hafalkan rumus ini.");
    await s.click(more());
    await s.click(item("Salin sorotan dan catatan"));
    await tick();
    const markdown = s.copied.at(-1)!;
    expect(markdown).toMatch(/^# Catatan\.txt\n\nMata kuliah: PL3002 /);
    expect(markdown).not.toContain("## Halaman");
    expect(markdown).toMatch(/\*\*Catatanku:\*\* Hafalkan rumus ini\.\n\n- biaya tetap _\(biru\)_\n$/);
  });
});
