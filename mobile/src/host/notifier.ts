// The engine's alerts as Android notifications, in the Student's language: the same alerts the
// desktop shows (src/desktop/notifications.ts). A tap opens the alert's screen, or SIX's timetable
// on a "Tandai Hadir" alert. Presence opening or closing goes on a channel of its own that may
// break through, the way the desktop marks it critical (./booking.ts words them, for the timed
// ones booked ahead too).
import * as Notifications from "expo-notifications";
import type { Lang } from "../../../src/core/models";
import { translate } from "../../../src/core/strings";
import type { AlertNotice } from "../../../src/engine/alerts/center";
import { CHANNELS, noticeContent } from "./booking";

export { CHANNELS, type NoticeData } from "./booking";

let channelsMade: Promise<void> | null = null;

/** Android's notification channels, named in the Student's language. Made again when the language changes. */
export function prepareChannels(lang: Lang): Promise<void> {
  channelsMade = (async () => {
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
  return channelsMade;
}

/** The channels, once made (made now if they never were). */
export const channelsReady = (lang: Lang) => channelsMade ?? prepareChannels(lang);

export function phoneNotifier(lang: () => Lang) {
  return {
    async show(notice: Pick<AlertNotice, "id" | "kind" | "title" | "body" | "target" | "checkIn">): Promise<boolean> {
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) return false;
      await channelsReady(lang());
      const { title, body, data, channelId } = noticeContent(notice, lang());
      await Notifications.scheduleNotificationAsync({
        identifier: notice.id,
        content: { title, body, data: data as unknown as Record<string, unknown> },
        trigger: { channelId },
      });
      return true;
    },
  };
}
