// What Jadwal reads: the desktop's useScheduleInput (src/app/schedule-data.ts), worked out the same way from the same
// datasets, but steady across the minute's tick. The desktop's builds a new object every minute (the open Tasks are
// filtered by the clock), and with it every day of the agenda was worked out and drawn again; here each part is
// worked out again only when its own data changes, and the open Tasks only when one opens or closes.
import { useMemo } from "react";
import { useTermCourses } from "../../../../src/app/courses";
import { useNow } from "../../../../src/app/i18n";
import { type ScheduleData, useExamIds } from "../../../../src/app/schedule-data";
import { useDataset } from "../../../../src/app/store";
import { edunexMeetings, meetingsOutsideSix, taskWindows } from "../../../../src/core/schedule";
import { isOpenStatus, taskStatus } from "../../../../src/core/tasks";
import { useClockSelect, useSteady } from "./clock";

/** undefined until SIX's timetable or anything from Edunex or ITB's calendar is known (as useScheduleInput). */
export function useAgendaInput(): ScheduleData | undefined {
  const schedule = useDataset("six.schedule");
  const months = useDataset("six.scheduleMonths");
  const unread = useDataset("six.scheduleUnread");
  const courses = useTermCourses();
  const materials = useDataset("edunex.materials");
  const announcements = useDataset("edunex.announcements");
  const presence = useDataset("edunex.presence");
  const tasks = useDataset("edunex.tasks");
  const calendar = useDataset("itb.calendar");
  // Which Tasks are still open, said as their ids: changes when one closes, not every minute.
  const openIds = useClockSelect((now) =>
    (tasks ?? [])
      .filter((task) => isOpenStatus(taskStatus(task, now)))
      .map((task) => task.id)
      .join(","),
  );
  const open = useMemo(() => {
    const ids = new Set(openIds.split(","));
    return (tasks ?? []).filter((task) => ids.has(String(task.id)));
  }, [tasks, openIds]);
  const codes = useMemo(() => [...new Set([...(courses ?? []).map((c) => c.code), ...(schedule ?? []).map((s) => s.courseCode)])], [courses, schedule]);
  const windows = useMemo(() => taskWindows(presence, schedule ?? [], tasks ?? []), [presence, schedule, tasks]);
  const outside = useMemo(
    () => (schedule ? meetingsOutsideSix(codes, schedule, months, { materials, announcements, presence }, unread) : []),
    [codes, schedule, months, materials, announcements, presence, unread],
  );
  const edunex = useMemo(
    () => (schedule ? [] : edunexMeetings(codes, { materials, announcements, presence })),
    [codes, schedule, materials, announcements, presence],
  );
  return useMemo(() => {
    if (!schedule && !tasks && !presence && !calendar) return undefined;
    const shared = { tasks: open, events: calendar?.events ?? [], windows };
    if (!schedule) return { ...shared, schedule: [], months: [], outside: [], edunex, six: false };
    return { ...shared, schedule, months: months ?? [], unread: unread ?? [], outside, six: true };
  }, [schedule, months, unread, open, calendar, windows, outside, edunex, tasks, presence]);
}

/** The exam each SIX session belongs to (useExamIds), kept as it was while it says the same. */
export function useSteadyExamIds(): ReadonlyMap<string, string> {
  const ids = useExamIds();
  return useSteady(ids, [...ids].map(([session, exam]) => `${session}=${exam}`).join(","));
}

/** The clock's minute, for parts that really change with it (a sheet open over the agenda). */
export const useMinuteNow = () => Math.floor(useNow() / 60_000) * 60_000;
