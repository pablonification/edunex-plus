// Graduation honors (Peraturan Akademik ITB, Pasal 49): cum laude at IPK ≥
// 3.50, magna cum laude ≥ 3.75, summa cum laude ≥ 3.85 with no course
// retaken, all within 9 semesters. Shared by Nilai and the planner, so both
// say the same thing.
import { GRADE_POINTS, LETTER_GRADES, type LetterGrade } from "./models";

export type HonorLevel = "summa" | "magna" | "cum";

/** Highest first. */
export const HONORS: readonly { level: HonorLevel; min: number }[] = [
  { level: "summa", min: 3.85 },
  { level: "magna", min: 3.75 },
  { level: "cum", min: 3.5 },
];

/** Honors need graduating within this many semesters (short semesters don't count). */
export const HONORS_MAX_SEMESTERS = 9;

export interface Path {
  /** Any course taken again, on the transcript or in the plan. */
  retakes: boolean;
  /** The semester the Student graduates in. */
  semesters: number | null;
}

/** Why a level can't be had whatever the grades. */
export function blockedBy(level: HonorLevel, path: Path): "time" | "retake" | null {
  if (path.semesters !== null && path.semesters > HONORS_MAX_SEMESTERS) return "time";
  if (level === "summa" && path.retakes) return "retake";
  return null;
}

/** The honors an IPK (as SIX rounds it) earns on this path. */
export function honorFor(ipk: number | null, path: Path): HonorLevel | null {
  if (ipk === null) return null;
  return HONORS.find((h) => ipk >= h.min - 1e-9 && blockedBy(h.level, path) === null)?.level ?? null;
}

/** The lowest letter whose points reach an average: what "about AB" means. */
export function letterForAverage(average: number): LetterGrade {
  const letters = [...LETTER_GRADES].sort((a, b) => GRADE_POINTS[a] - GRADE_POINTS[b]);
  return letters.find((letter) => GRADE_POINTS[letter] >= average - 1e-9) ?? "A";
}

/** The letter nearest an IP: the default expected grade, as the Student has been doing. */
export function nearestLetter(ip: number | null): LetterGrade {
  if (ip === null) return "B";
  return [...LETTER_GRADES].sort((a, b) => Math.abs(GRADE_POINTS[a] - ip) - Math.abs(GRADE_POINTS[b] - ip) || GRADE_POINTS[b] - GRADE_POINTS[a])[0];
}

/**
 * The graduation predicate (Peraturan Akademik ITB): an honors level, else
 * "sangat memuaskan" above 2,75, else "memuaskan" from 2,00. One word for an
 * IPK, wherever it shows.
 */
export type Predicate = HonorLevel | "very-good" | "good";

export function predicateFor(ipk: number | null, path: Path): Predicate | null {
  if (ipk === null) return null;
  return honorFor(ipk, path) ?? (ipk > 2.75 + 1e-9 ? "very-good" : ipk >= 2 - 1e-9 ? "good" : null);
}
