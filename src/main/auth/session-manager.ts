import { effectRuntime } from "../effect/effect-runtime";
import { sensitiveString, type SensitiveString } from "../effect/conventions";
import type { AuthStatus, CapturedAuth } from "../../shared/auth";

/**
 * Promise-compatible compatibility seam retained for the original auth unit
 * tests and any older main-process callers. The live application uses
 * AuthService; even this seam stores state in an Effect synchronized reference
 * so it cannot reintroduce a second free-mutable session machine.
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
  /** `localStorage.auth` was captured out of the webview after the redirect. */
  capture(auth: CapturedAuth): Promise<void>;
  /** 401 from any API use: pause everything into the re-login moment. */
  handleUnauthorized(): void;
  /** Token handed to the API client. */
  accessToken(): string | null;
  /** Account id used to partition on-device feed snapshots. */
  accountId(): string | null;
}

interface CompatibilityState {
  readonly status: AuthStatus;
  readonly accessToken: SensitiveString | null;
  readonly accountId: string | null;
}

export function createSessionManager(deps: SessionManagerDeps): SessionManager {
  const state = effectRuntime.SynchronizedRef.makeUnsafe<CompatibilityState>({
    status: "signed-out",
    accessToken: null,
    accountId: null,
  });

  function status(): AuthStatus {
    return effectRuntime.SynchronizedRef.getUnsafe(state).status;
  }

  function accessToken(): string | null {
    const token = effectRuntime.SynchronizedRef.getUnsafe(state).accessToken;
    if (!token) return null;
    try {
      return effectRuntime.Redacted.value(token);
    } catch {
      return null;
    }
  }

  function accountId(): string | null {
    return effectRuntime.SynchronizedRef.getUnsafe(state).accountId;
  }

  function transitionTo(next: AuthStatus) {
    const changed = effectRuntime.Effect.runSync(
      effectRuntime.SynchronizedRef.modify(
        state,
        (current): readonly [boolean, CompatibilityState] => [
          current.status !== next,
          { ...current, status: next },
        ],
      ),
    );
    if (changed) deps.onChange?.(next);
  }

  function installSession(auth: CapturedAuth) {
    effectRuntime.Effect.runSync(
      effectRuntime.SynchronizedRef.set(state, {
        status: status(),
        accessToken: sensitiveString(auth.accessToken),
        accountId: accountIdFromSession(auth),
      }),
    );
  }

  function handleUnauthorized() {
    const changed = effectRuntime.Effect.runSync(
      effectRuntime.SynchronizedRef.modify(
        state,
        (current): readonly [boolean, CompatibilityState] => {
          const alreadyExpired =
            current.status === "session-expired" &&
            current.accessToken === null &&
            current.accountId === null;
          if (alreadyExpired) return [false, current];
          return [true, {
            status: "session-expired",
            accessToken: null,
            accountId: null,
          }];
        },
      ),
    );
    if (!changed) return;
    try {
      deps.store.clear();
    } catch {
      // Clearing is best-effort; the in-memory state is already invalidated.
    }
    deps.onChange?.("session-expired");
  }

  async function verify(): Promise<{ status: number }> {
    try {
      return await deps.api.get("/login/me");
    } catch {
      return { status: 0 };
    }
  }

  return {
    status,
    accessToken,
    accountId,

    async restore() {
      let stored: CapturedAuth | null;
      try {
        stored = deps.store.load();
      } catch {
        stored = null;
      }
      if (!stored) {
        effectRuntime.Effect.runSync(
          effectRuntime.SynchronizedRef.set(state, {
            status: "signed-out",
            accessToken: null,
            accountId: null,
          }),
        );
        // Initial state is already signed-out; publish directly so the
        // renderer leaves its boot gate even though nothing changed.
        deps.onChange?.("signed-out");
        return;
      }
      installSession(stored);
      const check = await verify();
      if (check.status === 401) {
        handleUnauthorized();
        return;
      }
      transitionTo("signed-in");
    },

    startLogin() {
      transitionTo("authenticating");
    },

    async capture(auth) {
      installSession(auth);
      try {
        deps.store.save(auth);
      } catch {
        // Never fall back to plaintext when encrypted persistence is unavailable.
        console.error("[auth] could not persist session; it will not survive restart");
      }
      const check = await verify();
      if (check.status === 401) {
        handleUnauthorized();
        return;
      }
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
    const claims = JSON.parse(decodeBase64Url(encodedClaims)) as unknown;
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

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = globalThis.atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
