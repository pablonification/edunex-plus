// Signing in to Edunex and SIX on one Microsoft sign-in. One sign-in per
// system runs at a time. As soon as Microsoft hands one system back, the
// other is tried by itself in a hidden window on the same Microsoft session,
// while the first is still being read: it says it's "joining" meanwhile, then
// connects without a word from the Student once the first is in, or gives up
// and its own "Hubungkan" stays as it was. A system the Student signed out of on
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
/** Whether `work` went through. */
const landed = (work: Promise<unknown>) =>
  work.then(
    () => true,
    () => false,
  );
/** What a system leaves on this computer while its session has ended (the screens keep showing it). */
const SAVED: Record<SignInSource, DatasetName> = { edunex: "edunex.account", six: "six.student" };

export function signInToBoth(deps: {
  engine: Pick<Engine, "signIn" | "snapshot">;
  send(event: Event): void;
  windows: SignInWindows;
  /** Sees each quiet try (tests wait for it). */
  background?(work: Promise<unknown>): void;
}) {
  const running = new Map<SignInSource, { result: Promise<boolean>; quiet: boolean; stopped: boolean; handedBack: boolean }>();

  const state = (source: SignInSource) => deps.engine.snapshot().statuses.find((status) => status.source === source)?.state ?? "signed-out";
  const needsSignIn = (source: SignInSource) => ["signed-out", "expired"].includes(state(source));
  /** Its session ran out, or its data is still here, or nobody has used the app yet: not a system the Student signed out of. */
  const worthTrying = (source: SignInSource) => {
    if (state(source) === "expired") return true;
    const snapshot = deps.engine.snapshot();
    return snapshot.datasets.some((dataset) => dataset.name === SAVED[source]) || !snapshot.settings.firstScanDone;
  };

  /** Right after Microsoft handed `source` back: the other system, by itself, kept only once `connecting` is done. */
  const after = (source: SignInSource, quiet: boolean, connecting: Promise<void>) => {
    const other = OTHER[source];
    if (!needsSignIn(other)) return void deps.windows.forget();
    if (quiet || !worthTrying(other)) return;
    const trying = signIn(other, true, connecting);
    deps.background?.(trying);
  };

  /** `ridesOn`: the other system's sign-in this quiet one rides on. What it finds waits for that one to be in. */
  function signIn(source: SignInSource, quiet: boolean, ridesOn?: Promise<void>): Promise<boolean> {
    const onStep = (step: SignInStep | null) => deps.send({ type: "signIn", source, step });
    const now = running.get(source);
    if (now) {
      // The Student asks for the one the app is trying by itself: it's theirs now, with its window when it needs them.
      if (!quiet && now.quiet) {
        now.quiet = false;
        onStep(null);
        if (!now.handedBack) void deps.windows.open(source, { quiet: false, onStep }).catch(() => undefined);
      }
      return now.result;
    }
    const attempt = { quiet, stopped: false, handedBack: false, result: Promise.resolve(false) };
    attempt.result = (async () => {
      try {
        // The app's own try says so, for the Student who would otherwise press "Hubungkan" again.
        if (quiet) onStep("joining");
        const session = await deps.windows.open(source, { quiet, onStep });
        attempt.handedBack = true;
        if (!session || attempt.stopped) return false;
        // The one it rode on didn't end up in (signed out meanwhile, the wrong account say, or its session ended at once):
        // nothing the app's own try found is kept. One the Student took over is theirs to keep.
        const rodeIn = !ridesOn || ((await landed(ridesOn)) && !(attempt.quiet && needsSignIn(OTHER[source])));
        if (!rodeIn || attempt.stopped) return false;
        const connecting = deps.engine.signIn(source, source === "edunex" ? { token: session } : { cookie: session });
        // The hidden window saw the system signed in: say so now, not after its first full read (SIX reads at human pace).
        if (attempt.quiet) deps.send({ type: "signIn.joined", source });
        // The other one now, on the Microsoft session just used, alongside this one's first full read.
        after(source, attempt.quiet, connecting);
        await connecting;
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
    /** The Student signed out: the app's own tries stop, nothing they find is kept, and none keeps what rode on a sign-in from before. */
    stopQuiet(): void {
      for (const [source, attempt] of running) {
        if (!attempt.quiet) continue;
        attempt.stopped = true;
        deps.windows.stopQuiet(source);
      }
    },
  };
}
