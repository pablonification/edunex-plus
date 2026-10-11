// This term's courses as the Student sees them: SIX is the truth for
// enrollment (once SIX is connected) and EduNex adds its course pages, joined
// by course code, class and term. Indonesian screens use SIX's names, English
// ones EduNex's when it has them.
import { useMemo } from "react";
import { courseColors } from "../core/course-colors";
import type { Course, SixCourse } from "../core/models";
import { useLang } from "./i18n";
import { useDataset } from "./store";

export interface TermCourse {
  code: string;
  classNo: string | null;
  name: string;
  /** From SIX; null until SIX is connected. */
  sks: number | null;
  attendance: SixCourse["attendance"];
  color: string;
  /** The EduNex course pages, when the course has them. */
  edunex: Course["edunex"] | null;
  inSix: boolean;
}

/** SIX's term code ("2026-1"): SIX's once connected, else EduNex's. */
export function useTerm(): string | undefined {
  const student = useDataset("six.student");
  const edunex = useDataset("edunex.courses");
  return student?.term ?? edunex?.[0]?.term;
}

export function useTermCourses(): TermCourse[] | undefined {
  const lang = useLang();
  const edunex = useDataset("edunex.courses");
  const six = useSixCourses();
  return useMemo(() => {
    if (!edunex && !six) return undefined;
    if (!six) {
      const colors = courseColors(edunex!.map((course) => course.code));
      return edunex!.map((course) => ({
        code: course.code,
        classNo: course.classNo,
        name: course.name,
        sks: null,
        attendance: null,
        color: colors.get(course.code)!,
        edunex: course.edunex,
        inSix: false,
      }));
    }
    // EduNex courses of another term, or not in SIX at all, are left out: SIX says what the Student takes.
    const sameTerm = (edunex ?? []).filter((course) => course.term === six.term);
    const key = (code: string, classNo: string | null) => `${code}|${classNo ?? ""}`;
    const byClass = new Map(sameTerm.map((course) => [key(course.code, course.classNo), course]));
    const colors = courseColors(six.courses.map((course) => course.code));
    return six.courses.map((course) => {
      const match = byClass.get(key(course.code, course.classNo)) ?? sameTerm.find((e) => e.code === course.code);
      return {
        code: course.code,
        classNo: course.classNo,
        name: lang === "en" && match ? match.name : course.name,
        sks: course.sks,
        attendance: course.attendance,
        color: colors.get(course.code)!,
        edunex: match?.edunex ?? null,
        inSix: true,
      };
    });
  }, [edunex, six, lang]);
}

function useSixCourses(): { term: string; courses: SixCourse[] } | undefined {
  const student = useDataset("six.student");
  const courses = useDataset("six.courses");
  return useMemo(() => (student && courses ? { term: student.term, courses } : undefined), [student, courses]);
}
