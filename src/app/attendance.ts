// Each term course's attendance as the screens show it (#85): SIX's count,
// what's left before the Student's target, where it counts, and the EduNex
// Presence windows open now with the action that counts in each. The
// Presensi screen, its sidebar badge and the course header read it.
import { useMemo } from "react";
import { type AttendanceHealth, attendanceHealth, lecturePeriod, openWindows, type PresenceAction, presenceAction } from "../core/attendance";
import type { ClassSession, DatasetName, PresenceSession, SixCourse, SixStudent } from "../core/models";
import { type TermCourse, useTermCourses } from "./courses";
import { useNow } from "./i18n";
import { useDataset, useSettings } from "./store";

// SIX's datasets are registered by the SIX ticket (#76); until then nothing arrives under these names.
const SIX_COURSES = "six.courses" as DatasetName;
const SIX_SCHEDULE = "six.schedule" as DatasetName;
const SIX_STUDENT = "six.student" as DatasetName;

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
  target: number;
  /** ITB's last lecture day ("2026-12-04"), when the calendar has it. */
  lastDay: string | null;
}

export function useAttendance(): Attendance | undefined {
  const courses = useTermCourses();
  const presence = useDataset("edunex.presence");
  const tasks = useDataset("edunex.tasks");
  const calendar = useDataset("itb.calendar");
  const sixCourses = useDataset(SIX_COURSES) as SixCourse[] | undefined;
  const schedule = useDataset(SIX_SCHEDULE) as ClassSession[] | undefined;
  const student = useDataset(SIX_STUDENT) as SixStudent | undefined;
  const { attendanceTarget: target } = useSettings();
  // Minute precision is plenty, and keeps the math from rerunning every tick.
  const now = Math.floor(useNow() / 60_000) * 60_000;
  return useMemo(() => {
    if (!courses) return undefined;
    const period = lecturePeriod(calendar, student?.term ?? null, now);
    const list = courses.map((course) => {
      const six = course.attendance ?? sixCourses?.find((c) => c.code === course.code)?.attendance ?? null;
      const mine = presence?.[course.code] ?? [];
      const health = attendanceHealth({ code: course.code, six, presence: mine, schedule: schedule ?? [], period, target, now });
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
  }, [courses, presence, tasks, calendar, sixCourses, schedule, student, target, now]);
}
