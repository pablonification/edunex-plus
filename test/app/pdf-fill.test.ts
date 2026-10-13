// Filling a PDF in the app, through real pdf.js: a form's fields come out of
// the file with what they hold, and what the Student fills in and the text
// they add are in the copy that's saved, read back by pdf.js from its bytes.
// (Node runs pdf.js's build for older engines; the app's is the same code.)
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { OFF, openPdf, type PdfText, textWidth } from "../../src/app/ui/pdf-engine";
import { fillablePdf } from "../kit/fillable-pdf";

vi.mock("pdfjs-dist", () => import("pdfjs-dist/legacy/build/pdf.mjs"));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: fileURLToPath(new URL("../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url)),
}));

beforeAll(() => {
  vi.stubGlobal("document", { baseURI: "app://edunex-plus/index.html" });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

/** What a saved PDF holds, as pdf.js reads it again: each field's value by name, and the added notes' text. */
async function readBack(bytes: Uint8Array) {
  const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = lib.getDocument({ data: bytes, useWasm: false });
  const doc = await task.promise;
  const annotations = await (await doc.getPage(1)).getAnnotations();
  const fields: Record<string, unknown> = {};
  for (const a of annotations) if (a.subtype === "Widget") fields[a.fieldName] = Array.isArray(a.fieldValue) ? a.fieldValue[0] : a.fieldValue;
  const notes = annotations.filter((a) => a.subtype === "FreeText").map((a) => ({ text: a.contentsObj?.str, rect: a.rect as number[] }));
  await task.destroy();
  return { fields, notes };
}

const note = (patch: Partial<PdfText>): PdfText => ({ id: "t1", page: 1, left: 72, top: 300, size: 12, text: "Catatan", ...patch });

describe("a PDF form", () => {
  it("shows its fields where they are on the page, with what the file holds", async () => {
    const doc = await openPdf(fillablePdf());
    expect(doc.form).toEqual({ Nama: "", Setuju: OFF, Kelas: OFF, Prodi: "Teknik Sipil" });
    const fields = await (await doc.page(1)).fields();
    expect(fields.map(({ name, kind, on }) => ({ name, kind, on }))).toEqual([
      { name: "Nama", kind: "text", on: "" },
      { name: "Setuju", kind: "check", on: "Yes" },
      { name: "Kelas", kind: "radio", on: "K01" },
      { name: "Kelas", kind: "radio", on: "K02" },
      { name: "Prodi", kind: "choice", on: "" },
    ]);
    // Placed from the page's top left, as the viewer lays them over it.
    expect(fields[0]).toMatchObject({ left: 140, top: 98, width: 240, height: 20, fontSize: 11, maxLength: null, readOnly: false });
    expect(fields[4].options.map((o) => o.label)).toEqual(["Teknik Sipil", "Arsitektur", "Planologi"]);
    doc.destroy();
  });

  it("filled in and saved, the copy holds every value", async () => {
    const doc = await openPdf(fillablePdf());
    const saved = await doc.save({ fields: { Nama: "Ana Contoh", Setuju: "Yes", Kelas: "K02", Prodi: "Arsitektur" }, texts: [] });
    expect((await readBack(saved)).fields).toEqual({ Nama: "Ana Contoh", Setuju: "Yes", Kelas: "K02", Prodi: "Arsitektur" });
    doc.destroy();
  });

  it("a field changed back after one save is the file's own again in the next", async () => {
    const doc = await openPdf(fillablePdf());
    await doc.save({ fields: { Nama: "Ana Contoh", Setuju: "Yes" }, texts: [note({})] });
    const again = await readBack(await doc.save({ fields: { Setuju: "Yes" }, texts: [] }));
    expect(again.fields).toMatchObject({ Nama: "", Setuju: "Yes" });
    expect(again.notes).toEqual([]);
    doc.destroy();
  });
});

describe("text added on a page", () => {
  it("is in the saved copy where it was put, wide enough for its longest line", async () => {
    const doc = await openPdf(fillablePdf({ fields: false }));
    expect(doc.form).toBeNull();
    expect(await (await doc.page(1)).fields()).toEqual([]);
    const saved = await doc.save({
      fields: {},
      texts: [note({ text: "Ana Contoh\n18223901", left: 100, top: 200, size: 14 }), note({ id: "t2", text: "  " })],
    });
    const { notes } = await readBack(saved);
    // An empty one isn't written; the other sits 200 pt below the A4 page's top, two lines tall.
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe("Ana Contoh\n18223901");
    const [left, bottom, right, top] = notes[0].rect;
    expect(left).toBeCloseTo(100);
    expect(top).toBeCloseTo(842 - 200);
    expect(top - bottom).toBeCloseTo(2 * 1.35 * 14 + 1);
    expect(right - left).toBeGreaterThanOrEqual(textWidth("Ana Contoh", 14));
    doc.destroy();
  });

  it("never runs past the page's right edge", async () => {
    const doc = await openPdf(fillablePdf({ fields: false }));
    const { notes } = await readBack(await doc.save({ fields: {}, texts: [note({ left: 500, text: "Teks yang panjang sekali di tepi halaman" })] }));
    expect(notes[0].rect[2]).toBeLessThanOrEqual(595);
    doc.destroy();
  });
});
