// The app's one absence scale (mobile/src/ui/absence.ts): every tab colours a course's absences the same way, so
// "Jatah habis" on Beranda and "Habis" on Kuliah are the same amber, and "Di bawah target" the same red.
import { describe, expect, it } from "vitest";
import { absenceInk, absenceTone } from "../../mobile/src/ui/absence";

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
