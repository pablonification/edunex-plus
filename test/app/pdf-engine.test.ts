// How sharp a PDF page is drawn: at the screen's own density, until the
// drawing would grow past what one page should cost in memory (zoomed far in
// on a Retina screen) or past the longest side a canvas can have. And which
// links inside a PDF the viewer may offer: web pages and its own pages only.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drawingRatio, openPdf } from "../../src/app/ui/pdf-engine";

/** pdf.js, as far as a page's links go: one page whose annotations are these. */
const annotations = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/pdfjs/worker.mjs" }));
vi.mock("pdfjs-dist", () => {
  const page = {
    getViewport: () => ({ width: 600, height: 800, convertToViewportPoint: (x: number, y: number) => [x, 800 - y] }),
    getAnnotations: async () => annotations,
  };
  const doc = { numPages: 9, getPage: async () => page, getDestination: async () => null, getPageIndex: async () => 4 };
  return {
    GlobalWorkerOptions: {},
    Util: { normalizeRect: ([a, b, c, d]: number[]) => [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)] },
    getDocument: () => ({ promise: Promise.resolve(doc), destroy: async () => undefined }),
  };
});

/** An A4 page in CSS pixels at this zoom (1 = its printed size). */
const a4 = (zoom: number) => [595 * (96 / 72) * zoom, 842 * (96 / 72) * zoom] as const;

describe("a page's drawing", () => {
  it("is as sharp as the screen at the zooms people read at", () => {
    expect(drawingRatio(...a4(1.5), 2)).toBe(2);
    expect(drawingRatio(...a4(1), 1)).toBe(1);
  });

  it("stays within the memory cap zoomed far in, a little soft instead of hundreds of MB", () => {
    const [width, height] = a4(4);
    const ratio = drawingRatio(width, height, 2);
    expect(ratio).toBeLessThan(2);
    expect(width * ratio * (height * ratio)).toBeLessThanOrEqual(2 ** 25 + 1);
  });

  it("never asks a canvas for a side longer than it can have (a very long page)", () => {
    const ratio = drawingRatio(800, 40_000, 2);
    expect(40_000 * ratio).toBeLessThanOrEqual(32_767);
  });
});

describe("links inside a PDF", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { baseURI: "app://edunex-plus/index.html" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    annotations.length = 0;
  });

  it("are offered only when they go to a web page or a page of the PDF", async () => {
    const link = (extra: Record<string, unknown>) => ({ subtype: "Link", rect: [10, 700, 110, 720], ...extra });
    annotations.push(
      link({ url: "https://example.org/reading" }),
      link({ url: "javascript:alert(1)" }),
      link({ url: "file:///etc/passwd" }),
      link({ url: "mailto:lecturer@example.org" }),
      link({ url: "https://name:secret@example.org/" }),
      link({ dest: [{ num: 12, gen: 0 }, { name: "XYZ" }] }),
      { subtype: "Widget", rect: [0, 0, 1, 1], url: "https://example.org/form" },
    );
    const doc = await openPdf(new Uint8Array());
    const links = await (await doc.page(1)).links();
    expect(links).toEqual([
      { left: 10, top: 80, width: 100, height: 20, url: "https://example.org/reading" },
      { left: 10, top: 80, width: 100, height: 20, page: 5 },
    ]);
  });
});
