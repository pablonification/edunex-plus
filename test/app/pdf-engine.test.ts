// How sharp a PDF page is drawn: at the screen's own density, until the
// drawing would grow past what one page should cost in memory (zoomed far in
// on a Retina screen) or past the longest side a canvas can have. And which
// links inside a PDF the viewer may offer: web pages and its own pages only.
// And a form's page is drawn without its fields, which the viewer lays over it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drawingRatio, openPdf } from "../../src/app/ui/pdf-engine";

/** pdf.js, as far as a page's links go: one page whose annotations are these. */
const annotations = vi.hoisted(() => [] as Record<string, unknown>[]);
/** The form's fields by name (none: no form), and what each page.render was asked. */
const pdfjs = vi.hoisted(() => ({ fields: null as Record<string, unknown[]> | null, renders: [] as Record<string, unknown>[] }));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/pdfjs/worker.mjs" }));
vi.mock("pdfjs-dist", () => {
  const page = {
    getViewport: () => ({ width: 600, height: 800, convertToViewportPoint: (x: number, y: number) => [x, 800 - y] }),
    getAnnotations: async () => annotations,
    render: (options: Record<string, unknown>) => {
      pdfjs.renders.push(options);
      return { promise: Promise.resolve(), cancel: () => undefined };
    },
  };
  const doc = {
    numPages: 9,
    getPage: async () => page,
    getDestination: async () => null,
    getPageIndex: async () => 4,
    getFieldObjects: async () => pdfjs.fields,
  };
  return {
    GlobalWorkerOptions: {},
    AnnotationMode: { ENABLE: 1, ENABLE_FORMS: 2 },
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

describe("a form's page", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { baseURI: "app://edunex-plus/index.html" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    pdfjs.fields = null;
    pdfjs.renders.length = 0;
  });

  const draw = async () => {
    const page = await (await openPdf(new Uint8Array())).page(1);
    const canvas = { width: 0, height: 0, getContext: () => ({}) } as unknown as HTMLCanvasElement;
    await page.render(canvas, 1, 1).promise;
    return pdfjs.renders.at(-1)!;
  };

  it("is drawn without its fields' own looks, which pdf.js would otherwise paint into the page under the viewer's boxes", async () => {
    pdfjs.fields = { Setuju: [{ id: "8R", type: "checkbox", value: "Off", exportValues: "Yes", page: 0 }] };
    const options = await draw();
    expect(options.annotationMode).toBe(2);
    // A check box's ticked and unticked looks, and a read-only field's text, go to canvases of their own, never shown.
    expect(options.annotationCanvasMap).toBeInstanceOf(Map);
  });

  it("without a form, its notes and stamps are drawn into it as before", async () => {
    const options = await draw();
    expect(options.annotationMode).toBe(1);
    expect(options.annotationCanvasMap).toBeUndefined();
  });
});
