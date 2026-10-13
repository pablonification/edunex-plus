// pdf.js (Apache-2.0) behind the few things the PDF viewer needs. It loads
// only when a PDF is first opened, as its own chunk, so start-up doesn't grow.
// Its worker and data files come from the app's own files (/pdfjs/, see
// vite.config.ts); it runs without WebAssembly and never runs a PDF's
// scripts. Links inside a PDF are handed back, never followed here. A form's
// fields and text the Student adds are written into a copy with pdf.js's own
// saving (fields as filled in, added text as FreeText notes in Helvetica).
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

/**
 * A form field's box on a page (at scale 1) and what kind it is. Fields of
 * one name share one value: a radio group, or a name asked for twice.
 */
export interface PdfField {
  id: string;
  name: string;
  /** What the PDF calls it for people (its tooltip), else its name. */
  label: string;
  kind: "text" | "check" | "radio" | "choice";
  left: number;
  top: number;
  width: number;
  height: number;
  /** The value a check box or radio button stands for when it's picked. */
  on: string;
  multiline: boolean;
  maxLength: number | null;
  readOnly: boolean;
  /** The PDF's own text size for it, in points; 0: fit the box. */
  fontSize: number;
  options: { value: string; label: string }[];
}

/** "Off": a check box or radio group with nothing picked, as PDFs say it. */
export const OFF = "Off";

/** Text the Student added: on which page (from 1), where it starts (at scale 1, from the page's top left) and its size in points. */
export interface PdfText {
  id: string;
  page: number;
  left: number;
  top: number;
  size: number;
  text: string;
}

/** What the Student filled in: values by field name (only the ones they changed), and the text they added. */
export interface PdfFill {
  fields: Readonly<Record<string, string>>;
  texts: readonly PdfText[];
}

/** Lines of added text sit this far apart, in font sizes (pdf.js draws FreeText so). */
export const LINE_HEIGHT = 1.35;

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
  /** The form fields on the page the Student can fill in. */
  fields(): Promise<PdfField[]>;
  /** Frees what drawing it held (a page far out of view). */
  release(): void;
}

export interface PdfDocument {
  pages: number;
  /** The form's values by field name as the file has them; null when it has no form. */
  form: Readonly<Record<string, string>> | null;
  page(number: number): Promise<PdfPage>;
  /** The whole PDF again, with the fill written in. The file it came from stays as it was. */
  save(fill: PdfFill): Promise<Uint8Array>;
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

/** Helvetica's widths (thousandths of its size) for the characters from space to "~", the font added text is saved in. */
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584,
  556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278,
  469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260,
  334, 584,
];

/** How wide a line of added text is in the saved PDF, in points; a character outside the table counts as a wide one. */
export function textWidth(line: string, size: number): number {
  let width = 0;
  for (const char of line) width += HELVETICA[(char.codePointAt(0) ?? 0) - 32] ?? 722;
  return (width / 1000) * size;
}

type FieldObject = { id: string; type: string; value?: unknown; exportValues?: string; page: number };

/** A field's value as one string: a text, the picked option, or what a check box or radio group stands for ("Off": nothing). */
function fieldValue(value: unknown): string {
  if (Array.isArray(value)) return fieldValue(value[0]);
  return typeof value === "string" ? value : "";
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

  // The form, read once: each field's widgets by name, and the values they hold.
  const objects = ((await doc.getFieldObjects().catch(() => null)) ?? null) as Record<string, FieldObject[]> | Map<string, FieldObject[]> | null;
  const widgets = new Map<string, FieldObject[]>();
  for (const [name, list] of objects instanceof Map ? objects : Object.entries(objects ?? {}))
    widgets.set(
      name,
      list.filter((object) => object.page >= 0 && ["text", "checkbox", "radiobutton", "combobox", "listbox"].includes(object.type)),
    );
  const form = widgets.size > 0 ? Object.fromEntries([...widgets].flatMap(([name, list]) => (list[0] ? [[name, fieldValue(list[0].value)]] : []))) : null;
  /** What was written into pdf.js's store at the last save, to take back what the Student has undone since. */
  let written: { fields: Set<string>; texts: string[] } = { fields: new Set(), texts: [] };

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
    form,
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
            // A form's fields are the viewer's own boxes over the page, not drawn into it. pdf.js still draws a check
            // box's ticked and unticked looks, and a read-only field's text, unless they get canvases of their own,
            // which pdf.js's own viewer would show and this one drops (with them, a push button that would do nothing).
            annotationMode: form ? lib.AnnotationMode.ENABLE_FORMS : lib.AnnotationMode.ENABLE,
            annotationCanvasMap: form ? new Map() : undefined,
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
        async fields() {
          if (!form) return [];
          const out: PdfField[] = [];
          for (const a of await page.getAnnotations({ intent: "display" })) {
            if (a.subtype !== "Widget" || a.hidden || typeof a.fieldName !== "string" || !widgets.has(a.fieldName) || !Array.isArray(a.rect)) continue;
            const kind = a.fieldType === "Tx" ? "text" : a.fieldType === "Ch" ? "choice" : a.checkBox ? "check" : a.radioButton ? "radio" : null;
            if (!kind) continue;
            const [ax, ay, bx, by] = a.rect as number[];
            const [x1, y1, x2, y2] = lib.Util.normalizeRect([...base.convertToViewportPoint(ax, ay), ...base.convertToViewportPoint(bx, by)]) as number[];
            out.push({
              id: String(a.id),
              name: a.fieldName,
              label: (typeof a.alternativeText === "string" && a.alternativeText.trim()) || a.fieldName,
              kind,
              left: x1,
              top: y1,
              width: x2 - x1,
              height: y2 - y1,
              on: String((kind === "check" ? a.exportValue : a.buttonValue) ?? ""),
              multiline: Boolean(a.multiLine),
              maxLength: typeof a.maxLen === "number" && a.maxLen > 0 ? a.maxLen : null,
              readOnly: Boolean(a.readOnly),
              fontSize: Number(a.defaultAppearanceData?.fontSize) || 0,
              options: Array.isArray(a.options)
                ? (a.options as { exportValue: unknown; displayValue: unknown }[]).map((o) => ({
                    value: String(o.exportValue),
                    label: String(o.displayValue ?? o.exportValue),
                  }))
                : [],
            });
          }
          return out;
        },
        release: () => void page.cleanup(),
      };
    },
    async save(fill) {
      const storage = doc.annotationStorage;
      for (const key of written.texts) storage.remove(key);
      // A field changed at an earlier save and changed back since goes back to the file's own value.
      for (const name of new Set([...written.fields, ...Object.keys(fill.fields)])) {
        const value = fill.fields[name] ?? form?.[name];
        for (const widget of widgets.get(name) ?? []) {
          if (value === undefined) continue;
          const picked = widget.type === "checkbox" || widget.type === "radiobutton" ? value === widget.exportValues : null;
          storage.setValue(widget.id, { value: picked ?? (widget.type === "combobox" || widget.type === "listbox" ? [value] : value) });
        }
      }
      const texts: string[] = [];
      for (const text of fill.texts) {
        if (!text.text.trim() || text.page < 1 || text.page > doc.numPages) continue;
        const page = await doc.getPage(text.page);
        const view = page.getViewport({ scale: 1 });
        const lines = text.text.split("\n");
        // Wide enough for its longest line, so pdf.js never shrinks it to fit; never past the page's edge.
        const width = Math.min(Math.max(...lines.map((line) => textWidth(line, text.size))) * 1.05 + 2, view.width - text.left);
        const height = lines.length * LINE_HEIGHT * text.size + 1;
        const rect = lib.Util.normalizeRect([
          ...view.convertToPdfPoint(text.left, text.top),
          ...view.convertToPdfPoint(text.left + width, text.top + height),
        ]) as number[];
        const key = `pdfjs_internal_editor_${texts.length}`;
        storage.setValue(key, {
          annotationType: lib.AnnotationEditorType.FREETEXT,
          color: [0, 0, 0],
          fontSize: text.size,
          value: text.text,
          pageIndex: text.page - 1,
          rect,
          rotation: view.rotation,
        });
        texts.push(key);
      }
      written = { fields: new Set([...written.fields, ...Object.keys(fill.fields)]), texts };
      return await doc.saveDocument();
    },
    destroy: () => void task.destroy(),
  };
}
