// The course page (#74): each course's Edunex outline (modules, lecturer, the
// published grade), materials, Presence sessions, announcements and exams.
// Every dataset is kept per course code, the class's parent and child Edunex
// courses merged under it; a code that is there means the course was read,
// even when it holds nothing. Also what the Student types into the
// course-contract calculator, kept on this computer.
import { z } from "zod";

/** A module of a course's Edunex outline. */
export const CourseModule = z.object({
  id: z.number(),
  /** The Edunex course it belongs to: the class's own course or its parent. */
  courseId: z.number(),
  title: z.string(),
  /** When the lecturer posted it (ms). */
  postedAt: z.number().nullable(),
});
export type CourseModule = z.infer<typeof CourseModule>;

export const GradebookGrade = z.object({ total: z.number(), letter: z.string() });
export type GradebookGrade = z.infer<typeof GradebookGrade>;

export const CourseOutline = z.object({
  lecturer: z.string().nullable(),
  /** SKS as Edunex has it; SIX's count wins once SIX is connected. */
  credits: z.number().nullable(),
  /** The study program offering the course, as Edunex names it ("S1 - Desain Komunikasi Visual"): its catalog page has the course's official name. */
  program: z.string().nullable().optional(),
  /** In Edunex's order, the class's own course first, then its parent's. Modules the lecturer switched off are left out. */
  modules: z.array(CourseModule),
  /** From Edunex's gradebook once the lecturer publishes it. Before that Edunex shows 0 · E, which is never a grade. */
  grade: GradebookGrade.nullable(),
});
export type CourseOutline = z.infer<typeof CourseOutline>;

export const Material = z.object({
  id: z.number(),
  courseId: z.number(),
  /** null: course-wide, in no module. */
  moduleId: z.number().nullable(),
  title: z.string(),
  /** Edunex's own type: pdf, text, ms-teams, zoom, google-meet, cloudx, webex, video, audio, url, file, h5p, or one the app doesn't know yet. */
  type: z.string(),
  /** What Edunex holds for it: a link (a file, an online class, a page) or, for text, HTML. */
  content: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  postedAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
});
export type Material = z.infer<typeof Material>;

/** One Edunex Presence session of the Student's class. */
export const PresenceSession = z.object({
  id: z.number(),
  courseId: z.number(),
  classId: z.number(),
  /** The meeting as Edunex has it (ms). SIX's timetable is the official time. */
  start: z.number(),
  end: z.number(),
  /** The window in which Edunex records presence (ms). */
  opensAt: z.number(),
  closesAt: z.number(),
  topic: z.string().nullable(),
  /** The lecturer's note, e.g. "Presensi dengan submit Tugas 01 Bab I". */
  note: z.string().nullable(),
  /** The activity that counts as presence when the lecturer chose one (Edunex `presentable`, e.g. an assignment and its id); empty: viewing the course. */
  countsBy: z.array(z.object({ kind: z.string(), id: z.string() })),
  /** The Edunex page to act on, when Edunex gives one. */
  url: z.string().nullable(),
  /** What Edunex recorded for the Student; null when it recorded nothing. */
  recorded: z.object({ present: z.boolean(), at: z.number().nullable() }).nullable(),
});
export type PresenceSession = z.infer<typeof PresenceSession>;

export const Announcement = z.object({
  id: z.number(),
  courseId: z.number(),
  /** As the lecturer wrote it: plain text with line breaks. */
  text: z.string(),
  author: z.string().nullable(),
  postedAt: z.number().nullable(),
});
export type Announcement = z.infer<typeof Announcement>;

/**
 * An exam on Edunex. No exam record has been recorded yet (none on the
 * account), so only its id is relied on; a name and time show when Edunex
 * sends them the way its other records do.
 */
export const EdunexExam = z.object({
  id: z.string(),
  courseId: z.number(),
  title: z.string().nullable(),
  start: z.number().nullable(),
  end: z.number().nullable(),
});
export type EdunexExam = z.infer<typeof EdunexExam>;

/** A part of the final score in a course contract (UTS, UAS, Tasks…), and the score the Student has or expects. */
export const ContractPart = z.object({
  id: z.string().max(40),
  name: z.string().max(80),
  /** Percent of the final score. */
  weight: z.number().min(0).max(100),
  /** 0–100; null while unknown. */
  score: z.number().min(0).max(100).nullable(),
  /** Scored from SIX's attendance count when SIX has it. */
  attendance: z.boolean().optional(),
});
export type ContractPart = z.infer<typeof ContractPart>;

export const CONTRACT_LETTERS = ["A", "AB", "B", "BC", "C", "D"] as const;
export type ContractLetter = (typeof CONTRACT_LETTERS)[number];

export const CourseContract = z.object({
  parts: z.array(ContractPart).max(20),
  /** The lowest final score for each letter, as the contract sets them. */
  cutoffs: z.object({ A: z.number(), AB: z.number(), B: z.number(), BC: z.number(), C: z.number(), D: z.number() }),
});
export type CourseContract = z.infer<typeof CourseContract>;

const perCourse = <T extends z.ZodType>(item: T) => z.record(z.string(), z.array(item));

export const coursePageDatasets = {
  "edunex.outline": z.record(z.string(), CourseOutline),
  "edunex.materials": perCourse(Material),
  "edunex.presence": perCourse(PresenceSession),
  "edunex.announcements": perCourse(Announcement),
  "edunex.exams": perCourse(EdunexExam),
  /** What the Student entered from each course contract, by course code. */
  "local.courseWeights": z.record(z.string(), CourseContract),
} as const;
