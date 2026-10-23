// Everything Beranda reasons from (src/core/needs.ts), as the window has it
// now. Beranda and the alerts bell both read it, so "Yang berubah" and the
// bell's history come from one place and never disagree.
import { useMemo } from "react";
import { classResults, targetFor } from "../core/attendance";
import type { HomeWorld } from "../core/needs";
import { useTerm, useTermCourses } from "./courses";
import { useNow } from "./i18n";
import { useDataset, useDatasetPayload, useSettings, useStatus } from "./store";

/**
 * Once the term's courses are known. The exact moment, not rounded down: a
 * Task posted seconds ago is already open. The window's clock ticks once a
 * minute, so this is redone about as often.
 */
export function useHomeWorld(): HomeWorld | undefined {
  const courses = useTermCourses();
  const tasks = useDataset("edunex.tasks");
  const taskEdits = useDataset("edunex.taskEdits");
  const presence = useDataset("edunex.presence");
  const materials = useDataset("edunex.materials");
  const announcements = useDataset("edunex.announcements");
  const schedule = useDataset("six.schedule");
  const scheduleMonths = useDataset("six.scheduleMonths");
  const exams = useDataset("edunex.exams");
  const examMarks = useDataset("local.examMarks");
  const calendar = useDataset("itb.calendar");
  const krs = useDataset("six.krs");
  const bills = useDataset("six.bills");
  const sixCourses = useDataset("six.courses");
  const countLog = useDataset("six.countLog");
  const savedResults = useDataset("six.classResults");
  const readAt = useDatasetPayload("six.courses")?.fetchedAt ?? 0;
  // The same test as Presensi's: signed out of SIX, nothing reads as counting.
  const sixConnected = useStatus("six").state !== "signed-out" || sixCourses !== undefined;
  const term = useTerm();
  const { attendanceTarget, attendanceTargets, needsAhead } = useSettings();
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
      examMarks,
      calendar,
      krs,
      bills,
      sixConnected,
      countLog: countLog ?? {},
      // As Presensi judges them: the saved results, and what the latest count already says.
      classResults: classResults(savedResults ?? {}, countLog ?? {}, schedule ?? [], now, readAt),
      taskEdits,
      needsAhead,
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
    examMarks,
    calendar,
    krs,
    bills,
    sixConnected,
    countLog,
    savedResults,
    readAt,
    taskEdits,
    term,
    attendanceTarget,
    attendanceTargets,
    needsAhead,
    now,
  ]);
}
