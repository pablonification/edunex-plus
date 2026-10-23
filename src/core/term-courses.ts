// This term's courses as the Student sees them: SIX is the truth for
// enrollment (once SIX is connected) and Edunex adds its course pages, joined
// by course code, class and term. A course has one name everywhere, in both
// languages: its official one (SIX's, else ITB's public catalog), else the
// name its Edunex page carries. The window adds each course's color
// (src/app/courses.ts); the tray menu reads them as they are.
import type { Course, DatasetValue, SixCourse } from "./models";

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

/** SIX's term code ("2026-1"): SIX's once connected, else Edunex's. */
export function termOf(student: DatasetValue<"six.student"> | undefined, edunex: readonly Course[] | undefined): string | undefined {
  return student?.term ?? edunex?.[0]?.term;
}

export function termCourses(input: {
  edunex: readonly Course[] | undefined;
  catalog: DatasetValue<"itb.catalog"> | undefined;
  /** SIX's term and its courses, once SIX is connected. */
  six: { term: string; courses: readonly SixCourse[] } | undefined;
}): TermCourseBase[] | undefined {
  const { edunex, catalog, six } = input;
  if (!edunex && !six) return undefined;
  if (!six) {
    const official = new Map((catalog?.courses ?? []).map((course) => [course.code, course.name]));
    return edunex!.map((course) => ({
      code: course.code,
      classNo: course.classNo,
      name: official.get(course.code) ?? course.name,
      sks: null,
      attendance: null,
      edunex: course.edunex,
      inSix: false,
    }));
  }
  // Edunex courses of another term, or not in SIX at all, are left out: SIX says what the Student takes.
  const sameTerm = (edunex ?? []).filter((course) => course.term === six.term);
  const key = (code: string, classNo: string | null) => `${code}|${classNo ?? ""}`;
  const byClass = new Map(sameTerm.map((course) => [key(course.code, course.classNo), course]));
  return six.courses.map((course) => {
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
}
