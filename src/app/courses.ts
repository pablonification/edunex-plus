// This term's courses as the Student sees them: SIX is the truth for
// enrollment (once SIX is connected) and Edunex adds its course pages, joined
// by course code, class and term. A course has one name everywhere, in both
// languages: its official one (SIX's, else ITB's public catalog), else the
// name its Edunex page carries. The transcript, KRS and planner use the
// official names too, so no two screens call one course differently.
import { useMemo } from "react";
import { courseColors } from "../core/course-colors";
import type { Course, SixCourse } from "../core/models";
import { useDataset } from "./store";

export interface TermCourse {
  code: string;
  classNo: string | null;
  name: string;
  /** From SIX; null until SIX is connected. */
  sks: number | null;
  attendance: SixCourse["attendance"];
  color: string;
  /** The Edunex course pages, when the course has them. */
  edunex: Course["edunex"] | null;
  inSix: boolean;
}

/** SIX's term code ("2026-1"): SIX's once connected, else Edunex's. */
export function useTerm(): string | undefined {
  const student = useDataset("six.student");
  const edunex = useDataset("edunex.courses");
  return student?.term ?? edunex?.[0]?.term;
}

export function useTermCourses(): TermCourse[] | undefined {
  const edunex = useDataset("edunex.courses");
  const catalog = useDataset("itb.catalog");
  const six = useSixCourses();
  return useMemo(() => {
    if (!edunex && !six) return undefined;
    if (!six) {
      const colors = courseColors(edunex!.map((course) => course.code));
      const official = new Map((catalog?.courses ?? []).map((course) => [course.code, course.name]));
      return edunex!.map((course) => ({
        code: course.code,
        classNo: course.classNo,
        name: official.get(course.code) ?? course.name,
        sks: null,
        attendance: null,
        color: colors.get(course.code)!,
        edunex: course.edunex,
        inSix: false,
      }));
    }
    // Edunex courses of another term, or not in SIX at all, are left out: SIX says what the Student takes.
    const sameTerm = (edunex ?? []).filter((course) => course.term === six.term);
    const key = (code: string, classNo: string | null) => `${code}|${classNo ?? ""}`;
    const byClass = new Map(sameTerm.map((course) => [key(course.code, course.classNo), course]));
    const colors = courseColors(six.courses.map((course) => course.code));
    return six.courses.map((course) => {
      const match = byClass.get(key(course.code, course.classNo)) ?? sameTerm.find((e) => e.code === course.code);
      return {
        code: course.code,
        classNo: course.classNo,
        name: course.name,
        sks: course.sks,
        attendance: course.attendance,
        color: colors.get(course.code)!,
        edunex: match?.edunex ?? null,
        inSix: true,
      };
    });
  }, [edunex, catalog, six]);
}

function useSixCourses(): { term: string; courses: SixCourse[] } | undefined {
  const student = useDataset("six.student");
  const courses = useDataset("six.courses");
  return useMemo(() => (student && courses ? { term: student.term, courses } : undefined), [student, courses]);
}
