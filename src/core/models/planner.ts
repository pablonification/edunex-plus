// The study plan (#79): the semesters the Student plans from now to
// graduation, the grades they expect, and the IPK they aim for. It stays on
// this computer ("local.plan", saved with "local.set"); the app never sends a
// KRS.
import { z } from "zod";
import { LETTER_GRADES, type LetterGrade } from "./six-records";

export const Letter = z.enum(LETTER_GRADES as [LetterGrade, ...LetterGrade[]]);

export const PlannedCourse = z.object({
  code: z.string().min(1).max(20),
  /** Kept with the plan, so it reads the same when the catalog isn't loaded. */
  name: z.string().max(200),
  sks: z.number().int().min(0).max(24),
  /** The grade the Student expects. */
  grade: Letter,
  /** Taking a graded course again: the newest grade replaces the old one in the IPK. */
  retake: z.boolean(),
});
export type PlannedCourse = z.infer<typeof PlannedCourse>;

export const PlannedTerm = z.object({
  /** SIX term code: "2027-1" (1 odd, 2 even, 3 short semester). */
  term: z.string().regex(/^\d{4}-[123]$/),
  courses: z.array(PlannedCourse).max(40),
});
export type PlannedTerm = z.infer<typeof PlannedTerm>;

export const StudyPlan = z.object({
  /** Terms after the current one, oldest first. */
  terms: z.array(PlannedTerm).max(20),
  /** Expected grades for this term's courses, by course code. */
  expected: z.record(z.string(), Letter),
  /** The IPK the Student aims for; null until they pick one. */
  target: z.number().min(0).max(4).nullable(),
  /** The minor the Student tracks: "<program> · <name>". */
  minor: z.string().nullable(),
});
export type StudyPlan = z.infer<typeof StudyPlan>;

export const plannerDatasets = {
  "local.plan": StudyPlan,
} as const;
