// Each term course's attendance as the screens show it (#85): SIX's count,
// what's left before the course's target (its own, or the Student's
// default), where it counts, and the Edunex
// Presence windows open now with the action that counts in each. The
// Presensi screen, its sidebar badge and the course header read it.
import { useMemo } from "react";
import { type AttendanceHealth, attendanceHealth, lecturePeriod, openWindows, type PresenceAction, presenceAction, targetFor } from "../core/attendance";
import type { ClassSession, PresenceSession } from "../core/models";
import { type TermCourse, useTermCourses } from "./courses";
import { useNow } from "./i18n";
import { useDataset, useSettings, useStatus } from "./store";

export interface CourseAttendance {
  course: TermCourse;
  health: AttendanceHealth;
  presence: PresenceSession[];
  /** SIX's exam sessions still to come: they take a lecture slot. */
  exams: ClassSession[];
}

export interface OpenWindow {
  course: TermCourse | undefined;
  code: string;
  session: PresenceSession;
  action: PresenceAction;
  health: AttendanceHealth | undefined;
}

export interface Attendance {
  courses: CourseAttendance[];
  open: OpenWindow[];
  /** The default target (percent), for courses without their own: each course's is on its `health`. */
  target: number;
  /** ITB's last lecture day ("2026-12-04"), when the calendar has it. */
  lastDay: string | null;
}

export function useAttendance(): Attendance | undefined {
  const courses = useTermCourses();
  const presence = useDataset("edunex.presence");
  const tasks = useDataset("edunex.tasks");
  const calendar = useDataset("itb.calendar");
  const sixCourses = useDataset("six.courses");
  const schedule = useDataset("six.schedule");
  const student = useDataset("six.student");
  const { attendanceTarget: target, attendanceTargets } = useSettings();
  // Signed out of SIX: which system counts can't be known, so nothing reads as counting.
  const sixConnected = useStatus("six").state !== "signed-out" || sixCourses !== undefined;
  // Minute precision is plenty, and keeps the math from rerunning every tick.
  const now = Math.floor(useNow() / 60_000) * 60_000;
  return useMemo(() => {
    if (!courses) return undefined;
    const period = lecturePeriod(calendar, student?.term ?? null, now);
    const list = courses.map((course) => {
      const six = course.attendance ?? sixCourses?.find((c) => c.code === course.code)?.attendance ?? null;
      const mine = presence?.[course.code] ?? [];
      const health = attendanceHealth({
        code: course.code,
        six,
        sixConnected,
        presence: mine,
        schedule: schedule ?? [],
        period,
        target: targetFor({ attendanceTarget: target, attendanceTargets }, course.code),
        now,
      });
      const exams = (schedule ?? []).filter((s) => s.courseCode === course.code && s.start > now && /\b(UTS|UAS)\b/i.test(s.activity));
      return { course, health, presence: mine, exams };
    });
    const open = openWindows(presence ?? {}, now).map(({ code, session }) => ({
      code,
      session,
      course: courses.find((c) => c.code === code),
      action: presenceAction(session, tasks ?? []),
      health: list.find((c) => c.course.code === code)?.health,
    }));
    return { courses: list, open, target, lastDay: period?.lastDay ?? null };
  }, [courses, presence, tasks, calendar, sixCourses, schedule, student, target, attendanceTargets, sixConnected, now]);
}
