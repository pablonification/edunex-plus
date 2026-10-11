// What Jadwal, the exam list and the exam page read (#77): SIX's timetable
// with the meetings announced only in EduNex, the Tasks still to hand in,
// ITB's calendar, and the merged exam list.
import { useMemo } from "react";
import { type Exam, mergeExams } from "../core/exams";
import { meetingsOutsideSix, type ScheduleInput } from "../core/schedule";
import { isOpenStatus, taskStatus } from "../core/tasks";
import { useTermCourses } from "./courses";
import { useNow } from "./i18n";
import { useDataset } from "./store";

/** Minute precision is plenty, and keeps the merging from rerunning every tick. */
const useMinute = () => Math.floor(useNow() / 60_000) * 60_000;

/** undefined until SIX's timetable has been read. */
export function useScheduleInput(): (ScheduleInput & { months: readonly string[] }) | undefined {
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
    if (!schedule) return undefined;
    const codes = [...new Set([...(courses ?? []).map((c) => c.code), ...schedule.map((s) => s.courseCode)])];
    return {
      schedule,
      months: months ?? [],
      outside: meetingsOutsideSix(codes, schedule, months, { materials, announcements, presence }),
      tasks: (tasks ?? []).filter((task) => isOpenStatus(taskStatus(task, now))),
      events: calendar?.events ?? [],
    };
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
