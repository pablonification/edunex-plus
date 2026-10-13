// ITB's public pages (#84): the academic calendar (Kalender Pendidikan) and
// SIX's public course catalog (Kurikulum 2024, Sarjana). Both feed the
// attendance math, deadlines, exams and the study planner.
import { z } from "zod";

/**
 * What an academic calendar event means for a Student. Anything the app
 * doesn't recognise is kept as "other".
 */
export const CalendarKind = z.enum([
  "lecture-start",
  "lecture-end",
  "uts",
  "uas",
  /** Registering the study plan (DRS, "Pengisian Rencana Studi"). */
  "drs",
  /** Changing the study plan (URS, PRS). */
  "urs",
  /** Paying the semester's tuition (UKT). */
  "ukt-deadline",
  /** The lecture evaluation questionnaire; SIX hides grades until it's filled. */
  "questionnaire",
  /** Lecturers' deadline for entering final grades. */
  "grade-deadline",
  /** Last day a grade may still be changed. */
  "grade-change-deadline",
  /** "Pemantauan dan Evaluasi Akademik": the progress check against 24/48/72/96/120 SKS. */
  "progress-check",
  "holiday",
  /** Last day to apply for a semester's leave ("Pengajuan Cuti"). */
  "leave",
  /** Last day to apply for more study time ("Perpanjangan Waktu Studi"). */
  "study-extension",
  /** Graduation: a month's yudisium and its paperwork deadline, graduation days, diplomas. */
  "graduation",
  "other",
]);
export type CalendarKind = z.infer<typeof CalendarKind>;

export const CalendarEvent = z.object({
  /** The feed's UID (with the start appended for a repeat). */
  id: z.string(),
  /** As ITB writes it: "Masa Ujian Tengah Semester I-2026/2027". */
  title: z.string(),
  kind: CalendarKind,
  /** SIX term code the event is about ("2026-1", "2026-2", "2026-3" short semester), when the title says. */
  term: z.string().nullable(),
  /** ms since epoch; for all-day events the start of the first day in WIB. */
  start: z.number(),
  /** ms since epoch, exclusive; for all-day events the start of the day after the last. */
  end: z.number(),
  allDay: z.boolean(),
  /** First and last day (inclusive) in WIB, "2026-10-12". */
  firstDay: z.string(),
  lastDay: z.string(),
});
export type CalendarEvent = z.infer<typeof CalendarEvent>;

export const AcademicCalendar = z.object({
  /** When the feed was last read (ms); it's read again after a day. */
  checkedAt: z.number(),
  /** Sorted by start. */
  events: z.array(CalendarEvent),
});
export type AcademicCalendar = z.infer<typeof AcademicCalendar>;

/** A course in the catalog. */
export const CatalogCourse = z.object({
  /** "II2210"; a few ITB-wide courses end in X ("WI201X", the religion course). */
  code: z.string(),
  name: z.string(),
  sks: z.number(),
  /** "Kuliah", "Kerja Praktik", "Tugas Akhir / Tesis / Disertasi", from the owner's catalog tab; null until it's read. */
  category: z.string().nullable(),
  /** The program whose code prefix the course carries ("102" for FI1101), once that program's page is read. */
  owner: z.string().nullable(),
});
export type CatalogCourse = z.infer<typeof CatalogCourse>;

/** A specialization ("pilihan" track) or a multidisciplinary package: a named set of courses. */
export const CatalogTrack = z.object({
  name: z.string(),
  sks: z.number(),
  courses: z.array(z.string()),
});
export type CatalogTrack = z.infer<typeof CatalogTrack>;

export const CatalogMinor = z.object({
  /** SIX's own id for the package. */
  id: z.string(),
  /** The program that offers it, as SIX writes it ("Matematika"). */
  program: z.string(),
  name: z.string(),
  sks: z.number(),
  courses: z.array(z.string()),
});
export type CatalogMinor = z.infer<typeof CatalogMinor>;

/**
 * pending: not read yet. ready: read. missing: the page didn't answer (some
 * campus programs answer 500); tried again later. changed: the page's layout
 * isn't the one the app knows.
 */
export const CatalogProgramState = z.enum(["pending", "ready", "missing", "changed"]);

export const CatalogProgram = z.object({
  /** SIX's program number ("182"). */
  id: z.string(),
  name: z.string(),
  /** "STEI". */
  faculty: z.string(),
  state: CatalogProgramState,
  /** When the page was last tried (ms). */
  checkedAt: z.number().nullable(),
  /** The code prefix of the courses it owns ("II"); null until read. */
  prefix: z.string().nullable(),
  /** Required courses by recommended semester (1–8). */
  required: z.array(z.object({ code: z.string(), semester: z.number() })),
  /** Its own courses that aren't required. */
  electives: z.array(z.string()),
  specializations: z.array(CatalogTrack),
  multidisciplinary: z.array(CatalogTrack),
  /** Minor packages open to its Students (ids in `minors`). */
  minors: z.array(z.string()),
  /** Every course its catalog tab lists. */
  catalog: z.array(z.string()),
});
export type CatalogProgram = z.infer<typeof CatalogProgram>;

export const CourseCatalog = z.object({
  /** When the program list was last read (ms). */
  checkedAt: z.number(),
  programs: z.array(CatalogProgram),
  /** Sorted by code. */
  courses: z.array(CatalogCourse),
  minors: z.array(CatalogMinor),
});
export type CourseCatalog = z.infer<typeof CourseCatalog>;

export const itbDatasets = {
  "itb.calendar": AcademicCalendar,
  "itb.catalog": CourseCatalog,
} as const;
