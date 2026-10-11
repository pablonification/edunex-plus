// What Jadwal, the exam list and the exam page read (#77): SIX's timetable
// with the meetings announced only in EduNex, the Presence windows counted by
// handing in a Task, the Tasks still to hand in, ITB's calendar, and the
// merged exam list. Without SIX, what EduNex knows: its meetings, deadlines
// and ITB's calendar.
import { useCallback, useMemo } from "react";
import { type Exam, mergeExams } from "../core/exams";
import { edunexMeetings, meetingsOutsideSix, type ScheduleInput, taskWindows } from "../core/schedule";
import { isOpenStatus, taskStatus } from "../core/tasks";
import { useTermCourses } from "./courses";
import { useLang, useNow } from "./i18n";
import { useDataset } from "./store";

/**
 * Course names as Jadwal and Presensi show them: SIX's (Indonesian) once SIX
 * is known; before that, on Indonesian screens, ITB's catalog name when the
 * catalog has the course, else EduNex's as it is. The code always goes first.
 */
export function useCourseNames(): (code: string, fallback?: string) => string {
  const courses = useTermCourses();
  const catalog = useDataset("itb.catalog");
  const lang = useLang();
  return useCallback(
    (code: string, fallback?: string) => {
      const course = courses?.find((c) => c.code === code);
      if (course?.inSix || lang === "en") return course?.name ?? fallback ?? code;
      return catalog?.courses.find((c) => c.code === code)?.name ?? course?.name ?? fallback ?? code;
    },
    [courses, catalog, lang],
  );
}

/** Minute precision is plenty, and keeps the merging from rerunning every tick. */
const useMinute = () => Math.floor(useNow() / 60_000) * 60_000;

export interface ScheduleData extends ScheduleInput {
  /** The months ("2026-10") whose own SIX timetable page was read. */
  months: readonly string[];
  /** SIX's timetable was read; else this is what EduNex knows. */
  six: boolean;
}

/** undefined until SIX's timetable or anything from EduNex or ITB's calendar is known. */
export function useScheduleInput(): ScheduleData | undefined {
  const schedule = useDataset("six.schedule");
  const months = useDataset("six.scheduleMonths");
  const courses = useTermCourses();
  const materials = useDataset("edunex.materials");
  const announcements = useDataset("edunex.announcements");
  const presence = useDataset("edunex.presence");
  const tasks = useDataset("edunex.tasks");
  const calendar = useDataset("itb.calendar");
  const now = useMinute();
  return useMemo(() => {
    if (!schedule && !tasks && !presence && !calendar) return undefined;
    const codes = [...new Set([...(courses ?? []).map((c) => c.code), ...(schedule ?? []).map((s) => s.courseCode)])];
    const edunex = { materials, announcements, presence };
    const open = (tasks ?? []).filter((task) => isOpenStatus(taskStatus(task, now)));
    const shared = { tasks: open, events: calendar?.events ?? [], windows: taskWindows(presence, schedule ?? [], tasks ?? []) };
    if (!schedule) return { ...shared, schedule: [], months: [], outside: [], edunex: edunexMeetings(codes, edunex), six: false };
    return { ...shared, schedule, months: months ?? [], outside: meetingsOutsideSix(codes, schedule, months, edunex), six: true };
  }, [schedule, months, courses, materials, announcements, presence, tasks, calendar, now]);
}

/** Every exam of the term; undefined until SIX or EduNex has said anything. */
export function useExams(): Exam[] | undefined {
  const schedule = useDataset("six.schedule");
  const edunexExams = useDataset("edunex.exams");
  const tasks = useDataset("edunex.tasks");
  const outline = useDataset("edunex.outline");
  const calendar = useDataset("itb.calendar");
  const student = useDataset("six.student");
  const courses = useTermCourses();
  const now = useMinute();
  return useMemo(() => {
    if (!schedule && !tasks && !edunexExams) return undefined;
    return mergeExams({ schedule, edunexExams, tasks, outline, calendar, term: student?.term, courses: courses?.map((c) => c.code), now });
  }, [schedule, edunexExams, tasks, outline, calendar, student, courses, now]);
}

/** The exam each SIX exam session belongs to, by SIX meeting id: the id of the exam page it opens. */
export function useExamIds(): ReadonlyMap<string, string> {
  const exams = useExams();
  return useMemo(() => new Map((exams ?? []).flatMap((exam) => exam.six.map((session) => [session.id, exam.id] as const))), [exams]);
}
