// What the first run leaves on Beranda instead of taking over the screen (W15): once the first read is in, a card
// with what the app found ("Semua siap, Dimas. 5 mata kuliah · 10 tugas · 40 pertemuan") and the way to the summary;
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
import { scanSummary } from "../../../../src/core/first-scan";
import { Button, IconButton } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { Text } from "../../ui/text";
import { shape, space, useTheme } from "../../ui/theme";
import { useScanReady } from "../first-scan/scan";

/** "Semua siap": shown once the first read is in, until the Student opens the summary or closes the card. */
export function FirstScanCard() {
  const { firstScanDone } = useSettings();
  if (firstScanDone) return null;
  return <ScanCard />;
}

function ScanCard() {
  const t = useT();
  const theme = useTheme();
  const bridge = useBridge();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const { saved, statuses, ready } = useScanReady();
  if (!ready) return null;
  const summary = scanSummary(saved, statuses);
  const name = account ? firstName(account.name) : student ? firstName(student.name) : null;
  const seen = () => void bridge.invoke("settings.update", { firstScanDone: true }).catch(() => undefined);
  const counts = [
    `${summary.courses} ${t("welcome.count.courses", { count: summary.courses })}`,
    `${summary.tasks} ${t("welcome.count.tasks", { count: summary.tasks })}`,
    `${summary.meetings} ${t("welcome.count.meetings", { count: summary.meetings })}`,
  ].join(" · ");
  return (
    <View
      testID="card.firstScan"
      style={{ marginTop: space[4], borderRadius: shape.lg, backgroundColor: theme.color.primaryContainer, paddingLeft: space[4], paddingTop: space[3] }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
        <View style={{ paddingTop: space[2] + 2 }}>
          <Icons.CheckCircle size={22} weight="fill" color={theme.color.onPrimaryContainer} />
        </View>
        <View style={{ flex: 1, paddingTop: space[2] }}>
          <Text size="titleMedium" tone="onPrimaryContainer" accessibilityRole="header">
            {name ? t("welcome.readyTitle", { name }) : t("welcome.readyTitlePlain")}
          </Text>
          <Text size="bodyMedium" tone="onPrimaryContainer" style={{ marginTop: 2 }}>
            {counts}
          </Text>
        </View>
        <IconButton label={t("action.close")} onPress={seen} testID="action.firstScan.close">
          <Icons.X size={20} color={theme.color.onPrimaryContainer} />
        </IconButton>
      </View>
      <View style={{ flexDirection: "row", marginLeft: space[8], marginBottom: space[2] }}>
        <Button
          variant="ghost"
          onPress={() => {
            seen();
            router.push("/first-scan");
          }}
          testID="action.firstScan.open"
          style={{ marginLeft: -space[1] }}
        >
          {t("mobile.home.scanOpen")}
        </Button>
      </View>
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
  const theme = useTheme();
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
  return (
    <View
      testID="card.notify"
      style={{ marginTop: space[4], borderRadius: shape.lg, backgroundColor: theme.color.surfaceContainerLow, padding: space[4], gap: space[3] }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
        <View
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.color.secondaryContainer, alignItems: "center", justifyContent: "center" }}
        >
          <Icons.Bell size={20} color={theme.color.onSecondaryContainer} />
        </View>
        <View style={{ flex: 1 }}>
          <Text size="titleMedium">{t("mobile.home.notifyTitle")}</Text>
          <Text size="bodyMedium" tone="muted" style={{ marginTop: 2 }}>
            {t("mobile.home.notifyBody")}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: space[2] }}>
        <Button variant="ghost" onPress={() => void answer(false)} testID="action.notify.later">
          {t("mobile.home.notifyLater")}
        </Button>
        <Button variant="tonal" onPress={() => void answer(true)} testID="action.notify.on">
          {t("mobile.home.notifyOn")}
        </Button>
      </View>
    </View>
  );
}
