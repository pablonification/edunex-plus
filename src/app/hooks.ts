// Small hooks every screen uses.
import { useCallback, useMemo } from "react";
import { courseColors } from "../core/course-colors";
import type { Course } from "../core/models";
import { useBridge } from "./store";

/** Each course's identity color, stable across launches. */
export function useCourseColors(courses: readonly Course[] | undefined): Map<string, string> {
  return useMemo(() => courseColors((courses ?? []).map((course) => course.code)), [courses]);
}

/** Opens an official page (Edunex, SIX, ITB, an online-class link) in the browser. */
export function useOpenExternal(): (url: string) => void {
  const bridge = useBridge();
  return useCallback((url: string) => void bridge.invoke("shell.openExternal", { url }).catch(() => undefined), [bridge]);
}
