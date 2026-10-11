// OS notifications for the engine's alerts, in the Student's current
// language. Each notification is kept referenced until it's clicked or
// closed, or its click would be lost to garbage collection. A click brings
// the window forward on the alert's screen. Do Not Disturb / Focus is the
// OS's call: macOS and Windows hold notifications back on their own;
// Linux depends on the desktop's notification daemon.
// Platform notes (signing on macOS, the AppUserModelID on Windows): docs/platform-notifications.md.
import { Notification } from "electron";
import type { AlertText, Lang } from "../core/models";
import type { Route } from "../core/route";
import { translate } from "../core/strings";
import type { AlertNotice } from "../engine/alerts/center";

export interface Notifier {
  /** Shows the alert; false when this system can't show notifications. */
  show(notice: Pick<AlertNotice, "id" | "kind" | "title" | "body" | "target">): boolean;
}

export function createNotifier(options: { lang: () => Lang; open: (route: Route) => void }): Notifier {
  const live = new Set<Notification>();
  const text = (part: AlertText) => translate(options.lang(), part.key, part.vars);
  return {
    show(notice) {
      if (!Notification.isSupported()) return false;
      const notification = new Notification({
        title: text(notice.title),
        body: notice.body ? text(notice.body) : undefined,
        // Presence opening is time-critical; everything else is a normal notification.
        urgency: notice.kind === "presenceOpen" ? "critical" : "normal",
      });
      const forget = () => live.delete(notification);
      live.add(notification);
      notification.on("click", () => {
        forget();
        options.open(notice.target);
      });
      notification.on("close", forget);
      notification.on("failed", (_event, error) => {
        forget();
        console.error("[notifications] not shown:", error);
      });
      notification.show();
      return true;
    },
  };
}
