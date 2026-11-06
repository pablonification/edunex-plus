// A tap on one of the app's notifications opens what it's about, as a click on the desktop's does
// (src/desktop/notifications.ts): the alert's screen, or SIX's timetable on its class for "Tandai
// Hadir". Also when the tap is what started the app.
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { useBridge } from "../../../src/app/store";
import { Route } from "../../../src/core/route";
import type { NoticeData } from "../host/notifier";
import { useNav } from "../nav";

// Shown while the app is open too, as the desktop shows them over its window.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export function NotificationTaps() {
  const nav = useNav();
  const bridge = useBridge();
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data as Partial<NoticeData> | undefined;
      const route = Route.safeParse(data?.target);
      if (data?.checkIn) {
        // SIX's page for the class, else (the class isn't on the timetable read) the alert's own screen, as the
        // desktop falls back to its window.
        void bridge.invoke("six.openCheckIn", { meetingId: data.checkIn.meetingId }).catch(() => nav.go(route.success ? route.data : { screen: "home" }));
        return;
      }
      if (route.success) nav.go(route.data);
    };
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [nav, bridge]);
  return null;
}
