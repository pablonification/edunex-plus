// Everything Beranda reasons from (src/core/needs.ts), as the window has it
// now. Beranda and the alerts bell both read it, so "Yang berubah" and the
// bell's history come from one place and never disagree.
import { useMemo } from "react";
import { targetFor } from "../core/attendance";
import type { HomeWorld } from "../core/needs";
import { useTerm, useTermCourses } from "./courses";
import { useNow } from "./i18n";
import { useDataset, useSettings, useStatus } from "./store";

/**
 * Once the term's courses are known. The exact moment, not rounded down: a
 * Task posted seconds ago is already open. The window's clock ticks once a
 * minute, so this is redone about as often.
 */
export function useHomeWorld(): HomeWorld | undefined {
  const courses = useTermCourses();
  const tasks = useDataset("edunex.tasks");
  const presence = useDataset("edunex.presence");
  const materials = useDataset("edunex.materials");
  const announcements = useDataset("edunex.announcements");
  const schedule = useDataset("six.schedule");
  const scheduleMonths = useDataset("six.scheduleMonths");
  const exams = useDataset("edunex.exams");
  const calendar = useDataset("itb.calendar");
  const krs = useDataset("six.krs");
  const bills = useDataset("six.bills");
  const sixCourses = useDataset("six.courses");
  // The same test as Presensi's: signed out of SIX, nothing reads as counting.
  const sixConnected = useStatus("six").state !== "signed-out" || sixCourses !== undefined;
  const term = useTerm();
  const { attendanceTarget, attendanceTargets } = useSettings();
  const now = useNow();
  return useMemo(() => {
    if (!courses) return undefined;
    return {
      now,
      term: term ?? null,
      courses: courses.map((course) => ({
        code: course.code,
        six: course.attendance,
        edunexId: course.edunex?.courseId ?? null,
        target: targetFor({ attendanceTarget, attendanceTargets }, course.code),
      })),
      tasks: tasks ?? [],
      presence: presence ?? {},
      materials: materials ?? {},
      announcements: announcements ?? {},
      schedule: schedule ?? null,
      scheduleMonths,
      exams,
      calendar,
      krs,
      bills,
      sixConnected,
    };
  }, [
    courses,
    tasks,
    presence,
    materials,
    announcements,
    schedule,
    scheduleMonths,
    exams,
    calendar,
    krs,
    bills,
    sixConnected,
    term,
    attendanceTarget,
    attendanceTargets,
    now,
  ]);
}
