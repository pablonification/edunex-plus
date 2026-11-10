// The app's one absence scale (mobile/src/ui/absence.ts): every tab colours a course's absences the same way and calls
// them by the same name, so "Jatah absen habis" is amber on Beranda, Perlu kamu urus, Kuliah and an exam, and "Lewat jatah absen 1×"
// red on each of them.
import { describe, expect, it } from "vitest";
import { absenceInk, absenceName, absenceTone } from "../../mobile/src/ui/absence";
import type { AttendanceHealth } from "../../src/core/attendance";
import { type StringKey, translate } from "../../src/core/strings";

describe("absenceTone", () => {
  it("is red once the target is out of reach or the course finished below it", () => {
    expect(absenceTone("out")).toBe("red");
    expect(absenceTone("missed")).toBe("red");
  });

  it("is amber with the absences used up but none over", () => {
    expect(absenceTone("none")).toBe("amber");
  });

  it("is green with absences left or the target met", () => {
    expect(absenceTone("safe")).toBe("ok");
    expect(absenceTone("risk")).toBe("ok");
    expect(absenceTone("met")).toBe("ok");
  });

  it("says nothing before there's a count", () => {
    expect(absenceTone("unknown")).toBeNull();
  });
});

describe("absenceInk", () => {
  it("is v4's tinted pair for each tone", () => {
    const v = { redBg: "redBg", redFg: "redFg", ambBg: "ambBg", ambFg: "ambFg", okBg: "okBg", okFg: "okFg" };
    expect(absenceInk(v, "red")).toEqual({ bg: "redBg", fg: "redFg" });
    expect(absenceInk(v, "amber")).toEqual({ bg: "ambBg", fg: "ambFg" });
    expect(absenceInk(v, "ok")).toEqual({ bg: "okBg", fg: "okFg" });
  });
});

describe("absenceName", () => {
  const t = (key: StringKey, vars?: Record<string, string | number>) => translate("id", key, vars);
  const en = (key: StringKey, vars?: Record<string, string | number>) => translate("en", key, vars);
  /** SIX's count, the absences the target still allows, and the meetings still to come. */
  const health = (state: AttendanceHealth["state"], attended: number, held: number, absencesLeft: number, upcoming: number) =>
    ({ state, attended, held, absencesLeft, target: 80, left: { upcoming: Array.from({ length: upcoming }, () => ({})) } }) as unknown as AttendanceHealth;

  it("names no absences left one way", () => {
    expect(absenceName(t, health("none", 4, 6, 0, 7))).toBe("Jatah absen habis");
    expect(absenceName(en, health("none", 4, 6, 0, 7))).toBe("No absences left");
  });

  it("names the target out of reach by how far over the limit it is (KU5014: 2 of 6, 9 to go at 80%)", () => {
    expect(absenceName(t, health("out", 2, 6, -1, 9))).toBe("Lewat jatah absen 1×");
    expect(absenceName(en, health("out", 2, 6, -1, 9))).toBe("1 absence too many");
  });

  it("leaves every other state to its screen", () => {
    for (const state of ["safe", "risk", "met", "missed", "unknown"] as const) expect(absenceName(t, health(state, 5, 6, 1, 7))).toBeNull();
  });
});
