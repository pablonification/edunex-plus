// Attendance alerts (#85), from SIX's exact counts:
// - SIX didn't count a class: a few hours after a class on SIX's timetable
//   ends (the same day), SIX's count for that course should have gone up.
//   Held up but attended not: SIX marked the Student absent. Neither: SIX
//   hasn't recorded the meeting. Either way the Student hears it while the
//   lecturer still remembers. Once per class.
// - No absences left, or the target out of reach: once each time a course's
//   SIX count moves it into that state, against the course's own target.
//   Changing a target never alerts: the Student is looking right at it.
import { attendanceHealth, isExamActivity, judgeClass, lecturePeriod, percent, resultGate, targetFor } from "../../core/attendance";
import { wibDay } from "../../core/course-meetings";
import type { SixCourse } from "../../core/models";
import type { AlertDraft, Detector, DetectorContext, PlannedAlert } from "./detector";

type Read = Pick<DetectorContext, "get">;
const sixCourses = ({ get }: Read) => get("six.courses");
const sixSchedule = ({ get }: Read) => get("six.schedule") ?? [];
const sixTerm = ({ get }: Read) => get("six.student")?.term ?? null;

/**
 * SIX's count over time comes from the saved log (`six.countLog`, written by
 * the status feed before each new count lands), so a class is judged the same
 * after a restart, the same day only, and by the same rule as Presensi
 * (`judgeClass`): never a class from before the app watched, never one whose
 * count can't be told apart from another class's. Signing out of SIX, or
 * another Student, starts the log over.
 */
export function sixNotCounting(): Detector {
  return {
    name: "attendance.sixNotCounting",
    watches: ["six.courses", "six.schedule", "six.countLog", "six.classResults"],
    plan(context) {
      const courses = sixCourses(context) ?? [];
      const schedule = sixSchedule(context);
      const log = context.get("six.countLog") ?? {};
      const results = context.get("six.classResults") ?? {};
      // Only a count read after the class says anything: SIX offline or signed out isn't SIX not counting.
      const read = context.fetchedAt("six.courses");
      if (read === null) return [];
      const planned: PlannedAlert[] = [];
      const today = wibDay(context.now);
      for (const session of schedule) {
        if (isExamActivity(session.activity) || wibDay(session.start) !== today) continue;
        const count = courses.find((c) => c.code === session.courseCode)?.attendance;
        const judged = judgeClass(session, schedule, log, results, read);
        if (!count || !judged || judged.result === "counted") continue;
        planned.push({
          id: `six.notCounted:${session.id}`,
          kind: "attendanceRisk",
          source: "six",
          ...resultGate(session),
          title: { key: judged.result === "absent" ? "alert.six.absent" : "alert.six.missing", vars: { course: session.courseCode } },
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
  watches: ["six.courses"],
  changed(change, context) {
    if (change.name !== "six.courses" || !change.previous) return [];
    const previous = change.previous;
    const { now, get, settings } = context;
    const schedule = sixSchedule(context);
    const period = lecturePeriod(get("itb.calendar"), sixTerm(context), now);
    const presence = get("edunex.presence") ?? {};
    const health = (course: SixCourse | undefined, code: string) =>
      attendanceHealth({ code, six: course?.attendance ?? null, presence: presence[code] ?? [], schedule, period, target: targetFor(settings, code), now });
    const drafts: AlertDraft[] = [];
    for (const course of change.next) {
      const next = health(course, course.code);
      const before = health(
        previous.find((c) => c.code === course.code),
        course.code,
      );
      if ((next.state !== "none" && next.state !== "out") || next.state === before.state) continue;
      // The best case rounded down, as every screen says it: 79.6 % never reads as 80 %.
      const counts = { course: course.code, attended: next.attended ?? 0, held: next.held ?? 0, target: next.target, best: percent(next.best ?? 0) };
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
