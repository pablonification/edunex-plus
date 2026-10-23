// This term's courses as the Student sees them: SIX is the truth for
// enrollment (once SIX is connected) and Edunex adds its course pages, joined
// by course code, class and term. A course has one name everywhere, in both
// languages: its official one (SIX's, else ITB's public catalog), else the
// name its Edunex page carries. The transcript, KRS and planner use the
// official names too, so no two screens call one course differently. Each
// course's color is the Student's pick or its remembered automatic one
// (./course-colors.ts).
import { useCallback, useMemo } from "react";
import { courseTone, type PaletteId, pickedColor, resolveCourseColors } from "../core/course-colors";
import type { Course, SixCourse } from "../core/models";
import { useCourseColorsValue, withLegacy } from "./course-colors";
import { useDataset } from "./store";

export interface TermCourse {
  code: string;
  classNo: string | null;
  name: string;
  /** From SIX; null until SIX is connected. */
  sks: number | null;
  attendance: SixCourse["attendance"];
  /** Its color's tone in the theme on screen (a CSS color): its dot and stripe. */
  color: string;
  colorId: PaletteId;
  /** The Student picked it (else it's automatic). */
  colorPicked: boolean;
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
  const saved = useCourseColorsValue();
  return useMemo(() => {
    if (!edunex && !six) return undefined;
    const colorsOf = (codes: string[]) => {
      const { colors } = resolveCourseColors(codes, withLegacy(codes, saved));
      return (code: string) => {
        const { id, picked } = colors.get(code)!;
        return { color: courseTone(id), colorId: id, colorPicked: picked };
      };
    };
    if (!six) {
      const color = colorsOf(edunex!.map((course) => course.code));
      const official = new Map((catalog?.courses ?? []).map((course) => [course.code, course.name]));
      return edunex!.map((course) => ({
        code: course.code,
        classNo: course.classNo,
        name: official.get(course.code) ?? course.name,
        sks: null,
        attendance: null,
        ...color(course.code),
        edunex: course.edunex,
        inSix: false,
      }));
    }
    // Edunex courses of another term, or not in SIX at all, are left out: SIX says what the Student takes.
    const sameTerm = (edunex ?? []).filter((course) => course.term === six.term);
    const key = (code: string, classNo: string | null) => `${code}|${classNo ?? ""}`;
    const byClass = new Map(sameTerm.map((course) => [key(course.code, course.classNo), course]));
    const color = colorsOf(six.courses.map((course) => course.code));
    return six.courses.map((course) => {
      const match = byClass.get(key(course.code, course.classNo)) ?? sameTerm.find((e) => e.code === course.code);
      return {
        code: course.code,
        classNo: course.classNo,
        name: course.name,
        sks: course.sks,
        attendance: course.attendance,
        ...color(course.code),
        edunex: match?.edunex ?? null,
        inSix: true,
      };
    });
  }, [edunex, catalog, six, saved]);
}

/**
 * A course's color wherever its code shows: this term's; else, for a course outside the term (a grade from last
 * term, a Task of a course SIX doesn't list), the Student's pick for it; else none, and its mark is an outline.
 */
export function useCourseColor(): (code: string | null | undefined) => string | undefined {
  const courses = useTermCourses();
  const saved = useCourseColorsValue();
  return useCallback(
    (code) => {
      if (!code) return undefined;
      const term = courses?.find((course) => course.code === code);
      if (term) return term.color;
      const picked = pickedColor(code, saved);
      return picked ? courseTone(picked) : undefined;
    },
    [courses, saved],
  );
}

function useSixCourses(): { term: string; courses: SixCourse[] } | undefined {
  const student = useDataset("six.student");
  const courses = useDataset("six.courses");
  return useMemo(() => (student && courses ? { term: student.term, courses } : undefined), [student, courses]);
}
