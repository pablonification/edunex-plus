// This term's courses as the Student sees them: SIX is the truth for
// enrollment (once SIX is connected) and Edunex adds its course pages, joined
// by course code, class and term. A course has one name everywhere, in both
// languages: its official one (SIX's, else ITB's public catalog), else the
// name its Edunex page carries. When SIX's list may be missing a course (a row
// left out because its code or name couldn't be read), this term's Edunex
// courses SIX doesn't list stay (ADR 0012). The window adds each course's color
// (src/app/courses.ts); the tray menu reads them as they are.
import type { Course, DatasetValue, SixCourse, SourceStatus } from "./models";

export interface TermCourseBase {
  code: string;
  classNo: string | null;
  name: string;
  /** From SIX; null until SIX is connected. */
  sks: number | null;
  attendance: SixCourse["attendance"];
  /** The Edunex course pages, when the course has them. */
  edunex: Course["edunex"] | null;
  inSix: boolean;
}

/**
 * SIX's list of this term's courses, with its term. `courses` null: the list won't come until SIX's
 * page reads again (its table changed before it was ever read). `incomplete`: the list left out a
 * row it couldn't tell the course of.
 */
export interface SixList {
  term: string;
  courses: readonly SixCourse[] | null;
  incomplete?: boolean;
}

/** SIX's term code ("2026-1"): SIX's once connected, else Edunex's. */
export function termOf(student: DatasetValue<"six.student"> | undefined, edunex: readonly Course[] | undefined): string | undefined {
  return student?.term ?? edunex?.[0]?.term;
}

/** SIX's course list left out a row it couldn't tell the course of (its code or name), not just a detail: it may be missing a course. */
export function sixListIncomplete(skipped: DatasetValue<"six.skipped"> | undefined): boolean {
  return skipped?.["six.courses"]?.some((row) => !row.blank) ?? false;
}

/** SIX's list, from what SIX has: undefined before the Student is known, and while the course list is still on its way. */
export function sixList(six: {
  student: DatasetValue<"six.student"> | undefined;
  courses: DatasetValue<"six.courses"> | undefined;
  skipped: DatasetValue<"six.skipped"> | undefined;
  status: Pick<SourceStatus, "changedPages"> | undefined;
}): SixList | undefined {
  if (!six.student) return undefined;
  if (six.courses) return { term: six.student.term, courses: six.courses, incomplete: sixListIncomplete(six.skipped) };
  const changed = six.status?.changedPages?.some((page) => page.datasets.includes("six.courses")) ?? false;
  return changed ? { term: six.student.term, courses: null } : undefined;
}

export function termCourses(input: {
  edunex: readonly Course[] | undefined;
  catalog: DatasetValue<"itb.catalog"> | undefined;
  /** Once SIX is connected. */
  six: SixList | undefined;
}): TermCourseBase[] | undefined {
  const { edunex, catalog, six } = input;
  const official = new Map((catalog?.courses ?? []).map((course) => [course.code, course.name]));
  const fromEdunex = (course: Course): TermCourseBase => ({
    code: course.code,
    classNo: course.classNo,
    name: official.get(course.code) ?? course.name,
    sks: null,
    attendance: null,
    edunex: course.edunex,
    inSix: false,
  });
  if (!six) return edunex?.map(fromEdunex);
  // Edunex courses of another term, or not in SIX at all, are left out: SIX says what the Student takes.
  const sameTerm = (edunex ?? []).filter((course) => course.term === six.term);
  // SIX's list won't come until its page reads again: Edunex's for the term is the list, and nothing waits for SIX's.
  if (!six.courses) return sameTerm.map(fromEdunex);
  const key = (code: string, classNo: string | null) => `${code}|${classNo ?? ""}`;
  const byClass = new Map(sameTerm.map((course) => [key(course.code, course.classNo), course]));
  const listed = six.courses.map((course) => {
    const match = byClass.get(key(course.code, course.classNo)) ?? sameTerm.find((e) => e.code === course.code);
    return {
      code: course.code,
      classNo: course.classNo,
      name: course.name,
      sks: course.sks,
      attendance: course.attendance,
      edunex: match?.edunex ?? null,
      inSix: true,
    };
  });
  if (!six.incomplete) return listed;
  // Unless SIX's list lost a row it couldn't tell the course of: a course of the term it doesn't list was probably that row.
  return [...listed, ...lostFromSix(sameTerm, six.courses).map(fromEdunex)];
}

/** This term's Edunex courses that SIX's list doesn't name, one per code. */
export function lostFromSix(sameTerm: readonly Course[], six: readonly SixCourse[]): Course[] {
  const named = new Set(six.map((course) => course.code));
  return sameTerm.filter((course, index) => !named.has(course.code) && sameTerm.findIndex((other) => other.code === course.code) === index);
}
