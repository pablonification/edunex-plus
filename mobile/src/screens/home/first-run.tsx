// What the first run leaves on Beranda instead of taking over the screen (W15): once the first read is in, one line
// ("Semua siap, Dimas.") that opens the summary;
// and, the first time there's a class, the one ask for notifications, saying what they're for, with Nyalakan and
// Nanti, before Android's own prompt. Each goes for good once answered.
import { File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { firstName } from "../../../../src/app/names";
import { useBridge, useDataset, useSettings } from "../../../../src/app/store";
import { useSettling } from "../../host/settling";
import { IconButton } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { slopY } from "../../ui/sizes";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { useScanReady } from "../first-scan/scan";

/** "Semua siap": shown once the first read is in, until the Student opens the summary. */
export function FirstScanCard() {
  const { firstScanDone } = useSettings();
  // The demo's own first sync isn't the Student's first read.
  const settling = useSettling();
  if (firstScanDone || settling) return null;
  return <ScanCard />;
}

/** One line and its one action: "Semua siap, Dimas." and Lihat ringkasan; the whole card opens the summary. */
function ScanCard() {
  const t = useT();
  const v = useTheme().v4;
  const bridge = useBridge();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const { ready } = useScanReady();
  if (!ready) return null;
  const name = account ? firstName(account.name) : student ? firstName(student.name) : null;
  const title = name ? t("welcome.readyTitle", { name }) : t("welcome.readyTitlePlain");
  const open = () => {
    void bridge.invoke("settings.update", { firstScanDone: true }).catch(() => undefined);
    router.push("/first-scan");
  };
  return (
    <View testID="card.firstScan" style={{ marginTop: space[4] }}>
      <PressScale
        onPress={open}
        testID="action.firstScan.open"
        accessibilityRole="button"
        accessibilityLabel={`${title} ${t("mobile.home.scanOpen")}`}
        style={{ minHeight: 56, borderRadius: 20, backgroundColor: v.brandTint, paddingHorizontal: space[4], flexDirection: "row", alignItems: "center", gap: space[3] }}
      >
        <Icons.CheckCircle size={22} weight="fill" color={v.brandInk} />
        <Text size="bodyLarge" weight="medium" numberOfLines={1} style={{ flex: 1, color: v.brandInk }}>
          {title}
        </Text>
        <Text size="labelLarge" style={{ color: v.brandInk }}>
          {t("mobile.home.scanOpen")}
        </Text>
      </PressScale>
    </View>
  );
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
  // v4: a card like Nanti hari ini's rows, one question, the filled Nyalakan and a close (Nanti); no sentence.
  return (
    <View
      testID="card.notify"
      style={{
        marginTop: space[4],
        borderRadius: 20,
        backgroundColor: v.card,
        padding: space[3],
        paddingLeft: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: v.brandTint, alignItems: "center", justifyContent: "center" }}>
        <Icons.Bell size={22} weight="fill" color={v.brandInk} />
      </View>
      <Text size="bodyLarge" weight="medium" style={{ color: v.fg, flex: 1 }}>
        {t("mobile.home.notifyTitle")}
      </Text>
      <PressScale
        onPress={() => void answer(true)}
        testID="action.notify.on"
        hitSlop={slopY(40)}
        style={{ minHeight: 40, borderRadius: 20, paddingHorizontal: space[4], justifyContent: "center", backgroundColor: v.brand }}
      >
        <Text size="labelLarge" style={{ color: v.onBrand }}>
          {t("mobile.home.notifyOn")}
        </Text>
      </PressScale>
      <IconButton label={t("mobile.home.notifyLater")} onPress={() => void answer(false)} testID="action.notify.later">
        <Icons.X size={20} color={v.muted} />
      </IconButton>
    </View>
  );
}
