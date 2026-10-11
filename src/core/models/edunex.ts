// EduNex: the Student's account and this term's courses (#71).
import { z } from "zod";

export const Account = z.object({
  name: z.string(),
  /** Student number (NIM). */
  nim: z.string(),
});
export type Account = z.infer<typeof Account>;

/** A course the Student takes this term, as EduNex knows it. SIX details join in later. */
export const Course = z.object({
  code: z.string(),
  name: z.string(),
  /** "01" from EduNex's "II4091-01". */
  classNo: z.string().nullable(),
  /** SIX term code: "2026-1". */
  term: z.string(),
  edunex: z.object({
    courseId: z.number(),
    classId: z.number(),
    /** Parent and child EduNex courses for the same class; information can sit in either. */
    relatedCourseIds: z.array(z.number()),
  }),
});
export type Course = z.infer<typeof Course>;

export const edunexDatasets = {
  "edunex.account": Account,
  "edunex.courses": z.array(Course),
} as const;
