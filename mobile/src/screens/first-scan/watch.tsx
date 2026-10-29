// Until the first-run scan was shown once (the setting firstScanDone), the watch for the first full
// sync, as the desktop's (src/app/shell/first-scan.tsx Watch): once it's done, remember it, and open
// the summary only with something to say. Drawn by the app's frame once the welcome has closed; it
// waits while "Laporkan masalah" or search is open. If it breaks, the summary just doesn't open by
// itself (Settings still opens it), and the app's log says why.
import { router, usePathname } from "expo-router";
import { Component, type ReactNode, useEffect, useRef } from "react";
import { useBridge, useSettings } from "../../../../src/app/store";
import { useScan } from "./scan";

/** Screens the summary doesn't open over: it waits its turn. */
const BUSY = new Set(["/report", "/search", "/first-scan"]);

export function FirstScanWatch() {
  const { firstScanDone } = useSettings();
  const bridge = useBridge();
  if (firstScanDone) return null;
  return (
    <Quiet onError={(message) => void bridge.invoke("report.windowError", { kind: "panel", where: "first-run scan", message }).catch(() => undefined)}>
      <Watch />
    </Quiet>
  );
}

function Watch() {
  const bridge = useBridge();
  const path = usePathname();
  const { ready, findings } = useScan(false);
  const done = useRef(false);
  const blocked = BUSY.has(path);
  useEffect(() => {
    if (!ready || blocked || done.current) return;
    done.current = true;
    void bridge.invoke("settings.update", { firstScanDone: true }).catch(() => undefined);
    if (findings.length) router.push("/first-scan");
  }, [ready, blocked, findings.length, bridge]);
  return null;
}

/** The watch has nothing to show: if it breaks, it draws nothing and says so in the app's log. */
class Quiet extends Component<{ children: ReactNode; onError: (message: string) => void }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[first-run scan]", error);
    this.props.onError((error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 500));
  }
  render() {
    return this.state.broken ? null : this.props.children;
  }
}
