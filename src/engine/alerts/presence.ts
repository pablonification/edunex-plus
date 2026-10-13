// The Presence-opening alert (#85): the minute an Edunex Presence window
// opens, one urgent alert naming the action that counts there and when it
// closes. Every window, even in a course whose attendance counts in SIX: a
// lecturer may use both systems, and the action takes seconds. A window the
// Student was already recorded in, or that closed, never alerts.
import { presenceAction, type PresenceActivity } from "../../core/attendance";
import type { StringKey } from "../../core/strings";
import { clockTime, type Detector, type PlannedAlert } from "./detector";

const BODY: Record<PresenceActivity, StringKey> = {
  course: "alert.presence.course",
  module: "alert.presence.module",
  thread: "alert.presence.thread",
  assignment: "alert.presence.assignment",
  exam: "alert.presence.exam",
  vicon: "alert.presence.vicon",
  crs: "alert.presence.crs",
  other: "alert.presence.other",
};

export const presenceOpening: Detector = {
  name: "presence.open",
  watches: ["edunex.presence"],
  plan({ get }) {
    const tasks = get("edunex.tasks") ?? [];
    const planned: PlannedAlert[] = [];
    for (const [code, sessions] of Object.entries(get("edunex.presence") ?? {})) {
      for (const session of sessions) {
        if (session.recorded?.present) continue;
        const action = presenceAction(session, tasks);
        // Without the Task in hand, the lecturer's note ("Presensi dengan submit Tugas 02 Bab II") says it best.
        const key = action.activity === "assignment" && !action.task ? (session.note ? "alert.presence.note" : "alert.presence.assignmentUnknown") : BODY[action.activity];
        planned.push({
          id: `presence.open:${session.id}:${session.opensAt}`,
          kind: "presenceOpen",
          source: "edunex",
          urgent: true,
          at: session.opensAt,
          until: session.closesAt,
          title: { key: "alert.presenceOpen", vars: { course: code } },
          body: { key, vars: { time: clockTime(session.closesAt), task: action.task?.title ?? "", note: session.note ?? "" } },
          target: { screen: "course", code, tab: "meetings" },
        });
      }
    }
    return planned;
  },
};
