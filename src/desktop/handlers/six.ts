// Bridge handlers for SIX (#76), and "Tandai Hadir": SIX opened on a class's popup.
import { sixTimetableUrl } from "../../core/links";
import type { DatasetName, DatasetValue } from "../../core/models";
import { translate } from "../../core/strings";
import type { Engine } from "../../engine/engine";
import { EngineError } from "../../engine/errors";
import { SixSession } from "../../engine/sources/six";
import { demo } from "../demo";
import { forgetSignInSession } from "../signin-session";
import { openSixWindow, type SixWindowOptions } from "../six-window";
import type { DesktopContext, HandlerGroup } from "./context";

type SixContext = Pick<DesktopContext, "lang" | "packaged"> & { engine: Pick<Engine, "snapshot" | "session" | "act" | "recheckAttendance"> };

/**
 * What every SIX window has, whatever page it opens: signed in with the engine's session; a press in a
 * class's popup there, or the window closing, reads SIX again at once.
 */
export function sixWindowOptions(context: SixContext, title: "six.checkInTitle" | "source.six"): Omit<SixWindowOptions, "url" | "meetingId"> {
  const saved = SixSession.safeParse(context.engine.session("six"));
  return {
    cookie: saved.success ? saved.data.cookie : null,
    title: translate(context.lang(), title),
    devTools: !context.packaged,
    onPressed: (pressed) => void context.engine.act("six", "checkInPressed", { meetingId: pressed }).catch(() => undefined),
    onClosed: () => void context.engine.recheckAttendance("six").catch(() => undefined),
  };
}

/**
 * Opens SIX in the app's SIX window on a class of the timetable the app read,
 * its popup up, signed in with the engine's session. A press there, or the
 * window closing, reads SIX again at once. The demo opens nothing: its SIX is
 * pretend (pressed there at once), and the real one isn't the demo's to visit.
 */
export function openCheckIn(context: SixContext, meetingId: string): Promise<void> {
  if (demo) {
    // No window: the Student presses Tandai Hadir on the pretend SIX, and the app hears it as from the SIX window.
    if (!demo.pressCheckIn) return Promise.resolve();
    demo.pressCheckIn(meetingId);
    return context.engine.act("six", "checkInPressed", { meetingId }).then(() => undefined);
  }
  const { datasets } = context.engine.snapshot();
  const dataset = <N extends DatasetName>(name: N) => datasets.find((d) => d.name === name)?.value as DatasetValue<N> | undefined;
  const student = dataset("six.student");
  const session = dataset("six.schedule")?.find((s) => s.id === meetingId);
  if (!student || !session) return Promise.reject(new EngineError("Rejected", "That class isn't on SIX's timetable"));
  return openSixWindow({ url: sixTimetableUrl(student, session.start), meetingId, ...sixWindowOptions(context, "six.checkInTitle") });
}

export const sixHandlers: HandlerGroup<"auth.signInDone" | "six.openCheckIn"> = (context) => ({
  "auth.signInDone": async () => {
    await forgetSignInSession();
    return {};
  },
  "six.openCheckIn": async ({ meetingId }) => {
    await openCheckIn(context, meetingId);
    return {};
  },
});
