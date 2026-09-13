import type { AuthStatus, CapturedAuth } from "../../shared/auth";

/**
 * The auth state machine (see AuthStatus in shared/auth.ts). Owns the tokens
 * in main; the renderer only ever sees the status. Recovery is interactive
 * by design — there is deliberately no refresh logic anywhere (spec: auth &
 * session): a 401 or a missing token clears the session and pauses the app
 * into the "please sign in again" moment, which reopens the login webview.
 */

export interface SessionStoreLike {
  load(): CapturedAuth | null;
  save(session: CapturedAuth): void;
  clear(): void;
}

export interface SessionManagerDeps {
  store: SessionStoreLike;
  /** Client used for the one verification GET the auth slice makes. */
  api: { get(path: string): Promise<{ status: number }> };
  onChange?(status: AuthStatus): void;
}

export interface SessionManager {
  status(): AuthStatus;
  /** Startup: restore from the encrypted store, verifying the token still
   * works. Signed-in stays signed-in when the check can't reach the network. */
  restore(): Promise<void>;
  /** Login webview is now open in the renderer. */
  startLogin(): void;
  /** `localStorage.auth` was captured out of the webview after the redirect.
   * Persists the tokens, then verifies before leaving authenticating — a
   * stale partition must not flash signed-in and yank the webview away. */
  capture(auth: CapturedAuth): Promise<void>;
  /** 401 from any API use: pause everything into the re-login moment. */
  handleUnauthorized(): void;
  /** Token handed to the API client. */
  accessToken(): string | null;
  /** Account id used to partition on-device feed snapshots. */
  accountId(): string | null;
}

export function createSessionManager(deps: SessionManagerDeps): SessionManager {
  let status: AuthStatus = "signed-out";
  let token: string | null = null;
  let accountId: string | null = null;

  function transitionTo(next: AuthStatus) {
    if (status === next) return;
    status = next;
    deps.onChange?.(next);
  }

  function handleUnauthorized() {
    if (status === "session-expired" && token === null && accountId === null) return;
    token = null;
    accountId = null;
    void deps.store.clear();
    transitionTo("session-expired");
  }

  return {
    status: () => status,

    accessToken: () => token,

    accountId: () => accountId,

    async restore() {
      const stored = await deps.store.load();
      if (!stored) {
        // Initial state is already signed-out; broadcast directly so the
        // renderer leaves its boot gate even though nothing "changed".
        status = "signed-out";
        accountId = null;
        deps.onChange?.("signed-out");
        return;
      }
      token = stored.accessToken;
      accountId = accountIdFromSession(stored);
      const check = await deps.api.get("/login/me");
      if (check.status === 401) {
        // Stale session (cookies don't survive restarts anyway): clear it and
        // surface the re-login moment instead of showing stale data.
        handleUnauthorized();
        return;
      }
      // 200 → healthy; unreachable/offline → keep the session, the next sync
      // tick will re-check. Only a real 401 signs the user out.
      transitionTo("signed-in");
    },

    startLogin() {
      transitionTo("authenticating");
    },

    async capture(auth) {
      token = auth.accessToken;
      accountId = accountIdFromSession(auth);
      try {
        await deps.store.save(auth);
      } catch (err) {
        // safeStorage refused (e.g. no keyring): the session works this run
        // but can never survive a restart — never write plaintext instead.
        console.error("[auth] could not persist session:", err);
      }
      const check = await deps.api.get("/login/me");
      console.log("[auth] capture verify /login/me →", check.status);
      if (check.status === 401) {
        // The partition handed back stale tokens (a previous session's
        // localStorage.auth survived): straight into the re-login moment,
        // never through a signed-in flash.
        handleUnauthorized();
        return;
      }
      // 200 → healthy; unreachable → the tokens were just minted by the SSO
      // redirect, accept them and let the next online check re-verify.
      transitionTo("signed-in");
    },

    handleUnauthorized,
  };
}

function accountIdFromSession(auth: CapturedAuth): string | null {
  const jwtAccountId = accountIdFromJwt(auth.accessToken);
  if (jwtAccountId) return jwtAccountId;

  const accounts = Array.isArray(auth.accounts) ? auth.accounts : Object.values(auth.accounts);
  for (const account of accounts) {
    if (typeof account !== "object" || account === null) continue;
    const id = (account as Record<string, unknown>).id;
    if (typeof id === "string" && id.length > 0) return id;
    if (typeof id === "number" && Number.isFinite(id)) return String(id);
  }
  return null;
}

function accountIdFromJwt(token: string): string | null {
  try {
    const encodedClaims = token.split(".")[1];
    if (!encodedClaims) return null;
    const claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")) as unknown;
    if (typeof claims !== "object" || claims === null) return null;
    const subject = (claims as Record<string, unknown>).sub;
    if (typeof subject === "string" && subject.length > 0) return subject;
    if (typeof subject === "number" && Number.isFinite(subject)) return String(subject);
  } catch {
    // A malformed token can still be accepted while offline; the accounts map
    // remains a safe fallback for the local cache key.
  }
  return null;
}
