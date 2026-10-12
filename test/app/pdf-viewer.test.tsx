// @vitest-environment jsdom
// PDFs read in the app: a course's PDF material, a lecturer's PDF on a Task
// and the Student's own answer open in the viewer over the current screen,
// read in by main's real reader from the pretend storage. pdf.js can't draw in
// jsdom, so a stand-in reads a page count from the made-up bytes; what's
// checked is what the Student sees and can do around the pages.
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../../src/core/models";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

vi.mock("../../src/app/ui/pdf-engine", () => {
  class PdfOpenError extends Error {
    constructor(readonly reason: "locked" | "broken") {
      super(reason);
    }
  }
  const page = (number: number) => ({
    size: number === 3 ? { width: 842, height: 595 } : { width: 595, height: 842 },
    render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
    text: (container: HTMLElement) => {
      container.textContent = `Isi halaman ${number}`;
      return { promise: Promise.resolve(), cancel: () => undefined };
    },
    links: async () =>
      number === 1
        ? [
            { left: 10, top: 10, width: 100, height: 12, url: "https://docs.google.com/fixture" },
            { left: 10, top: 40, width: 80, height: 12, page: 3 },
          ]
        : [],
    release: () => undefined,
  });
  return {
    PdfOpenError,
    openPdf: async (bytes: Uint8Array) => {
      const text = new TextDecoder().decode(bytes);
      if (text.includes("/Encrypt")) throw new PdfOpenError("locked");
      const pages = Number(/Pages: (\d+)/.exec(text)?.[1] ?? 1);
      return { pages, page: async (n: number) => page(n), destroy: () => undefined };
    },
  };
});

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const BLOB = "https://edunexfixture.blob.core.windows.net/edunex/fixture-1";
const viewer = () => document.querySelector<HTMLElement>("[role=dialog]");
const pageBox = () => viewer()!.querySelector<HTMLInputElement>("input[aria-label='Halaman']")!;

async function openPl3032(world: PretendWorld) {
  const s = await openApp({ signedIn: true, world });
  screen = s;
  const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3032"));
  await s.click(card!);
  return s;
}

async function key(target: Element, key: string, init: KeyboardEventInit = {}) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
  });
}

describe("the PDF viewer", () => {
  it("a course's PDF opens over the page, its pages one under another, read in by the app", async () => {
    const world = new PretendWorld();
    world.putFile(BLOB, "%PDF-1.7 Pages: 3");
    const s = await openPl3032(world);
    const view = s.button("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    view.focus();
    await s.click(view);
    expect(s.calls).toContainEqual({ name: "files.read", input: { url: BLOB, as: "pdf" } });
    expect(viewer()?.textContent).toContain("K1. SAP Ekonomi Infrastruktur dan Transportasi.pdf");
    expect(viewer()?.textContent).toContain("dari 3");
    expect(pageBox().value).toBe("1");
    const pages = [...viewer()!.querySelectorAll("[role=group]")].map((p) => p.getAttribute("aria-label"));
    expect(pages).toEqual(["Halaman 1 dari 3", "Halaman 2 dari 3", "Halaman 3 dari 3"]);
    // The text is there to select and copy; downloading stays a click away.
    expect(viewer()?.textContent).toContain("Isi halaman 1");
    await s.click("Unduh");
    expect(s.calls.at(-1)).toEqual({ name: "files.download", input: { url: BLOB, name: "K1. SAP Ekonomi Infrastruktur dan Transportasi.pdf" } });
    // Escape closes it, and the keyboard is back where the Student was.
    await key(document.activeElement!, "Escape");
    expect(viewer()).toBeNull();
    expect(document.activeElement).toBe(view);
  });

  it("zooms in steps, fits the page or the width, and goes to a page from the box or the keyboard", async () => {
    const world = new PretendWorld();
    world.putFile(BLOB, "%PDF-1.7 Pages: 12");
    const s = await openPl3032(world);
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    const percent = () => viewer()!.querySelector("[aria-live=polite]")!.textContent;
    // Without a measured window (jsdom), "fit width" is the printed size.
    expect(percent()).toBe("100%");
    await s.click("Perbesar");
    expect(percent()).toBe("110%");
    await key(document.activeElement!, "=", { metaKey: true });
    expect(percent()).toBe("125%");
    await key(document.activeElement!, "-", { ctrlKey: true });
    await key(document.activeElement!, "-", { ctrlKey: true });
    expect(percent()).toBe("100%");
    // After a zoom, one button fits the width again; once fitted, it offers the whole page.
    await s.click("Selebar jendela");
    await s.click("Satu halaman penuh");
    expect(s.has("Selebar jendela")).toBe(true);
    // The pages take the keyboard first.
    expect(document.activeElement?.getAttribute("aria-label")).toBe("K1. SAP Ekonomi Infrastruktur dan Transportasi.pdf");
    await key(document.activeElement!, "End");
    expect(pageBox().value).toBe("12");
    await key(document.activeElement!, "PageUp");
    expect(pageBox().value).toBe("11");
    await key(document.activeElement!, "Home");
    expect(pageBox().value).toBe("1");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(pageBox(), "7");
      pageBox().dispatchEvent(new Event("input", { bubbles: true }));
    });
    await key(pageBox(), "Enter");
    expect(pageBox().value).toBe("7");
  });

  it("a link in the PDF opens in the browser, or goes to its page", async () => {
    const world = new PretendWorld();
    world.putFile(BLOB, "%PDF-1.7 Pages: 3");
    const s = await openPl3032(world);
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    await s.click(viewer()!.querySelector<HTMLAnchorElement>("a[href='https://docs.google.com/fixture']")!);
    expect(s.calls.at(-1)).toEqual({ name: "shell.openLink", input: { url: "https://docs.google.com/fixture" } });
    await s.click("Ke halaman 3");
    expect(pageBox().value).toBe("3");
  });

  it("says why when a PDF can't be shown, with the ways forward", async () => {
    const world = new PretendWorld();
    world.putFile(BLOB, "%PDF-1.7 Pages: 3");
    world.blobStatus.set(new URL(BLOB).pathname, 403);
    const s = await openPl3032(world);
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    expect(viewer()?.textContent).toContain("PDF ini tidak bisa ditampilkan");
    expect(viewer()?.textContent).toContain("Tautan berkas ini sudah tidak berlaku di Edunex.");
    expect(s.has("Buka di Edunex")).toBe(true);
    // Fixed on Edunex's side: trying again shows it.
    world.blobStatus.clear();
    await s.click("Coba lagi");
    expect(viewer()?.textContent).toContain("dari 3");

    // Bytes that aren't a PDF are never handed to the reader; a locked one says so.
    world.putFile(BLOB, "<html>not a pdf</html>");
    await key(document.activeElement!, "Escape");
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    expect(viewer()?.textContent).toContain("Berkas ini tidak bisa ditampilkan di aplikasi.");
    world.putFile(BLOB, "%PDF-1.7 /Encrypt");
    await s.click("Coba lagi");
    expect(viewer()?.textContent).toContain("PDF ini dikunci dengan kata sandi.");
  });
});

describe("PDFs on a Task", () => {
  // biome-ignore lint/suspicious/noExplicitAny: a dataset as the engine holds it
  const tasks = (s: NonNullable<typeof screen>): Task[] => s.engine.snapshot().datasets.find((d) => d.name === "edunex.tasks")?.value as any;

  async function openTask(title: string) {
    const s = await openApp({ signedIn: true });
    screen = s;
    const task = tasks(s).find((t) => t.title === title)!;
    await s.apply({ type: "navigate", route: { screen: "task", taskId: task.id } });
    return s;
  }

  it("the lecturer's PDF opens in the viewer", async () => {
    const s = await openTask("UTS Markom");
    const file = tasks(s).find((task) => task.title === "UTS Markom")!.files[0];
    s.world.putFile(file.url, "%PDF-1.4 Pages: 2");
    await s.click("Lihat UTS MARKOM SEM 1 2026 2027.pdf");
    expect(s.calls).toContainEqual({ name: "files.read", input: { url: file.url, as: "pdf" } });
    expect(viewer()?.textContent).toContain("dari 2");
  });

  it("the Student's own PDF in the answer opens in the viewer, even while the answer can still change", async () => {
    const s = await openTask("Tugas 01 Bab I");
    const file = tasks(s).find((task) => task.title === "Tugas 01 Bab I")!.answer!.files[0];
    s.world.putFile(file.url, "%PDF-1.4 Pages: 4");
    await s.click(`Lihat ${file.name}`);
    expect(s.calls).toContainEqual({ name: "files.read", input: { url: file.url, as: "pdf" } });
    expect(viewer()?.textContent).toContain("dari 4");
  });
});
