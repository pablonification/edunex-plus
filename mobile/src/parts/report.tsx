// "Laporkan masalah", asked from where something went wrong (src/app/report.tsx): the ask is kept
// here and the report screen (app/report.tsx) shows it. The Student sends nothing until they choose.
import { router } from "expo-router";
import { useSyncExternalStore } from "react";
import { useT } from "../../../src/app/i18n";
import type { ReportAbout } from "../../../src/core/models";
import { Button } from "../ui/controls";
import { Icons } from "../ui/icons";

export interface ReportAsk {
  about: ReportAbout;
  at: number;
}

let asked: ReportAsk | null = null;
let asks = 0;
const watchers = new Set<() => void>();

/** Opens "Laporkan masalah" about a source, the datasets a screen shows, or neither (Settings). */
export function openReport(about: ReportAbout): void {
  asked = { about, at: ++asks };
  for (const watcher of watchers) watcher();
  router.push("/report");
}

export function useReportAsk(): ReportAsk | null {
  return useSyncExternalStore(
    (watcher) => {
      watchers.add(watcher);
      return () => void watchers.delete(watcher);
    },
    () => asked,
  );
}

/** "Laporkan", beside what a screen or the status says went wrong. */
export function ReportButton({ about }: { about: ReportAbout }) {
  const t = useT();
  return (
    <Button size="sm" label={t("report.title")} icon={<Icons.Flag size={14} />} onPress={() => openReport(about)} testID="action.report">
      {t("report.open")}
    </Button>
  );
}
