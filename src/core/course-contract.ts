// The course-contract calculator (#74, the approved prototype's grade
// standing): the Student enters each part's weight from the course contract
// and the score they have or expect, and sees their final score, or the
// average they need on what's left for each letter. EduNex's gradebook can't
// answer this: it shows 0 · E until the lecturer publishes it.
import { CONTRACT_LETTERS, type ContractLetter, type ContractPart, type CourseContract } from "./models";

/**
 * A starting point only, from a real ITB course contract (Fisika Dasar
 * 2022/23). Parts with no name are named in the Student's language by their id.
 */
export const EXAMPLE_CONTRACT: CourseContract = {
  parts: [
    { id: "uts", name: "", weight: 30, score: null },
    { id: "uas", name: "", weight: 30, score: null },
    { id: "tasks", name: "", weight: 20, score: null },
    { id: "quizzes", name: "", weight: 10, score: null },
    { id: "attendance", name: "", weight: 10, score: null, attendance: true },
  ],
  cutoffs: { A: 75, AB: 68, B: 60, BC: 55, C: 50, D: 45 },
};

export const EXAMPLE_PART_IDS = ["uts", "uas", "tasks", "quizzes", "attendance"] as const;

export interface LetterNeed {
  letter: ContractLetter;
  /** Already secured, even scoring 0 on what's left. */
  reached: boolean;
  /** The average needed on the parts still open (0–100), or null when it's out of reach or nothing is open. */
  need: number | null;
}

export interface Standing {
  /** The weights' sum; a contract's add up to 100. */
  totalWeight: number;
  /** Points secured by the parts with a score. */
  secured: number;
  /** Weight of the parts still without a score. */
  openWeight: number;
  /** The final score once every part has a score. */
  final: number | null;
  /** The letter for `final`; "E" below every cut-off. */
  letter: ContractLetter | "E" | null;
  needs: LetterNeed[];
}

/** A part's score: SIX's attendance for the attendance part when SIX has it, else what the Student entered. */
export function partScore(part: ContractPart, attendance: number | null): number | null {
  return part.attendance && attendance !== null ? attendance : part.score;
}

export function letterFor(score: number, cutoffs: CourseContract["cutoffs"]): ContractLetter | "E" {
  return CONTRACT_LETTERS.find((letter) => score >= cutoffs[letter] - 1e-9) ?? "E";
}

/** Where the course grade stands. `attendance` is SIX's attendance percentage, when known. */
export function standing(contract: CourseContract, attendance: number | null): Standing {
  let secured = 0;
  let openWeight = 0;
  let totalWeight = 0;
  for (const part of contract.parts) {
    totalWeight += part.weight;
    const score = partScore(part, attendance);
    if (score === null) openWeight += part.weight;
    else secured += (part.weight * score) / 100;
  }
  const final = openWeight === 0 ? secured : null;
  const needs = CONTRACT_LETTERS.map((letter): LetterNeed => {
    const cutoff = contract.cutoffs[letter];
    if (secured >= cutoff - 1e-9) return { letter, reached: true, need: null };
    if (openWeight === 0) return { letter, reached: false, need: null };
    const need = ((cutoff - secured) / openWeight) * 100;
    return { letter, reached: false, need: need > 100 + 1e-9 ? null : Math.max(0, Math.ceil(need - 1e-9)) };
  });
  return { totalWeight, secured, openWeight, final, letter: final === null ? null : letterFor(final, contract.cutoffs), needs };
}
