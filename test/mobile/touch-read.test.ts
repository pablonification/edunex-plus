// mobile/qa/touch-read.mjs lists tappable things under 48 dp or with no name TalkBack reads. A tiny made-up screen
// (1080x2400, 420 dpi: 48 dp = 126 px), no student's data.
import { describe, expect, it } from "vitest";
import { readDump } from "../../mobile/qa/dump-lib.mjs";
import { readTouch, whereOn } from "../../mobile/qa/touch-read.mjs";

interface Spec {
  id?: string;
  box: [number, number, number, number];
  text?: string;
  desc?: string;
  tap?: boolean;
  kids?: Spec[];
}
const maestro = (s: Spec): object => ({
  attributes: {
    text: s.text ?? "",
    accessibilityText: s.desc ?? "",
    "resource-id": s.id ?? "",
    clickable: String(!!s.tap),
    bounds: `[${s.box.slice(0, 2).join(",")}][${s.box.slice(2).join(",")}]`,
    class: "android.view.View",
  },
  children: (s.kids ?? []).map(maestro),
});
// The app's own root fills the screen, as in a real dump: it is what tells where the screen's edge is.
const read = (kids: Spec[]) => readTouch(readDump(JSON.stringify(maestro({ box: [0, 0, 1080, 2400], kids: [{ box: [0, 0, 1080, 2400], kids }] }))));

describe("touch-read", () => {
  it("passes a screen where every tap is 48 dp and named", () => {
    const { findings } = read([
      { id: "action.a", tap: true, box: [0, 200, 1080, 400], text: "Tugas" },
      { id: "action.b", tap: true, box: [0, 500, 126, 626], desc: "Cari" },
    ]);
    expect(findings).toEqual([]);
  });

  it("lists a small tap with its size in dp and where it is", () => {
    const { findings } = read([{ id: "action.small", tap: true, box: [900, 100, 1000, 200], desc: "Lonceng" }]);
    expect(findings).toHaveLength(1);
    expect(findings[0].small).toBe(true);
    expect(findings[0].line).toContain("action.small");
    expect(findings[0].line).toContain("38.1x38.1 dp");
    expect(findings[0].line).toContain("top right");
  });

  it("lists a tap with no name, and takes a named child as its name", () => {
    const { findings } = read([
      { id: "action.mute", tap: true, box: [0, 1000, 400, 1200] },
      { id: "action.row", tap: true, box: [0, 1300, 1080, 1500], kids: [{ text: "Nilai", box: [40, 1350, 300, 1450] }] },
    ]);
    expect(findings.map((f) => f.line)).toHaveLength(1);
    expect(findings[0].unnamed).toBe(true);
    expect(findings[0].line).toContain("action.mute");
  });

  it("judges the parent that is the real target, not the small tap inside it", () => {
    const { findings } = read([
      { id: "row.task.1", tap: true, box: [0, 600, 1080, 800], text: "Laporan", kids: [{ id: "action.inner", tap: true, box: [900, 650, 960, 710] }] },
    ]);
    expect(findings).toEqual([]);
  });

  it("says one line for a node that is both small and unnamed", () => {
    const { findings } = read([{ id: "action.x", tap: true, box: [100, 1000, 160, 1060] }]);
    expect(findings).toHaveLength(1);
    expect(findings[0].line).toMatch(/under 48 dp, no name/);
  });

  it("leaves a tap cut by the screen's edge as a note, not a finding", () => {
    const { findings, notes } = read([
      { id: "action.top", tap: true, box: [0, 100, 1080, 300], text: "Atas" },
      { id: "row.cut", tap: true, box: [0, 2330, 1080, 2400], text: "Setengah" },
    ]);
    expect(findings).toEqual([]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("row.cut");
  });

  it("names the part of the screen", () => {
    expect(whereOn({ x1: 0, y1: 0, x2: 100, y2: 100 } as never, 1080, 2400)).toBe("top left");
    expect(whereOn({ x1: 480, y1: 1100, x2: 600, y2: 1300 } as never, 1080, 2400)).toBe("middle");
    expect(whereOn({ x1: 900, y1: 2200, x2: 1000, y2: 2300 } as never, 1080, 2400)).toBe("bottom right");
  });
});
