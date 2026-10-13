// Signing in to Edunex and SIX on one Microsoft sign-in. One sign-in per
// system runs at a time. Right after the Student signs in to one system, the
// other is tried by itself in a hidden window on the same Microsoft session:
// it connects without a word from the Student, or gives up silently and its
// own "Hubungkan" stays as it was. A system the Student signed out of on
// purpose isn't tried. Microsoft's session goes once neither needs it.
import type { Event, SignInStep } from "../core/contract";
import type { DatasetName } from "../core/models";
import type { Engine } from "../engine/engine";

export type SignInSource = "edunex" | "six";

export interface SignInWindows {
  /**
   * The sign-in window for a system: what it read (Edunex's token, SIX's
   * cookie), or null when it was closed or a quiet try gave up. Already open:
   * the same sign-in, and the Student's from now on unless this one is quiet.
   */
  open(source: SignInSource, how: { quiet: boolean; onStep(step: SignInStep | null): void }): Promise<string | null>;
  /** Stops the quiet try for a system, if one is running. */
  stopQuiet(source: SignInSource): void;
  /** Wipes Microsoft's session (at once, or as soon as no sign-in window is open). */
  forget(): Promise<void>;
}

const OTHER = { edunex: "six", six: "edunex" } as const;
/** What a system leaves on this computer while its session has ended (the screens keep showing it). */
const SAVED: Record<SignInSource, DatasetName> = { edunex: "edunex.account", six: "six.student" };

export function signInToBoth(deps: {
  engine: Pick<Engine, "signIn" | "snapshot">;
  send(event: Event): void;
  windows: SignInWindows;
  /** Sees each quiet try (tests wait for it). */
  background?(work: Promise<unknown>): void;
}) {
  const running = new Map<SignInSource, { result: Promise<boolean>; quiet: boolean; stopped: boolean }>();
  /** Sign-outs so far: one during a sign-in undoes what comes after it. */
  let signOuts = 0;

  const state = (source: SignInSource) => deps.engine.snapshot().statuses.find((status) => status.source === source)?.state ?? "signed-out";
  const needsSignIn = (source: SignInSource) => ["signed-out", "expired"].includes(state(source));
  /** Its session ran out, or its data is still here, or nobody has used the app yet: not a system the Student signed out of. */
  const worthTrying = (source: SignInSource) => {
    if (state(source) === "expired") return true;
    const snapshot = deps.engine.snapshot();
    return snapshot.datasets.some((dataset) => dataset.name === SAVED[source]) || !snapshot.settings.firstScanDone;
  };

  const after = (source: SignInSource, quiet: boolean) => {
    const other = OTHER[source];
    if (!needsSignIn(other)) return void deps.windows.forget();
    if (quiet || !worthTrying(other)) return;
    const trying = signIn(other, true);
    deps.background?.(trying);
  };

  function signIn(source: SignInSource, quiet: boolean): Promise<boolean> {
    const onStep = (step: SignInStep | null) => deps.send({ type: "signIn", source, step });
    const now = running.get(source);
    if (now) {
      // The Student asks for the one the app is trying by itself: it's theirs now, with its window when it needs them.
      if (!quiet && now.quiet) {
        now.quiet = false;
        void deps.windows.open(source, { quiet: false, onStep }).catch(() => undefined);
      }
      return now.result;
    }
    const attempt = { quiet, stopped: false, result: Promise.resolve(false) };
    const since = signOuts;
    attempt.result = (async () => {
      try {
        const session = await deps.windows.open(source, { quiet, onStep });
        if (!session || attempt.stopped) return false;
        const connecting = deps.engine.signIn(source, source === "edunex" ? { token: session } : { cookie: session });
        // The hidden window saw the system signed in: say so now, not after its first full read (SIX reads at human pace).
        if (attempt.quiet) deps.send({ type: "signIn.joined", source });
        await connecting;
        // Signed out while it was connecting (the wrong account, say): the other system isn't tried on it.
        if (signOuts === since) after(source, attempt.quiet);
        return true;
      } catch (error) {
        if (attempt.quiet) return false;
        throw error;
      } finally {
        if (running.get(source) === attempt) running.delete(source);
        onStep(null);
      }
    })();
    running.set(source, attempt);
    return attempt.result;
  }

  return {
    /** The Student's sign-in: true once the system is connected, false when they closed the window. */
    signIn: (source: SignInSource) => signIn(source, false),
    /** The Student signed out: the app's own tries stop, nothing they find is kept, and none starts on a sign-in from before. */
    stopQuiet(): void {
      signOuts += 1;
      for (const [source, attempt] of running) {
        if (!attempt.quiet) continue;
        attempt.stopped = true;
        deps.windows.stopQuiet(source);
      }
    },
  };
}
