// SIX: the Student, this term's courses with attendance, and the timetable
// (#76). These shapes are shared with Home, the course page and later screens.
import { z } from "zod";

export const SixStudent = z.object({
  nim: z.string(),
  name: z.string(),
  /** SIX's own id for the Student, used in page addresses. */
  studentId: z.string(),
  /** SIX term code: "2026-1" (1 odd, 2 even, 3 short semester). */
  term: z.string(),
  /** "Perencanaan Wilayah dan Kota", as SIX writes it. */
  program: z.string().nullable(),
  /** ITB's number for the study program ("182"), as in the public catalog's addresses. */
  programCode: z.string().nullable(),
});
export type SixStudent = z.infer<typeof SixStudent>;

/** A course of this term on SIX's student status page. SIX is the truth for enrollment. */
export const SixCourse = z.object({
  code: z.string(),
  /** SIX's (Indonesian) name. */
  name: z.string(),
  classNo: z.string().nullable(),
  sks: z.number(),
  /** "Hadir X dari Y pertemuan": exact counts when SIX shows them. */
  attendance: z.object({ attended: z.number(), held: z.number() }).nullable(),
});
export type SixCourse = z.infer<typeof SixCourse>;

/** One class meeting on SIX's timetable: the official time and room. */
export const ClassSession = z.object({
  /** SIX's meeting id. */
  id: z.string(),
  courseCode: z.string(),
  courseName: z.string(),
  /** ms since epoch. */
  start: z.number(),
  end: z.number(),
  /** "Kuliah", "Praktikum", "Tutorial", "UTS", "UAS", … as SIX writes it. */
  activity: z.string(),
  room: z.string().nullable(),
});
export type ClassSession = z.infer<typeof ClassSession>;

export const sixDatasets = {
  "six.student": SixStudent,
  /** This term's courses, in SIX's order. */
  "six.courses": z.array(SixCourse),
  /** The class meetings of this month and the next, by start time. */
  "six.schedule": z.array(ClassSession),
  /**
   * The months ("2026-10") whose own timetable page was read. A month page
   * also shows the edges of the months around it; those days don't make
   * their month read, so nothing there is called missing from SIX.
   */
  "six.scheduleMonths": z.array(z.string()),
} as const;
