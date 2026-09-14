import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { effectRuntime } from "../effect/effect-runtime";
import type { CapturedAuth } from "../../shared/auth";
import type { ClockService } from "../platform/services";

/**
 * Reading `localStorage.auth` out of the login webview — the capture step the
 * auth-spike prototype proved (~2s after the SSO redirect-back lands on
 * edunex.itb.ac.id).
 */

/** Accepts only the exact auth shape; anything else (login page leftovers,
 * garbage, half-writes) is not a session. `accounts` arrives as an array
 * (student + lecturer identities, per the webhook payload) — accept array or
 * map, the app only needs the token in v1. */
export function parseCapturedAuth(raw: unknown): CapturedAuth | null {
  if (typeof raw !== "object" || raw === null) return null;
  const it = raw as Record<string, unknown>;
  if (typeof it.accessToken !== "string" || it.accessToken.length === 0) return null;
  if (typeof it.refreshToken !== "string" || it.refreshToken.length === 0) return null;
  if (typeof it.expirationDate !== "string") return null;
  if (typeof it.verified !== "boolean") return null;
  if (typeof it.accounts !== "object" || it.accounts === null) return null;
  return {
    accessToken: it.accessToken,
    refreshToken: it.refreshToken,
    expirationDate: it.expirationDate,
    verified: it.verified,
    accounts: it.accounts as CapturedAuth["accounts"],
  };
}

/** Minimal surface of a WebContents this loop needs — keeps it testable
 * without Electron. */
export type AuthReader = (signal: AbortSignal) => Promise<unknown>;
export type AuthCaptureEffect = EffectModule.Effect.Effect<void, never, never>;
export type AuthCaptureFiber = EffectModule.Fiber.Fiber<void, never>;

export interface AuthCapture {
  /** Begins polling; returns false if the loop is already running. */
  start(onCaptured: (auth: CapturedAuth) => AuthCaptureEffect): boolean;
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
  opts: {
    intervalMs: number;
    clock: ClockService;
    fork: (effect: AuthCaptureEffect) => AuthCaptureFiber;
  },
): AuthCapture {
  const clock = opts.clock;
  let running = false;
  let generation = 0;
  let fiber: AuthCaptureFiber | null = null;
  let warnedAboutValue = false;

  function poll(
    onCaptured: (auth: CapturedAuth) => AuthCaptureEffect,
    runGeneration: number,
  ): AuthCaptureEffect {
    const loop = effectRuntime.Effect.gen(function* () {
      while (running && runGeneration === generation) {
        const raw = yield* effectRuntime.Effect.tryPromise({
          try: (signal) => executeJs(signal),
          catch: () => null,
        }).pipe(
          effectRuntime.Effect.catch(() => effectRuntime.Effect.succeed(null)),
        );
        if (!running || runGeneration !== generation) return;

        const auth = parseRawAuth(raw);
        if (auth) {
          running = false;
          yield* onCaptured(auth);
          return;
        }

        // A present-but-rejected value means the SPA's shape drifted from the
        // validator — surface it once (keys only, never token values).
        if (raw != null && !warnedAboutValue) {
          warnedAboutValue = true;
          console.log("[auth] poll saw a value that failed validation; keys:", keysOfRaw(raw));
        }

        yield* sleepWithClock(clock, opts.intervalMs);
      }
    });

    return loop.pipe(
      effectRuntime.Effect.catchCause((cause) =>
        effectRuntime.Cause.hasInterrupts(cause)
          ? effectRuntime.Effect.interrupt
          : effectRuntime.Effect.void,
      ),
    );
  }

  return {
    start(onCaptured) {
      if (running) return false;
      running = true;
      const runGeneration = ++generation;
      warnedAboutValue = false;
      try {
        fiber = opts.fork(poll(onCaptured, runGeneration));
      } catch {
        running = false;
        return false;
      }
      return true;
    },
    stop() {
      running = false;
      generation += 1;
      const current = fiber;
      fiber = null;
      current?.interruptUnsafe();
    },
  };
}

function parseRawAuth(raw: unknown): CapturedAuth | null {
  try {
    return parseCapturedAuth(typeof raw === "string" ? JSON.parse(raw) : raw);
  } catch {
    return null;
  }
}

function keysOfRaw(raw: unknown): string[] {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return typeof value === "object" && value !== null
      ? Object.keys(value as Record<string, unknown>)
      : [];
  } catch {
    return [];
  }
}

function sleepWithClock(clock: ClockService, delayMs: number): AuthCaptureEffect {
  return effectRuntime.Effect.callback<void>((resume) => {
    const timer = clock.setTimeout(
      () => resume(effectRuntime.Effect.void),
      Math.max(0, Math.round(delayMs)),
    );
    return effectRuntime.Effect.sync(() => clock.clearTimeout(timer));
  });
}
