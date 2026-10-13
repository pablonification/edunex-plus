// The study planner's logic (#78, #79): the Student's record read from SIX,
// this term's what-ifs on top of it, the IP/IPK projection Nilai and the
// planner share, the rules a plan is checked against (Peraturan Akademik ITB
// and the program's curriculum) and the warnings the Student hid, and the
// plan edits. Pure: the screens and the tests call the same functions.
import { fillsSlot, type ProgressRow, type SlotStanding, slotStandings } from "./curriculum-slots";
import { blockedBy, HONORS, type HonorLevel, honorFor, nearestLetter, type Path } from "./honors";
import {
  type CourseCatalog,
  type CoursePackage,
  type Curriculum,
  type CurriculumFix,
  cumulativeIndex,
  GRADE_POINTS,
  type HideReason,
  type IndexSum,
  isLetterGrade,
  type LetterGrade,
  type PlannedCourse,
  type Progress,
  projectIpk,
  roundIndex,
  type StudyPlan,
  type Transcript,
  termIndex,
  type WhatIfCourse,
} from "./models";

/** Most SKS in a regular semester (with the academic advisor's approval), the normal load, and a short semester's limit. */
export const MAX_SKS = 24;
export const NORMAL_SKS = 20;
export const SHORT_SKS = 9;
/** Used while SIX's curriculum isn't read yet. */
const DEFAULT_GRADUATION_SKS = 144;
const DEFAULT_SEMESTERS = 8;

// ------------------------------------------------------------ terms

export type TermKind = "odd" | "even" | "short";

export const termKind = (term: string): TermKind => (term.endsWith("-3") ? "short" : term.endsWith("-1") ? "odd" : "even");

/** The term after `term`; with `short`, the short semester after an even one. */
export function nextTerm(term: string, short = false): string {
  const [year, kind] = term.split("-").map(Number);
  if (kind === 1) return `${year}-2`;
  if (kind === 2 && short) return `${year}-3`;
  return `${year + 1}-1`;
}

/** The Student's semester number in a regular term (1 = the entry term); null for a short semester. */
export function semesterOf(term: string, entryTerm: string | null): number | null {
  if (!entryTerm || termKind(term) === "short") return null;
  const [year, kind] = term.split("-").map(Number);
  const [entryYear, entryKind] = entryTerm.split("-").map(Number);
  return (year - entryYear) * 2 + (kind - Math.min(entryKind, 2)) + 1;
}

// ------------------------------------------------------------ the Student's record

export interface CourseInfo {
  code: string;
  name: string;
  sks: number;
  /** The program running it (SIX's number, "182"), when known. */
  owner: string | null;
}

export interface RequiredCourse {
  code: string;
  name: string;
  sks: number;
  /** The curriculum's recommended semester. */
  semester: number;
}

export interface TermCourseRecord {
  code: string;
  name: string;
  sks: number;
  /** The letter grade once SIX shows it. */
  grade: LetterGrade | null;
}

export interface MinorOption {
  /** "<program> · <name>": how the plan names it. */
  key: string;
  name: string;
  program: string;
  sks: number | null;
  note: string | null;
  courses: string[];
}

export interface StudentRecord {
  transcript: Transcript | undefined;
  progress: Progress | undefined;
  curriculum: Curriculum | undefined;
  /** The term in progress ("2026-1"). */
  term: string | null;
  entryTerm: string | null;
  semesterNow: number | null;
  graduationSks: number;
  normalSemesters: number;
  /** The program's code and name ("182", "Sistem dan Teknologi Informasi"). */
  program: { code: string; name: string } | null;
  thisTerm: TermCourseRecord[];
  /** KRS courses the Student left out of this term as a what-if, and the codes of those they added (see `withWhatIf`); empty in SIX's own record. */
  thisTermDropped: TermCourseRecord[];
  thisTermAdded: string[];
  /** SKS passed, as SIX counts them (exempt courses included). */
  passedSks: number;
  /** This term's SKS still without a grade. */
  inProgressSks: number;
  /** Each course's newest grade that counts in the IPK. */
  graded: Map<string, { name: string; sks: number; grade: LetterGrade; term: string }>;
  /** Courses SIX credits without a grade. */
  exempt: Set<string>;
  /** A course was already taken again: summa cum laude is out. */
  retookBefore: boolean;
  /** The curriculum's required courses by code. */
  required: Map<string, RequiredCourse>;
  /** Where each of them stands for the Student, the Student's corrections applied. */
  slots: Map<string, SlotStanding>;
  /** Required courses still to take (SIX's graduation progress), failed ones included, less those the Student corrected. */
  requiredLeft: RequiredCourse[];
  /** Elective SKS the program needs (graduation SKS minus required), and those passed or in progress. */
  electiveNeed: number | null;
  electiveHave: number;
  /** Of `electiveHave`: passed (or credited) and this term's. */
  electivePassed: number;
  electiveInProgress: number;
  /** The specialization the Student registered for, as the curriculum lists it. */
  specialization: CoursePackage | null;
  minors: MinorOption[];
  /** Minor the Student registered for, when any. */
  registeredMinor: string | null;
  courses: Map<string, CourseInfo>;
  /** Program names by SIX's number, from the catalog. */
  programNames: Map<string, string>;
}

export interface RecordInput {
  transcript?: Transcript;
  progress?: Progress;
  curriculum?: Curriculum;
  catalog?: CourseCatalog;
  /** The current term as SIX says it (six.student), else the KRS's; else the transcript's latest. */
  term?: string | null;
  /** This term's courses when the transcript doesn't list the term yet (SIX's status page). */
  termCourses?: readonly { code: string; name: string; sks: number }[];
  /** The Student's corrections to the curriculum, by course code ("local.curriculum"). */
  fixes?: Readonly<Record<string, CurriculumFix>>;
}

const passedGrade = (grade: string | null): grade is LetterGrade => isLetterGrade(grade) && grade !== "E";
/** This term's SKS still without a grade; retaking a course passed before adds none (as for a planned retake). */
const newSks = (thisTerm: readonly TermCourseRecord[], graded: StudentRecord["graded"]) =>
  thisTerm.filter((c) => c.grade === null && !passedGrade(graded.get(c.code)?.grade ?? null)).reduce((sum, c) => sum + c.sks, 0);
const ELECTIVE = new Set(["program-elective", "outside-elective"]);

export function studentRecord(input: RecordInput): StudentRecord {
  const { transcript, progress, curriculum, catalog } = input;
  const terms = transcript?.terms ?? [];
  // Without SIX's own word, the transcript's latest term is this one (until the next starts, the finished one).
  const term = input.term ?? terms.at(-1)?.term ?? null;
  const entryTerm = progress?.entryTerm ?? terms[0]?.term ?? null;

  const inTranscript = terms.find((t) => t.term === term);
  const thisTerm: TermCourseRecord[] = inTranscript
    ? inTranscript.courses.map((c) => ({ code: c.code, name: c.name, sks: c.sks, grade: isLetterGrade(c.grade) ? c.grade : null }))
    : (input.termCourses ?? []).map((c) => ({ ...c, grade: null }));

  const graded = new Map<string, { name: string; sks: number; grade: LetterGrade; term: string }>();
  for (const t of terms)
    for (const c of t.courses)
      if (c.standing === "counted" && isLetterGrade(c.grade)) graded.set(c.code, { name: c.name, sks: c.sks, grade: c.grade, term: t.term });
  const rows = terms.flatMap((t) => t.courses);

  const progressRows: ProgressRow[] = (progress?.stages ?? []).flatMap((stage) =>
    stage.semesters.flatMap((s) => s.courses.map((c) => ({ ...c, semester: s.semester }))),
  );
  const exempt = new Set(progressRows.filter((c) => c.status === "exempt").map((c) => c.code));

  const courses = new Map<string, CourseInfo>();
  const know = (code: string, name: string, sks: number, owner: string | null, override = true) => {
    if (override || !courses.has(code)) courses.set(code, { code, name, sks, owner: owner ?? courses.get(code)?.owner ?? null });
  };
  for (const c of catalog?.courses ?? []) know(c.code, c.name, c.sks, c.owner);
  const programCode = curriculum?.program.code ?? null;
  for (const c of curriculum?.catalog ?? []) know(c.code, c.name, c.sks, programCode);
  for (const c of curriculum?.required ?? []) know(c.code, c.name, c.sks, courses.get(c.code)?.owner ?? null);
  for (const pkg of [...(curriculum?.specializations ?? []), ...(curriculum?.minors ?? [])])
    for (const c of pkg.courses) know(c.code, c.name, c.sks, null, false);
  for (const c of [...rows, ...progressRows, ...thisTerm]) know(c.code, c.name, c.sks, null, false);

  const required = new Map((curriculum?.required ?? []).map((c) => [c.code, { code: c.code, name: c.name, sks: c.sks, semester: c.semester }]));
  const slots = slotStandings({ slots: [...required.values()], rows: progress ? progressRows : null, graded, thisTerm, fixes: input.fixes ?? {} });
  // Courses filling a slot under another code count there, never also as electives.
  const filling = new Set([...slots.values()].flatMap((s) => (s.via ? [s.via.code] : [])));
  const thisTermCodes = new Set(thisTerm.map((c) => c.code));
  const requiredLeft: RequiredCourse[] = [];
  if (progress) {
    // A course the Student corrected (not in their curriculum, done, or counted as another) is no longer left, whatever SIX lists.
    const corrected = (code: string) => {
      const slot = [...required.keys()].find((s) => fillsSlot(s, code));
      const standing = slot === undefined ? undefined : slots.get(slot);
      return Boolean(standing?.fix) && standing?.status !== "left" && standing?.status !== "failed";
    };
    for (const row of progressRows) {
      if (row.kind !== "required" || requiredLeft.some((c) => c.code === row.code) || corrected(row.code)) continue;
      const failed = row.status === "graded" && row.grade === "E" && !thisTermCodes.has(row.code);
      if (row.status === "not-taken" || failed) requiredLeft.push({ code: row.code, name: row.name, sks: row.sks, semester: row.semester });
    }
  } else {
    for (const c of required.values()) {
      const status = slots.get(c.code)?.status;
      if (status === "left" || status === "failed") requiredLeft.push(c);
    }
  }

  const requiredSks = curriculum ? curriculum.required.reduce((sum, c) => sum + c.sks, 0) : null;
  const graduationSks = curriculum?.graduationSks ?? DEFAULT_GRADUATION_SKS;
  const electiveRows = progressRows.filter((c) => ELECTIVE.has(c.kind) && !filling.has(c.code));
  const sksOf = (list: { sks: number }[]) => list.reduce((sum, c) => sum + c.sks, 0);
  // A graded elective without a letter yet is this term's, as SIX lists it.
  const electivePassed = progress
    ? sksOf(electiveRows.filter((c) => c.status === "exempt" || (c.status === "graded" && passedGrade(c.grade))))
    : sksOf([...graded.entries()].filter(([code, g]) => !required.has(code) && !filling.has(code) && passedGrade(g.grade)).map(([, g]) => g));
  const electiveInProgress = progress ? sksOf(electiveRows.filter((c) => c.status === "in-progress" || (c.status === "graded" && !isLetterGrade(c.grade)))) : 0;
  const electiveHave = electivePassed + electiveInProgress;

  const registration = (kind: "specialization" | "minor") => curriculum?.registrations.find((r) => r.kind === kind)?.name.toLowerCase() ?? null;
  const specName = registration("specialization");
  const specialization = curriculum?.specializations.find((s) => s.name.toLowerCase() === specName) ?? null;
  const minors: MinorOption[] = curriculum?.minors.length
    ? curriculum.minors.map((m) => ({
        key: `${m.program} · ${m.name}`,
        name: m.name,
        program: m.program,
        sks: m.sks,
        note: m.note,
        courses: m.courses.map((c) => c.code),
      }))
    : (catalog?.minors ?? []).map((m) => ({ key: `${m.program} · ${m.name}`, name: m.name, program: m.program, sks: m.sks, note: null, courses: m.courses }));
  const minorName = registration("minor");
  const programName = curriculum ? curriculum.program.name.replace(/^S1\s+/i, "") : null;

  return {
    transcript,
    progress,
    curriculum,
    term,
    entryTerm,
    semesterNow: term ? semesterOf(term, entryTerm) : null,
    graduationSks,
    normalSemesters: curriculum?.semesters ?? DEFAULT_SEMESTERS,
    program: curriculum && programName ? { code: curriculum.program.code, name: programName } : null,
    thisTerm,
    thisTermDropped: [],
    thisTermAdded: [],
    passedSks: progress?.sksPassed ?? [...graded.values()].filter((g) => passedGrade(g.grade)).reduce((sum, g) => sum + g.sks, 0),
    inProgressSks: newSks(thisTerm, graded),
    graded,
    exempt,
    retookBefore: rows.some((c) => c.attempt > 1 || c.standing === "replaced"),
    required,
    slots,
    requiredLeft,
    electiveNeed: requiredSks === null ? null : Math.max(0, graduationSks - requiredSks),
    electiveHave,
    electivePassed,
    electiveInProgress,
    specialization,
    minors,
    registeredMinor: minors.find((m) => m.name.toLowerCase() === minorName)?.key ?? null,
    courses,
    programNames: new Map([
      ...(catalog?.programs ?? []).map((p) => [p.id, p.name] as const),
      ...(curriculum && programName ? [[curriculum.program.code, programName] as const] : []),
    ]),
  };
}

export const courseInfo = (record: StudentRecord, code: string): CourseInfo => record.courses.get(code) ?? { code, name: code, sks: 0, owner: null };

/** Where a course stands for the Student, as the search shows it. */
export type CourseState = "passed" | "this-term" | "exempt" | "planned" | null;

export function courseState(record: StudentRecord, plan: StudyPlan, code: string): CourseState {
  if (record.thisTerm.some((c) => c.code === code)) return "this-term";
  if (plan.terms.some((t) => t.courses.some((c) => c.code === code))) return "planned";
  if (passedGrade(record.graded.get(code)?.grade ?? null)) return "passed";
  if (record.exempt.has(code)) return "exempt";
  return null;
}

export type CourseRole = "required" | "specialization" | "minor" | "program-elective" | "outside-elective";

/** A course's role for the Student; `specialization` is the one they still follow (see `activeSpecialization`). */
export function courseRole(record: StudentRecord, code: string, minor: MinorOption | null, specialization = record.specialization): CourseRole {
  if (record.required.has(code) || record.requiredLeft.some((c) => c.code === code)) return "required";
  if (specialization?.courses.some((c) => c.code === code)) return "specialization";
  if (minor?.courses.includes(code)) return "minor";
  const owner = courseInfo(record, code).owner;
  return owner !== null && owner === record.program?.code ? "program-elective" : "outside-elective";
}

// ------------------------------------------------------------ the plan

/**
 * The plan as it's kept: the terms still ahead (a plan made last term drops
 * what has started), and this term's what-ifs only while it lasts. A term
 * that has ended takes its what-ifs with it: a course only tried in it (not
 * on SIX's transcript for it) goes back to the semester it was planned in.
 */
export function aheadPlan(plan: StudyPlan, record: StudentRecord): StudyPlan {
  const ended = plan.now && plan.now.term !== record.term ? plan.now : null;
  const took = (code: string) => (record.transcript?.terms ?? []).some((t) => t.term >= ended!.term && t.courses.some((c) => c.code === code));
  const kept = ended ? ended.added.filter((c) => !took(c.code)).reduce((p, c) => placeBack(p, c, record.term ?? ended.term), plan) : plan;
  const ahead = record.term ? kept.terms.filter((t) => t.term > record.term!) : kept.terms;
  const { now, ...rest } = kept;
  return { ...rest, ...(now && !ended ? { now } : {}), terms: [...ahead].sort((a, b) => a.term.localeCompare(b.term)) };
}

/**
 * The plan as every figure reads it: `aheadPlan`, less what the Student has
 * taken already. A course is taken once: one in this term (SIX's KRS, or a
 * what-if a plan saved before `from` still holds later too), passed or
 * credited isn't planned again, so a later copy (planned, then taken for
 * real) neither shows nor counts its SKS twice. A retake planned for later stays.
 */
export function livePlan(plan: StudyPlan, record: StudentRecord): StudyPlan {
  const ahead = aheadPlan(plan, record);
  const now = new Set(record.thisTerm.map((c) => c.code));
  const taken = (code: string) => now.has(code) || passedGrade(record.graded.get(code)?.grade ?? null) || record.exempt.has(code);
  return { ...ahead, terms: ahead.terms.map((t) => ({ ...t, courses: t.courses.filter((c) => c.retake || !taken(c.code)) })) };
}

// ------------------------------------------------------------ this term's what-ifs

/** Whether the plan's what-ifs still change this term (one SIX has caught up with changes nothing). Takes SIX's record or one with the what-ifs. */
export function hasWhatIfs(plan: StudyPlan, record: StudentRecord): boolean {
  const applied = withWhatIf(record, plan);
  return applied.thisTermAdded.length > 0 || applied.thisTermDropped.length > 0;
}

/**
 * The plan without what-ifs SIX's record has caught up with: a course since
 * added to the KRS, or one left out that SIX graded or dropped. A course SIX
 * added goes back to the semester it was planned in: `livePlan` hides it while
 * it's in the KRS (or passed), and a drop on SIX later doesn't lose it.
 */
export function pruneWhatIfs(plan: StudyPlan, record: StudentRecord): StudyPlan {
  const { now, ...rest } = plan;
  if (!now) return plan;
  const inKrs = (code: string) => record.thisTerm.some((t) => t.code === code);
  const added = now.added.filter((c) => !inKrs(c.code));
  const dropped = now.dropped.filter((code) => record.thisTerm.some((t) => t.code === code && t.grade === null));
  if (added.length === now.added.length && dropped.length === now.dropped.length) return plan;
  const kept = now.added.filter((c) => inKrs(c.code)).reduce<StudyPlan>((p, c) => placeBack(p, c, now.term), rest);
  return added.length || dropped.length ? { ...kept, now: { ...now, added, dropped } } : kept;
}

/**
 * This term as the Student's what-ifs make it, only in the plan: courses
 * added, KRS courses left out (never one SIX already graded). Everything that
 * reads the record (IP and IPK, SKS, the rules, the curriculum) then counts
 * it without knowing; SIX's own record, as Nilai shows it, is left alone.
 */
export function withWhatIf(record: StudentRecord, plan: StudyPlan): StudentRecord {
  const now = plan.now;
  if (!now || !record.term || now.term !== record.term) return record;
  const dropped = record.thisTerm.filter((c) => c.grade === null && now.dropped.includes(c.code));
  const added = now.added.filter((c) => !record.thisTerm.some((t) => t.code === c.code)).map((c) => ({ ...c, grade: null }));
  if (!dropped.length && !added.length) return record;
  const gone = new Set(dropped.map((c) => c.code));
  const thisTerm = [...record.thisTerm.filter((c) => !gone.has(c.code)), ...added];

  const slotCodes = [...record.required.keys()];
  /** The required course a course fills: its own code, or the one it stands in for. */
  const slotOf = (code: string) => slotCodes.find((s) => fillsSlot(s, code)) ?? slotCodes.find((s) => record.slots.get(s)?.via?.code === code);
  const slots = new Map(record.slots);
  let requiredLeft = record.requiredLeft;
  for (const c of dropped) {
    const slot = slotOf(c.code);
    const standing = slot === undefined ? undefined : slots.get(slot);
    if (slot === undefined || !standing || (standing.status !== "in-progress" && standing.status !== "failed")) continue;
    // Not retaking after all: a grade from before stands; without one, or with an E, it's left again.
    const before = record.graded.get(c.code);
    if (before && passedGrade(before.grade)) {
      slots.set(slot, { ...standing, status: "passed", grade: before.grade, whatIf: "left-out" });
      continue;
    }
    slots.set(
      slot,
      before
        ? { ...standing, status: "failed", grade: before.grade, whatIf: "left-out" }
        : { ...standing, status: "left", grade: null, via: null, whatIf: "left-out" },
    );
    if (!requiredLeft.some((r) => r.code === slot || r.code === c.code)) requiredLeft = [...requiredLeft, record.required.get(slot)!];
  }
  for (const c of added) {
    requiredLeft = requiredLeft.filter((r) => r.code !== c.code && !fillsSlot(r.code, c.code));
    const slot = slotOf(c.code);
    const standing = slot === undefined ? undefined : slots.get(slot);
    if (slot !== undefined && standing && ["left", "unlisted", "failed"].includes(standing.status))
      slots.set(slot, { ...standing, status: "in-progress", grade: null, via: c.code === slot ? null : { code: c.code, name: c.name }, whatIf: "added" });
  }

  // Electives: SIX counts this term's in its progress; a what-if elective counts the same way.
  const sixNow = new Set(
    (record.progress?.stages ?? [])
      .flatMap((stage) => stage.semesters.flatMap((sem) => sem.courses))
      .filter((c) => ELECTIVE.has(c.kind) && (c.status === "in-progress" || (c.status === "graded" && !isLetterGrade(c.grade))))
      .map((c) => c.code),
  );
  const isRequired = (code: string) => slotOf(code) !== undefined || record.requiredLeft.some((r) => r.code === code);
  const sum = (list: { sks: number }[]) => list.reduce((total, c) => total + c.sks, 0);
  const electiveInProgress =
    record.electiveInProgress - sum(dropped.filter((c) => sixNow.has(c.code))) + sum(added.filter((c) => !isRequired(c.code) && !record.graded.has(c.code)));

  const courses = new Map(record.courses);
  for (const c of added) if (!courses.has(c.code)) courses.set(c.code, { code: c.code, name: c.name, sks: c.sks, owner: null });
  return {
    ...record,
    thisTerm,
    thisTermDropped: dropped,
    thisTermAdded: added.map((c) => c.code),
    inProgressSks: newSks(thisTerm, record.graded),
    // Taking a graded course again this term is a retake: summa cum laude closes, as for a planned one.
    retookBefore: record.retookBefore || added.some((c) => record.graded.has(c.code)),
    slots,
    requiredLeft,
    electiveInProgress,
    electiveHave: record.electivePassed + electiveInProgress,
    courses,
  };
}

const nowOf = (plan: StudyPlan, term: string) => (plan.now?.term === term ? plan.now : { term, added: [], dropped: [] });

/**
 * Adds a course to this term as a what-if; a KRS course left out comes back
 * instead. A course is taken once: one planned for a later semester moves out
 * of it, and the what-if remembers where it was (see `removeTried`).
 */
export function addToNow(plan: StudyPlan, term: string, course: WhatIfCourse): StudyPlan {
  const now = nowOf(plan, term);
  if (now.dropped.includes(course.code)) return { ...plan, now: { ...now, dropped: now.dropped.filter((c) => c !== course.code) } };
  const at = plan.terms.find((t) => t.courses.some((c) => c.code === course.code));
  const planned = at?.courses.find((c) => c.code === course.code);
  const from = at && planned ? { term: at.term, grade: planned.grade, retake: planned.retake } : now.added.find((c) => c.code === course.code)?.from;
  const tried: WhatIfCourse = { code: course.code, name: course.name, sks: course.sks, ...(from ? { from } : {}) };
  return {
    ...plan,
    terms: plan.terms.map((t) => (t === at ? { ...t, courses: t.courses.filter((c) => c.code !== course.code) } : t)),
    now: { ...now, added: [...now.added.filter((c) => c.code !== course.code), tried] },
  };
}

/**
 * Puts a course tried now back where it was planned: its semester, or, when
 * that one is gone (or over), the last regular one planned after `after`, a
 * new one when none is left. A course that wasn't planned goes nowhere.
 */
function placeBack(plan: StudyPlan, tried: WhatIfCourse, after: string): StudyPlan {
  const { from } = tried;
  if (!from || plan.terms.some((t) => t.courses.some((c) => c.code === tried.code))) return plan;
  const later = plan.terms.filter((t) => t.term > after);
  const back = later.some((t) => t.term === from.term) ? from.term : (later.filter((t) => termKind(t.term) !== "short").at(-1)?.term ?? nextTerm(after));
  const terms = plan.terms.some((t) => t.term === back)
    ? plan.terms
    : [...plan.terms, { term: back, courses: [] }].sort((a, b) => a.term.localeCompare(b.term));
  const course: PlannedCourse = { code: tried.code, name: tried.name, sks: tried.sks, grade: from.grade, retake: from.retake };
  return { ...plan, terms: terms.map((t) => (t.term === back ? { ...t, courses: [...t.courses, course] } : t)) };
}

/** Removes a course the Student added to this term as a what-if; one that was planned for later goes back there (see `placeBack`). */
export function removeTried(plan: StudyPlan, term: string, code: string): StudyPlan {
  const now = nowOf(plan, term);
  const tried = now.added.find((c) => c.code === code);
  const rest: StudyPlan = { ...plan, now: { ...now, added: now.added.filter((c) => c.code !== code) } };
  return tried ? placeBack(rest, tried, term) : rest;
}

/**
 * The plan as SIX's own record reads it (Nilai, and what a reset compares):
 * each course tried this term back in the semester it was planned in. The
 * what-ifs stay, so a screen can still say it leaves them out.
 */
export function untried(plan: StudyPlan): StudyPlan {
  const { now } = plan;
  return now ? now.added.reduce((p, c) => placeBack(p, c, now.term), plan) : plan;
}

/** Leaves a KRS course out of this term as a what-if. */
export function leaveOut(plan: StudyPlan, term: string, code: string): StudyPlan {
  const now = nowOf(plan, term);
  return { ...plan, now: { term, added: now.added.filter((c) => c.code !== code), dropped: [...now.dropped.filter((c) => c !== code), code] } };
}

/** Puts a KRS course that was left out back into this term. */
export function putBack(plan: StudyPlan, term: string, code: string): StudyPlan {
  const now = nowOf(plan, term);
  return { ...plan, now: { ...now, dropped: now.dropped.filter((c) => c !== code) } };
}

/** Where each planned course sits: code → term. */
export function plannedCodes(plan: StudyPlan): Map<string, string> {
  return new Map(plan.terms.flatMap((t) => t.courses.map((c) => [c.code, t.term] as const)));
}

/**
 * A starting plan: the regular semesters up to the program's normal length,
 * each required course left in its recommended semester (or the next one when
 * that has passed), and what the registered specialization still needs in the
 * first. Grades start at the Student's usual level.
 */
export function defaultPlan(record: StudentRecord, hidden?: StudyPlan["hidden"]): StudyPlan {
  // Hidden warnings describe the Student, not the plan: a fresh plan keeps them.
  const empty: StudyPlan = { terms: [], expected: {}, target: null, minor: record.registeredMinor, ...(hidden ? { hidden } : {}) };
  if (!record.term) return empty;
  const grade = nearestLetter(record.transcript?.ipk.computed ?? null);
  const terms: { term: string; semester: number }[] = [];
  let term = nextTerm(record.term);
  let semester = record.semesterNow === null ? null : record.semesterNow + 1;
  do {
    terms.push({ term, semester: semester ?? terms.length + 1 });
    term = nextTerm(term);
    semester = semester === null ? null : semester + 1;
  } while (semester !== null && semester <= record.normalSemesters);
  const items = new Map(terms.map((t) => [t.term, [] as PlannedCourse[]]));
  const place = (code: string, at: string) => {
    const info = courseInfo(record, code);
    items.get(at)?.push({ code, name: info.name, sks: info.sks, grade, retake: false });
  };
  for (const course of record.requiredLeft) {
    const at = terms.find((t) => t.semester >= course.semester) ?? terms[terms.length - 1];
    place(course.code, at.term);
  }
  const taken = (code: string) =>
    passedGrade(record.graded.get(code)?.grade ?? null) ||
    record.thisTerm.some((c) => c.code === code) ||
    [...items.values()].some((list) => list.some((c) => c.code === code));
  for (const course of activeSpecialization(record, empty)?.courses ?? []) {
    if (taken(course.code)) continue;
    const at = terms.find((t) => (items.get(t.term) ?? []).reduce((sum, c) => sum + c.sks, 0) + course.sks <= NORMAL_SKS) ?? terms[terms.length - 1];
    place(course.code, at.term);
  }
  return { ...empty, terms: terms.map((t) => ({ term: t.term, courses: items.get(t.term) ?? [] })) };
}

export function setTermCourses(plan: StudyPlan, term: string, edit: (courses: PlannedCourse[]) => PlannedCourse[]): StudyPlan {
  return { ...plan, terms: plan.terms.map((t) => (t.term === term ? { ...t, courses: edit(t.courses) } : t)) };
}

/** Adds a course to a term; a course is planned once, so it moves from another term. */
export function addCourse(plan: StudyPlan, term: string, course: PlannedCourse): StudyPlan {
  return {
    ...plan,
    terms: plan.terms.map((t) => ({ ...t, courses: [...t.courses.filter((c) => c.code !== course.code), ...(t.term === term ? [course] : [])] })),
  };
}

export const removeCourse = (plan: StudyPlan, term: string, code: string) => setTermCourses(plan, term, (courses) => courses.filter((c) => c.code !== code));

export const setGrade = (plan: StudyPlan, term: string, code: string, grade: LetterGrade) =>
  setTermCourses(plan, term, (courses) => courses.map((c) => (c.code === code ? { ...c, grade } : c)));

/** The next regular semester after the plan's last one. */
export function addTerm(plan: StudyPlan, record: StudentRecord): StudyPlan {
  const regular = [record.term, ...plan.terms.map((t) => t.term)].filter((t): t is string => t !== null && termKind(t) !== "short").sort();
  const last = regular[regular.length - 1];
  if (!last) return plan;
  return { ...plan, terms: [...plan.terms, { term: nextTerm(last), courses: [] }].sort((a, b) => a.term.localeCompare(b.term)) };
}

/** The first short semester that can still be added: after an even semester, this one or a planned one. */
export function shortTermToAdd(plan: StudyPlan, record: StudentRecord): string | null {
  const planned = new Set(plan.terms.map((t) => t.term));
  const evens = [record.term, ...plan.terms.map((t) => t.term)].filter((t): t is string => t !== null && termKind(t) === "even").sort();
  return evens.map((t) => nextTerm(t, true)).find((t) => !planned.has(t) && (!record.term || t > record.term)) ?? null;
}

export function addShortTerm(plan: StudyPlan, record: StudentRecord): StudyPlan {
  const term = shortTermToAdd(plan, record);
  return term ? { ...plan, terms: [...plan.terms, { term, courses: [] }].sort((a, b) => a.term.localeCompare(b.term)) } : plan;
}

/** A short semester, or the last regular one: removing a middle semester would leave a gap. */
export function canRemoveTerm(plan: StudyPlan, term: string): boolean {
  if (termKind(term) === "short") return true;
  const regular = plan.terms.map((t) => t.term).filter((t) => termKind(t) !== "short");
  return regular[regular.length - 1] === term;
}

export function removeTerm(plan: StudyPlan, term: string): StudyPlan {
  return canRemoveTerm(plan, term) ? { ...plan, terms: plan.terms.filter((t) => t.term !== term) } : plan;
}

// ------------------------------------------------------------ the projection

export interface ProjectedStep {
  term: string;
  semester: number | null;
  sks: number;
  /** The term's IP, shown as SIX shows it for past terms. */
  ip: number | null;
  /** The IPK once the term is done. */
  ipk: number | null;
  /** From expected grades (this term while grades are missing, and planned terms). */
  projected: boolean;
}

export type Need =
  /** Reached whatever the grades still to come. */
  | { kind: "secured" }
  /** The average grade points the courses still to be graded need. */
  | { kind: "needs"; average: number }
  /** Not even straight A's reach it. */
  | { kind: "out" }
  /** Nothing is left to grade. */
  | { kind: "none" };

export interface Projection {
  steps: ProjectedStep[];
  /** The IPK at graduation, as SIX would round it. */
  finalIpk: number | null;
  /** The semester the Student graduates in, from the plan's last semester with courses. */
  finishSemester: number | null;
  path: Path;
  honor: HonorLevel | null;
  /** SKS still to be graded: this term's courses without a grade and every planned one. */
  variableSks: number;
  /** The highest IPK still possible: an A in everything still to be graded. */
  bestIpk: number | null;
  /** The average the rest needs for an IPK. */
  need(target: number): Need;
}

/** This term's expected grade for a course: the one the Student picked, else their usual level. */
export function expectedGrade(record: StudentRecord, plan: StudyPlan, code: string): LetterGrade {
  return plan.expected[code] ?? nearestLetter(record.transcript?.ipk.computed ?? null);
}

/**
 * The transcript, this term at the grades posted or expected, then each
 * planned semester in order. A retake replaces the older grade (only the
 * newest counts), exactly as SIX computes the IPK.
 */
export function project(record: StudentRecord, rawPlan: StudyPlan): Projection {
  const plan = livePlan(rawPlan, record);
  const { transcript } = record;
  const ipkWith = (targets: { code: string; sks: number; grade: LetterGrade }[]): IndexSum =>
    transcript ? projectIpk(transcript, targets) : cumulativeIndex(targets);
  const steps: ProjectedStep[] = [];

  // Past terms: SIX's IP, and the IPK the rows make after each.
  const attempts: { code: string; sks: number; grade: string | null }[] = [];
  for (const t of transcript?.terms ?? []) {
    if (record.term && t.term >= record.term) break;
    attempts.push(...t.courses.filter((c) => c.standing === "counted" || c.standing === "replaced"));
    const ip = t.ip.six ?? t.ip.computed;
    if (ip === null) continue;
    steps.push({ term: t.term, semester: semesterOf(t.term, record.entryTerm), sks: t.sks, ip, ipk: cumulativeIndex(attempts).value, projected: false });
  }

  const targets: { code: string; sks: number; grade: LetterGrade }[] = [];
  if (record.term && record.thisTerm.length) {
    const now = record.thisTerm.map((c) => ({ code: c.code, sks: c.sks, grade: c.grade ?? expectedGrade(record, plan, c.code) }));
    targets.push(...now);
    steps.push({
      term: record.term,
      semester: record.semesterNow,
      sks: now.reduce((sum, c) => sum + c.sks, 0),
      ip: termIndex(now).value,
      ipk: ipkWith(targets).value,
      projected: record.thisTerm.some((c) => c.grade === null),
    });
  }
  for (const t of plan.terms) {
    targets.push(...t.courses);
    steps.push({
      term: t.term,
      semester: semesterOf(t.term, record.entryTerm),
      sks: t.courses.reduce((sum, c) => sum + c.sks, 0),
      ip: termIndex(t.courses).value,
      ipk: ipkWith(targets).value,
      projected: true,
    });
  }

  const finalIpk = targets.length ? ipkWith(targets).value : (transcript?.ipk.computed ?? null);
  const lastPlanned = [...plan.terms].reverse().find((t) => termKind(t.term) !== "short" && t.courses.length);
  const finishSemester = lastPlanned
    ? semesterOf(lastPlanned.term, record.entryTerm)
    : record.thisTerm.length
      ? record.semesterNow
      : (steps.at(-1)?.semester ?? null);
  const path: Path = { retakes: record.retookBefore || plan.terms.some((t) => t.courses.some((c) => c.retake)), semesters: finishSemester };

  // Fixed: what's graded and stays (a planned retake takes its course out). Variable: still to be graded.
  const fixed = new Map<string, { sks: number; grade: LetterGrade }>();
  for (const [code, g] of record.graded) fixed.set(code, g);
  for (const c of record.thisTerm) if (c.grade) fixed.set(c.code, { sks: c.sks, grade: c.grade });
  const variable = new Map<string, number>();
  for (const c of record.thisTerm) if (!c.grade) variable.set(c.code, c.sks);
  for (const t of plan.terms) for (const c of t.courses) variable.set(c.code, c.sks);
  for (const code of variable.keys()) fixed.delete(code);
  let points = 0;
  let sks = 0;
  for (const g of fixed.values()) {
    points += GRADE_POINTS[g.grade] * g.sks;
    sks += g.sks;
  }
  const variableSks = [...variable.values()].reduce((sum, v) => sum + v, 0);

  return {
    steps,
    finalIpk,
    finishSemester,
    path,
    honor: honorFor(finalIpk, path),
    variableSks,
    bestIpk: variableSks ? roundIndex(points + GRADE_POINTS.A * variableSks, sks + variableSks) : finalIpk,
    need(target) {
      if (variableSks === 0) return { kind: "none" };
      const average = (target * (sks + variableSks) - points) / variableSks;
      if (average <= 1e-9) return { kind: "secured" };
      if (average > 4 + 1e-9) return { kind: "out" };
      return { kind: "needs", average: Math.ceil(average * 100 - 1e-6) / 100 };
    },
  };
}

export type HonorOutlook = { level: HonorLevel; min: number } & ({ kind: "blocked"; reason: "time" | "retake" } | Need);

/** Each honors level: reached, what the rest needs, out of reach, or ruled out (a retake, too many semesters). */
export function honorsOutlook(projection: Projection): HonorOutlook[] {
  return HONORS.map(({ level, min }) => {
    const reason = blockedBy(level, projection.path);
    return reason ? { level, min, kind: "blocked", reason } : { level, min, ...projection.need(min) };
  });
}

// ------------------------------------------------------------ retakes

export interface RetakeCandidate {
  code: string;
  name: string;
  sks: number;
  grade: LetterGrade;
  /** The IPK now, and with an A in the retake. */
  ipkNow: number | null;
  ipkWithA: number | null;
}

/** Courses passed with C or BC: retaking one replaces its grade (and rules out summa cum laude). Biggest gain first; `sks` is the course's SKS now. */
export function retakeCandidates(record: StudentRecord): RetakeCandidate[] {
  const { transcript } = record;
  if (!transcript) return [];
  const now = projectIpk(transcript, []).value;
  return [...record.graded.entries()]
    .filter(([code, g]) => (g.grade === "C" || g.grade === "BC") && !record.thisTerm.some((c) => c.code === code))
    .map(([code, g]) => {
      // Taken again, it's the course as the catalog has it now (its SKS can differ from the old curriculum's).
      const sks = record.courses.get(code)?.sks ?? g.sks;
      return { code, name: g.name, sks, grade: g.grade, ipkNow: now, ipkWithA: projectIpk(transcript, [{ code, sks, grade: "A" }]).value };
    })
    .sort((a, b) => (b.ipkWithA ?? 0) - (a.ipkWithA ?? 0) || a.code.localeCompare(b.code));
}

// ------------------------------------------------------------ rules

export type RuleLevel = "ok" | "warn" | "error";

export type Rule =
  | { id: "total"; level: RuleLevel; have: number; need: number }
  | {
      id: "required";
      level: RuleLevel;
      /** Required courses that apply to the Student (not those SIX doesn't ask of them or they marked not in their curriculum). */
      total: number | null;
      missing: { code: string; name: string }[];
      /** Courses SIX still lists as to take that the Student corrected. */
      corrected: { code: string; name: string }[];
    }
  | { id: "electives"; level: RuleLevel; have: number; need: number }
  | { id: "specialization"; level: RuleLevel; name: string; total: number; missing: { code: string; name: string }[] }
  | { id: "minor"; level: RuleLevel; name: string; have: number; need: number }
  | { id: "load"; level: RuleLevel; term: string; sks: number; limit: number }
  | { id: "parity"; level: RuleLevel; term: string; code: string; name: string; semester: number }
  | { id: "early"; level: RuleLevel; term: string; code: string; name: string; semester: number }
  | { id: "finish"; level: RuleLevel; semester: number; normal: number; blocked: Shortfall | null };

/** What still stands between the plan and graduating: SKS, required courses, elective SKS, other rules not met. */
export interface Shortfall {
  sks: number;
  required: number;
  electives: number;
  other: number;
}

/** SKS a minor's courses add up to for the Student: passed, this term or planned. */
export function minorCoverage(record: StudentRecord, plan: StudyPlan, minor: MinorOption): { have: number; codes: string[] } {
  const { passed, now, planned } = minorProgress(record, plan, minor);
  const counted = new Set<CourseState>(["passed", "this-term", "planned"]);
  return { have: passed + now + planned, codes: minor.courses.filter((code) => counted.has(courseState(record, plan, code))) };
}

/** A minor's SKS split the way the Student reads it: passed, this semester, planned. */
export function minorProgress(record: StudentRecord, plan: StudyPlan, minor: MinorOption): { passed: number; now: number; planned: number; need: number } {
  const sks = (state: CourseState) =>
    minor.courses.filter((code) => courseState(record, plan, code) === state).reduce((sum, code) => sum + courseInfo(record, code).sks, 0);
  return { passed: sks("passed"), now: sks("this-term"), planned: sks("planned"), need: minorNeed(record, minor) };
}

export const minorNeed = (record: StudentRecord, minor: MinorOption) => minor.sks ?? minor.courses.reduce((sum, code) => sum + courseInfo(record, code).sks, 0);

// ------------------------------------------------------------ hiding a warning

/**
 * The key a hidden warning is kept under, stable while the plan changes
 * (II4090's odd/even warning stays hidden wherever it's moved). Only warnings
 * can be hidden: what decides graduating can't (correct the curriculum instead).
 */
export function ruleKey(rule: Rule): string | null {
  if (rule.level !== "warn") return null;
  switch (rule.id) {
    case "specialization":
    case "minor":
      return `${rule.id}|${rule.name.toLowerCase()}`;
    case "parity":
    case "early":
      return `${rule.id}|${rule.code}`;
    case "load":
      return `load|${rule.term}`;
    case "finish":
      return "finish|late";
    default:
      return null;
  }
}

/** The reasons offered for hiding a warning, the likeliest first. */
export function hideReasons(rule: Rule): HideReason[] {
  if (rule.id === "specialization") return ["not-continuing", "other"];
  if (rule.id === "parity" || rule.id === "early") return ["program-adds", "other"];
  return ["other"];
}

export const isHidden = (rule: Rule, plan: StudyPlan) => {
  const key = ruleKey(rule);
  return key !== null && Boolean(plan.hidden?.[key]);
};

export const hideRule = (plan: StudyPlan, key: string, reason: HideReason, at: number): StudyPlan => ({
  ...plan,
  hidden: { ...plan.hidden, [key]: { reason, at } },
});

export function showRule(plan: StudyPlan, key: string): StudyPlan {
  const { [key]: _shown, ...rest } = plan.hidden ?? {};
  return { ...plan, hidden: rest };
}

/** The registered specialization, unless the Student said they aren't continuing it: then the planner stops offering and tagging its courses. */
export function activeSpecialization(record: StudentRecord, plan: Pick<StudyPlan, "hidden">): CoursePackage | null {
  const spec = record.specialization;
  return spec && plan.hidden?.[`specialization|${spec.name.toLowerCase()}`]?.reason === "not-continuing" ? null : spec;
}

/** Every rule the plan is checked against, live. */
export function checkPlan(record: StudentRecord, rawPlan: StudyPlan, projection: Projection): Rule[] {
  const plan = livePlan(rawPlan, record);
  const planned = plannedCodes(plan);
  const sks = sksModel(record, plan);
  const rules: Rule[] = [];

  rules.push({ id: "total", level: sks.short ? "error" : "ok", have: sks.total, need: sks.need });

  const missing = record.requiredLeft.filter((c) => !planned.has(c.code)).map(({ code, name }) => ({ code, name }));
  const standings = [...record.slots.entries()];
  const applies = standings.filter(([, s]) => s.status !== "unlisted" && s.status !== "not-mine").length;
  const corrected = standings.filter(([, s]) => s.sixLeft).map(([code]) => ({ code, name: record.required.get(code)?.name ?? code }));
  rules.push({ id: "required", level: missing.length ? "error" : "ok", total: record.curriculum ? applies : null, missing, corrected });

  if (record.electiveNeed !== null) {
    rules.push({ id: "electives", level: sks.electives.short ? "error" : "ok", have: sks.electives.have, need: record.electiveNeed });
  }

  if (record.specialization) {
    const spec = record.specialization;
    const covered = (code: string) => passedGrade(record.graded.get(code)?.grade ?? null) || record.thisTerm.some((c) => c.code === code) || planned.has(code);
    const gaps = spec.courses.filter((c) => !covered(c.code));
    const coveredSks = spec.courses.filter((c) => covered(c.code)).reduce((sum, c) => sum + c.sks, 0);
    const done = !gaps.length || (spec.sks !== null && coveredSks >= spec.sks);
    rules.push({
      id: "specialization",
      level: done ? "ok" : "warn",
      name: spec.name,
      total: spec.courses.length,
      missing: done ? [] : gaps.map(({ code, name }) => ({ code, name })),
    });
  }

  const minor = record.minors.find((m) => m.key === plan.minor);
  if (minor) {
    const need = minorNeed(record, minor);
    const { have: minorSks } = minorCoverage(record, plan, minor);
    rules.push({ id: "minor", level: minorSks >= need ? "ok" : "warn", name: minor.name, have: minorSks, need });
  }

  // This term counts too once the Student changed it: its load, and the courses they added.
  const whatIf = record.term && hasWhatIfs(rawPlan, record) ? record.term : null;
  const added = new Set(record.thisTermAdded);
  const terms = [
    ...(whatIf ? [{ term: whatIf, courses: record.thisTerm, sks: record.thisTerm.reduce((sum, c) => sum + c.sks, 0) }] : []),
    ...plan.terms.map((t) => ({ term: t.term, courses: t.courses, sks: t.courses.reduce((sum, c) => sum + c.sks, 0) })),
  ];
  for (const t of terms) {
    const sks = t.sks;
    const short = termKind(t.term) === "short";
    const limit = short ? SHORT_SKS : MAX_SKS;
    if (sks > limit) rules.push({ id: "load", level: "error", term: t.term, sks, limit });
    else if (!short && sks > NORMAL_SKS) rules.push({ id: "load", level: "warn", term: t.term, sks, limit: NORMAL_SKS });
    const semester = semesterOf(t.term, record.entryTerm);
    if (short) continue;
    for (const c of t.courses) {
      if (t.term === whatIf && !added.has(c.code)) continue;
      const recommended = record.required.get(c.code)?.semester ?? record.requiredLeft.find((r) => r.code === c.code)?.semester;
      if (recommended === undefined) continue;
      if (recommended % 2 !== (termKind(t.term) === "odd" ? 1 : 0))
        rules.push({ id: "parity", level: "warn", term: t.term, code: c.code, name: c.name, semester: recommended });
      else if (semester !== null && semester < recommended)
        rules.push({ id: "early", level: "warn", term: t.term, code: c.code, name: c.name, semester: recommended });
    }
  }

  // Graduating is one verdict: while any rule above is not met, there is no graduation semester to promise.
  if (projection.finishSemester !== null) {
    const semester = projection.finishSemester;
    const errors = rules.filter((r) => r.level === "error");
    const of = <I extends Rule["id"]>(id: I) => errors.find((r): r is Extract<Rule, { id: I }> => r.id === id);
    const total = of("total");
    const electives = of("electives");
    const blocked: Shortfall | null = errors.length
      ? {
          sks: total ? total.need - total.have : 0,
          required: of("required")?.missing.length ?? 0,
          electives: electives ? electives.need - electives.have : 0,
          other: errors.filter((r) => r.id !== "total" && r.id !== "required" && r.id !== "electives").length,
        }
      : null;
    rules.push({
      id: "finish",
      level: blocked ? "error" : semester <= record.normalSemesters ? "ok" : "warn",
      semester,
      normal: record.normalSemesters,
      blocked,
    });
  }
  return rules;
}

// ------------------------------------------------------------ SKS, one count for every screen

/**
 * The SKS picture Rencana, Kurikulum and Nilai all show, from one count:
 * what graduating needs (all, required, electives), and what the Student has
 * passed, takes this term and has planned. Retakes add no SKS.
 */
export interface SksModel {
  need: number;
  requiredNeed: number | null;
  electiveNeed: number | null;
  passed: number;
  inProgress: number;
  planned: number;
  /** passed + inProgress + planned. */
  total: number;
  /** SKS still missing to graduate, and SKS beyond what's needed. */
  short: number;
  extra: number;
  /** Required courses still to take, and those of them not in the plan. */
  requiredLeft: { count: number; sks: number };
  requiredUnplanned: { count: number; sks: number };
  electives: { passed: number; inProgress: number; planned: number; have: number; short: number; extra: number };
}

export function sksModel(record: StudentRecord, rawPlan: StudyPlan): SksModel {
  const plan = livePlan(rawPlan, record);
  const planned = plannedCodes(plan);
  const fresh = plan.terms.flatMap((t) => t.courses.filter((c) => !c.retake));
  const sum = (list: { sks: number }[]) => list.reduce((total, c) => total + c.sks, 0);
  const plannedSks = sum(fresh);
  const total = record.passedSks + record.inProgressSks + plannedSks;
  const left = new Set(record.requiredLeft.map((c) => c.code));
  const electivePlanned = sum(fresh.filter((c) => !left.has(c.code) && !record.required.has(c.code)));
  const electiveHave = record.electiveHave + electivePlanned;
  const unplanned = record.requiredLeft.filter((c) => !planned.has(c.code));
  const need = record.electiveNeed ?? 0;
  return {
    need: record.graduationSks,
    requiredNeed: record.electiveNeed === null ? null : record.graduationSks - record.electiveNeed,
    electiveNeed: record.electiveNeed,
    passed: record.passedSks,
    inProgress: record.inProgressSks,
    planned: plannedSks,
    total,
    short: Math.max(0, record.graduationSks - total),
    extra: Math.max(0, total - record.graduationSks),
    requiredLeft: { count: record.requiredLeft.length, sks: sum(record.requiredLeft) },
    requiredUnplanned: { count: unplanned.length, sks: sum(unplanned) },
    electives: {
      passed: record.electivePassed,
      inProgress: record.electiveInProgress,
      planned: electivePlanned,
      have: electiveHave,
      short: record.electiveNeed === null ? 0 : Math.max(0, need - electiveHave),
      extra: record.electiveNeed === null ? 0 : Math.max(0, electiveHave - need),
    },
  };
}

// ------------------------------------------------------------ the IPK target

/** A target the planner and Nilai accept: an IPK from 2,00 to 4,00. */
export const TARGET_MIN = 2;
export const TARGET_MAX = 4;
/** The quick picks; any other value can be typed. */
export const TARGET_PICKS = [3, 3.5, 3.75] as const;

/** What the Student typed as a target ("3,5" or "3.5"): a value, nothing yet, or out of range. */
export function parseTarget(text: string): { kind: "ok"; value: number } | { kind: "empty" } | { kind: "invalid" } {
  const clean = text.trim().replace(",", ".");
  if (!clean) return { kind: "empty" };
  const value = Number(clean);
  if (!Number.isFinite(value) || value < TARGET_MIN - 1e-9 || value > TARGET_MAX + 1e-9) return { kind: "invalid" };
  return { kind: "ok", value: Math.round(value * 100) / 100 };
}

/** The Student's target, one setting for Nilai and the planner: theirs, else the next honors line above the IPK. */
export function targetOf(record: StudentRecord, plan: StudyPlan): number {
  if (plan.target !== null && plan.target >= TARGET_MIN && plan.target <= TARGET_MAX) return plan.target;
  const ipk = record.transcript?.ipk.computed ?? 0;
  return [3, 3.5, 3.75, 3.85, 4].find((v) => v > ipk + 1e-9) ?? 4;
}

// ------------------------------------------------------------ the catalog

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Every course whose code or name matches, codes first. */
export function searchCourses(record: StudentRecord, query: string, limit = 60): CourseInfo[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const words = q.split(/\s+/);
  const rank = (c: CourseInfo) => {
    const code = fold(c.code);
    if (code.startsWith(q)) return 0;
    if (code.includes(q)) return 1;
    const name = fold(c.name);
    return words.every((w) => name.includes(w)) ? 2 : -1;
  };
  return [...record.courses.values()]
    .map((c) => ({ c, r: rank(c) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.c.code.localeCompare(b.c.code))
    .slice(0, limit)
    .map((x) => x.c);
}

/** The program's own courses that aren't required: its electives. */
export function programElectives(record: StudentRecord): CourseInfo[] {
  const code = record.program?.code;
  if (!code) return [];
  return [...record.courses.values()].filter((c) => c.owner === code && !record.required.has(c.code)).sort((a, b) => a.code.localeCompare(b.code));
}

/** Minors run by other programs, those the Student is closest to first. */
export function rankedMinors(record: StudentRecord, plan: StudyPlan): (MinorOption & { have: number; need: number })[] {
  const own = record.program?.name.toLowerCase();
  return record.minors
    .filter((m) => m.program.toLowerCase() !== own)
    .map((m) => ({ ...m, have: minorCoverage(record, plan, m).have, need: minorNeed(record, m) }))
    .sort((a, b) => b.have / Math.max(1, b.need) - a.have / Math.max(1, a.need) || a.name.localeCompare(b.name));
}
