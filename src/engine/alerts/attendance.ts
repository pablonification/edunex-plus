// Attendance alerts (#85), from SIX's exact counts:
// - SIX didn't count a class: a few hours after a class on SIX's timetable
//   ends (the same day), SIX's count for that course should have gone up.
//   Held up but attended not: SIX marked the Student absent. Neither: SIX
//   hasn't recorded the meeting. Either way the Student hears it while the
//   lecturer still remembers. Once per class.
// - No absences left, or the target out of reach: once each time a course
//   moves into that state.
import { afterClass, attendanceHealth, type CountAt, isExamActivity, lecturePeriod } from "../../core/attendance";
import { wibDay } from "../../core/course-meetings";
import type { ClassSession, DatasetName, SixCourse, SixStudent } from "../../core/models";
import type { AlertDraft, Detector, DetectorContext, PlannedAlert } from "./detector";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// SIX's datasets are registered by the SIX ticket (#76); they're read by name until then.
const SIX_COURSES = "six.courses" as DatasetName;
const SIX_SCHEDULE = "six.schedule" as DatasetName;
const SIX_STUDENT = "six.student" as DatasetName;

type Read = Pick<DetectorContext, "get">;
const sixCourses = ({ get }: Read) => get(SIX_COURSES) as SixCourse[] | undefined;
const sixSchedule = ({ get }: Read) => (get(SIX_SCHEDULE) as ClassSession[] | undefined) ?? [];
const sixTerm = ({ get }: Read) => (get(SIX_STUDENT) as SixStudent | undefined)?.term ?? null;

/** Lecturers fill SIX in after class: give it this long. */
const GRACE = 3 * HOUR;

/** When to check a class: a few hours after it ends, and still the same day. */
function checkTime(session: ClassSession): { at: number; until: number } {
  const dayEnd = Date.parse(`${wibDay(session.start)}T00:00:00+07:00`) + 24 * HOUR;
  return { at: Math.max(session.end + 30 * MINUTE, Math.min(session.end + GRACE, dayEnd - HOUR)), until: dayEnd };
}

/**
 * The detector keeps what SIX's count was over time (it only hears about
 * changes), so it can tell whether a class moved it. A fresh sign-in starts
 * the memory over.
 */
export function sixNotCounting(): Detector {
  const seen = new Map<string, CountAt[]>();
  const remember = (code: string, count: CountAt) => {
    const list = seen.get(code) ?? [];
    const last = list.at(-1);
    if (last && last.attended === count.attended && last.held === count.held) return;
    seen.set(code, [...list, count].slice(-30));
  };
  const rememberAll = (courses: readonly SixCourse[], at: number) => {
    for (const course of courses) if (course.attendance) remember(course.code, { at, ...course.attendance });
  };
  return {
    name: "attendance.sixNotCounting",
    watches: [SIX_COURSES, SIX_SCHEDULE],
    changed(change, { now }) {
      if (change.name !== SIX_COURSES) return [];
      if (change.previous === undefined) seen.clear();
      rememberAll(change.next as unknown as SixCourse[], now);
      return [];
    },
    plan(context) {
      const courses = sixCourses(context) ?? [];
      // Counts known since before now (after a restart, from here on).
      for (const course of courses) if (course.attendance && !seen.has(course.code)) remember(course.code, { at: context.now, ...course.attendance });
      const planned: PlannedAlert[] = [];
      const today = wibDay(context.now);
      for (const session of sixSchedule(context)) {
        if (isExamActivity(session.activity) || wibDay(session.start) !== today) continue;
        const count = courses.find((c) => c.code === session.courseCode)?.attendance;
        const before = seen.get(session.courseCode)?.filter((c) => c.at <= session.start).at(-1);
        if (!count || !before) continue;
        // Only a count read after the class says anything: SIX offline or signed out isn't SIX not counting.
        const read = context.fetchedAt(SIX_COURSES);
        if (read === null || read <= session.end) continue;
        const result = afterClass(before, count);
        if (result === "counted") continue;
        planned.push({
          id: `six.notCounted:${session.id}`,
          kind: "attendanceRisk",
          source: "six",
          ...checkTime(session),
          title: { key: result === "absent" ? "alert.six.absent" : "alert.six.missing", vars: { course: session.courseCode } },
          body: { key: "alert.six.body", vars: { attended: count.attended, held: count.held } },
          target: { screen: "presence" },
        });
      }
      return planned;
    },
  };
}

/** No absences left, or the target out of reach: when a course's SIX count moves it there. */
export const attendanceBudget: Detector = {
  name: "attendance.budget",
  watches: [SIX_COURSES],
  changed(change, context) {
    if (change.name !== SIX_COURSES || !change.previous) return [];
    const previous = change.previous as unknown as SixCourse[];
    const { now, get, settings } = context;
    const schedule = sixSchedule(context);
    const period = lecturePeriod(get("itb.calendar"), sixTerm(context), now);
    const presence = get("edunex.presence") ?? {};
    const target = settings.attendanceTarget;
    const health = (course: SixCourse | undefined, code: string) =>
      attendanceHealth({ code, six: course?.attendance ?? null, presence: presence[code] ?? [], schedule, period, target, now });
    const drafts: AlertDraft[] = [];
    for (const course of change.next as unknown as SixCourse[]) {
      const next = health(course, course.code);
      const before = health(
        previous.find((c) => c.code === course.code),
        course.code,
      );
      if ((next.state !== "none" && next.state !== "out") || next.state === before.state) continue;
      const counts = { course: course.code, attended: next.attended ?? 0, held: next.held ?? 0, target, best: Math.round((next.best ?? 0) * 100) };
      drafts.push({
        id: `attendance.${next.state}:${course.code}:${next.attended}/${next.held}`,
        kind: "attendanceRisk",
        source: "six",
        title: { key: next.state === "none" ? "alert.attendance.none" : "alert.attendance.out", vars: counts },
        body: { key: next.state === "none" ? "alert.attendance.none.body" : "alert.attendance.out.body", vars: counts },
        target: { screen: "presence" },
      });
    }
    return drafts;
  },
};
