// Settings › Notifikasi's notice, above its rows, while Android's permission for notifications is off: no
// reminder will show, booked ahead or live. Its button asks for the permission while Android still
// lets the app ask, then opens the app's notification settings. Checked again on return to the app.
import Constants from "expo-constants";
import * as IntentLauncher from "expo-intent-launcher";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import { useT } from "../../../src/app/i18n";
import { Icons } from "../ui/icons";
import { Appear, Tap } from "../ui/moves";
import { Text } from "../ui/text";
import { space, useTheme } from "../ui/theme";

/** Android's page of this app's notifications; the app's own settings page where that one won't open (and on iOS). */
export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS !== "android") return Linking.openSettings();
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS, {
      extra: { "android.provider.extra.APP_PACKAGE": Constants.expoConfig?.android?.package },
    });
  } catch {
    await Linking.openSettings();
  }
}

export type NotificationPermission = ReturnType<typeof useNotificationPermission>;

/** Android's permission for notifications (null until read), checked again on return to the app. */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<Notifications.NotificationPermissionsStatus | null>(null);
  const check = useCallback(async () => setPermission(await Notifications.getPermissionsAsync()), []);
  useEffect(() => {
    void check().catch(() => undefined);
    const change = AppState.addEventListener("change", (state) => {
      if (state === "active") void check().catch(() => undefined);
    });
    return () => change.remove();
  }, [check]);
  return { permission, setPermission, check, off: permission !== null && !permission.granted };
}

/**
 * The notice, one line: what's wrong ("Mati di HP ini": the bell and the page's title say what) and its one button, 48 dp tall, one word ("Nyalakan": the
 * line beside it says what; a screen reader hears "Nyalakan notifikasi"). The same part, the same look, on Notifikasi
 * and in Settings; what being off means is on the switches, greyed under it.
 */
export function NotificationsOff({ state }: { state: NotificationPermission }) {
  const t = useT();
  const v = useTheme().v4;
  const { permission, setPermission, check } = state;
  if (!permission || permission.granted) return null;
  const turnOn = async () => {
    if (permission.canAskAgain) setPermission(await Notifications.requestPermissionsAsync());
    else await openNotificationSettings();
    await check();
  };
  return (
    // It comes a moment after the screen (Android is asked first) and goes when notifications are on: seen doing both.
    <Appear
      testID="note.notificationsOff"
      style={{
        marginBottom: space[3],
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        paddingLeft: space[4],
        paddingRight: space[2],
        paddingVertical: space[2],
        borderRadius: 16,
        backgroundColor: v.ambBg,
      }}
    >
      <Icons.Bell size={20} color={v.ambFg} />
      <Text size="bodyLarge" weight="semibold" numberOfLines={2} style={{ flex: 1, color: v.ambFg }}>
        {t("mobile.settings.notificationsOffTitle")}
      </Text>
      <Tap
        onPress={() => void turnOn().catch(() => undefined)}
        accessibilityRole="button"
        accessibilityLabel={t("mobile.settings.notificationsTurnOn")}
        testID="action.notificationsOn"
        // The app's one button colour (the brand's blue), as every other main button: amber is the state's, not the action's.
        style={{ minHeight: 48, paddingHorizontal: space[5], borderRadius: 24, justifyContent: "center", backgroundColor: v.brand }}
      >
        <Text size="labelLarge" weight="bold" style={{ color: v.onBrand }}>
          {t("mobile.settings.alertsTurnOn")}
        </Text>
      </Tap>
    </Appear>
  );
}
