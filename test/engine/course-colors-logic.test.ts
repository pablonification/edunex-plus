// Course colors, seam 1: the rules alone. Which color each course of a term
// gets from the Student's picks and the automatic colors remembered for it,
// what moves when a pick takes a remembered color, and the one-time move from
// the old hashed colors to the palette. The demo's made-up course codes.
import { describe, expect, it } from "vitest";
import {
  applyChoice,
  COURSE_PALETTE,
  courseTone,
  isCourseColorId,
  legacyAutomatic,
  type PaletteId,
  PICKER_ORDER,
  pickedColor,
  pruneCourseColors,
  resolveCourseColors,
  withRemembered,
} from "../../src/core/course-colors";
import type { CourseColors } from "../../src/core/models";

const TERM = ["PL3032", "DK4073", "II4091", "KU5014", "PL3002"];
const ORDER = COURSE_PALETTE.map((color) => color.id);
/** What each code shows, as "CODE id" (with "*" for a pick), in code order. */
const shown = (codes: readonly string[], saved?: CourseColors) =>
  [...resolveCourseColors(codes, saved).colors].sort(([a], [b]) => a.localeCompare(b)).map(([code, c]) => `${code} ${c.id}${c.picked ? "*" : ""}`);
const pick = (color: string, at = 1) => ({ color, at });

describe("the palette", () => {
  it("has ten colors, none of them the hues status speaks in, and lays them out by hue in the picker", () => {
    expect(ORDER).toEqual(["cyan", "indigo", "berry", "blue", "orchid", "magenta", "purple", "pink", "plum", "lavender"]);
    // Red, orange, amber, yellow, green and teal (355°–208° going round through 0°) are left out.
    for (const { hue } of COURSE_PALETTE) expect(hue >= 208 && hue <= 354).toBe(true);
    expect(PICKER_ORDER).toEqual(["cyan", "blue", "indigo", "lavender", "purple", "orchid", "plum", "magenta", "pink", "berry"]);
    expect(courseTone("blue")).toBe("var(--course-blue)");
  });

  it("knows its own ids and nothing else", () => {
    expect(isCourseColorId("berry")).toBe(true);
    expect(isCourseColorId("teal")).toBe(false);
    expect(isCourseColorId("#3366F0")).toBe(false);
    expect(isCourseColorId(undefined)).toBe(false);
  });
});

describe("which color each course gets", () => {
  it("a fresh term gets the first colors in order, by sorted code, and remembers them", () => {
    const result = resolveCourseColors(TERM, undefined);
    expect(shown(TERM)).toEqual(["DK4073 cyan", "II4091 indigo", "KU5014 berry", "PL3002 blue", "PL3032 orchid"]);
    expect(result.remember).toEqual({ DK4073: "cyan", II4091: "indigo", KU5014: "berry", PL3002: "blue", PL3032: "orchid" });
    expect(result.moved).toEqual([]);
  });

  it("remembered colors survive a course being added or dropped, and nothing more is remembered once each is", () => {
    const saved: CourseColors = { picks: {}, automatic: resolveCourseColors(TERM, undefined).remember };
    expect(resolveCourseColors(TERM, saved).remember).toEqual({});
    // AA1000 sorts first: before, it would have shifted every course after it.
    const added = ["AA1000", ...TERM];
    expect(shown(added, saved)).toEqual(["AA1000 magenta", "DK4073 cyan", "II4091 indigo", "KU5014 berry", "PL3002 blue", "PL3032 orchid"]);
    expect(resolveCourseColors(added, saved).remember).toEqual({ AA1000: "magenta" });
    const dropped = TERM.filter((code) => code !== "II4091");
    expect(shown(dropped, saved)).toEqual(["DK4073 cyan", "KU5014 berry", "PL3002 blue", "PL3032 orchid"]);
  });

  it("a pick moves only the automatic course whose color it took, to the first free color, and says which", () => {
    // PL3002's own automatic color is free once it's picked: DK4073 takes it.
    const automatic = resolveCourseColors(TERM, undefined).remember;
    const result = resolveCourseColors(TERM, { picks: { PL3002: pick("cyan") }, automatic });
    expect(shown(TERM, { picks: { PL3002: pick("cyan") }, automatic })).toEqual([
      "DK4073 blue",
      "II4091 indigo",
      "KU5014 berry",
      "PL3002 cyan*",
      "PL3032 orchid",
    ]);
    expect(result.moved).toEqual([{ code: "DK4073", from: "cyan", to: "blue" }]);
    expect(result.remember).toEqual({ DK4073: "blue" });
  });

  it("picks for courses outside the term reserve nothing, and still answer for those courses", () => {
    const saved: CourseColors = { picks: { MA1101: pick("cyan") }, automatic: {} };
    expect(shown(TERM, saved)).toEqual(["DK4073 cyan", "II4091 indigo", "KU5014 berry", "PL3002 blue", "PL3032 orchid"]);
    expect(resolveCourseColors(TERM, saved).colors.has("MA1101")).toBe(false);
    expect(pickedColor("MA1101", saved)).toBe("cyan");
    expect(pickedColor("DK4073", saved)).toBeUndefined();
    expect(pickedColor("MA1101", undefined)).toBeUndefined();
  });

  it("two picks may share a color", () => {
    const saved: CourseColors = { picks: { PL3002: pick("blue"), II4091: pick("blue") } };
    expect(shown(TERM, saved)).toEqual(["DK4073 cyan", "II4091 blue*", "KU5014 indigo", "PL3002 blue*", "PL3032 berry"]);
  });

  it("past ten courses, the least-used colors are shared, earliest in the order first", () => {
    const codes = Array.from({ length: 12 }, (_, i) => `KU${1000 + i}`);
    const colors = resolveCourseColors(codes, undefined).colors;
    expect(codes.map((code) => colors.get(code)!.id)).toEqual([...ORDER, "cyan", "indigo"]);
  });

  it("an id the palette doesn't have is automatic, picked or remembered", () => {
    const saved: CourseColors = { picks: { PL3002: pick("teal") }, automatic: { DK4073: "slate" } };
    expect(shown(TERM, saved)).toEqual(["DK4073 cyan", "II4091 indigo", "KU5014 berry", "PL3002 blue", "PL3032 orchid"]);
    expect(pickedColor("PL3002", saved)).toBeUndefined();
  });

  it("a code in two classes is one course with one color", () => {
    expect(shown(["PL3002", "PL3002", "DK4073"])).toEqual(["DK4073 cyan", "PL3002 indigo"]);
  });
});

describe("a choice in the picker", () => {
  it("picking a color saves it with the course moved out of its way; going back to automatic returns to the color it had", () => {
    const saved: CourseColors = { picks: {}, automatic: resolveCourseColors(TERM, undefined).remember };
    const picked = withRemembered(TERM, applyChoice(saved, "PL3002", "cyan", 5));
    expect(picked).toEqual({ picks: { PL3002: { color: "cyan", at: 5 } }, automatic: { ...saved.automatic, DK4073: "blue" } });
    // Back to automatic: PL3002's own blue went to DK4073, so it takes the first free one.
    const back = withRemembered(TERM, applyChoice(picked, "PL3002", null, 6));
    expect(back.picks).toEqual({});
    expect(shown(TERM, back)).toEqual(["DK4073 blue", "II4091 indigo", "KU5014 berry", "PL3002 cyan", "PL3032 orchid"]);
  });

  it("past the cap, the picks made longest ago for courses outside the term go first, never this term's", () => {
    const old = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`XX${1000 + i}`, { color: "blue", at: 100 + i }]));
    const value = applyChoice({ picks: { ...old, PL3002: { color: "cyan", at: 1 } } }, "DK4073", "pink", 999);
    const kept = pruneCourseColors(value, TERM);
    expect(Object.keys(kept.picks)).toHaveLength(200);
    expect(kept.picks.PL3002).toBeDefined();
    expect(kept.picks.DK4073).toBeDefined();
    expect(kept.picks.XX1000).toBeUndefined();
    expect(kept.picks.XX1001).toBeUndefined();
    expect(kept.picks.XX1002).toBeDefined();
  });
});

describe("the move from the old colors", () => {
  it("each demo course keeps a color close to its old one; the grey and the brown take the first free ones", () => {
    // Before: DK4073 sky, II4091 purple, KU5014 brown, PL3002 slate, PL3032 pink.
    const legacy = legacyAutomatic(TERM);
    expect(legacy).toEqual({ DK4073: "blue", II4091: "purple", PL3032: "pink" } satisfies Record<string, PaletteId>);
    expect(shown(TERM, { picks: {}, automatic: legacy })).toEqual(["DK4073 blue", "II4091 purple", "KU5014 cyan", "PL3002 indigo", "PL3032 pink"]);
  });

  it("courses of one term never share a color after the move", () => {
    // Eight codes that land on all eight old colors: the six kept ones map to six different new ones.
    const codes = ["AA1000", "DK4073", "II4091", "KU5014", "PL3002", "PL3032", "XX2000", "XX2001"];
    const kept = Object.values(legacyAutomatic(codes));
    expect(kept).toHaveLength(6);
    expect(new Set(kept).size).toBe(6);
  });
});
