// What the first run leaves on Beranda instead of taking over the screen (W15): one card that holds its place from
// the moment Beranda shows (the first minute hands over to it, ../../shell/first-minute). While the first read runs it
// says what the read has brought so far ("5 mata kuliah · 10 tugas"); once the read is in it turns, in the same place,
// into "Semua siap, Dimas." and opens the summary. It never arrives late and pushes what's under it down.
// And, the first time there's a class, the one ask for notifications, saying what they're for, with Nyalakan and
// Nanti, before Android's own prompt. Each goes for good once answered.
import { File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { firstName } from "../../../../src/app/names";
import { useBridge, useDataset, useSettings } from "../../../../src/app/store";
import { firstRead } from "../../../../src/core/first-scan";
import { useSettling } from "../../host/settling";
import { IconButton } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { useScanReady } from "../first-scan/scan";

/** The first read's card: what's in so far while it runs, then "Semua siap", until the Student opens the summary. */
export function FirstScanCard() {
  const { firstScanDone } = useSettings();
  // The demo's own first sync isn't the Student's first read.
  const settling = useSettling();
  if (firstScanDone || settling) return null;
  return <ScanCard />;
}

/** The card's height, the same reading and ready: nothing under it moves when the read comes in. */
const SCAN_CARD = 56;

/**
 * One line in one place. Reading: what the read has brought, as plain words, nothing to press. Ready: "Semua siap,
 * Dimas." and Lihat ringkasan; the whole card opens the summary.
 */
function ScanCard() {
  const t = useT();
  const v = useTheme().v4;
  const bridge = useBridge();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const courses = useDataset("edunex.courses")?.length ?? 0;
  const tasks = useDataset("edunex.tasks")?.length ?? 0;
  const { saved, statuses, ready } = useScanReady();
  const shape = {
    minHeight: SCAN_CARD,
    borderRadius: 20,
    backgroundColor: v.brandTint,
    paddingHorizontal: space[4],
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
  } as const;
  if (!ready) {
    // Held only while a system is still bringing its part: a read that stopped (offline, a page that changed) leaves no
    // card waiting for it.
    if (firstRead(saved, statuses).next === null) return null;
    const found = [courses ? t("scan.read.courses", { count: courses }) : null, tasks ? t("scan.read.tasks", { count: tasks }) : null]
      .filter(Boolean)
      .join(" · ");
    return (
      <View testID="card.firstRead" style={{ marginTop: space[4] }} accessibilityState={{ busy: true }}>
        <View style={shape} accessible={found !== ""} accessibilityLabel={found}>
          <Text size="bodyLarge" weight="medium" tabular numberOfLines={1} style={{ flex: 1, color: v.brandInk }}>
            {found}
          </Text>
        </View>
      </View>
    );
  }
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
        style={shape}
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
