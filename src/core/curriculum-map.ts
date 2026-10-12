// The curriculum map (#79): the program's required courses by recommended
// semester with where the Student stands on each, from SIX's graduation
// progress and the transcript. Students who started on an older curriculum
// passed many courses under other codes (KU1001 Olah Raga for WI2003); SIX's
// progress page places those in the semester of the course they stand in
// for, so a slot is matched to such a course by semester and name. A slot SIX
// neither lists as taken nor as still to take is shown as such, never guessed.
import { isLetterGrade, type ProgressCourse, type StudyPlan } from "./models";
import { minorCoverage, minorNeed, plannedCodes, rankedMinors, type StudentRecord } from "./planner";

/**
 * passed: graded (not E). failed: graded E. in-progress: this term. exempt:
 * credited without a grade. planned: in the Student's plan. left: still to
 * take. unlisted: SIX's progress doesn't list it at all.
 */
export type SlotStatus = "passed" | "failed" | "in-progress" | "exempt" | "planned" | "left" | "unlisted";

export interface MapCourse {
  code: string;
  name: string;
  sks: number;
  /** SIX's course id: its public syllabus page. */
  courseId: string | null;
  status: SlotStatus;
  grade: string | null;
  /** The course that fills the slot under another code. */
  via: { code: string; name: string } | null;
}

export interface MapSemester {
  semester: number;
  required: MapCourse[];
  /** Other courses SIX counts in this semester: electives, and older-curriculum courses that fill no slot here. */
  others: MapCourse[];
}

export interface PackageProgress {
  name: string;
  /** The program running it, for minors. */
  program: string | null;
  sks: number;
  have: number;
  registered: boolean;
  courses: { code: string; name: string; sks: number; status: SlotStatus }[];
}

export interface CurriculumMap {
  semesters: MapSemester[];
  requiredSks: number;
  requiredLeftSks: number;
  electiveNeed: number | null;
  electivePassed: number;
  electiveInProgress: number;
  specializations: PackageProgress[];
  /** The tracked or registered minor first, then the closest. */
  minors: PackageProgress[];
}

type Row = ProgressCourse & { semester: number };

const STOP = new Set(["dan", "di", "untuk", "the", "and", "of", "pengantar", "pengenalan", "dasar", "i", "ii", "iii", "ia", "iia", "ib", "a", "b"]);
const words = (name: string) =>
  name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
const sameWord = (a: string, b: string) => a === b || (a.length >= 7 && b.length >= 7 && a.slice(0, 7) === b.slice(0, 7));
/** Words two course names share, when they cover every word of the shorter name ("Olah Raga", "Pancasila"); else 0. */
export function nameMatch(a: string, b: string): number {
  const [short, long] = [words(a), words(b)].sort((x, y) => x.length - y.length);
  const shared = short.filter((w) => long.some((v) => sameWord(w, v))).length;
  return shared > 0 && shared === short.length ? shared : 0;
}

/** "WI201X" is any of WI2010–WI2019. */
const fillsSlot = (slot: string, code: string) =>
  slot.endsWith("X") ? code.length === slot.length && code.startsWith(slot.slice(0, -1)) && /\d$/.test(code) : slot === code;

function statusOf(row: Row): SlotStatus {
  if (row.status === "exempt") return "exempt";
  if (row.status === "in-progress") return "in-progress";
  if (row.status === "not-taken") return "left";
  return row.grade === "E" ? "failed" : isLetterGrade(row.grade) ? "passed" : "in-progress";
}

export function curriculumMap(record: StudentRecord, plan: StudyPlan): CurriculumMap {
  const planned = plannedCodes(plan);
  const rows: Row[] = (record.progress?.stages ?? []).flatMap((stage) =>
    stage.semesters.flatMap((s) => s.courses.map((c) => ({ ...c, semester: s.semester }))),
  );
  const slots = [...record.required.values()];
  const isSlotCode = (code: string) => slots.some((s) => fillsSlot(s.code, code));
  // Required-kind rows under codes the curriculum doesn't have: older-curriculum courses standing in for a slot.
  const substitutes = rows.filter((r) => r.kind === "required" && !isSlotCode(r.code));
  const used = new Set<string>();
  const withPlan = (status: SlotStatus, code: string): SlotStatus =>
    (status === "left" || status === "unlisted" || status === "failed") && planned.has(code) ? "planned" : status;

  const fromTranscript = (code: string): { status: SlotStatus; grade: string | null } | null => {
    if (record.thisTerm.some((c) => fillsSlot(code, c.code))) return { status: "in-progress", grade: null };
    const graded = [...record.graded.entries()].find(([c]) => fillsSlot(code, c))?.[1];
    return graded ? { status: graded.grade === "E" ? "failed" : "passed", grade: graded.grade } : null;
  };

  const slotCourse = (slot: (typeof slots)[number]): MapCourse => {
    const base = { code: slot.code, name: slot.name, sks: slot.sks, courseId: record.curriculum?.required.find((c) => c.code === slot.code)?.courseId ?? null };
    const own = rows.find((r) => fillsSlot(slot.code, r.code));
    if (own) {
      used.add(own.code);
      const via = own.code === slot.code ? null : { code: own.code, name: own.name };
      return { ...base, status: withPlan(statusOf(own), slot.code), grade: own.grade, via };
    }
    const seen = fromTranscript(slot.code);
    if (seen) return { ...base, ...seen, status: withPlan(seen.status, slot.code), via: null };
    const best = substitutes
      .map((r) => ({ r, score: nameMatch(slot.name, r.name) + (r.semester === slot.semester ? 2 : 0) - (used.has(r.code) ? 0.5 : 0) }))
      .filter((x) => nameMatch(slot.name, x.r.name) > 0)
      .sort((a, b) => b.score - a.score)[0];
    if (best) {
      used.add(best.r.code);
      return { ...base, status: statusOf(best.r), grade: best.r.grade, via: { code: best.r.code, name: best.r.name } };
    }
    return { ...base, status: withPlan(record.progress ? "unlisted" : "left", slot.code), grade: null, via: null };
  };

  const bySemester = new Map<number, MapSemester>();
  const semester = (n: number) => bySemester.get(n) ?? bySemester.set(n, { semester: n, required: [], others: [] }).get(n)!;
  for (const slot of slots) semester(slot.semester).required.push(slotCourse(slot));
  for (const row of rows) {
    if (used.has(row.code) || isSlotCode(row.code)) continue;
    used.add(row.code);
    semester(row.semester).others.push({
      code: row.code,
      name: row.name,
      sks: row.sks,
      courseId: null,
      status: withPlan(statusOf(row), row.code),
      grade: row.grade,
      via: null,
    });
  }

  const requiredLeftSks = record.requiredLeft.reduce((sum, c) => sum + c.sks, 0);

  const packageStatus = (code: string): SlotStatus => {
    const seen = fromTranscript(code);
    return seen ? seen.status : planned.has(code) ? "planned" : record.exempt.has(code) ? "exempt" : "left";
  };
  const spec = record.curriculum?.specializations ?? [];
  const specializations: PackageProgress[] = spec.map((p) => {
    const courses = p.courses.map((c) => ({ code: c.code, name: c.name, sks: c.sks, status: packageStatus(c.code) }));
    return {
      name: p.name,
      program: null,
      sks: p.sks ?? courses.reduce((sum, c) => sum + c.sks, 0),
      have: courses.filter((c) => c.status === "passed" || c.status === "in-progress").reduce((sum, c) => sum + c.sks, 0),
      registered: record.specialization?.name === p.name,
      courses,
    };
  });
  specializations.sort((a, b) => Number(b.registered) - Number(a.registered));

  const tracked = new Set([plan.minor, record.registeredMinor].filter((k): k is string => k !== null));
  const ranked = rankedMinors(record, plan);
  const minors = [...ranked.filter((m) => tracked.has(m.key)), ...ranked.filter((m) => !tracked.has(m.key) && m.have > 0).slice(0, 4)].map((m) => ({
    name: m.name,
    program: m.program,
    sks: minorNeed(record, m),
    have: minorCoverage(record, plan, m).have,
    registered: m.key === record.registeredMinor,
    courses: m.courses.map((code) => ({
      code,
      name: record.courses.get(code)?.name ?? code,
      sks: record.courses.get(code)?.sks ?? 0,
      status: packageStatus(code),
    })),
  }));

  return {
    semesters: [...bySemester.values()].sort((a, b) => a.semester - b.semester),
    requiredSks: slots.reduce((sum, c) => sum + c.sks, 0),
    requiredLeftSks,
    electiveNeed: record.electiveNeed,
    // The same count the planner checks, so the two tabs never disagree.
    electivePassed: record.electivePassed,
    electiveInProgress: record.electiveInProgress,
    specializations,
    minors,
  };
}
