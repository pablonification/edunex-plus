// SIX records (#78, #79, #80): the transcript with IP and IPK, graduation
// progress per curriculum stage, the curriculum with its specializations and
// minors, the study plan (KRS) and UKT bills, read from SIX once a day. ITB's
// grade arithmetic lives here too, so the screens project an IPK (target
// calculator, planner) with the same rules the engine uses to check SIX.
import { z } from "zod";

/** SIX term code: "2026-1" (1 odd, 2 even, 3 short semester). */
const Term = z.string().regex(/^\d{4}-[123]$/);
/** A calendar day as SIX gives it, no time: "2026-08-24". */
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ------------------------------------------------------------ grade arithmetic

/** Grade points per letter (Peraturan Akademik ITB). Other marks, such as T (incomplete), carry none. */
export const GRADE_POINTS = { A: 4, AB: 3.5, B: 3, BC: 2.5, C: 2, D: 1, E: 0 } as const;
export type LetterGrade = keyof typeof GRADE_POINTS;
export const LETTER_GRADES = Object.keys(GRADE_POINTS) as LetterGrade[];

export const isLetterGrade = (grade: string | null | undefined): grade is LetterGrade => grade != null && Object.hasOwn(GRADE_POINTS, grade);

/** An IP or IPK and what it is made of: value = points / sks, rounded as SIX shows it. */
export interface IndexSum {
  points: number;
  sks: number;
  /** Null over 0 SKS. */
  value: number | null;
}

/** points / sks rounded half up to two decimals, as SIX shows an index. Exact: points are multiples of 0.5. */
export function roundIndex(points: number, sks: number): number | null {
  if (sks <= 0) return null;
  return Math.floor((Math.round(points * 2) * 100 + sks) / (2 * sks)) / 100;
}

function sumOf(courses: Iterable<{ sks: number; grade: LetterGrade }>): IndexSum {
  let points = 0;
  let sks = 0;
  for (const course of courses) {
    points += GRADE_POINTS[course.grade] * course.sks;
    sks += course.sks;
  }
  return { points, sks, value: roundIndex(points, sks) };
}

/** The IP over a set of courses, e.g. one term: every letter grade counts once. */
export function termIndex(courses: readonly { sks: number; grade: string | null }[]): IndexSum {
  return sumOf(courses.filter((c): c is { sks: number; grade: LetterGrade } => isLetterGrade(c.grade)));
}

/**
 * The IPK over attempts listed oldest first: each course (by code) counts once,
 * with its newest letter grade (a retake replaces the earlier grade). Add this
 * term's courses with target grades to project one.
 */
export function cumulativeIndex(attempts: readonly { code: string; sks: number; grade: string | null }[]): IndexSum {
  const newest = new Map<string, { sks: number; grade: LetterGrade }>();
  for (const attempt of attempts) if (isLetterGrade(attempt.grade)) newest.set(attempt.code, { sks: attempt.sks, grade: attempt.grade });
  return sumOf(newest.values());
}

/** An IP or IPK as SIX shows it, next to the app's own figure from the course rows. */
export const CheckedIndex = z.object({
  /** SIX's figure; null when it shows none ("NR -" before any grade is in). */
  six: z.number().nullable(),
  /** The SKS SIX says its figure covers, where it says ("dari 125 SKS" next to the IPK). */
  sixSks: z.number().nullable(),
  /** The app's figure from the rows, rounded like SIX's; null while nothing counts. */
  computed: z.number().nullable(),
  /** Grade points and SKS behind `computed` (computed = points / sks), for exact projections. */
  points: z.number(),
  sks: z.number(),
  /** False when SIX's figure (or its SKS) doesn't match the rows. Both stay as they are; nothing is overwritten. */
  agrees: z.boolean(),
});
export type CheckedIndex = z.infer<typeof CheckedIndex>;

/** Puts SIX's figure next to the app's. Agreeing means SIX's two decimals are a rounding of the exact value. */
export function checkIndex(six: number | null, sixSks: number | null, sum: IndexSum): CheckedIndex {
  const exact = sum.sks > 0 ? sum.points / sum.sks : null;
  const valueAgrees = six === null || exact === null ? six === exact : Math.abs(six - exact) <= 0.005 + 1e-9;
  return { six, sixSks, computed: sum.value, points: sum.points, sks: sum.sks, agrees: valueAgrees && (sixSks === null || sixSks === sum.sks) };
}

// ------------------------------------------------------------ transcript (#78)

/**
 * How a transcript row counts.
 * - counted: in its term's IP and in the IPK.
 * - replaced: in its term's IP; a later graded attempt of the course replaces it in the IPK.
 * - off-transcript: in its term's IP; not (yet) on the transcript ("Masuk Transkrip" ✗), so not in the IPK.
 * - pending: no grade yet (this term, or hidden until the course questionnaire is filled).
 * - no-points: a mark without grade points, such as T (incomplete): in neither.
 */
export const Standing = z.enum(["counted", "replaced", "off-transcript", "pending", "no-points"]);
export type Standing = z.infer<typeof Standing>;

export const TranscriptCourse = z.object({
  /** "FI1101", without SIX's curriculum suffix. */
  code: z.string(),
  /** The curriculum the code belongs to, from SIX's suffix: 2019 for "FI1101-19". */
  curriculumYear: z.number().nullable(),
  /** SIX's (Indonesian) name. */
  name: z.string(),
  sks: z.number(),
  /** As SIX shows it: A, AB, B, BC, C, D, E, T or another mark; null while there is none. */
  grade: z.string().nullable(),
  /** The course's recommended semester in the Student's curriculum ("Semester Kurikulum"). */
  curriculumSemester: z.number().nullable(),
  /** SIX's "Masuk Transkrip" mark: the row is on the official transcript. */
  onTranscript: z.boolean(),
  standing: Standing,
  /** 1 the first time the Student took the course, 2 for the first retake, … */
  attempt: z.number(),
});
export type TranscriptCourse = z.infer<typeof TranscriptCourse>;

export const TranscriptTerm = z.object({
  term: Term,
  courses: z.array(TranscriptCourse),
  /** SKS taken in the term, as SIX totals them (pending courses included). */
  sks: z.number(),
  /** The term's IP: every letter grade of the term counts. */
  ip: CheckedIndex,
});
export type TranscriptTerm = z.infer<typeof TranscriptTerm>;

/** The transcript by semester (Transkrip Historis). Show `ipk` as the Student's IPK. */
export const Transcript = z.object({
  /** Oldest first; the last one is usually the term in progress. */
  terms: z.array(TranscriptTerm),
  /** SKS taken over all terms, as SIX totals them (this term included). */
  sksTaken: z.number(),
  /** SIX's IPK (from the curriculum-position page) next to the app's: every `counted` row. */
  ipk: CheckedIndex,
});
export type Transcript = z.infer<typeof Transcript>;

/** The IPK if courses got these grades: every counted grade, then the targets (a retake replaces the older grade). */
export function projectIpk(transcript: Transcript, targets: readonly { code: string; sks: number; grade: LetterGrade }[]): IndexSum {
  const counted = transcript.terms.flatMap((t) => t.courses).filter((c) => c.standing === "counted");
  return cumulativeIndex([...counted, ...targets]);
}

/** A grade that appeared or changed on the transcript. */
export interface GradeChange {
  term: string;
  code: string;
  name: string;
  /** The earlier grade; null when the course had none. */
  from: string | null;
  to: string;
}

/** Grades posted or changed between two reads of the transcript; none without an earlier read (the first sync is silent). */
export function gradeChanges(before: Transcript | undefined, after: Transcript): GradeChange[] {
  if (!before) return [];
  const earlier = new Map(before.terms.flatMap((t) => t.courses.map((c) => [`${t.term}|${c.code}`, c.grade] as const)));
  const changes: GradeChange[] = [];
  for (const term of after.terms) {
    for (const course of term.courses) {
      const from = earlier.get(`${term.term}|${course.code}`) ?? null;
      if (course.grade !== null && course.grade !== from) changes.push({ term: term.term, code: course.code, name: course.name, from, to: course.grade });
    }
  }
  return changes;
}

// ------------------------------------------------------------ graduation progress (#78, #79)

/** A course's kind in the curriculum ("Sifat"): W required, PD elective of the Student's program, PL elective from another program. */
export const CourseKind = z.enum(["required", "program-elective", "outside-elective", "other"]);
export type CourseKind = z.infer<typeof CourseKind>;

export const ProgressCourse = z.object({
  code: z.string(),
  curriculumYear: z.number().nullable(),
  name: z.string(),
  kind: CourseKind,
  /** As SIX writes the kind: "W", "PD", "PL". */
  kindCode: z.string(),
  sks: z.number(),
  /**
   * graded: has a grade (`grade`). in-progress: taken (`term`), no grade yet or SIX hides it.
   * exempt: credited without a grade (`note` says why, e.g. "Transfer").
   * not-taken: still to take. SIX already places courses passed under other codes.
   */
  status: z.enum(["graded", "in-progress", "exempt", "not-taken"]),
  grade: z.string().nullable(),
  /** The term it was taken: "2023-1". */
  term: Term.nullable(),
  note: z.string().nullable(),
});
export type ProgressCourse = z.infer<typeof ProgressCourse>;

export const ProgressStage = z.object({
  /** As SIX names it: "Tahap Persiapan Bersama", "Tahap Sarjana". */
  name: z.string(),
  /** SIX's IP for the stage next to the app's from the stage's rows. */
  ip: CheckedIndex,
  /** Passed SKS as SIX counts them (exempt courses included); SIX's own sum, not always the rows'. */
  sksPassed: z.number(),
  /** The stage's courses by the curriculum's recommended semester. */
  semesters: z.array(z.object({ semester: z.number(), courses: z.array(ProgressCourse) })),
});
export type ProgressStage = z.infer<typeof ProgressStage>;

/** Graduation progress (Transkrip Posisi Kurikulum): the Student's courses placed in their curriculum. */
export const Progress = z.object({
  /** The term the Student started: "2023-1" ("Tahun Masuk"). */
  entryTerm: Term.nullable(),
  /** SIX's IPK as this page shows it; show the transcript's `ipk`, which is checked against the rows. */
  ipk: z.number().nullable(),
  /** SKS passed over every stage, as SIX counts them ("Lulus 125 SKS"). */
  sksPassed: z.number(),
  /** SKS graded T (incomplete). */
  sksIncomplete: z.number(),
  /** SKS taken (graded or in progress, exempt not included) by kind, as SIX totals them ("Jenis Mata Kuliah"); "other" where SIX's label isn't a known one. */
  sksByKind: z.array(z.object({ kind: CourseKind, label: z.string(), sks: z.number() })),
  stages: z.array(ProgressStage),
});
export type Progress = z.infer<typeof Progress>;

// ------------------------------------------------------------ curriculum (#79)

export const CurriculumCourse = z.object({
  /** "II2100". A slot several courses can fill ends in X: "WI201X" is any of WI2010–WI2019 (religion). */
  code: z.string(),
  name: z.string(),
  sks: z.number(),
  /** SIX's id for the course; its syllabus is /kurikulum/silabus/{id}/view. */
  courseId: z.string().nullable(),
});
export type CurriculumCourse = z.infer<typeof CurriculumCourse>;

/** Courses taken together: a specialization or a minor. */
export const CoursePackage = z.object({
  name: z.string(),
  /** SKS the package needs, as SIX states it. */
  sks: z.number().nullable(),
  /** SIX's description of the rules, when it gives one (mostly minors). */
  note: z.string().nullable(),
  courses: z.array(CurriculumCourse),
});
export type CoursePackage = z.infer<typeof CoursePackage>;

/** A specialization, minor, multidisciplinary program or double major the Student registered for. */
export const SchemeRegistration = z.object({
  kind: z.enum(["specialization", "minor", "multidisciplinary", "double-major"]),
  /** "Sistem Informasi Cerdas": matches a package name in the curriculum. */
  name: z.string(),
  /** The program running it: "Sistem dan Teknologi Informasi". */
  program: z.string().nullable(),
  /** The day the academic advisor and the running program approved it; null until they have. */
  advisorApprovedOn: Day.nullable(),
  programApprovedOn: Day.nullable(),
  /** As SIX writes it: "On Progress", … */
  status: z.string(),
});
export type SchemeRegistration = z.infer<typeof SchemeRegistration>;

/** The Student's curriculum (Struktur Kurikulum) and what they registered for. */
export const Curriculum = z.object({
  /** "Kurikulum 2024 - Sarjana Sistem dan Teknologi Informasi", as SIX writes it. */
  name: z.string(),
  year: z.number(),
  /** "182", "S1 Sistem dan Teknologi Informasi", "STEI", as SIX writes them. */
  program: z.object({ code: z.string(), name: z.string(), faculty: z.string() }),
  /** SKS needed to graduate and the program's normal length in semesters. */
  graduationSks: z.number().nullable(),
  semesters: z.number().nullable(),
  /** Required courses by recommended semester. What the Student still has to take: Progress rows `not-taken`. */
  required: z.array(CurriculumCourse.extend({ semester: z.number() })),
  /** The program's specializations ("Spesialisasi"). */
  specializations: z.array(CoursePackage),
  /** Minors open to the Student, with the faculty and program running each. */
  minors: z.array(CoursePackage.extend({ faculty: z.string(), program: z.string() })),
  /** Every course the program runs ("Katalog Mata Kuliah"); those not required are its electives. */
  catalog: z.array(CurriculumCourse.extend({ category: z.string() })),
  /** What the Student registered for ("Skema Program Pendidikan"). */
  registrations: z.array(SchemeRegistration),
});
export type Curriculum = z.infer<typeof Curriculum>;

/** Indonesian and English text as SIX gives them; null where SIX leaves it empty. */
const Bilingual = z.object({ id: z.string().nullable(), en: z.string().nullable() });

/** A course's syllabus page (/kurikulum/silabus/{id}/view), read on demand. */
export const Syllabus = z.object({
  courseId: z.string(),
  code: z.string(),
  /** The curriculum it belongs to: 2024 for "II1200 - 2024". */
  curriculumYear: z.number().nullable(),
  sks: z.number(),
  /** "182 - Sistem dan Teknologi Informasi / STEI". */
  organizer: z.string().nullable(),
  name: Bilingual,
  summary: Bilingual,
  content: Bilingual,
  outcomes: Bilingual,
  related: z.string().nullable(),
  activities: Bilingual,
  references: z.string().nullable(),
  assessment: Bilingual,
  notes: Bilingual,
  /** The weekly plan ("Satuan Acara Perkuliahan"); empty when SIX has none. */
  weeks: z.array(
    z.object({ week: z.string(), topic: z.string(), subtopics: z.string().nullable(), outcomes: z.string().nullable(), sources: z.string().nullable() }),
  ),
});
export type Syllabus = z.infer<typeof Syllabus>;

// ------------------------------------------------------------ study plan (#80)

export const KrsCourse = z.object({
  code: z.string(),
  name: z.string(),
  classNo: z.string(),
  sks: z.number(),
  /** The academic advisor approved this course. */
  approved: z.boolean(),
});
export type KrsCourse = z.infer<typeof KrsCourse>;

/** When each step of a round happened (ms), as SIX records it; null while it hasn't. */
export const KrsSteps = z.object({
  /** Sent to the academic advisor ("Pengiriman Rencana Studi"). */
  sentAt: z.number().nullable(),
  /** Approved by the academic advisor ("Persetujuan Dosen Wali"). */
  approvedAt: z.number().nullable(),
  /** The study card (KSM) made official ("Pengesahan KSM"). */
  legalizedAt: z.number().nullable(),
});
export type KrsSteps = z.infer<typeof KrsSteps>;

/** not-sent → sent (waiting for the advisor) → approved → official (KSM legalized), for the latest round. */
export const KrsState = z.enum(["not-sent", "sent", "approved", "official"]);
export type KrsState = z.infer<typeof KrsState>;

/** This term's study plan (Rencana Studi). View only: the app never sends or changes a KRS. */
export const KrsPlan = z.object({
  term: Term,
  /** The academic advisor (Dosen Wali), as SIX writes the name. */
  advisor: z.string().nullable(),
  /** The most SKS SIX allows this term ("Maksimal Beban"). */
  maxSks: z.number().nullable(),
  state: KrsState,
  /** The plan as first sent (DRS). */
  plan: KrsSteps,
  /** The change round (URS, "Penggantian Rencana Studi"); null when SIX shows none. */
  change: KrsSteps.nullable(),
  /** UKT for the term as the KRS page shows it: paid, and the amount; null when the page shows no UKT step. */
  ukt: z.object({ paid: z.boolean(), amount: z.number().nullable() }).nullable(),
  courses: z.array(KrsCourse),
  /** SKS of the plan, as SIX totals them. */
  sks: z.number(),
});
export type KrsPlan = z.infer<typeof KrsPlan>;

/** Something that moved on the study plan between two reads. */
export type KrsChange =
  | { kind: "sent" | "approved" | "legalized"; round: "plan" | "change"; at: number }
  | { kind: "course-added" | "course-removed"; code: string; name: string }
  | { kind: "course-changed"; code: string; name: string; classNo: string; sks: number; approved: boolean };

/** What moved on the plan; none without an earlier read (the first sync is silent). A new term's plan counts from empty. */
export function krsChanges(before: KrsPlan | undefined, after: KrsPlan): KrsChange[] {
  if (!before) return [];
  const empty: KrsSteps = { sentAt: null, approvedAt: null, legalizedAt: null };
  const old = before.term === after.term ? before : { ...before, plan: empty, change: null, courses: [] };
  const changes: KrsChange[] = [];
  for (const round of ["plan", "change"] as const) {
    const was = old[round] ?? empty;
    const now = after[round] ?? empty;
    if (now.sentAt !== null && now.sentAt !== was.sentAt) changes.push({ kind: "sent", round, at: now.sentAt });
    if (now.approvedAt !== null && now.approvedAt !== was.approvedAt) changes.push({ kind: "approved", round, at: now.approvedAt });
    if (now.legalizedAt !== null && now.legalizedAt !== was.legalizedAt) changes.push({ kind: "legalized", round, at: now.legalizedAt });
  }
  const earlier = new Map(old.courses.map((c) => [c.code, c]));
  for (const course of after.courses) {
    const was = earlier.get(course.code);
    if (!was) changes.push({ kind: "course-added", code: course.code, name: course.name });
    else if (was.classNo !== course.classNo || was.sks !== course.sks || was.approved !== course.approved) changes.push({ kind: "course-changed", ...course });
    earlier.delete(course.code);
  }
  for (const gone of earlier.values()) changes.push({ kind: "course-removed", code: gone.code, name: gone.name });
  return changes;
}

// ------------------------------------------------------------ bills (#80)

export const Instalment = z.object({
  number: z.number(),
  amount: z.number(),
  /** The last day to pay it, and the end of that day in WIB (ms). */
  dueDate: Day,
  dueAt: z.number(),
});
export type Instalment = z.infer<typeof Instalment>;

/** not-billed: SIX shows "-". paid: paid in full. */
export const BillStatus = z.enum(["not-billed", "unpaid", "partly-paid", "paid"]);
export type BillStatus = z.infer<typeof BillStatus>;

/** A term's UKT bill (Status Keuangan). Overdue is `nextDueAt` in the past. */
export const Bill = z.object({
  term: Term,
  /** Billed and paid, in Rupiah; null where SIX shows "-". */
  amount: z.number().nullable(),
  paid: z.number().nullable(),
  status: BillStatus,
  /** The last day to pay ("Batas Pembayaran"), and the end of that day in WIB (ms); with instalments, the last one's. */
  dueDate: Day.nullable(),
  dueAt: z.number().nullable(),
  instalments: z.array(Instalment),
  /** When the next payment is due: the deadline, or the first instalment the paid amount doesn't cover. Null once paid or while nothing is billed. */
  nextDueAt: z.number().nullable(),
});
export type Bill = z.infer<typeof Bill>;

export const sixRecordsDatasets = {
  "six.transcript": Transcript,
  "six.progress": Progress,
  "six.curriculum": Curriculum,
  "six.krs": KrsPlan,
  /** Oldest term first. */
  "six.bills": z.array(Bill),
} as const;
