import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";

/**
 * Shell-slice status card (#32): states the close-to-tray contract (user
 * story 12's one-time explainer arrives with #22/#23) and gives a manual
 * trigger for the notification carve-out check — the main process already
 * fires one on dev startup.
 */
export function ShellStatusCard() {
  return (
    <section className="mt-8 max-w-md rounded-2lg border border-separator-border p-4">
      <div className="flex items-center gap-2">
        <StatusDot color="green" />
        <span className="text-body-medium font-semibold">Shell ready</span>
      </div>
      <p className="mt-2 text-body-medium text-text-secondary">
        Closing the window keeps Edunex Plus running in the tray, so notifications keep
        flowing. Quit lives in the tray menu.
      </p>
      <div className="mt-3">
        <Button variant="secondary" onClick={() => void window.edunex.fireTestNotification()}>
          Send test notification
        </Button>
      </div>
    </section>
  );
}
