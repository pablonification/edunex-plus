// OS notifications for the engine's alerts, in the Student's current
// language. Each notification is kept referenced until it's clicked or
// closed, or its click would be lost to garbage collection. A click brings
// the window forward on the alert's screen; on a "Tandai Hadir" alert, it
// opens SIX on the class's popup instead. Do Not Disturb / Focus is the
// OS's call: macOS and Windows hold notifications back on their own;
// Linux depends on the desktop's notification daemon.
// Platform notes (signing on macOS, the AppUserModelID on Windows): docs/platform-notifications.md.
import { Notification } from "electron";
import type { AlertText, Lang } from "../core/models";
import type { Route } from "../core/route";
import { translate } from "../core/strings";
import type { AlertNotice } from "../engine/alerts/center";
import { type AreaLog, errorLine } from "../engine/app-log";

export interface Notifier {
  /** Shows the alert; false when this system can't show notifications. */
  show(notice: Pick<AlertNotice, "id" | "kind" | "title" | "body" | "target" | "checkIn">): boolean;
}

export function createNotifier(options: {
  lang: () => Lang;
  open: (route: Route) => void;
  openCheckIn: (meetingId: string) => void;
  /** Which alerts showed and which didn't, for the app's own log (src/engine/app-log.ts): their kind, never their words. */
  log?: AreaLog;
}): Notifier {
  const live = new Set<Notification>();
  const text = (part: AlertText) => translate(options.lang(), part.key, part.vars);
  return {
    show(notice) {
      if (!Notification.isSupported()) {
        options.log?.("warn", `${notice.kind} not shown: this system shows no notifications`);
        return false;
      }
      const notification = new Notification({
        title: text(notice.title),
        body: notice.body ? text(notice.body) : undefined,
        // Presence opening or about to close is time-critical; everything else is a normal notification.
        urgency: notice.kind === "presenceOpen" || notice.kind === "presenceClosing" ? "critical" : "normal",
      });
      const forget = () => live.delete(notification);
      live.add(notification);
      notification.on("click", () => {
        forget();
        if (notice.checkIn) options.openCheckIn(notice.checkIn.meetingId);
        else options.open(notice.target);
      });
      notification.on("close", forget);
      notification.on("failed", (_event, error) => {
        forget();
        console.error("[notifications] not shown:", error);
        options.log?.("error", `${notice.kind} not shown: ${errorLine(error)}`);
      });
      notification.show();
      options.log?.("info", `${notice.kind} shown`);
      return true;
    },
  };
}
