// What the first run leaves on Beranda: the one ask for notifications, the first time there's a class, saying what
// they're for, with Nyalakan and Nanti, before Android's own prompt. It goes for good once answered. The first read
// leaves nothing here: when it's in, the app's snackbar says "Semua siap" once, with Lihat ringkasan
// (../first-scan/said.tsx), and the first minute (../../shell/first-minute) hands over to Beranda as it is.
import { File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { IconButton } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";

/** Nothing: the first read's card left Beranda's page (../first-scan/said.tsx). Kept until Beranda stops drawing it. */
export function FirstScanCard() {
  return null;
}

// The ask's answer, kept on this phone: once said (either way), the card doesn't come back.
const asked = new File(Paths.document, "home-asked.json");
let askedNotify = (() => {
  try {
    return asked.exists && JSON.parse(asked.textSync()).notify === true;
  } catch {
    return false;
  }
})();

function rememberAsked(): void {
  askedNotify = true;
  try {
    asked.writeSync(JSON.stringify({ notify: true }));
  } catch {
    // Not kept: the card comes back next start, nothing worse.
  }
}

/**
 * "Ingatkan aku sebelum kuliah": the notification permission, asked where it's useful (a class is on the card above)
 * and once. Android asks only after Nyalakan; with notifications already allowed, or Android no longer asking, nothing.
 */
export function NotifyCard({ hasClass }: { hasClass: boolean }) {
  const t = useT();
  const v = useTheme().v4;
  const [state, setState] = useState<"unknown" | "ask" | "done">(askedNotify ? "done" : "unknown");
  useEffect(() => {
    if (state !== "unknown") return;
    Notifications.getPermissionsAsync().then(
      (permission) => setState(!permission.granted && permission.canAskAgain ? "ask" : "done"),
      () => setState("done"),
    );
  }, [state]);
  if (!hasClass || state !== "ask") return null;
  const answer = async (allow: boolean) => {
    rememberAsked();
    setState("done");
    if (allow) await Notifications.requestPermissionsAsync().catch(() => undefined);
  };
  // v4: a card like Nanti hari ini's rows, one question, a close (Nanti), and the filled Nyalakan under the question, so
  // the question keeps the card's width (round 3's fourth review: beside the button it broke over three lines).
  return (
    <View testID="card.notify" style={{ marginTop: space[4], borderRadius: 20, backgroundColor: v.card, padding: space[3], paddingLeft: 14, gap: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: v.brandTint, alignItems: "center", justifyContent: "center" }}>
          <Icons.Bell size={22} weight="fill" color={v.brandInk} />
        </View>
        <Text size="bodyLarge" weight="medium" style={{ color: v.fg, flex: 1 }}>
          {t("mobile.home.notifyTitle")}
        </Text>
        <IconButton label={t("mobile.home.notifyLater")} onPress={() => void answer(false)} testID="action.notify.later">
          <Icons.X size={20} color={v.muted} />
        </IconButton>
      </View>
      <PressScale
        onPress={() => void answer(true)}
        testID="action.notify.on"
        style={{
          alignSelf: "flex-start",
          marginLeft: 44 + space[3],
          minHeight: 48,
          borderRadius: 24,
          paddingHorizontal: space[5],
          justifyContent: "center",
          backgroundColor: v.brand,
        }}
      >
        <Text size="labelLarge" style={{ color: v.onBrand }}>
          {t("mobile.home.notifyOn")}
        </Text>
      </PressScale>
    </View>
  );
}
