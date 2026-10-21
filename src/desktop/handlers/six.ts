// Bridge handlers for SIX (#76), and "Tandai Hadir": SIX opened on a class's popup.
import { sixTimetableUrl } from "../../core/links";
import type { DatasetName, DatasetValue } from "../../core/models";
import { translate } from "../../core/strings";
import type { Engine } from "../../engine/engine";
import { EngineError } from "../../engine/errors";
import { SixSession } from "../../engine/sources/six";
import { demo } from "../demo";
import { forgetSignInSession } from "../signin-session";
import { openSixCheckIn } from "../six-window";
import type { DesktopContext, HandlerGroup } from "./context";

/**
 * Opens SIX in the app's SIX window on a class of the timetable the app read,
 * its popup up, signed in with the engine's session. The demo opens nothing:
 * its SIX is pretend, and the real one isn't the demo's to visit.
 */
export function openCheckIn(
  context: Pick<DesktopContext, "lang" | "packaged"> & { engine: Pick<Engine, "snapshot" | "session"> },
  meetingId: string,
): Promise<void> {
  if (demo) return Promise.resolve();
  const { datasets } = context.engine.snapshot();
  const dataset = <N extends DatasetName>(name: N) => datasets.find((d) => d.name === name)?.value as DatasetValue<N> | undefined;
  const student = dataset("six.student");
  const session = dataset("six.schedule")?.find((s) => s.id === meetingId);
  if (!student || !session) return Promise.reject(new EngineError("Rejected", "That class isn't on SIX's timetable"));
  const saved = SixSession.safeParse(context.engine.session("six"));
  return openSixCheckIn({
    url: sixTimetableUrl(student, session.start),
    meetingId,
    cookie: saved.success ? saved.data.cookie : null,
    title: translate(context.lang(), "six.checkInTitle"),
    devTools: !context.packaged,
  });
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
