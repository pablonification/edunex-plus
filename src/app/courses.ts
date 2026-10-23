// This term's courses as the Student sees them (src/core/term-courses.ts: SIX
// for enrollment, Edunex's course pages, one official name). The transcript,
// KRS and planner use the official names too, so no two screens call one
// course differently. Each course's color is the Student's pick or its
// remembered automatic one (./course-colors.ts).
import { useCallback, useMemo } from "react";
import { courseTone, type PaletteId, pickedColor, resolveCourseColors } from "../core/course-colors";
import type { SixCourse } from "../core/models";
import { type TermCourseBase, termCourses, termOf } from "../core/term-courses";
import { useCourseColorsValue, withLegacy } from "./course-colors";
import { useDataset } from "./store";

export interface TermCourse extends TermCourseBase {
  /** Its color's tone in the theme on screen (a CSS color): its dot and stripe. */
  color: string;
  colorId: PaletteId;
  /** The Student picked it (else it's automatic). */
  colorPicked: boolean;
}

/** SIX's term code ("2026-1"): SIX's once connected, else Edunex's. */
export function useTerm(): string | undefined {
  return termOf(useDataset("six.student"), useDataset("edunex.courses"));
}

export function useTermCourses(): TermCourse[] | undefined {
  const edunex = useDataset("edunex.courses");
  const catalog = useDataset("itb.catalog");
  const six = useSixCourses();
  const saved = useCourseColorsValue();
  return useMemo(() => {
    const courses = termCourses({ edunex, catalog, six });
    if (!courses) return undefined;
    const codes = courses.map((course) => course.code);
    const { colors } = resolveCourseColors(codes, withLegacy(codes, saved));
    return courses.map((course) => {
      const { id, picked } = colors.get(course.code)!;
      return { ...course, color: courseTone(id), colorId: id, colorPicked: picked };
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
