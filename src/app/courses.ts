// This term's courses as the Student sees them (src/core/term-courses.ts: SIX
// for enrollment, Edunex's course pages, one official name). The transcript,
// KRS and planner use the official names too, so no two screens call one
// course differently. Each course's color is the Student's pick or its
// remembered automatic one (./course-colors.ts).
import { useCallback, useMemo } from "react";
import { courseTone, type PaletteId, pickedColor, resolveCourseColors } from "../core/course-colors";
import type { DatasetValue } from "../core/models";
import { type SixList, sixList, type TermCourseBase, termCourses, termOf } from "../core/term-courses";
import { useCourseColorsValue, withLegacy } from "./course-colors";
import { useDataset, useStatus } from "./store";

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
  const six = useSixList();
  const saved = useCourseColorsValue();
  return useMemo(() => shared(edunex, catalog, six, saved), [edunex, catalog, six, saved]);
}

/**
 * The term's courses, worked out once for every screen that asks (a dozen on Beranda alone), and the same array for as
 * long as they say the same: each page of SIX's catalog read in the background (87 KB, a page every few seconds) is a
 * new dataset that rarely changes a name, and a new array redrew every screen built on the courses, up to a second of a
 * blocked JS thread on a small phone.
 */
let last: { inputs: readonly unknown[]; courses: TermCourse[] | undefined; text: string } | null = null;

function shared(...inputs: Parameters<typeof work>): TermCourse[] | undefined {
  if (last && inputs.every((input, i) => input === last!.inputs[i])) return last.courses;
  const courses = work(...inputs);
  const text = JSON.stringify(courses) ?? "";
  last = { inputs, courses: last && text === last.text ? last.courses : courses, text };
  return last.courses;
}

function work(
  edunex: DatasetValue<"edunex.courses"> | undefined,
  catalog: DatasetValue<"itb.catalog"> | undefined,
  six: SixList | undefined,
  saved: ReturnType<typeof useCourseColorsValue>,
): TermCourse[] | undefined {
  const courses = termCourses({ edunex, catalog, six });
  if (!courses) return undefined;
  const codes = courses.map((course) => course.code);
  const { colors } = resolveCourseColors(codes, withLegacy(codes, saved));
  return courses.map((course) => {
    const { id, picked } = colors.get(course.code)!;
    return { ...course, color: courseTone(id), colorId: id, colorPicked: picked };
  });
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

function useSixList(): SixList | undefined {
  const student = useDataset("six.student");
  const courses = useDataset("six.courses");
  const skipped = useDataset("six.skipped");
  const { changedPages } = useStatus("six");
  return useMemo(() => sixList({ student, courses, skipped, status: { changedPages } }), [student, courses, skipped, changedPages]);
}
