// One colour scale for a course's absences, on every tab (round 2, v4): red once the target can't be reached (or the
// course finished below it), amber with the absences used up but none over, green with absences left or the target
// met. Beranda's "Jatah habis" and "Di bawah target", Kuliah's "Sisa 2×", "Habis" and "Lewat batas 1×", a course's
// page and the class sheet's pips all take their colour from here. Never the course's colour.
import type { AttendanceState } from "../../../src/core/attendance";

/** The three tones, named as v4's tinted pairs (`redBg/redFg`, `ambBg/ambFg`, `okBg/okFg`) and Kuliah's StatusChip. */
export type AbsenceTone = "red" | "amber" | "ok";

/** A course's absence state as its tone; null where there's no count to judge yet (`unknown`). */
export function absenceTone(state: AttendanceState): AbsenceTone | null {
  switch (state) {
    case "out":
    case "missed":
      return "red";
    case "none":
      return "amber";
    case "safe":
    case "risk":
    case "met":
      return "ok";
    default:
      return null;
  }
}

/** v4's three tinted pairs (`theme.v4` has them); just these, so this file stays free of React Native for the tests. */
type TonePairs = Record<"redBg" | "redFg" | "ambBg" | "ambFg" | "okBg" | "okFg", string>;

/** The tone's v4 pair: `fg` for words and pips (on a card, or on `bg`), `bg` for a chip. */
export function absenceInk(v: TonePairs, tone: AbsenceTone): { bg: string; fg: string } {
  if (tone === "red") return { bg: v.redBg, fg: v.redFg };
  if (tone === "amber") return { bg: v.ambBg, fg: v.ambFg };
  return { bg: v.okBg, fg: v.okFg };
}
