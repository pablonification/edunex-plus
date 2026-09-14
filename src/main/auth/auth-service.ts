import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { effectRuntime } from "../effect/effect-runtime";
import { sensitiveString, type SensitiveString } from "../effect/conventions";
import type { ApiResult, EdunexDataApi } from "../api/client";
import { createEdunexApi } from "../api/client";
import { createAuthCapture, type AuthCapture } from "./capture";
import { createSessionStore, type SessionCodec } from "./session-store";
import type { AuthStatus, CapturedAuth } from "../../shared/auth";
import {
  Clock,
  FileSystem,
  HttpTransport,
  SafeStorage,
  type ClockService,
  type FileSystemService,
  type HttpTransportService,
  type SafeStorageService,
  type WebContentsService,
} from "../platform/services";

/** The vendor API the captured bearer token talks to (spec: API stance). */
export const EDUNEX_API_BASE_URL = "https://api-edunex.cognisia.id";

/** Keep the application-identifying User-Agent in one main-process seam. */
export function edunexUserAgent(appVersion: string): string {
  return `EdunexPlus/${appVersion} (desktop client; +https://github.com/pablonification/edunex-plus)`;
}

export type AuthEffect<A> = EffectModule.Effect.Effect<A, never, never>;
type SessionRef = EffectModule.SynchronizedRef.SynchronizedRef<AuthState>;

interface AuthState {
  readonly status: AuthStatus;
  readonly restored: boolean;
  readonly accessToken: SensitiveString | null;
  readonly accountId: string | null;
  /** Invalidates an in-flight verification when another transition wins. */
  readonly revision: number;
}

const initialState: AuthState = {
  status: "signed-out",
  restored: false,
  accessToken: null,
  accountId: null,
  revision: 0,
};

/**
 * The main-process authentication service. Its methods are Effects so state
 * transitions, persistence, verification, and webview capture all have one
 * explicit application seam. Plain token values are available only to
 * main-process Effects and the bearer API closure; they are never part of the
 * renderer-facing service contract.
 */
export interface AuthServiceShape {
  readonly status: () => AuthEffect<AuthStatus | null>;
  readonly restore: () => AuthEffect<void>;
  readonly startLogin: () => AuthEffect<void>;
  readonly capture: (auth: CapturedAuth) => AuthEffect<void>;
  readonly handleUnauthorized: () => AuthEffect<void>;
  readonly signOut: () => AuthEffect<void>;
  readonly accessToken: () => AuthEffect<string | null>;
  readonly accountId: () => AuthEffect<string | null>;
  /** Main-process API adapter; it has no renderer/preload representation. */
  readonly api: EdunexDataApi;
  readonly attachWebview: (contents: WebContentsService) => AuthEffect<void>;
}

/** Explicit Effect service key used by main-process callers and tests. */
export class AuthService extends effectRuntime.Context.Service<AuthService, AuthServiceShape>()(
  "EdunexPlus/AuthService",
) {}

/** Alias for callers that name the domain service after its session role. */
export const SessionService = AuthService;
export type SessionServiceShape = AuthServiceShape;

export interface AuthServiceOptions {
  readonly sessionStorePath: string;
  readonly appVersion: string;
  /** Push only the public status to the renderer. */
  readonly broadcast: (status: AuthStatus) => void;
  /**
   * Runtime bridge for callbacks originating in promise-based host APIs.
   * The production main process supplies the managed runtime. If a host does
   * not supply the bridge, capture verification is skipped rather than
   * creating a second unmanaged runtime.
   */
  readonly runEffect?: <A>(effect: AuthEffect<A>) => Promise<A> | void;
}

export type AuthLayer = EffectModule.Layer.Layer<
  AuthService,
  never,
  FileSystem | Clock | SafeStorage | HttpTransport
>;

/**
 * Builds the authentication service from the platform layer. The layer owns
 * webview capture cleanup, while the session itself is held in a synchronized
 * redacted reference rather than free mutable module state.
 */
export function createAuthLayer(options: AuthServiceOptions): AuthLayer {
  return effectRuntime.Layer.effect(
    AuthService,
    effectRuntime.Effect.gen(function* () {
      const fileSystem = yield* FileSystem;
      const clock = yield* Clock;
      const safeStorage = yield* SafeStorage;
      const httpTransport = yield* HttpTransport;
      const state = yield* effectRuntime.SynchronizedRef.make(initialState);
      const captures = new Map<number, AuthCapture>();
      const codec = createSafeStorageCodec(safeStorage);
      const store = createSessionStore(options.sessionStorePath, codec, fileSystem);
      const userAgent = edunexUserAgent(options.appVersion);

      const getToken = () => tokenFromState(state);
      const apiOptions = {
        baseUrl: EDUNEX_API_BASE_URL,
        getToken,
        userAgent,
        transport: httpTransport,
      };

      // Verification deliberately uses a callback-free client. A 401 is
      // handled by the verification Effect itself, which avoids racing the
      // restore/capture transition with an out-of-band callback.
      const verificationApi = createEdunexApi(apiOptions);
      // Command and sync services handle a 401 in their own managed Effect.
      // Keeping this adapter callback-free prevents an HTTP promise from
      // re-entering the runtime through a second runSync call.
      const api = createEdunexApi(apiOptions);

      const service = createService({
        api,
        verificationApi,
        state,
        store,
        clock,
        captures,
        options,
      });

      return yield* effectRuntime.Effect.acquireRelease(
        effectRuntime.Effect.succeed(service),
        () =>
          effectRuntime.Effect.sync(() => {
            for (const capture of captures.values()) capture.stop();
            captures.clear();
          }),
      );
    }),
  ) as AuthLayer;
}

/** Conventional Layer alias for application composition sites. */
export const AuthServiceLive = createAuthLayer;
export const SessionServiceLive = createAuthLayer;
export const createAuthServiceLayer = createAuthLayer;
export const createSessionServiceLayer = createAuthLayer;

function createService(deps: {
  readonly api: EdunexDataApi;
  readonly verificationApi: EdunexDataApi;
  readonly state: SessionRef;
  readonly store: ReturnType<typeof createSessionStore>;
  readonly clock: ClockService;
  readonly captures: Map<number, AuthCapture>;
  readonly options: AuthServiceOptions;
}): AuthServiceShape {
  const { api, verificationApi, state, store, clock, captures, options } = deps;

  function status(): AuthEffect<AuthStatus | null> {
    return effectRuntime.SynchronizedRef.get(state).pipe(
      effectRuntime.Effect.map((current) => (current.restored ? current.status : null)),
    );
  }

  function accessToken(): AuthEffect<string | null> {
    return effectRuntime.SynchronizedRef.get(state).pipe(
      effectRuntime.Effect.map((current) => valueOfToken(current.accessToken)),
    );
  }

  function accountId(): AuthEffect<string | null> {
    return effectRuntime.SynchronizedRef.get(state).pipe(
      effectRuntime.Effect.map((current) => current.accountId),
    );
  }

  function restore(): AuthEffect<void> {
    return effectRuntime.Effect.gen(function* () {
      const stored = yield* safeSync(() => store.load(), null);
      if (!stored) {
        yield* publishState(
          {
            ...initialState,
            restored: true,
          },
          true,
        );
        return;
      }

      const revision = yield* installSession(stored);
      const check = yield* verify(verificationApi);
      if (check.status === 401) {
        yield* expireSession();
        return;
      }

      // A concurrent unauthorized transition wins over a late verification.
      yield* commitVerified(revision);
    });
  }

  function startLogin(): AuthEffect<void> {
    return transition((current) => ({
      ...current,
      status: "authenticating",
      revision: current.revision + 1,
    }));
  }

  function capture(auth: CapturedAuth): AuthEffect<void> {
    return effectRuntime.Effect.gen(function* () {
      const revision = yield* installSession(auth);

      // safeStorage failure is intentionally non-fatal for this run. The
      // store never falls back to plaintext; the next restart asks the Student
      // to sign in again.
      yield* safeSync(() => store.save(auth), undefined, () => {
        console.error("[auth] could not persist session; it will not survive restart");
      });

      const check = yield* verify(verificationApi);
      console.log("[auth] capture verify /login/me →", check.status);
      if (check.status === 401) {
        yield* expireSession();
        return;
      }

      // Status 0 means the API could not be reached. Newly captured tokens are
      // still accepted, matching the pre-migration behavior.
      yield* commitVerified(revision);
    });
  }

  function handleUnauthorized(): AuthEffect<void> {
    return effectRuntime.Effect.gen(function* () {
      const changed = yield* effectRuntime.SynchronizedRef.modify(
        state,
        (current): readonly [boolean, AuthState] => {
          const alreadyExpired =
            current.status === "session-expired" &&
            current.accessToken === null &&
            current.accountId === null;
          if (alreadyExpired) return [false, current];
          return [true, {
            ...current,
            status: "session-expired",
            restored: true,
            accessToken: null,
            accountId: null,
            revision: current.revision + 1,
          }];
        },
      );
      if (!changed) return;
      yield* clearStore();
      yield* broadcast("session-expired");
    });
  }

  function signOut(): AuthEffect<void> {
    return effectRuntime.Effect.gen(function* () {
      yield* clearStore();
      yield* transition((current) => ({
        ...current,
        status: "signed-out",
        restored: true,
        accessToken: null,
        accountId: null,
        revision: current.revision + 1,
      }), true);
    });
  }

  function attachWebview(contents: WebContentsService): AuthEffect<void> {
    return effectRuntime.Effect.sync(() => {
      captures.get(contents.id)?.stop();

      contents.setWindowOpenHandler(({ url }) => {
        if (/^https?:/i.test(url)) {
          clock.setTimeout(() => void contents.loadURL(url).catch(() => {}), 0);
        }
        return { action: "deny" };
      });

      const capture = createAuthCapture(readWithTimeout(contents, clock), {
        intervalMs: 1000,
        clock,
      });
      const maybeStart = (url: string) => {
        if (isEdunexOrigin(url)) {
          if (capture.start(onCaptured)) {
            // URLs can carry bearer material in their query; log only a path.
            console.log("[auth] polling for localStorage.auth on", new URL(url).pathname);
          }
        } else {
          capture.stop();
        }
      };

      contents.on("did-navigate", (_event, url) => maybeStart(url));
      contents.on("did-navigate-in-page", (_event, url) => maybeStart(url));
      contents.once("destroyed", () => {
        capture.stop();
        if (captures.get(contents.id) === capture) captures.delete(contents.id);
      });
      captures.set(contents.id, capture);
    });

    function onCaptured(auth: CapturedAuth) {
      console.log("[auth] session captured from webview, verifying");
      const effect = capture(auth);
      try {
        const result = options.runEffect?.(effect);
        if (!result) {
          console.error("[auth] captured session verification skipped: runtime unavailable");
          return;
        }
        void Promise.resolve(result).catch(() => {
          console.error("[auth] captured session verification failed");
        });
      } catch {
        console.error("[auth] captured session verification failed");
      }
    }
  }

  function installSession(auth: CapturedAuth): AuthEffect<number> {
    return effectRuntime.SynchronizedRef.modify(
      state,
      (current): readonly [number, AuthState] => {
        const nextRevision = current.revision + 1;
        return [nextRevision, {
          ...current,
          accessToken: sensitiveString(auth.accessToken),
          accountId: accountIdFromSession(auth),
          revision: nextRevision,
        }];
      },
    );
  }

  function commitVerified(expectedRevision: number): AuthEffect<void> {
    return effectRuntime.Effect.gen(function* () {
      const changed = yield* effectRuntime.SynchronizedRef.modify(
        state,
        (current): readonly [boolean, AuthState] => {
          if (current.revision !== expectedRevision) return [false, current];
          return [true, {
            ...current,
            status: "signed-in",
            restored: true,
          }];
        },
      );
      if (changed) yield* broadcast("signed-in");
    });
  }

  function publishState(next: AuthState, force = false): AuthEffect<void> {
    return effectRuntime.Effect.gen(function* () {
      const changed = yield* effectRuntime.SynchronizedRef.modify(
        state,
        (current): readonly [boolean, AuthState] => [
          force || current.status !== next.status || current.restored !== next.restored,
          { ...next, revision: current.revision + 1 },
        ],
      );
      if (changed) yield* broadcast(next.status);
    });
  }

  function transition(
    update: (current: AuthState) => AuthState,
    force = false,
  ): AuthEffect<void> {
    return effectRuntime.Effect.gen(function* () {
      const result = yield* effectRuntime.SynchronizedRef.modify(
        state,
        (
          current,
        ): readonly [
          { readonly changed: boolean; readonly status: AuthStatus },
          AuthState,
        ] => {
          const updated = update(current);
          return [
            {
              changed:
                force || current.status !== updated.status || current.restored !== updated.restored,
              status: updated.status,
            },
            updated,
          ];
        },
      );
      if (result.changed) yield* broadcast(result.status);
    });
  }

  function expireSession(): AuthEffect<void> {
    return handleUnauthorized();
  }

  function clearStore(): AuthEffect<void> {
    return effectRuntime.Effect.sync(() => {
      try {
        store.clear();
      } catch {
        // Clearing is best-effort; the in-memory state is already invalidated.
      }
    });
  }

  function broadcast(next: AuthStatus): AuthEffect<void> {
    return effectRuntime.Effect.sync(() => {
      try {
        options.broadcast(next);
      } catch {
        // A destroyed renderer must not make an otherwise valid session fail.
      }
    });
  }

  return {
    status,
    restore,
    startLogin,
    capture,
    handleUnauthorized,
    signOut,
    accessToken,
    accountId,
    api,
    attachWebview,
  };
}

function createSafeStorageCodec(safeStorage: SafeStorageService): SessionCodec {
  return {
    encrypt(plaintext) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("safeStorage is unavailable; refusing to store tokens");
      }
      return safeStorage.encryptString(plaintext);
    },
    decrypt(blob) {
      return safeStorage.decryptString(
        typeof blob === "string" ? new TextEncoder().encode(blob) : blob,
      );
    },
  };
}

function tokenFromState(state: SessionRef): string | null {
  return valueOfToken(effectRuntime.SynchronizedRef.getUnsafe(state).accessToken);
}

function valueOfToken(token: SensitiveString | null): string | null {
  if (!token) return null;
  try {
    return effectRuntime.Redacted.value(token);
  } catch {
    return null;
  }
}

function verify(api: Pick<EdunexDataApi, "get">): AuthEffect<ApiResult> {
  return effectRuntime.Effect.tryPromise(() => api.get("/login/me")).pipe(
    effectRuntime.Effect.catch(() =>
      // Verification must preserve the offline distinction. A transport
      // failure is represented by the API's established status-zero result.
      effectRuntime.Effect.succeed<ApiResult>({ status: 0, ok: false, body: null }),
    ),
  );
}

function safeSync<A>(
  thunk: () => A,
  fallback: A,
  onFailure?: () => void,
): AuthEffect<A> {
  return effectRuntime.Effect.sync(() => {
    try {
      return thunk();
    } catch {
      onFailure?.();
      return fallback;
    }
  });
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

function isEdunexOrigin(url: string): boolean {
  try {
    return new URL(url).host === "edunex.itb.ac.id";
  } catch {
    return false;
  }
}

/** Every read must settle so a wedged frame cannot stop future polls. */
function readWithTimeout(contents: WebContentsService, clock: ClockService) {
  return () =>
    new Promise<unknown>((resolve, reject) => {
      const timer = clock.setTimeout(() => reject(new Error("auth read timed out")), 5000);
      contents
        .executeJavaScript("localStorage.getItem('auth')", true)
        .then(
          (value) => {
            clock.clearTimeout(timer);
            resolve(value);
          },
          (error: unknown) => {
            clock.clearTimeout(timer);
            reject(error);
          },
        );
    });
}
