// This term's courses as the Student sees them: SIX is the truth for
// enrollment (once SIX is connected) and EduNex adds its course pages, joined
// by course code and class. Indonesian screens use SIX's names, English ones
// EduNex's when it has them.
import { useMemo } from "react";
import type { Course, SixCourse } from "../core/models";
import { useCourseColors } from "./hooks";
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

export function useTermCourses(): TermCourse[] | undefined {
  const lang = useLang();
  const edunex = useDataset("edunex.courses");
  // SIX's courses join once SIX is connected (#76).
  const six = useSixCourses();
  const colors = useCourseColors(edunex);
  return useMemo(() => {
    if (!edunex && !six) return undefined;
    const key = (code: string, classNo: string | null) => `${code}|${classNo ?? ""}`;
    const fromEdunex = new Map((edunex ?? []).map((course) => [key(course.code, course.classNo), course]));
    if (!six) {
      return (edunex ?? []).map((course) => ({
        code: course.code,
        classNo: course.classNo,
        name: course.name,
        sks: null,
        attendance: null,
        color: colors.get(course.code) ?? "#888",
        edunex: course.edunex,
        inSix: false,
      }));
    }
    return six.map((course) => {
      const match = fromEdunex.get(key(course.code, course.classNo)) ?? (edunex ?? []).find((e) => e.code === course.code);
      return {
        code: course.code,
        classNo: course.classNo,
        name: lang === "en" && match ? match.name : course.name,
        sks: course.sks,
        attendance: course.attendance,
        color: colors.get(course.code) ?? "#888",
        edunex: match?.edunex ?? null,
        inSix: true,
      };
    });
  }, [edunex, six, colors, lang]);
}

function useSixCourses(): SixCourse[] | undefined {
  return undefined;
}
