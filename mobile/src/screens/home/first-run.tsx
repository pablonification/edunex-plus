// What the first run leaves on Beranda: the one ask for notifications ("Ingatkan sebelum kuliah?"), saying what
// they're for, with Nyalakan and a close (Nanti), before Android's own prompt. It's a prompt, not information, so it
// comes late and once: never in the first minute or during the first read, and not in the visit that read finished
// in. It shows from the next time the app is opened with the first read behind it, on a day with a class, until it's
// answered either way; then it's gone for good. The first read leaves nothing here: when it's in, the app's snackbar
// says "Semua siap." once (../first-scan/said.tsx), and the first minute (../../shell/first-minute) hands over to
// Beranda as it is.
import { File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { useSettings } from "../../../../src/app/store";
import { IconButton } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";

/** Nothing: the first read's card left Beranda's page (../first-scan/said.tsx). Kept until Beranda stops drawing it. */
export function FirstScanCard() {
  return null;
}

// Kept on this phone: the ask's answer (once said, either way, the card doesn't come back), and that the first read
// was in when the app was last open (the ask waits for the visit after that one).
const asked = new File(Paths.document, "home-asked.json");
const kept: { notify?: boolean; ready?: boolean } = (() => {
  try {
    return asked.exists ? JSON.parse(asked.textSync()) : {};
  } catch {
    return {};
  }
})();
let askedNotify = kept.notify === true;
/** The first read was already behind the Student when the app opened this time. */
const readyBefore = kept.ready === true;

function remember(what: { notify?: true; ready?: true }): void {
  Object.assign(kept, what);
  try {
    asked.writeSync(JSON.stringify(kept));
  } catch {
    // Not kept: the card comes a visit later, or back next start; nothing worse.
  }
}

function rememberAsked(): void {
  askedNotify = true;
  remember({ notify: true });
}

/**
 * "Ingatkan aku sebelum kuliah": the notification permission, asked where it's useful (a class is on the card above)
 * and once. Android asks only after Nyalakan; with notifications already allowed, or Android no longer asking, nothing.
 */
export function NotifyCard({ hasClass }: { hasClass: boolean }) {
  const t = useT();
  const v = useTheme().v4;
  const { firstScanDone } = useSettings();
  // Late: only in a visit that began with the first read behind it (see the top of this file).
  const [state, setState] = useState<"unknown" | "ask" | "done">(askedNotify || !readyBefore ? "done" : "unknown");
  useEffect(() => {
    if (firstScanDone && !kept.ready) remember({ ready: true });
  }, [firstScanDone]);
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
  // One question with its bell (no tile behind it: it's a mark, not a service), a close (Nanti, 48 dp), and Nyalakan
  // as an outlined button under the question: nothing here is filled, so it never outranks the classes above it.
  return (
    <View
      testID="card.notify"
      style={{ marginTop: space[4], borderRadius: 20, backgroundColor: v.card, paddingLeft: space[4], paddingRight: space[1], paddingTop: space[1] }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Icons.Bell size={24} color={v.fg2} />
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
        accessibilityRole="button"
        style={{ alignSelf: "flex-start", marginLeft: 24 + space[3], minHeight: 48, minWidth: 48, justifyContent: "center" }}
      >
        {/* A button that looks like one: an outlined pill in the brand's ink (48 dp to touch, 36 drawn). */}
        <View style={{ height: 36, paddingHorizontal: space[4], borderRadius: 18, borderWidth: 1.5, borderColor: v.brandInk, justifyContent: "center" }}>
          <Text size="labelLarge" weight="semibold" style={{ color: v.brandInk }}>
            {t("mobile.home.notifyOn")}
          </Text>
        </View>
      </PressScale>
    </View>
  );
}
