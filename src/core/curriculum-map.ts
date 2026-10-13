// The curriculum map (#79): the program's required courses by recommended
// semester with where the Student stands on each, as the record decided it
// (src/core/curriculum-slots.ts, so Rencana and Kurikulum never disagree),
// the Student's plan on top, the other courses SIX counts, and the
// specializations and minors with progress.
import { fillsSlot, type ProgressRow, rowStatus, type StandingStatus } from "./curriculum-slots";
import type { CurriculumFix, StudyPlan } from "./models";
import { activeMinor, activeSpecialization, minorCoverage, minorNeed, notContinuing, plannedCodes, rankedMinors, type StudentRecord } from "./planner";

/** Where a course stands, and planned: in the Student's plan. */
export type SlotStatus = StandingStatus | "planned";

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
  /** The Student's correction (required courses only). */
  fix: CurriculumFix | null;
  /** SIX still lists it as to take, though the Student corrected it. */
  sixLeft: boolean;
  /** Only in the plan: tried this semester, or a KRS course left out of it (SIX's KRS doesn't change). */
  whatIf: "added" | "left-out" | null;
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
  /** Registered, but the Student said they aren't continuing it. */
  notContinuing: boolean;
  courses: { code: string; name: string; sks: number; status: SlotStatus; whatIf: MapCourse["whatIf"] }[];
}

export interface CurriculumMap {
  semesters: MapSemester[];
  requiredSks: number;
  requiredLeftSks: number;
  electiveNeed: number | null;
  electivePassed: number;
  electiveInProgress: number;
  /** The curriculum the Student started on, when older than this one (2019 for Kurikulum 2024). */
  startedOn: number | null;
  specializations: PackageProgress[];
  /** The tracked or registered minor first, then the closest. */
  minors: PackageProgress[];
}

export function curriculumMap(record: StudentRecord, plan: StudyPlan): CurriculumMap {
  const planned = plannedCodes(plan);
  const rows: ProgressRow[] = (record.progress?.stages ?? []).flatMap((stage) =>
    stage.semesters.flatMap((s) => s.courses.map((c) => ({ ...c, semester: s.semester }))),
  );
  const slots = [...record.required.values()];
  const isSlotCode = (code: string) => slots.some((s) => fillsSlot(s.code, code));
  const withPlan = (status: SlotStatus, code: string): SlotStatus =>
    (status === "left" || status === "unlisted" || status === "failed") && planned.has(code) ? "planned" : status;

  const fromTranscript = (code: string): { status: SlotStatus; grade: string | null } | null => {
    if (record.thisTerm.some((c) => fillsSlot(code, c.code))) return { status: "in-progress", grade: null };
    const graded = [...record.graded.entries()].find(([c]) => fillsSlot(code, c))?.[1];
    return graded ? { status: graded.grade === "E" ? "failed" : "passed", grade: graded.grade } : null;
  };

  const slotCourse = (slot: (typeof slots)[number]): MapCourse => {
    const standing = record.slots.get(slot.code);
    return {
      code: slot.code,
      name: slot.name,
      sks: slot.sks,
      courseId: record.curriculum?.required.find((c) => c.code === slot.code)?.courseId ?? null,
      status: withPlan(standing?.status ?? "left", slot.code),
      grade: standing?.grade ?? null,
      via: standing?.via ?? null,
      fix: standing?.fix ?? null,
      sixLeft: standing?.sixLeft ?? false,
      whatIf: standing?.whatIf ?? null,
    };
  };
  // Older courses already standing in for a slot aren't listed again under "other courses".
  const used = new Set([...record.slots.values()].flatMap((s) => (s.via ? [s.via.code] : [])));

  const bySemester = new Map<number, MapSemester>();
  const semester = (n: number) => bySemester.get(n) ?? bySemester.set(n, { semester: n, required: [], others: [] }).get(n)!;
  for (const slot of slots) semester(slot.semester).required.push(slotCourse(slot));
  // This term's what-ifs, as the planner counts them and marked as only in the plan: a course left out stays listed but
  // doesn't count (the totals come from the record); one added counts in this semester.
  const leftOut = new Set(record.thisTermDropped.map((c) => c.code));
  for (const row of rows) {
    if (used.has(row.code) || isSlotCode(row.code)) continue;
    used.add(row.code);
    semester(row.semester).others.push({
      code: row.code,
      name: row.name,
      sks: row.sks,
      courseId: null,
      status: withPlan(rowStatus(row), row.code),
      grade: row.grade,
      via: null,
      fix: null,
      sixLeft: false,
      whatIf: leftOut.has(row.code) ? "left-out" : null,
    });
  }
  const nowSemester = record.semesterNow ?? Math.max(1, ...bySemester.keys());
  for (const code of record.thisTermAdded) {
    const course = record.thisTerm.find((c) => c.code === code);
    if (!course || used.has(code) || isSlotCode(code) || rows.some((r) => r.code === code)) continue;
    semester(nowSemester).others.push({
      code,
      name: course.name,
      sks: course.sks,
      courseId: null,
      status: "in-progress",
      grade: null,
      via: null,
      fix: null,
      sixLeft: false,
      whatIf: "added",
    });
  }

  const requiredLeftSks = record.requiredLeft.reduce((sum, c) => sum + c.sks, 0);

  const tried = new Set(record.thisTermAdded);
  const packageWhatIf = (code: string): MapCourse["whatIf"] => (tried.has(code) ? "added" : leftOut.has(code) ? "left-out" : null);
  const packageStatus = (code: string): SlotStatus => {
    const seen = fromTranscript(code);
    return seen ? seen.status : planned.has(code) ? "planned" : record.exempt.has(code) ? "exempt" : "left";
  };
  const spec = record.curriculum?.specializations ?? [];
  const specializations: PackageProgress[] = spec.map((p) => {
    const courses = p.courses.map((c) => ({ code: c.code, name: c.name, sks: c.sks, status: packageStatus(c.code), whatIf: packageWhatIf(c.code) }));
    return {
      name: p.name,
      program: null,
      sks: p.sks ?? courses.reduce((sum, c) => sum + c.sks, 0),
      have: courses.filter((c) => c.status === "passed" || c.status === "in-progress").reduce((sum, c) => sum + c.sks, 0),
      registered: record.specialization?.name === p.name,
      notContinuing: record.specialization?.name === p.name && activeSpecialization(record, plan) === null,
      courses,
    };
  });
  specializations.sort((a, b) => Number(b.registered) - Number(a.registered));

  const tracked = new Set([activeMinor(record, plan)?.key ?? null, record.registeredMinor].filter((k): k is string => k !== null));
  const ranked = rankedMinors(record, plan);
  const minors = [...ranked.filter((m) => tracked.has(m.key)), ...ranked.filter((m) => !tracked.has(m.key) && m.have > 0).slice(0, 4)].map((m) => ({
    name: m.name,
    program: m.program,
    sks: minorNeed(record, m),
    have: minorCoverage(record, plan, m).have,
    registered: m.key === record.registeredMinor,
    notContinuing: m.key === record.registeredMinor && notContinuing(plan, "minor", m.name),
    courses: m.courses.map((code) => ({
      code,
      name: record.courses.get(code)?.name ?? code,
      sks: record.courses.get(code)?.sks ?? 0,
      status: packageStatus(code),
      whatIf: packageWhatIf(code),
    })),
  }));

  const firstYear = record.transcript?.terms[0]?.courses.map((c) => c.curriculumYear).find((y): y is number => y !== null) ?? null;
  const year = record.curriculum?.year ?? null;

  return {
    semesters: [...bySemester.values()].sort((a, b) => a.semester - b.semester),
    requiredSks: slots.reduce((sum, c) => sum + c.sks, 0),
    requiredLeftSks,
    electiveNeed: record.electiveNeed,
    // The same count the planner checks, so the two tabs never disagree.
    electivePassed: record.electivePassed,
    electiveInProgress: record.electiveInProgress,
    startedOn: firstYear !== null && year !== null && firstYear < year ? firstYear : null,
    specializations,
    minors,
  };
}

export interface StandIn {
  code: string;
  name: string;
  sks: number;
  grade: string;
  /** SIX places it in the slot's semester and it fills no other slot. */
  suggested: boolean;
  /** The slot the app guessed it counts for, when any: picking it here moves it. */
  fills: string | null;
}

/**
 * Courses the Student passed that could count for a slot ("Counted as…"):
 * SIX's rows in the slot's semester that fill nothing first, then the others
 * that fill nothing, then those the app only guessed for another slot (a
 * pick moves them). A course the Student or the table already put in a slot
 * isn't offered: one course counts once.
 */
export function standIns(record: StudentRecord, slotCode: string): StandIn[] {
  const semester = record.required.get(slotCode)?.semester;
  const placed = new Map(
    (record.progress?.stages ?? []).flatMap((stage) => stage.semesters.flatMap((s) => s.courses.map((c) => [c.code, s.semester] as const))),
  );
  const fills = new Map([...record.slots.entries()].flatMap(([code, s]) => (s.via && s.guessed ? [[s.via.code, code] as const] : [])));
  // Already this slot's, or settled in another one (by the Student or the table).
  const taken = new Set([...record.slots.entries()].flatMap(([code, s]) => (s.via && (!s.guessed || code === slotCode) ? [s.via.code] : [])));
  const slotCodes = [...record.required.keys()];
  const rank = (c: StandIn) => (c.suggested ? 0 : c.fills ? 2 : 1);
  return [...record.graded.entries()]
    .filter(([code, g]) => g.grade !== "E" && !taken.has(code) && !slotCodes.some((s) => fillsSlot(s, code)))
    .map(([code, g]) => ({
      code,
      name: g.name,
      sks: g.sks,
      grade: g.grade,
      suggested: !fills.has(code) && placed.get(code) === semester,
      fills: fills.get(code) ?? null,
    }))
    .sort((a, b) => rank(a) - rank(b) || a.code.localeCompare(b.code));
}
