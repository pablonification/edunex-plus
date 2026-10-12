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

/** What the stand-in opened and freed; `hold` keeps the next PDF opening until it's let go. */
const engine = vi.hoisted(() => ({ opened: 0, destroyed: 0, hold: null as Promise<void> | null }));

vi.mock("../../src/app/ui/pdf-engine", () => {
  class PdfOpenError extends Error {
    constructor(readonly reason: "locked" | "broken") {
      super(reason);
    }
  }
  const page = (number: number, broken: boolean) => ({
    size: number === 3 ? { width: 842, height: 595 } : { width: 595, height: 842 },
    render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
    text: (container: HTMLElement) => {
      if (broken) throw new Error("a page that can't be drawn");
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
      await engine.hold;
      engine.opened++;
      const pages = Number(/Pages: (\d+)/.exec(text)?.[1] ?? 1);
      return {
        pages,
        page: async (n: number) => page(n, text.includes("Rusak")),
        destroy: () => {
          engine.destroyed++;
        },
      };
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
    // Escape closes it, and the keyboard is back where the Student was (the dialog hands it back on its next tick).
    await key(document.activeElement!, "Escape");
    expect(viewer()).toBeNull();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
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

  it("says why when a PDF can't be shown, with the one way forward that can work", async () => {
    const world = new PretendWorld();
    world.putFile(BLOB, "%PDF-1.7 Pages: 3");
    world.blobStatus.set(new URL(BLOB).pathname, 403);
    const s = await openPl3032(world);
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    expect(viewer()?.textContent).toContain("PDF ini tidak bisa ditampilkan");
    expect(viewer()?.textContent).toContain("Tautan berkas ini sudah tidak berlaku di Edunex.");
    // The link stopped working: downloading or trying it again can't help; Edunex's page can.
    expect([...viewer()!.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["", "Buka di Edunex"]);
    await s.click("Buka di Edunex");
    expect(s.calls.at(-1)?.name).toBe("shell.openExternal");

    // Edunex's storage out of reach: trying again is the way, and works once it answers.
    world.blobStatus.set(new URL(BLOB).pathname, 503);
    await key(document.activeElement!, "Escape");
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    expect(viewer()?.textContent).toContain("Penyimpanan Edunex tidak terjangkau.");
    expect(s.has("Buka di Edunex")).toBe(false);
    world.blobStatus.clear();
    await s.click("Coba lagi");
    expect(viewer()?.textContent).toContain("dari 3");

    // Bytes that aren't a PDF are never handed to the reader; one the app can't read is still a download away.
    world.putFile(BLOB, "<html>not a pdf</html>");
    await key(document.activeElement!, "Escape");
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    expect(viewer()?.textContent).toContain("Berkas ini tidak bisa ditampilkan di aplikasi.");
    expect([...viewer()!.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["", "Unduh"]);
    world.putFile(BLOB, "%PDF-1.7 /Encrypt");
    await key(document.activeElement!, "Escape");
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    expect(viewer()?.textContent).toContain("PDF ini dikunci dengan kata sandi.");
    await s.click("Unduh");
    expect(s.calls.at(-1)).toEqual({ name: "files.download", input: { url: BLOB, name: "K1. SAP Ekonomi Infrastruktur dan Transportasi.pdf" } });
  });

  it("Escape while typing a page number lets go of the number; the next one closes the viewer", async () => {
    const world = new PretendWorld();
    world.putFile(BLOB, "%PDF-1.7 Pages: 12");
    const s = await openPl3032(world);
    const view = s.button("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    view.focus();
    await s.click(view);
    // The box is named, and says how many pages there are.
    expect(document.getElementById(pageBox().getAttribute("aria-describedby")!)?.textContent).toBe("dari 12");
    await act(async () => pageBox().focus());
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(pageBox(), "7");
      pageBox().dispatchEvent(new Event("input", { bubbles: true }));
    });
    await key(pageBox(), "Escape");
    expect(viewer()).not.toBeNull();
    expect(pageBox().value).toBe("1");
    await key(pageBox(), "Escape");
    expect(viewer()).toBeNull();
    // Leaving from a text box, the dialog hands the keyboard back on its next tick.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(document.activeElement).toBe(view);
  });

  it("the zoom buttons keep the keyboard at their limits", async () => {
    const world = new PretendWorld();
    world.putFile(BLOB, "%PDF-1.7 Pages: 2");
    const s = await openPl3032(world);
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    const zoomIn = s.button("Perbesar");
    zoomIn.focus();
    for (let step = 0; step < 10; step++) await s.click(zoomIn);
    expect(viewer()!.querySelector("[aria-live=polite]")!.textContent).toBe("400%");
    expect(zoomIn.getAttribute("aria-disabled")).toBe("true");
    expect(zoomIn.disabled).toBe(false);
    expect(document.activeElement).toBe(zoomIn);
  });

  it("a page drawn again at a new zoom gives the old drawing's memory back at once", async () => {
    const world = new PretendWorld();
    world.putFile(BLOB, "%PDF-1.7 Pages: 2");
    const s = await openPl3032(world);
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
    const drawing = () => viewer()!.querySelector<HTMLCanvasElement>("[data-page='1'] canvas");
    await wait(10);
    const first = drawing();
    expect(first!.width).toBeGreaterThan(0);
    await s.click("Perbesar");
    // Quick zoom steps draw once, a moment after the last.
    await wait(200);
    expect(drawing()).not.toBe(first);
    expect(first!.width).toBe(0);
  });

  it("closing it while the PDF is still opening frees it all the same", async () => {
    const world = new PretendWorld();
    world.putFile(BLOB, "%PDF-1.7 Pages: 3");
    const s = await openPl3032(world);
    let release: () => void = () => undefined;
    engine.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const before = { opened: engine.opened, destroyed: engine.destroyed };
    try {
      await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
      expect(viewer()?.textContent).toContain("Memuat PDF");
      await key(document.activeElement!, "Escape");
      expect(viewer()).toBeNull();
    } finally {
      engine.hold = null;
      await act(async () => release());
    }
    await act(async () => undefined);
    expect(engine.opened - before.opened).toBe(1);
    expect(engine.destroyed - before.destroyed).toBe(1);
  });

  it("moving to another screen shuts the viewer instead of leaving it over the new one", async () => {
    const world = new PretendWorld();
    world.putFile(BLOB, "%PDF-1.7 Pages: 3");
    const s = await openPl3032(world);
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    expect(viewer()).not.toBeNull();
    await key(document.activeElement!, "1", { metaKey: true });
    expect(viewer()).toBeNull();
    expect(document.querySelector("h1")?.textContent).not.toBe("Ekonomi Infrastruktur dan Transportasi");
    expect(s.has("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi")).toBe(false);
  });

  it("a notification click (or a search result, or ⌘[) going to another screen shuts it too", async () => {
    const world = new PretendWorld();
    world.putFile(BLOB, "%PDF-1.7 Pages: 3");
    const s = await openPl3032(world);
    await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    expect(viewer()).not.toBeNull();
    await s.apply({ type: "navigate", route: { screen: "course", code: "PL3002", tab: "modules" } });
    expect(viewer()).toBeNull();
    expect(document.querySelector("h1")?.textContent).toBe("Economics and Innovation in Planning");
  });

  it("a page that can't be drawn breaks the pages, not the window: the title and Close stay", async () => {
    const world = new PretendWorld();
    world.putFile(BLOB, "%PDF-1.7 Pages: 2 Rusak");
    const s = await openPl3032(world);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
      expect(viewer()?.textContent).toContain("Bagian ini gagal ditampilkan");
      expect(viewer()?.textContent).toContain("K1. SAP Ekonomi Infrastruktur dan Transportasi.pdf");
      await s.click("Tutup");
      expect(viewer()).toBeNull();
      expect(document.querySelector("h1")?.textContent).toBeTruthy();
    } finally {
      errors.mockRestore();
    }
  });

  it("whatever else in the viewer fails breaks the viewer, not the window: the title and Close stay", async () => {
    const world = new PretendWorld();
    // No pages at all: the reader has nothing to lay out.
    world.putFile(BLOB, "%PDF-1.7 Pages: 0");
    const s = await openPl3032(world);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await s.click("Lihat: K1. SAP Ekonomi Infrastruktur dan Transportasi");
      expect(viewer()?.textContent).toContain("Bagian ini gagal ditampilkan");
      expect(viewer()?.textContent).toContain("K1. SAP Ekonomi Infrastruktur dan Transportasi.pdf");
      await s.click("Tutup");
      expect(viewer()).toBeNull();
      expect(document.querySelector("h1")?.textContent).toBe("Infrastructure and Transportation Economics");
    } finally {
      errors.mockRestore();
    }
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

    // Gone from Edunex's storage: the Task's own page on Edunex is the way forward.
    s.world.blobStatus.set(new URL(file.url).pathname, 404);
    await key(document.activeElement!, "Escape");
    await s.click("Lihat UTS MARKOM SEM 1 2026 2027.pdf");
    expect(viewer()?.textContent).toContain("Berkas ini sudah tidak ada di Edunex.");
    await s.click("Buka di Edunex");
    expect(s.calls.at(-1)).toEqual({
      name: "shell.openExternal",
      input: { url: `https://edunex.itb.ac.id/assignment/take/${tasks(s).find((task) => task.title === "UTS Markom")!.id}` },
    });
  });

  it("the Student's own PDF in the answer opens in the viewer, even while the answer can still change", async () => {
    const s = await openTask("Tugas 01 Bab I");
    const file = tasks(s).find((task) => task.title === "Tugas 01 Bab I")!.answer!.files[0];
    s.world.putFile(file.url, "%PDF-1.4 Pages: 4");
    await s.click(`Lihat ${file.name}`);
    expect(s.calls).toContainEqual({ name: "files.read", input: { url: file.url, as: "pdf" } });
    expect(viewer()?.textContent).toContain("dari 4");
  });

  it("a PDF the Student just attached opens from its content, read by main by the id it gave; once on Edunex, from there", async () => {
    const s = await openTask("Tugas 02 Bab II");
    // Edunex's storage answers slowly: the files are still on their way up when the Student looks. (So no
    // waiting for every request here, only for the screen to catch up.)
    s.world.setLatency(10_000);
    const press = async (name: string | RegExp, until: () => boolean = () => true) =>
      act(async () => {
        s.button(name).click();
        for (let round = 0; round < 100 && !until(); round++) await new Promise((resolve) => setImmediate(resolve));
      });
    s.willPick([
      { name: "Bab II.pdf", content: "%PDF-1.4 Pages: 5" },
      { name: "Lampiran.pdf", content: "bukan PDF" },
      { name: "Catatan.docx", content: "PK" },
    ]);
    await press(/^Lampirkan berkas/, () => s.has("Lihat Bab II.pdf"));
    await press("Lihat Bab II.pdf", () => Boolean(viewer()?.textContent?.includes("dari 5")));
    expect(viewer()?.textContent).toContain("dari 5");
    // The window asks by the id main gave the file; where it is on the computer never reaches the window.
    expect(s.calls.filter((call) => call.name === "tasks.readPicked")).toEqual([{ name: "tasks.readPicked", input: { fileId: expect.any(String) } }]);
    expect(s.calls.some((call) => call.name === "files.read")).toBe(false);
    await key(document.activeElement!, "Escape");
    // Only a PDF offers a look, and one that isn't really a PDF says so instead of drawing nothing.
    expect(s.has("Lihat Catatan.docx")).toBe(false);
    await press("Lihat Lampiran.pdf", () => Boolean(viewer()?.querySelector("[role=alert]")));
    expect(viewer()?.textContent).toContain("Berkas ini tidak bisa ditampilkan di aplikasi.");
    await key(document.activeElement!, "Escape");

    // Uploaded: it opens from Edunex's storage, as the lecturer will get it.
    s.world.setLatency(0);
    await s.wait(10 * 60_000);
    expect(document.querySelector("main aside")?.textContent).not.toContain("Mengunggah");
    await s.click("Lihat Bab II.pdf");
    expect(s.calls.at(-1)).toEqual({ name: "files.read", input: { url: expect.stringContaining("/edunex/upload/"), as: "pdf" } });
    expect(viewer()?.textContent).toContain("dari 5");
  });
});
