// Settings › Notifikasi's notice, above its rows, while Android's permission for notifications is off: no
// reminder will show, booked ahead or live. Its button asks for the permission while Android still
// lets the app ask, then opens the app's notification settings. Checked again on return to the app.
import Constants from "expo-constants";
import * as IntentLauncher from "expo-intent-launcher";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, View } from "react-native";
import { useT } from "../../../src/app/i18n";
import { Button } from "../ui/controls";
import { Notice } from "../ui/layout";
import { space } from "../ui/theme";

/** Android's page of this app's notifications; the app's own settings page where that one won't open. */
async function openNotificationSettings(): Promise<void> {
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS, {
      extra: { "android.provider.extra.APP_PACKAGE": Constants.expoConfig?.android?.package },
    });
  } catch {
    await Linking.openSettings();
  }
}

export function NotificationsOff() {
  const t = useT();
  const [permission, setPermission] = useState<Notifications.NotificationPermissionsStatus | null>(null);
  const check = useCallback(async () => setPermission(await Notifications.getPermissionsAsync()), []);
  useEffect(() => {
    void check().catch(() => undefined);
    const change = AppState.addEventListener("change", (state) => {
      if (state === "active") void check().catch(() => undefined);
    });
    return () => change.remove();
  }, [check]);
  if (!permission || permission.granted) return null;
  const turnOn = async () => {
    if (permission.canAskAgain) setPermission(await Notifications.requestPermissionsAsync());
    else await openNotificationSettings();
    await check();
  };
  return (
    <View style={{ marginBottom: space[3] }}>
      <Notice
        tone="warning"
        title={t("mobile.settings.notificationsOffTitle")}
        action={
          <Button size="sm" onPress={() => void turnOn().catch(() => undefined)} testID="action.notificationsOn">
            {t("mobile.settings.notificationsTurnOn")}
          </Button>
        }
        testID="note.notificationsOff"
      >
        {t("mobile.settings.notificationsOffBody")}
      </Notice>
    </View>
  );
}
