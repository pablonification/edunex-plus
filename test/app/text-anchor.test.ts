// @vitest-environment jsdom
// Where a highlight is in what a viewer shows: a selection as the characters
// it covers in a page's text (only the part on that page, never a style
// sheet's text), those characters as a range again, and the boxes it's drawn
// in, one per line with the words on a line joined. jsdom measures nothing,
// so each word's box is made up here.
import { afterEach, describe, expect, it, vi } from "vitest";
import { boxesOf, offsetsIn, rangeAt, textOf } from "../../src/app/ui/text-anchor";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  // The made-up boxes below go with their test: jsdom has none.
  delete (Range.prototype as Partial<Range>).getClientRects;
});

/** A page's text as pdf.js lays it out: a span per run of text, a line break between lines. */
function page(html: string): HTMLElement {
  const element = document.createElement("div");
  element.innerHTML = html;
  document.body.append(element);
  return element;
}

const range = (start: Node, from: number, end: Node, to: number) => {
  const r = document.createRange();
  r.setStart(start, from);
  r.setEnd(end, to);
  return r;
};

describe("a highlight's place in the text", () => {
  it("counts only the text that shows, across runs and line breaks, and finds the same words again", () => {
    const one = page("<style>.x { color: red }</style><span>Minggu 1</span><br><span>Capaian: </span><span>konsep utama</span>");
    expect(textOf(one)).toBe("Minggu 1Capaian: konsep utama");
    const [, first, , second, third] = one.childNodes;
    const selected = range(second.firstChild!, 0, third.firstChild!, 6);
    expect(offsetsIn(one, selected)).toEqual({ start: 8, end: 23 });
    expect(rangeAt(one, 8, 23)?.toString()).toBe("Capaian: konsep");
    // A point given by an element and a child's position counts the same.
    expect(offsetsIn(one, range(one, 2, third.firstChild!, 6))).toEqual({ start: 8, end: 23 });
    expect(first.textContent).toBe("Minggu 1");
  });

  it("a selection over two pages is, on each, only its own part", () => {
    const one = page("<span>Halaman satu</span>");
    const two = page("<span>Halaman dua</span>");
    const across = range(one.firstChild!.firstChild!, 8, two.firstChild!.firstChild!, 7);
    expect(offsetsIn(one, across)).toEqual({ start: 8, end: 12 });
    expect(offsetsIn(two, across)).toEqual({ start: 0, end: 7 });
    const third = page("<span>Halaman tiga</span>");
    expect(offsetsIn(third, across)).toBeNull();
  });

  it("is drawn one box per line, the words on a line joined over the space between them", () => {
    const one = page("<span>Capaian:</span><span>konsep</span><br><span>utama</span>");
    // Made-up boxes: each word on its line, 10 px high, with a gap of 4 px between words.
    const at: Record<string, { left: number; top: number; width: number }> = {
      "Capaian:": { left: 10, top: 100, width: 60 },
      konsep: { left: 74, top: 101, width: 50 },
      utama: { left: 10, top: 120, width: 40 },
    };
    // jsdom has no getClientRects on a range at all.
    Range.prototype.getClientRects = function (this: Range) {
      const box = at[(this.startContainer as Text).data];
      const rect = { ...box, height: 10, right: box.left + box.width, bottom: box.top + 10, x: box.left, y: box.top };
      return Object.assign([rect], { item: () => rect }) as unknown as DOMRectList;
    };
    vi.spyOn(one, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0 } as DOMRect);
    const all = range(one.firstChild!.firstChild!, 0, one.lastChild!.firstChild!, 5);
    // At 200% the page is twice as big: the boxes are kept at scale 1.
    expect(boxesOf(all, one, 2)).toEqual([
      { left: 5, top: 50, width: 57, height: 5.5 },
      { left: 5, top: 60, width: 20, height: 5 },
    ]);
  });
});
