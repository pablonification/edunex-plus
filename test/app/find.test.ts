// Where the find bar (⌘F in a viewer) finds what's typed: case doesn't count,
// a space also finds two words split over a line or run together across one
// (a PDF's lines meet with nothing between them), and matches never overlap.
import { describe, expect, it } from "vitest";
import { matchesIn } from "../../src/app/ui/find";

const found = (text: string, query: string) => matchesIn(text, query).map(({ start, end }) => text.slice(start, end));

describe("finding words", () => {
  it("ignores case, and finds every match once, never one inside another", () => {
    expect(found("Minggu 1. minggu ini, MINGGU depan", "minggu")).toEqual(["Minggu", "minggu", "MINGGU"]);
    expect(found("aaaa", "aa")).toEqual(["aa", "aa"]);
  });

  it("a space finds the words over any run of space, a line break, or none", () => {
    expect(found("kuliah minggu\n  ini", "minggu ini")).toEqual(["minggu\n  ini"]);
    expect(found("kuliah mingguini", "minggu   ini")).toEqual(["mingguini"]);
    expect(found("minggu depan, minggu ini", "minggu ini")).toEqual(["minggu ini"]);
  });

  it("what's typed is only ever text, never a pattern", () => {
    expect(found("Nilai (UTS) 80.5 + [tugas]", "(uts) 80.5 + [")).toEqual(["(UTS) 80.5 + ["]);
    expect(found("a.c abc", "a.c")).toEqual(["a.c"]);
  });

  it("an empty search finds nothing", () => {
    expect(matchesIn("Isi halaman 1", "   ")).toEqual([]);
  });
});
