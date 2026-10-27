// Errors in the window, for the app's own log in main (ADR 0014), which a problem report carries:
// an error nobody caught, a promise nobody waited for, and a panel its crash guard caught
// (ui/panel-boundary.tsx). The window only says what broke; main keeps it, in memory only.
import { useEffect } from "react";
import type { ActionInput } from "../core/contract";
import type { Bridge } from "./bridge";

type WindowError = ActionInput<"report.windowError">;

/** A window that breaks in a loop says so a few times a minute, not thousands. */
const MOST_PER_MINUTE = 20;
/** As much of a message as the log keeps (src/engine/app-log.ts). */
const MAX_MESSAGE = 500;

let send: ((error: WindowError) => void) | null = null;
/** What broke before the window was connected to main (a panel's first draw), sent once it is. */
let waiting: WindowError[] = [];

/** Something broke: what and where, as one line ("TypeError: x is undefined"). Never its stack, which names this computer's folders. */
export function windowError(kind: WindowError["kind"], error: unknown, where?: string): void {
  const message = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, MAX_MESSAGE);
  const said: WindowError = { kind, message, ...(where ? { where: where.slice(0, 80) } : {}) };
  if (send) send(said);
  else if (waiting.length < MOST_PER_MINUTE) waiting.push(said);
}

/** While the window is open: what breaks in it goes to main. */
export function useWindowErrors(bridge: Bridge): void {
  useEffect(() => {
    let sent: number[] = [];
    send = (said) => {
      const now = Date.now();
      sent = sent.filter((at) => now - at < 60_000);
      if (sent.length >= MOST_PER_MINUTE) return;
      sent.push(now);
      void bridge.invoke("report.windowError", said).catch(() => undefined);
    };
    for (const said of waiting) send(said);
    waiting = [];
    const onError = (event: ErrorEvent) => windowError("error", event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => windowError("rejection", event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      send = null;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [bridge]);
}
