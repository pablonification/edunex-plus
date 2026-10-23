// Each term course's attendance as the screens show it (#85): SIX's count,
// what's left before the course's target (its own, or the Student's
// default), where it counts, the next Edunex Presence window, the windows
// open now with the action that counts in each and whether doing it counts
// at all, what SIX's count did after today's class, and the answer when its
// next class clashes with another course's. The Presensi screen, its sidebar
// badge and the course header read it.
import { useMemo } from "react";
import {
  type AttendanceHealth,
  attendanceHealth,
  type ClashPick,
  type ClassResults,
  type CountLog,
  clashPick,
  classResults,
  isExamActivity,
  lecturePeriod,
  openWindows,
  type PresenceAction,
  presenceAction,
  targetFor,
} from "../core/attendance";
import { clashes } from "../core/course-meetings";
import type { ClassSession, PresenceSession } from "../core/models";
import { type TermCourse, useTermCourses } from "./courses";
import { useNow } from "./i18n";
import { useDataset, useDatasetPayload, useSettings, useStatus } from "./store";

export interface CourseAttendance {
  course: TermCourse;
  health: AttendanceHealth;
  presence: PresenceSession[];
  /** The next Edunex Presence window that hasn't opened yet, and what counts in it. */
  nextWindow: { session: PresenceSession; action: PresenceAction } | null;
  /** Its next class shares time with another course's: which, when, and which to go to. */
  clash: { other: string; from: number; to: number; pick: ClashPick; session: ClassSession; with: ClassSession } | null;
}

export interface OpenWindow {
  course: TermCourse | undefined;
  code: string;
  session: PresenceSession;
  action: PresenceAction;
  health: AttendanceHealth | undefined;
  /** Doing it may count: Edunex keeps the course's count, or nobody can say yet. False where only SIX counts: optional. */
  counts: boolean;
}

export interface Attendance {
  courses: CourseAttendance[];
  open: OpenWindow[];
  /** The default target (percent), for courses without their own: each course's is on its `health`. */
  target: number;
  /** ITB's last lecture day ("2026-12-04"), when the calendar has it. */
  lastDay: string | null;
  period: ReturnType<typeof lecturePeriod>;
  /** False while signed out of SIX with nothing of it kept: then no count can be said. */
  sixConnected: boolean;
  /** SIX's timetable, every course. */
  schedule: readonly ClassSession[];
  /** SIX's count over time, and what it did after each class the app watched. */
  countLog: CountLog;
  results: ClassResults;
}

export function useAttendance(): Attendance | undefined {
  const courses = useTermCourses();
  const presence = useDataset("edunex.presence");
  const tasks = useDataset("edunex.tasks");
  const calendar = useDataset("itb.calendar");
  const sixCourses = useDataset("six.courses");
  const schedule = useDataset("six.schedule");
  const student = useDataset("six.student");
  const countLog = useDataset("six.countLog");
  const saved = useDataset("six.classResults");
  // When SIX's count was last read: a class is judged only from a count read after it.
  const readAt = useDatasetPayload("six.courses")?.fetchedAt ?? 0;
  const { attendanceTarget: target, attendanceTargets } = useSettings();
  // Signed out of SIX: which system counts can't be known, so nothing reads as counting.
  const sixConnected = useStatus("six").state !== "signed-out" || sixCourses !== undefined;
  // Minute precision is plenty, and keeps the math from rerunning every tick.
  const now = Math.floor(useNow() / 60_000) * 60_000;
  return useMemo(() => {
    if (!courses) return undefined;
    const period = lecturePeriod(calendar, student?.term ?? null, now);
    const timetable = schedule ?? [];
    // The saved results, and what the latest count already says (the status feed saves it at its next read).
    const results = classResults(saved ?? {}, countLog ?? {}, timetable, now, readAt);
    const healthOf = new Map<string, AttendanceHealth>();
    const base = courses.map((course) => {
      const six = course.attendance ?? sixCourses?.find((c) => c.code === course.code)?.attendance ?? null;
      const mine = presence?.[course.code] ?? [];
      const health = attendanceHealth({
        code: course.code,
        six,
        sixConnected,
        presence: mine,
        schedule: timetable,
        period,
        target: targetFor({ attendanceTarget: target, attendanceTargets }, course.code),
        now,
      });
      healthOf.set(course.code, health);
      const coming = mine.filter((p) => p.opensAt > now && !p.recorded?.present).sort((a, b) => a.opensAt - b.opensAt)[0];
      const nextWindow = coming ? { session: coming, action: presenceAction(coming, tasks ?? []) } : null;
      return { course, health, presence: mine, nextWindow };
    });
    const list = base.map((item): CourseAttendance => {
      // The class on now, else the next: a clash said on its row is about the class the Student decides on.
      const next =
        timetable.find((s) => s.courseCode === item.course.code && s.start <= now && now < s.end && !isExamActivity(s.activity)) ?? item.health.left.next;
      const other = next ? clashes(next, item.course.code, timetable).find((s) => !isExamActivity(s.activity) && healthOf.has(s.courseCode)) : undefined;
      const clash =
        next && other
          ? {
              other: other.courseCode,
              from: Math.max(next.start, other.start),
              to: Math.min(next.end, other.end),
              pick: clashPick(item.health, healthOf.get(other.courseCode)!),
              session: next,
              with: other,
            }
          : null;
      return { ...item, clash };
    });
    const open = openWindows(presence ?? {}, now).map(({ code, session }) => {
      const health = healthOf.get(code);
      return {
        code,
        session,
        course: courses.find((c) => c.code === code),
        action: presenceAction(session, tasks ?? []),
        health,
        counts: health?.countedIn !== "six",
      };
    });
    return {
      courses: list,
      open,
      target,
      lastDay: period?.lastDay ?? null,
      period,
      sixConnected,
      schedule: timetable,
      countLog: countLog ?? {},
      results,
    };
  }, [courses, presence, tasks, calendar, sixCourses, schedule, student, target, attendanceTargets, sixConnected, countLog, saved, readAt, now]);
}
