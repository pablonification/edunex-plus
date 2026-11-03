// SIX's "Tandai Hadir" alerts: the moment the button shows in a class's popup
// on SIX (../sources/six/check-in.ts reads it during class), one urgent alert
// that opens SIX there; and 15 minutes before the class ends, another if the
// button still shows (the Student hasn't pressed it). Once pressed (the button
// goes), nothing more: the closing one, booked on the phone, is taken back.
// On the phone only, a reminder at the start of every class SIX counts
// (sixClassStart): with the app closed nothing reads SIX for the button.
import { countedIn, isExamActivity } from "../../core/attendance";
import { CHECK_IN_LATE } from "../../core/check-in";
import { sixTimetableUrl } from "../../core/links";
import type { ClassSession } from "../../core/models";
import { taskWindows } from "../../core/schedule";
import { clockTime, type Detector, type PlannedAlert } from "./detector";

const MINUTE = 60_000;
/** The reminder comes this long before the class ends. */
const CLOSING_LEAD = 15 * MINUTE;

export const sixCheckIn: Detector = {
  name: "six.checkIn",
  watches: ["six.checkIn", "six.schedule", "six.student"],
  plan({ get }) {
    const who = get("six.student");
    if (!who) return [];
    const sessions = new Map<string, ClassSession>((get("six.schedule") ?? []).map((session) => [session.id, session]));
    return Object.entries(get("six.checkIn") ?? {}).flatMap(([id, check]): PlannedAlert[] => {
      const session = sessions.get(id);
      if (!session || check.state !== "open") return [];
      const alert = {
        kind: "presenceOpen",
        source: "six",
        urgent: true,
        body: { key: "alert.checkIn.body", vars: { time: clockTime(session.end) } },
        target: { screen: "home" },
        checkIn: { meetingId: id, url: sixTimetableUrl(who, session.start) },
      } as const;
      const opened: PlannedAlert = {
        ...alert,
        id: `six.checkIn:${id}`,
        at: check.since,
        until: session.end + CHECK_IN_LATE,
        title: { key: "alert.checkIn", vars: { course: session.courseCode } },
      };
      const closing = session.end - CLOSING_LEAD;
      // Shown under 15 minutes before the end: the first alert, which says when it ends, is the reminder.
      if (check.since >= closing) return [opened];
      return [
        opened,
        {
          ...alert,
          kind: "presenceClosing",
          id: `six.checkInClosing:${id}`,
          at: closing,
          until: session.end,
          title: { key: "alert.checkInClosing", vars: { course: session.courseCode } },
        },
      ];
    });
  },
};

/**
 * The phone's reminder the minute a class SIX counts starts (where Beranda says "Tekan Tandai Hadir
 * di SIX"): booked ahead with Android (mobile/src/host/booking.ts), it comes with the app closed,
 * when nothing reads SIX for the button. Opt-in (EngineDeps.checkInReminders): the desktop reads SIX
 * all class while it runs, so it has none. One per class, at its time as SIX lists it now; none once
 * SIX showed the button (its own alert said so, or the Student pressed it).
 */
export const sixClassStart: Detector = {
  name: "six.classStart",
  watches: ["six.schedule", "six.student", "six.courses", "six.checkIn", "edunex.presence", "edunex.tasks"],
  plan({ get, now }) {
    const who = get("six.student");
    if (!who) return [];
    const schedule = get("six.schedule") ?? [];
    const courses = get("six.courses") ?? [];
    const presence = get("edunex.presence") ?? {};
    const checks = get("six.checkIn") ?? {};
    // As the class-soon alert: not an exam, nor SIX's meeting that stands for handing in a Task.
    const handIn = new Set(taskWindows(presence, schedule, get("edunex.tasks") ?? []).flatMap((w) => (w.six ? [w.six.id] : [])));
    const countsInSix = (code: string) => {
      const where = countedIn(courses.find((course) => course.code === code)?.attendance ?? null, presence[code] ?? [], now);
      return where === "six" || where === "both";
    };
    return schedule
      .filter((session) => !isExamActivity(session.activity) && !handIn.has(session.id))
      .filter((session) => (checks[session.id]?.state ?? "waiting") === "waiting" && countsInSix(session.courseCode))
      .map(
        (session): PlannedAlert => ({
          id: `six.classStart:${session.id}:${session.start}`,
          kind: "presenceOpen",
          source: "six",
          urgent: true,
          at: session.start,
          until: session.end,
          title: { key: "mobile.alert.classStarted", vars: { course: session.courseCode } },
          body: { key: "mobile.alert.classStarted.body", vars: { time: clockTime(session.end) } },
          target: { screen: "home" },
          checkIn: { meetingId: session.id, url: sixTimetableUrl(who, session.start) },
        }),
      );
  },
};
