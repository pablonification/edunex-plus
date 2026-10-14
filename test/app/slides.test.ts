// @vitest-environment jsdom
// How a PowerPoint presentation reads for the viewer: its visible slides in
// the presentation's order, text placed and styled from the layout and master
// behind it, only pictures a page shows safely, tables as their cells' text,
// only links to web pages, and nothing read past what a real deck holds. The
// presentations are tiny made-up ones (../kit/office-files.ts).
import { describe, expect, it } from "vitest";
import { type Item, readPresentation } from "../../src/app/ui/slides";
import { aPptx, aZip } from "../kit/office-files";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
/** An EMF picture's first bytes (Windows' own drawing format, which a page can't show). */
const EMF = new Uint8Array([1, 0, 0, 0, 108, 0, 0, 0, 0, 0, 0, 0]);

type Shape = Extract<Item, { kind: "shape" }>;
const shapes = (items: Item[]) => items.filter((item): item is Shape => item.kind === "shape" && item.text !== null);
const texts = (items: Item[]) => shapes(items).map((s) => s.text!.paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n"));

describe("reading a presentation", () => {
  it("gives its visible slides in the presentation's order, at its slide size", async () => {
    const deck = await readPresentation(
      await aPptx([{ title: "Pertemuan 1: Pengantar" }, { title: "Kunci jawaban", hidden: true }, { title: "Pertemuan 2: Himpunan" }]),
    );
    expect([deck.width, deck.height]).toEqual([12192000, 6858000]);
    expect(deck.slides.map((slide) => texts(slide.items))).toEqual([["Pertemuan 1: Pengantar"], ["Pertemuan 2: Himpunan"]]);
  });

  it("places and styles a placeholder's text as its layout and master say", async () => {
    const deck = await readPresentation(await aPptx([{ title: "Logika proposisi", bullets: ["Proposisi", "  Nilai kebenaran", "Konektif"] }]));
    const [title, body] = shapes(deck.slides[0].items);
    // The layout moves the title; the body stays where the master has it.
    expect(title.box).toMatchObject({ x: 1524000, y: 457200, width: 9144000, height: 1143000 });
    expect(body.box).toMatchObject({ x: 838200, y: 1825625, width: 10500000, height: 4351338 });
    // The title's anchor comes from the master's placeholder; its size, colour (the theme's dk2) and font from the master's title style.
    expect(title.text?.anchor).toBe("middle");
    expect(title.text?.paragraphs[0].bullet).toBeNull();
    expect(title.text?.paragraphs[0].runs[0]).toMatchObject({ size: 44, color: "1f2a44", font: "Calibri Light" });
    // Body text has the master's bullets, a level in and smaller for the second level.
    expect(body.text?.paragraphs.map((p) => [p.level, p.bullet?.text, p.margin, p.runs[0].size])).toEqual([
      [0, "•", 228600, 28],
      [1, "–", 685800, 24],
      [0, "•", 228600, 28],
    ]);
    expect(body.text?.paragraphs[0].runs[0]).toMatchObject({ color: "000000", font: "Calibri" });
    expect(deck.slides[0].background).toEqual({ color: "ffffff" });
  });

  it("keeps a PNG as a data: address and leaves out pictures a page can't show safely", async () => {
    const deck = await readPresentation(
      await aPptx([
        {
          pictures: [
            { bytes: PNG, ext: "png" },
            { bytes: EMF, ext: "emf" },
            // Named a PNG, but not one.
            { bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), ext: "png" },
          ],
        },
      ]),
    );
    const pictures = deck.slides[0].items.filter((item) => item.kind === "picture");
    expect(pictures).toHaveLength(1);
    expect(pictures[0]).toMatchObject({ url: `data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`, box: { x: 838200, width: 2743200 } });
  });

  it("reads a table as its cells' text, and a group's shapes where the group puts them", async () => {
    const deck = await readPresentation(
      await aPptx([
        {
          table: [
            ["NIM", "Kelompok"],
            ["10000001", "A"],
          ],
          group: ["Masukan", "Keluaran"],
        },
      ]),
    );
    const table = deck.slides[0].items.find((item) => item.kind === "table");
    expect(table?.kind === "table" && table.rows.map((row) => row.cells.map((cell) => cell.text))).toEqual([
      ["NIM", "Kelompok"],
      ["10000001", "A"],
    ]);
    expect(table).toMatchObject({ size: 14, header: true, columns: [2000000, 2000000] });
    // The group is laid out at twice its size from (1000000, 1000000), and put at (6000000, 3000000) at half that.
    expect(shapes(deck.slides[0].items).map((s) => s.box)).toMatchObject([
      { x: 6000000, y: 3000000, width: 1000000, height: 1000000 },
      { x: 7000000, y: 3000000, width: 1000000, height: 1000000 },
    ]);
  });

  it("keeps only links to web pages", async () => {
    const link = async (url: string) => {
      const deck = await readPresentation(await aPptx([{ note: { text: "Formulir kehadiran", link: url } }]));
      return shapes(deck.slides[0].items)[0].text?.paragraphs[0].runs[0];
    };
    expect(await link("https://forms.gle/fixture")).toMatchObject({
      text: "Formulir kehadiran",
      link: "https://forms.gle/fixture",
      underline: true,
      color: "0563c1",
    });
    for (const url of ["javascript:alert(1)", "file:///C:/Windows/system32/calc.exe", "ppt/slides/slide1.xml"]) expect((await link(url))?.link, url).toBeNull();
  });

  it("refuses what isn't a presentation, or holds more slides than it reads", async () => {
    await expect(readPresentation(await aZip({ "word/document.xml": "<w:document/>" }))).rejects.toThrow();
    await expect(readPresentation(new TextEncoder().encode("bukan zip"))).rejects.toThrow();
    await expect(readPresentation(await aPptx([{ title: "Tersembunyi", hidden: true }]))).rejects.toThrow();
    const many = Array.from({ length: 2001 }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i}"/>`).join("");
    const huge = await aZip({
      "ppt/presentation.xml": `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst>${many}</p:sldIdLst></p:presentation>`,
    });
    await expect(readPresentation(huge)).rejects.toThrow("Too many slides");
  });
});
