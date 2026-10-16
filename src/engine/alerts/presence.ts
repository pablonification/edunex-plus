// The Presence alerts (#85): the minute an Edunex Presence window opens, one
// urgent alert naming the action that counts there and when it closes; and
// 15 minutes before it closes, another if the Student still isn't recorded.
// Every window, even in a course whose attendance counts in SIX: a lecturer
// may use both systems, and the action takes seconds. A window the Student
// was already recorded in, or that closed, never alerts.
import { type PresenceActivity, presenceAction } from "../../core/attendance";
import type { AlertText, PresenceSession, Task } from "../../core/models";
import type { StringKey } from "../../core/strings";
import { clockTime, type Detector, type PlannedAlert } from "./detector";

const MINUTE = 60_000;
/** The closing reminder comes this long before the window closes. */
const CLOSING_LEAD = 15 * MINUTE;
/**
 * A window this short gets no closing reminder: the opening alert, which says
 * when it closes, came at most 15 minutes before it would.
 */
const SHORT_WINDOW = 30 * MINUTE;

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

/** What counts as present in this window, and when it closes. */
function presenceBody(session: PresenceSession, tasks: readonly Task[]): AlertText {
  const action = presenceAction(session, tasks);
  // Without the Task in hand, the lecturer's note ("Presensi dengan submit Tugas 02 Bab II") says it best.
  const key =
    action.activity === "assignment" && !action.task ? (session.note ? "alert.presence.note" : "alert.presence.assignmentUnknown") : BODY[action.activity];
  return { key, vars: { time: clockTime(session.closesAt), task: action.task?.title ?? "", note: session.note ?? "" } };
}

/** Every window the Student isn't recorded in yet, past or future, with its course code. */
function unrecorded(get: Parameters<NonNullable<Detector["plan"]>>[0]["get"]) {
  return Object.entries(get("edunex.presence") ?? {}).flatMap(([code, sessions]) =>
    sessions.filter((session) => !session.recorded?.present).map((session) => ({ code, session })),
  );
}

export const presenceOpening: Detector = {
  name: "presence.open",
  // The Tasks too: what counts in a window can be one of them.
  watches: ["edunex.presence", "edunex.tasks"],
  plan({ get }) {
    const tasks = get("edunex.tasks") ?? [];
    return unrecorded(get).map(
      ({ code, session }): PlannedAlert => ({
        id: `presence.open:${session.id}:${session.opensAt}`,
        kind: "presenceOpen",
        source: "edunex",
        urgent: true,
        at: session.opensAt,
        until: session.closesAt,
        title: { key: "alert.presenceOpen", vars: { course: code } },
        body: presenceBody(session, tasks),
        target: { screen: "course", code, tab: "meetings" },
      }),
    );
  },
};

export const presenceClosing: Detector = {
  name: "presence.closing",
  // The Tasks too: what counts in a window can be one of them.
  watches: ["edunex.presence", "edunex.tasks"],
  plan({ get }) {
    const tasks = get("edunex.tasks") ?? [];
    return unrecorded(get)
      .filter(({ session }) => session.closesAt - session.opensAt > SHORT_WINDOW)
      .map(
        ({ code, session }): PlannedAlert => ({
          id: `presence.closing:${session.id}:${session.closesAt}`,
          kind: "presenceClosing",
          source: "edunex",
          urgent: true,
          at: session.closesAt - CLOSING_LEAD,
          until: session.closesAt,
          title: { key: "alert.presenceClosing", vars: { course: code } },
          body: presenceBody(session, tasks),
          target: { screen: "course", code, tab: "meetings" },
        }),
      );
  },
};
