// SIX's "Tandai Hadir" alerts: the moment the button shows in a class's popup
// on SIX (../sources/six/check-in.ts reads it during class), one urgent alert
// that opens SIX there; and 15 minutes before the class ends, another if the
// button still shows (the Student hasn't pressed it). Once pressed (the button
// goes), nothing more: the closing one, booked on the phone, is taken back.
import { CHECK_IN_LATE } from "../../core/check-in";
import { sixTimetableUrl } from "../../core/links";
import type { ClassSession } from "../../core/models";
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
