import type { CapturedAuth } from "../../shared/auth";

/**
 * Reading `localStorage.auth` out of the login webview — the capture step the
 * auth-spike prototype proved (~2s after the SSO redirect-back lands on
 * edunex.itb.ac.id).
 */

/** Accepts only the exact auth shape; anything else (login page leftovers,
 * garbage, half-writes) is not a session. */
export function parseCapturedAuth(raw: unknown): CapturedAuth | null {
  if (typeof raw !== "object" || raw === null) return null;
  const it = raw as Record<string, unknown>;
  if (typeof it.accessToken !== "string" || it.accessToken.length === 0) return null;
  if (typeof it.refreshToken !== "string" || it.refreshToken.length === 0) return null;
  if (typeof it.expirationDate !== "string") return null;
  if (typeof it.verified !== "boolean") return null;
  if (typeof it.accounts !== "object" || it.accounts === null || Array.isArray(it.accounts)) {
    return null;
  }
  return {
    accessToken: it.accessToken,
    refreshToken: it.refreshToken,
    expirationDate: it.expirationDate,
    verified: it.verified,
    accounts: it.accounts as Record<string, unknown>,
  };
}

/** Minimal surface of a WebContents this loop needs — keeps it testable
 * without Electron. */
export type AuthReader = () => Promise<unknown>;

export interface AuthCapture {
  /** Begins polling; returns false if the loop is already running. */
  start(onCaptured: (auth: CapturedAuth) => void): boolean;
  stop(): void;
}

/**
 * Polls the webview's localStorage until a valid session shows up. No
 * timeout on purpose: MFA can take as long as the human needs; the loop only
 * ends on success or stop() (login closed / webview left the origin). A hung
 * reader must not wedge the loop, so only ever one poll is in flight and
 * start() while already running is a no-op.
 */
export function createAuthCapture(
  executeJs: AuthReader,
  opts: { intervalMs: number },
): AuthCapture {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let inFlight = false;

  async function poll(onCaptured: (auth: CapturedAuth) => void) {
    if (!running || inFlight) return;
    inFlight = true;
    try {
      const raw = await executeJs();
      const auth = parseCapturedAuth(typeof raw === "string" ? JSON.parse(raw) : raw);
      if (auth) {
        running = false;
        onCaptured(auth);
        return;
      }
    } catch {
      // Webview mid-navigation or frame gone — the next tick retries.
    } finally {
      inFlight = false;
    }
    if (running) timer = setTimeout(() => void poll(onCaptured), opts.intervalMs);
  }

  return {
    start(onCaptured) {
      if (running) return false;
      running = true;
      void poll(onCaptured);
      return true;
    },
    stop() {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
