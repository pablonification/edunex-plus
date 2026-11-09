// Signing back in by itself: Edunex's or SIX's session ended (SIX's cookie lasts about 30 days) while Microsoft's
// session in the app's web views is still alive. The app tries the system's sign-in out of sight on that Microsoft
// session (../shell/sign-in.tsx's quiet try, which gives up on any page that waits for the Student) and the
// Student never hears the session ended. Only when that try gives up do the screens see it (the banner, "Masuk
// lagi"), as before.
//
// It sits between the engine and the screens (./host.ts): a status that says a session ended is held back while
// the try runs, the screens seeing the system as "connecting" instead. At most one try per system every ten minutes,
// only with the app in front (the web view needs the screens), and never one for a system the Student signed out of.
// "[resignin] …" lines on Android's log say what it did: states and times only, never a session.
import type { SourceId, SourceStatus } from "../../../src/core/models";

export type ResignSource = "edunex" | "six";

/** At most one quiet try per system this often. */
export const RESIGN_EVERY_MS = 10 * 60_000;
/** A try still holding the screens back this long has gone wrong (the page never opened): they see what's true. */
export const RESIGN_LIMIT_MS = 40_000;

const SOURCES: readonly SourceId[] = ["edunex", "six"];
const isResignSource = (source: SourceId): source is ResignSource => SOURCES.includes(source);

/** Whether to try now: the session ended, the app is in front, and the last try for it was long enough ago. */
export function shouldResign(state: SourceStatus["state"] | undefined, inFront: boolean, lastTry: number | undefined, now: number): boolean {
  if (state !== "expired" || !inFront) return false;
  return lastTry === undefined || now - lastTry >= RESIGN_EVERY_MS;
}

/** What the screens see of a system while its quiet try runs: connecting, with everything else as it was. */
export function heldStatus(status: SourceStatus): SourceStatus {
  return { ...status, state: "connecting", detail: null };
}

export interface ResignDeps {
  now(): number;
  /** Whether the app is in front, its screens (and so the sign-in's web view) drawn. */
  inFront(): boolean;
  /** The engine's own status for a system now. */
  status(source: ResignSource): SourceStatus | undefined;
  /** The quiet try (signInToBoth's retry): true once it's signed in, false when it gave up. */
  retry(source: ResignSource): Promise<boolean>;
  /** A status for the screens. */
  show(status: SourceStatus): void;
  /** Runs `fn` after `ms`; the returned function cancels it. */
  later(ms: number, fn: () => void): () => void;
  log(line: string): void;
}

export function quietResignIn(deps: ResignDeps) {
  const lastTry = new Map<ResignSource, number>();
  /** The systems whose ended session the screens don't see yet, with when the try began and its time limit. */
  const held = new Map<ResignSource, { at: number; cancel(): void }>();

  const release = (source: ResignSource) => {
    held.get(source)?.cancel();
    held.delete(source);
  };

  /** The try gave up (or took too long): the screens see the session ended, as before. */
  const gaveUp = (source: ResignSource, why: string) => {
    const hold = held.get(source);
    if (!hold) return;
    release(source);
    deps.log(`[resignin] ${source} ${why} in ${deps.now() - hold.at}ms`);
    const now = deps.status(source);
    if (now) deps.show(now);
  };

  /** Tries `source` if it should; true when it's trying (the screens held back). */
  const consider = (source: ResignSource): boolean => {
    if (held.has(source)) return true;
    const status = deps.status(source);
    const now = deps.now();
    if (!shouldResign(status?.state, deps.inFront(), lastTry.get(source), now)) {
      if (status?.state === "expired") deps.log(`[resignin] ${source} not now (${deps.inFront() ? "tried in the last 10 minutes" : "the app isn't in front"})`);
      return false;
    }
    lastTry.set(source, now);
    held.set(source, { at: now, cancel: deps.later(RESIGN_LIMIT_MS, () => gaveUp(source, "took too long")) });
    deps.log(`[resignin] ${source} trying`);
    if (status) deps.show(heldStatus(status));
    deps.retry(source).then(
      (ok) => {
        if (!ok) gaveUp(source, "needs the Student");
      },
      () => gaveUp(source, "failed"),
    );
    return true;
  };

  return {
    /** A status the engine published: to the screens, unless it says a session ended that a quiet try may bring back. */
    saw(status: SourceStatus): void {
      const source = status.source;
      if (!isResignSource(source)) {
        deps.show(status);
        return;
      }
      const hold = held.get(source);
      if (status.state === "expired") {
        if (!hold && !consider(source)) deps.show(status);
        return;
      }
      if (hold) {
        // Back in (the engine is reading it afresh), or the Student signed out meanwhile.
        release(source);
        deps.log(status.state === "signed-out" ? `[resignin] ${source} stopped, signed out` : `[resignin] ${source} ok in ${deps.now() - hold.at}ms`);
      }
      deps.show(status);
    },
    /** The app came to the front, or started: any session that ended is tried (the screens then see it held). */
    wake(): void {
      for (const source of ["edunex", "six"] as const) consider(source);
    },
    /** The statuses the screens start from (the app's snapshot), with any held one as they'd see it. */
    shown(statuses: readonly SourceStatus[]): SourceStatus[] {
      return statuses.map((status) => (isResignSource(status.source) && held.has(status.source) ? heldStatus(status) : status));
    },
  };
}
