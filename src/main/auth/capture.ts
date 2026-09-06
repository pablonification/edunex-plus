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
  start(onCaptured: (auth: CapturedAuth) => void): void;
  stop(): void;
}

/**
 * Polls the webview's localStorage until a valid session shows up. No
 * timeout on purpose: MFA can take as long as the human needs; the loop only
 * ends on success or stop() (login closed / webview detached). Polls overlap
 * are guarded so a slow executeJavaScript can't double-fire.
 */
export function createAuthCapture(
  executeJs: AuthReader,
  opts: { intervalMs: number; setTimeout?: typeof setTimeout; clearTimeout?: typeof clearTimeout },
): AuthCapture {
  const setTimeout_ = opts.setTimeout ?? setTimeout;
  const clearTimeout_ = opts.clearTimeout ?? clearTimeout;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let done = false;

  async function poll(onCaptured: (auth: CapturedAuth) => void) {
    if (done || inFlight) return;
    inFlight = true;
    try {
      const raw = await executeJs();
      const auth = parseCapturedAuth(typeof raw === "string" ? JSON.parse(raw) : raw);
      if (auth) {
        done = true;
        onCaptured(auth);
        return;
      }
    } catch {
      // Webview mid-navigation or frame gone — the next tick retries.
    } finally {
      inFlight = false;
    }
    if (!done) timer = setTimeout_(() => void poll(onCaptured), opts.intervalMs);
  }

  return {
    start(onCaptured) {
      done = false;
      void poll(onCaptured);
    },
    stop() {
      done = true;
      if (timer) {
        clearTimeout_(timer);
        timer = null;
      }
    },
  };
}
