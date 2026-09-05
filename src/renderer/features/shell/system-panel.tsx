import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import type { AppInfo } from "@shared/shell";

/**
 * Home panel instrumentation for the shell slice (#32): what a desktop app's
 * about/settings screen shows instead of a landing-page hero — real runtime
 * facts (version, platform, tray, notification support) straight from the
 * main process, plus a manual trigger for the notification carve-out check.
 * Styled as an inset grouped list (macOS System Settings recipe): muted
 * surface, no borders, hairline-free rows.
 */

function InfoRow({ label, ok, value }: { label: string; ok?: boolean; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {ok !== undefined && <StatusDot color={ok ? "green" : "yellow"} />}
      <span className="text-[13px] leading-5 text-text-secondary">{label}</span>
      <span className="ml-auto text-[13px] font-medium text-text-primary">{value}</span>
    </div>
  );
}

export function SystemPanel() {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.edunex.getAppInfo().then((result) => {
      if (!cancelled) setInfo(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-6 max-w-md">
      <h2 className="px-1 text-[13px] font-semibold text-text-tertiary">System</h2>
      <div className="mt-2 rounded-xl bg-background-secondary-default/80 p-1">
        <InfoRow label="App version" value={info ? info.version : "…"} />
        <InfoRow label="Platform" value={info ? info.platform : "…"} />
        <InfoRow
          label="Tray (close keeps app running)"
          value={info ? (info.trayActive ? "Active" : "Unavailable") : "…"}
          ok={info ? info.trayActive : undefined}
        />
        <InfoRow
          label="OS notifications"
          value={info ? (info.notificationsSupported ? "Supported" : "Unsupported") : "…"}
          ok={info ? info.notificationsSupported : undefined}
        />
      </div>
      <div className="mt-3 px-1">
        <Button variant="ghost" size="small" onClick={() => void window.edunex.fireTestNotification()}>
          Send test notification
        </Button>
      </div>
    </section>
  );
}
