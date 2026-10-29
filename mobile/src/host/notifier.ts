// The engine's alerts as Android notifications, in the Student's language: the same alerts the
// desktop shows (src/desktop/notifications.ts). A tap opens the alert's screen, or SIX's timetable
// on a "Tandai Hadir" alert. Presence opening or closing goes on a channel of its own that may
// break through, the way the desktop marks it critical.
import * as Notifications from "expo-notifications";
import type { AlertText, Lang } from "../../../src/core/models";
import { translate } from "../../../src/core/strings";
import type { AlertNotice } from "../../../src/engine/alerts/center";

export const CHANNELS = { urgent: "presence", normal: "alerts" } as const;
const URGENT = new Set(["presenceOpen", "presenceClosing"]);

/** What a tap on a notification carries back to the app (see useNotificationTaps). */
export interface NoticeData {
  target: AlertNotice["target"];
  checkIn?: AlertNotice["checkIn"];
}

let channelsReady: Promise<void> | null = null;

/** Android's notification channels, named in the Student's language. Made again when the language changes. */
export function prepareChannels(lang: Lang): Promise<void> {
  channelsReady = (async () => {
    await Notifications.setNotificationChannelAsync(CHANNELS.urgent, {
      name: translate(lang, "mobile.channel.presence"),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.normal, {
      name: translate(lang, "mobile.channel.alerts"),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  })().catch(() => undefined);
  return channelsReady;
}

export function phoneNotifier(lang: () => Lang) {
  const text = (part: AlertText) => translate(lang(), part.key, part.vars);
  return {
    async show(notice: Pick<AlertNotice, "id" | "kind" | "title" | "body" | "target" | "checkIn">): Promise<boolean> {
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) return false;
      await (channelsReady ?? prepareChannels(lang()));
      const data: NoticeData = { target: notice.target, ...(notice.checkIn ? { checkIn: notice.checkIn } : {}) };
      await Notifications.scheduleNotificationAsync({
        identifier: notice.id,
        content: {
          title: text(notice.title),
          body: notice.body ? text(notice.body) : null,
          data: data as unknown as Record<string, unknown>,
        },
        trigger: { channelId: URGENT.has(notice.kind) ? CHANNELS.urgent : CHANNELS.normal },
      });
      return true;
    },
  };
}
