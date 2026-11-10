// The first read is in: said once, as the app's snackbar just above the tabs ("Semua siap.", with Lihat ringkasan, which
// opens the summary). It pushes nothing on Beranda and leaves nothing there; afterwards the summary is in Semua layanan
// ("Ringkasan awal"). Never under the first minute's stage, and never for the demo's own first sync. Drawn by the
// sign-in host (../../shell/sign-in.tsx), which is there on every screen.
import { router } from "expo-router";
import { useEffect } from "react";
import { useT } from "../../../../src/app/i18n";
import { useBridge, useSettings } from "../../../../src/app/store";
import { useSettling } from "../../host/settling";
import { useFirstMinuteCovering } from "../../shell/first-minute/covering";
import { useNobodyIn } from "../../shell/nobody";
import { toast } from "../../swaps/overlays";
import { useScanReady } from "./scan";

export function FirstReadSaid() {
  const { firstScanDone } = useSettings();
  const settling = useSettling();
  const covering = useFirstMinuteCovering();
  const nobody = useNobodyIn();
  // Once said it's done for good: a start with the first read behind it pays for these four checks and no more.
  if (firstScanDone || settling || covering || nobody) return null;
  return <Watching />;
}

function Watching() {
  const t = useT();
  const bridge = useBridge();
  const { ready } = useScanReady();
  useEffect(() => {
    if (!ready) return;
    void bridge.invoke("settings.update", { firstScanDone: true }).catch(() => undefined);
    toast(t("welcome.readyTitlePlain"), "neutral", { label: t("mobile.home.scanOpen"), onClick: () => router.push("/first-scan") });
  }, [ready, bridge, t]);
  return null;
}
