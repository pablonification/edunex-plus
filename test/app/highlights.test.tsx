// @vitest-environment jsdom
// Highlighting what's read in the app. Text selected in a course's PDF or
// text file gets a bar over it, a color each, and ⌘⇧H highlights it in the
// color picked last; a highlight is a stop for the keyboard, whose bar changes
// its color or removes it, and Delete removes it; the viewer's "⋯" menu
// removes all of a file's at once; Undo and ⌘Z put them back. Each is said
// to screen readers. Highlights are kept on this computer by the
// file's content and come back the next time it opens, after a restart too; a
// Word document's do as well. pdf.js can't lay out text in jsdom, so a
// stand-in lays each page's lines out as spans, as pdf.js's text layer does;
// where a highlight is drawn isn't checked (jsdom measures nothing), what's
// kept, reached and said is.
import { createHash } from "node:crypto";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { textOf } from "../../src/app/ui/text-anchor";
import type { HighlightedFile } from "../../src/core/models";
import { aDocx } from "../kit/office-files";
import { MemoryStorage } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

vi.mock("../../src/app/ui/pdf-engine", () => {
  class PdfOpenError extends Error {}
  const lines = (n: number) => [`Minggu ${n}: Pengantar`, "Capaian: mahasiswa mampu menjelaskan konsep utama."];
  const page = (n: number) => ({
    size: { width: 595, height: 842 },
    render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
    // A line a span, a line break between them, as pdf.js lays a page's text over it.
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
const PDF = "%PDF-1.7 Pages: 2";
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const viewer = () => document.querySelector<HTMLElement>("[role=dialog]");
const pages = () => viewer()!.querySelector<HTMLElement>("section[tabindex='0']")!;
const page = (n: number) => viewer()!.querySelector<HTMLElement>(`[data-page="${n}"]`)!;
const bar = () => viewer()?.querySelector<HTMLElement>("[role=toolbar]") ?? null;
/** The viewer's own "⋯" (the course page behind it has one too), and its one item as the Student reads it. */
const more = () => viewer()!.querySelector<HTMLButtonElement>("button[aria-label=Lainnya]")!;
const clearAllItem = () =>
  [...document.querySelectorAll<HTMLButtonElement>("[role=menuitem]")].find((item) => item.textContent?.startsWith("Hapus semua sorotan"));
/** What the viewer last said to screen readers. */
const said = () => [...viewer()!.querySelectorAll("[aria-live=polite]")].at(-1)?.textContent;
/** The highlights the app saved last, as "page start-end color text". */
const savedHighlights = (s: Awaited<ReturnType<typeof openApp>>) => {
  const value = s.calls.findLast((call) => call.name === "local.set" && (call.input as { name: string }).name === "local.highlights")?.input as
    | { value: HighlightedFile[] }
    | undefined;
  return (value?.value ?? []).flatMap((file) =>
    file.highlights.map((h) => `${file.file.slice(0, 8)} ${h.page ?? "-"} ${h.start}-${h.end} ${h.color} ${h.text}`),
  );
};

/** Lets the window's next ticks run: the file's content is told apart beside its drawing. */
async function tick() {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

/** The Student selects `words` under `within` with the mouse: pressed, dragged over them, let go. */
async function select(within: ParentNode, words: string) {
  const walker = document.createTreeWalker(within, NodeFilter.SHOW_TEXT);
  let node: Text | null = null;
  for (let at = walker.nextNode(); at; at = walker.nextNode()) if ((at as Text).data.includes(words)) node = at as Text;
  if (!node) throw new Error(`No "${words}" to select`);
  const from = node.data.indexOf(words);
  const range = document.createRange();
  range.setStart(node, from);
  range.setEnd(node, from + words.length);
  const target = node.parentElement!;
  await act(async () => {
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
}

async function press(target: Element, key: string, init: KeyboardEventInit = {}) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
  });
  await tick();
}

/** PL3032's outline (a PDF) open in the viewer, read in and told apart. */
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

describe("highlighting a PDF", () => {
  it("selected text gets a bar with a color each; a highlight is kept by the file's content, the page and where its text is", async () => {
    const s = await openOutline();
    expect(bar()).toBeNull();
    await select(page(1), "mahasiswa mampu");
    expect(bar()?.getAttribute("aria-label")).toBe("Sorot teks");
    expect([...bar()!.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual([
      "Sorot kuning",
      "Sorot hijau",
      "Sorot biru",
      "Sorot merah muda",
    ]);
    // The color ⌘⇧H uses says so.
    expect(s.button("Sorot kuning").getAttribute("aria-keyshortcuts")).toBe("Meta+Shift+H");

    await s.click("Sorot kuning");
    // "Minggu 1: Pengantar" is 19 characters, "Capaian: " 9 more: the words start at 28.
    expect(savedHighlights(s)).toEqual([`${sha(PDF).slice(0, 8)} 1 28-43 yellow mahasiswa mampu`]);
    expect(bar()).toBeNull();
    expect(document.getSelection()?.isCollapsed).toBe(true);
    expect(said()).toBe("Disorot kuning");
    // On the page, where the keyboard reaches it, named by its color and words.
    expect(page(1).contains(s.button("Sorotan kuning: mahasiswa mampu"))).toBe(true);
    // It's kept on this computer, and goes nowhere else.
    expect(s.calls.filter((call) => call.name !== "local.set" && JSON.stringify(call.input ?? null).includes("mahasiswa"))).toEqual([]);
  });

  it("from the keyboard: Enter opens a highlight's bar on its color, a color changes it, Delete removes it and ⌘Z puts it back", async () => {
    const s = await openOutline();
    await select(page(1), "konsep utama");
    await s.click("Sorot kuning");
    const highlight = s.button("Sorotan kuning: konsep utama");
    highlight.focus();
    // Enter (a click from the keyboard) opens its bar, on the color it is.
    await s.click(highlight);
    expect(bar()?.getAttribute("aria-label")).toBe("Sorotan");
    expect(highlight.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Kuning");
    expect(document.activeElement?.getAttribute("aria-pressed")).toBe("true");
    expect(s.button("Hijau").getAttribute("aria-pressed")).toBe("false");

    await s.click("Hijau");
    expect(savedHighlights(s)).toEqual([`${sha(PDF).slice(0, 8)} 1 56-68 green konsep utama`]);
    expect(said()).toBe("Sorotan sekarang hijau");
    // The keyboard is back on the highlight.
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Sorotan hijau: konsep utama");

    // Escape closes its bar, not the viewer (the first one shuts the tooltip of the color in focus).
    await s.click(document.activeElement as HTMLElement);
    await press(document.activeElement!, "Escape");
    await press(document.activeElement!, "Escape");
    expect(bar()).toBeNull();
    expect(viewer()).not.toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Sorotan hijau: konsep utama");

    await press(document.activeElement!, "Delete");
    expect(savedHighlights(s)).toEqual([]);
    expect(s.has("Sorotan hijau: konsep utama")).toBe(false);
    expect(said()).toBe("Sorotan dihapus. Urungkan dengan ⌘Z.");
    expect(s.text()).toContain("Sorotan dihapus");
    // The keyboard carries on from the pages.
    expect(document.activeElement).toBe(pages());

    await press(pages(), "z", { metaKey: true });
    expect(savedHighlights(s)).toEqual([`${sha(PDF).slice(0, 8)} 1 56-68 green konsep utama`]);
    expect(said()).toBe("Sorotan dikembalikan");
    expect(s.has("Sorotan hijau: konsep utama")).toBe(true);
  });

  it("⌘⇧H highlights what's selected in the color picked last, across pages; the bar's Remove has an Undo in its toast", async () => {
    const s = await openOutline();
    await select(page(2), "Pengantar");
    await s.click("Sorot biru");
    // From the end of page 1 to the start of page 2, with the keyboard.
    const range = document.createRange();
    const lastLine = page(1).querySelectorAll(".pdf-text span")[1].firstChild as Text;
    range.setStart(lastLine, lastLine.data.indexOf("utama"));
    range.setEnd(page(2).querySelector(".pdf-text span")!.firstChild!, 6);
    await act(async () => {
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
    });
    await press(pages(), "H", { metaKey: true, shiftKey: true });
    expect(savedHighlights(s).map((h) => h.slice(9))).toEqual(["2 10-19 blue Pengantar", "1 63-69 blue utama.", "2 0-6 blue Minggu"]);
    expect(said()).toBe("Disorot biru");

    const highlight = s.button("Sorotan biru: Pengantar");
    highlight.focus();
    await s.click(highlight);
    await s.click("Hapus sorotan");
    expect(s.has("Sorotan biru: Pengantar")).toBe(false);
    await s.click("Urungkan");
    expect(s.has("Sorotan biru: Pengantar")).toBe(true);
    expect(savedHighlights(s)).toHaveLength(3);
  });

  it("the ⋯ menu removes every highlight in the file at once; Undo and ⌘Z put them all back", async () => {
    const s = await openOutline();
    // None yet: the item says why it can't run.
    await s.click(more());
    expect(clearAllItem()?.disabled).toBe(true);
    expect(clearAllItem()?.textContent).toBe("Hapus semua sorotanBelum ada sorotan di berkas ini");
    await s.key("Escape");

    await select(page(1), "mahasiswa mampu");
    await s.click("Sorot kuning");
    await select(page(2), "Pengantar");
    await s.click("Sorot biru");
    await s.click(more());
    expect(clearAllItem()?.textContent).toBe("Hapus semua sorotan2 sorotan di berkas ini");
    await s.click(clearAllItem()!);
    expect(savedHighlights(s)).toEqual([]);
    expect(s.has("Sorotan kuning: mahasiswa mampu")).toBe(false);
    expect(s.text()).toContain("2 sorotan dihapus");
    expect(said()).toBe("2 sorotan dihapus. Urungkan dengan ⌘Z.");
    // The keyboard carries on from the pages, where ⌘Z puts them back.
    expect(document.activeElement).toBe(pages());

    await s.click("Urungkan");
    expect(savedHighlights(s).map((h) => h.slice(9))).toEqual(["1 28-43 yellow mahasiswa mampu", "2 10-19 blue Pengantar"]);

    await s.click(more());
    await s.click(clearAllItem()!);
    await press(pages(), "z", { metaKey: true });
    expect(savedHighlights(s)).toHaveLength(2);
    expect(said()).toBe("2 sorotan dikembalikan");
    expect(s.has("Sorotan biru: Pengantar")).toBe(true);
  });

  it("come back when the file opens again, and after a restart, at any zoom", async () => {
    const world = new PretendWorld();
    const storage = new MemoryStorage();
    const s = await openOutline({ world, storage });
    await select(page(1), "mahasiswa mampu");
    await s.click("Sorot hijau");
    await s.click("Tutup");
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    await tick();
    expect(s.has("Sorotan hijau: mahasiswa mampu")).toBe(true);
    await s.click("Perbesar");
    await tick();
    expect(s.has("Sorotan hijau: mahasiswa mampu")).toBe(true);
    s.close();

    const again = await openOutline({ world, storage });
    expect(again.has("Sorotan hijau: mahasiswa mampu")).toBe(true);
  });
});

describe("highlighting other files", () => {
  async function openWith(file: { name: string; ext: string; bytes: Uint8Array | string }) {
    const s = await openApp({ signedIn: true });
    screen = s;
    const url = `${BLOB}-${file.name.toLowerCase()}.${file.ext}`;
    s.world.edunex.postMaterial(95001, { name: file.name, type: "file", content: url });
    s.world.putFile(url, file.bytes);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3002"));
    await s.click(card!);
    const nav = document.querySelector("nav[aria-label='Daftar isi']")!;
    await s.click([...nav.querySelectorAll("button")].find((b) => b.textContent?.includes("Pengantar"))!);
    await s.click(`Lihat: ${file.name}`);
    for (let i = 0; i < 200 && (!viewer() || viewer()!.querySelector("[role=status]")); i++)
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    await tick();
    return s;
  }

  it("a text file's text is highlighted as a PDF's is, and kept by its content; its ⋯ menu removes them all", async () => {
    const text = "Catatan kuliah\nRumus utama: biaya total = biaya tetap + biaya variabel\n";
    const s = await openWith({ name: "Catatan", ext: "txt", bytes: text });
    await select(viewer()!.querySelector("pre")!, "biaya tetap");
    await s.click("Sorot kuning");
    expect(savedHighlights(s)).toEqual([`${sha(text).slice(0, 8)} - 42-53 yellow biaya tetap`]);
    await s.click("Tutup");
    await s.click("Lihat: Catatan");
    await tick();
    expect(s.has("Sorotan kuning: biaya tetap")).toBe(true);

    await s.click(more());
    await s.click(clearAllItem()!);
    expect(savedHighlights(s)).toEqual([]);
    expect(said()).toBe("1 sorotan dihapus. Urungkan dengan ⌘Z.");
    await press(document.activeElement!, "z", { metaKey: true });
    expect(s.has("Sorotan kuning: biaya tetap")).toBe(true);
    expect(said()).toBe("Sorotan dikembalikan");
  });

  it("a Word document's highlights come back on its pages, and Delete removes one", async () => {
    const docx = await aDocx({ lines: ["Notulen rapat kelompok", "Pembagian tugas minggu ini"] });
    const s = await openWith({ name: "Notulen", ext: "docx", bytes: docx });
    const shadow = [...viewer()!.querySelectorAll("section div")].find((element) => element.shadowRoot)!.shadowRoot!;
    const words = textOf(shadow);
    const start = words.indexOf("Pembagian tugas");
    await s.engineDoes(() =>
      s.engine.setLocal("local.highlights", [
        { file: sha(docx), at: 1, highlights: [{ id: "h1", start, end: start + 15, color: "pink", text: "Pembagian tugas", at: 1 }] },
      ]),
    );
    await tick();
    const highlight = s.button("Sorotan merah muda: Pembagian tugas");
    highlight.focus();
    await press(highlight, "Delete");
    expect(s.has("Sorotan merah muda: Pembagian tugas")).toBe(false);
    expect(savedHighlights(s)).toEqual([]);
  });
});
