// What the app has saved, by dataset name (the window's store, or an engine
// snapshot), and this term's courses as the screens list them. For code that
// reasons over many datasets at once: quick search and the first-run scan.
import type { DatasetName, DatasetValue } from "./models";
import type { Lang } from "./strings";

export type Saved = { [N in DatasetName]?: DatasetValue<N> };

export interface TermCourseNames {
  code: string;
  classNo: string | null;
  /** SIX's (Indonesian) name, once SIX is connected. */
  six: string | null;
  /** Edunex's name (often English), when the course is on Edunex. */
  edunex: string | null;
  /** The class's own Edunex course, when it has one. */
  edunexCourseId: number | null;
  sks: number | null;
}

/**
 * This term's courses as the screens list them: SIX is the truth for
 * enrollment once connected (Edunex's courses of the same term join by code
 * and class), else Edunex's list.
 */
export function termCourses(saved: Saved): TermCourseNames[] {
  const edunex = saved["edunex.courses"] ?? [];
  const six = saved["six.courses"];
  const term = saved["six.student"]?.term;
  if (!six || !term)
    return edunex.map((c) => ({ code: c.code, classNo: c.classNo, six: null, edunex: c.name, edunexCourseId: c.edunex.courseId, sks: null }));
  const sameTerm = edunex.filter((c) => c.term === term);
  return six.map((c) => {
    const match = sameTerm.find((e) => e.code === c.code && e.classNo === c.classNo) ?? sameTerm.find((e) => e.code === c.code);
    return { code: c.code, classNo: c.classNo, six: c.name, edunex: match?.name ?? null, edunexCourseId: match?.edunex.courseId ?? null, sks: c.sks };
  });
}

/** The course's name in the Student's language: SIX's in Indonesian, Edunex's in English when it has one. */
export function courseName(course: TermCourseNames, lang: Lang): string {
  return (lang === "en" ? (course.edunex ?? course.six) : (course.six ?? course.edunex)) ?? course.code;
}

/** Whether a code is one of this term's courses. Before any course is known, every code is. */
export function inTerm(courses: readonly TermCourseNames[]): (code: string) => boolean {
  const codes = new Set(courses.map((course) => course.code));
  return (code) => codes.size === 0 || codes.has(code);
}
