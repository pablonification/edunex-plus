// pdf.js (Apache-2.0) behind the few things the PDF viewer needs. It loads
// only when a PDF is first opened, as its own chunk, so start-up doesn't grow.
// Its worker and data files come from the app's own files (/pdfjs/, see
// vite.config.ts); it runs without WebAssembly and never runs a PDF's
// scripts. Links inside a PDF are handed back, never followed here.
import { isWebLink } from "../../core/links";

/** A page's size at scale 1, in CSS pixels at 72 per inch (PDF points). */
export interface PdfSize {
  width: number;
  height: number;
}

/** A link on a page: where it sits (at scale 1) and where it goes, a web page or a page of this PDF. */
export interface PdfLink {
  left: number;
  top: number;
  width: number;
  height: number;
  url?: string;
  page?: number;
}

export interface PdfTask {
  promise: Promise<void>;
  cancel(): void;
}

export interface PdfPage {
  size: PdfSize;
  /** Draws the page on the canvas at this scale, sharp on this screen's pixel ratio. */
  render(canvas: HTMLCanvasElement, scale: number, pixelRatio: number): PdfTask;
  /** Lays the page's text over it, invisible but selectable and copyable. */
  text(container: HTMLElement, scale: number): PdfTask;
  links(): Promise<PdfLink[]>;
  /** Frees what drawing it held (a page far out of view). */
  release(): void;
}

export interface PdfDocument {
  pages: number;
  page(number: number): Promise<PdfPage>;
  destroy(): void;
}

/** Why a PDF can't be shown: it asks for a password, or it isn't a PDF pdf.js can read. */
export class PdfOpenError extends Error {
  constructor(readonly reason: "locked" | "broken") {
    super(reason);
    this.name = "PdfOpenError";
  }
}

type PdfJs = typeof import("pdfjs-dist");
let library: Promise<PdfJs> | null = null;

function pdfjs(): Promise<PdfJs> {
  library ??= Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  });
  // A failed load (a missing chunk) can be tried again.
  library.catch(() => {
    library = null;
  });
  return library;
}

/** The most pixels one page's drawing holds, pdf.js's own viewer's cap (about 128 MB), and the longest side a canvas can have. */
const MAX_PIXELS = 2 ** 25;
const MAX_SIDE = 32_767;

/**
 * How many canvas pixels per CSS pixel a page is drawn at: the screen's own
 * density, so it's sharp, until the drawing would pass the caps (a page
 * zoomed in far on a Retina screen); past them it's drawn smaller and
 * stretched, a little soft instead of hundreds of MB, or blank.
 */
export function drawingRatio(width: number, height: number, pixelRatio: number): number {
  return Math.min(pixelRatio, Math.sqrt(MAX_PIXELS / (width * height)), MAX_SIDE / width, MAX_SIDE / height);
}

const cancelled = (error: unknown) => error instanceof Error && error.name === "RenderingCancelledException";

export async function openPdf(bytes: Uint8Array): Promise<PdfDocument> {
  let lib: PdfJs;
  try {
    lib = await pdfjs();
  } catch {
    throw new PdfOpenError("broken");
  }
  const files = new URL("pdfjs/", document.baseURI).href;
  const task = lib.getDocument({
    data: bytes,
    cMapUrl: `${files}cmaps/`,
    standardFontDataUrl: `${files}standard_fonts/`,
    wasmUrl: `${files}wasm/`,
    useWasm: false,
    enableXfa: false,
  });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (error) {
    void task.destroy();
    throw new PdfOpenError(error instanceof Error && error.name === "PasswordException" ? "locked" : "broken");
  }

  /** A link's target page (from 1), for a named destination or an explicit one. */
  const pageOf = async (dest: unknown): Promise<number | undefined> => {
    try {
      const explicit = typeof dest === "string" ? await doc.getDestination(dest) : dest;
      if (!Array.isArray(explicit) || explicit[0] == null) return undefined;
      const target = explicit[0];
      const index = typeof target === "number" ? target : await doc.getPageIndex(target);
      return index + 1;
    } catch {
      return undefined;
    }
  };

  return {
    pages: doc.numPages,
    async page(number) {
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      return {
        size: { width: base.width, height: base.height },
        render(canvas, scale, pixelRatio) {
          const viewport = page.getViewport({ scale });
          const ratio = drawingRatio(viewport.width, viewport.height, pixelRatio);
          canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
          canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
          const context = canvas.getContext("2d");
          if (!context) return { promise: Promise.resolve(), cancel: () => undefined };
          const rendering = page.render({
            canvas,
            canvasContext: context,
            viewport,
            transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
          });
          return {
            promise: rendering.promise.catch((error: unknown) => {
              if (!cancelled(error)) throw error;
            }),
            cancel: () => rendering.cancel(),
          };
        },
        text(container, scale) {
          container.replaceChildren();
          const layer = new lib.TextLayer({ textContentSource: page.streamTextContent(), container, viewport: page.getViewport({ scale }) });
          return {
            promise: layer.render().then(
              () => undefined,
              () => undefined,
            ),
            cancel: () => layer.cancel(),
          };
        },
        async links() {
          const out: PdfLink[] = [];
          for (const annotation of await page.getAnnotations({ intent: "display" })) {
            if (annotation.subtype !== "Link" || !Array.isArray(annotation.rect)) continue;
            const [ax, ay, bx, by] = annotation.rect as number[];
            const [x1, y1, x2, y2] = lib.Util.normalizeRect([...base.convertToViewportPoint(ax, ay), ...base.convertToViewportPoint(bx, by)]) as number[];
            const place = { left: x1, top: y1, width: x2 - x1, height: y2 - y1 };
            if (typeof annotation.url === "string" && isWebLink(annotation.url)) out.push({ ...place, url: annotation.url });
            else if (annotation.dest) {
              const target = await pageOf(annotation.dest);
              if (target) out.push({ ...place, page: target });
            }
          }
          return out;
        },
        release: () => void page.cleanup(),
      };
    },
    destroy: () => void task.destroy(),
  };
}
