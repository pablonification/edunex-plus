// "Laporkan masalah" (ADR 0007), from where the app says something went wrong: a source's status
// (the banner, the status panel), a screen's note about its SIX page, and Settings. One dialog for
// the window (./shell/report-dialog.tsx), opened about what the Student was looking at.
import { useSyncExternalStore } from "react";
import type { ReportAbout } from "../core/models";
import { useT } from "./i18n";
import { Button } from "./ui/controls";
import { Icons } from "./ui/icons";

/** What the Student asked to report, and when (each ask opens a fresh report). */
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
}

/** The report the Student asked for last, if any: the dialog opens on a new one. */
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
export function ReportButton({ about, className }: { about: ReportAbout; className?: string }) {
  const t = useT();
  return (
    <Button size="sm" className={className} aria-label={t("report.title")} icon={<Icons.Flag className="size-3.5" />} onClick={() => openReport(about)}>
      {t("report.open")}
    </Button>
  );
}
