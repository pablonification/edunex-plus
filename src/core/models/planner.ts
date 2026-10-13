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

/** A course added to this term as a what-if: kept with the plan, so it reads the same without the catalog. */
export const WhatIfCourse = z.object({
  code: z.string().min(1).max(20),
  name: z.string().max(200),
  sks: z.number().int().min(0).max(24),
  /**
   * Where it was planned before it was tried now (a course is taken once, so
   * it left that semester): taking the what-if away puts it back. Optional:
   * what-ifs saved before it existed keep loading.
   */
  from: z
    .object({
      term: z.string().regex(/^\d{4}-[123]$/),
      grade: Letter,
      retake: z.boolean(),
    })
    .optional(),
});
export type WhatIfCourse = z.infer<typeof WhatIfCourse>;

/** Why the Student hid a rule's warning. "not-continuing" on a registered specialization or minor lasts: the plan stops following it. */
export const HideReason = z.enum(["not-continuing", "program-adds", "other"]);
export type HideReason = z.infer<typeof HideReason>;

export const StudyPlan = z.object({
  /** Terms after the current one, oldest first. */
  terms: z.array(PlannedTerm).max(20),
  /** Expected grades for this term's courses, by course code. */
  expected: z.record(z.string(), Letter),
  /** The IPK the Student aims for; null until they pick one. */
  target: z.number().min(0).max(4).nullable(),
  /** The minor the Student plans: "<program> · <name>". */
  minor: z.string().nullable(),
  /**
   * What-ifs on this term's KRS, only in the plan (SIX's KRS never changes):
   * courses added and the KRS courses left out. Ignored once SIX's term moves on.
   * Optional: plans saved before it existed keep loading.
   */
  now: z
    .object({
      term: z.string().regex(/^\d{4}-[123]$/),
      added: z.array(WhatIfCourse).max(20),
      dropped: z.array(z.string().min(1).max(20)).max(20),
    })
    .optional(),
  /** Rule warnings the Student hid, by the rule's key ("parity|II4090"), with why. Optional, like `now`. */
  hidden: z.record(z.string().min(1).max(120), z.object({ reason: HideReason, at: z.number() })).optional(),
});
export type StudyPlan = z.infer<typeof StudyPlan>;

/**
 * The Student's correction to one required course of the curriculum, when
 * SIX's record doesn't match theirs: not-mine (their cohort's curriculum
 * doesn't have it), counted-as (a course they passed stands in for it), done
 * (taken care of some other way), mine (SIX's record leaves it out, but it is
 * theirs to take), program-adds (their program will add it to their record).
 * The last two only settle what SIX hasn't: once SIX lists the course as
 * taken, SIX's word stands.
 */
export const CurriculumFix = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("not-mine"), at: z.number() }),
  z.object({ kind: z.literal("counted-as"), code: z.string().min(1).max(20), at: z.number() }),
  z.object({ kind: z.literal("done"), at: z.number() }),
  z.object({ kind: z.literal("mine"), at: z.number() }),
  z.object({ kind: z.literal("program-adds"), at: z.number() }),
]);
export type CurriculumFix = z.infer<typeof CurriculumFix>;

/** Facts the Student told the app about their curriculum, kept apart from the plan so "Reset plan" leaves them. */
export const CurriculumFixes = z.object({
  /** By the curriculum's course code ("WI1111", "WI201X"). */
  slots: z.record(z.string().min(1).max(20), CurriculumFix),
});
export type CurriculumFixes = z.infer<typeof CurriculumFixes>;

export const plannerDatasets = {
  "local.plan": StudyPlan,
  "local.curriculum": CurriculumFixes,
} as const;
