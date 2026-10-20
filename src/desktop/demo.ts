// Development only. The demo (scripts/demo) runs this same main process on the
// pretend Edunex and SIX the tests use, with made-up data, for walkthroughs,
// screenshots and recordings. It sets these hooks before main loads; a
// packaged app never has them.
import { app } from "electron";
import type { SignInStep } from "../core/contract";
import type { Ntfy } from "../engine/alerts/phone";
import type { Clock } from "../engine/clock";
import type { Engine } from "../engine/engine";
import type { Transport } from "../engine/http/transport";
import type { FetchFile } from "./remote-files";
import type { Platform } from "./window";

export interface DemoHooks {
  transport: Transport;
  clock: Clock;
  /** The data folder's name under the system's app data: never a real profile. */
  profile: string;
  /** What a sign-in hands back (Edunex's token, SIX's cookie), with no sign-in window; null when a quiet try gives up. */
  signIn(source: "edunex" | "six", how: { quiet: boolean; onStep(step: SignInStep | null): void }): Promise<string | null>;
  /** Before the window opens, e.g. sign in and sync. True when it started the engine itself. */
  prepare(engine: Engine): Promise<boolean>;
  /** How far the demo's clock is ahead of real time (ms), so the window shows the same time. */
  clockOffset(): number;
  /** Files from the pretend storage, for the window to show (pictures in notes). */
  fetchFile?: FetchFile;
  /** The system the page draws itself for, to picture Windows' title bar on a Mac; the window keeps the real system's. */
  platform?: Platform;
}

declare global {
  var __edunexPlusDemo: DemoHooks | undefined;
}

export const demo: DemoHooks | undefined = app.isPackaged ? undefined : globalThis.__edunexPlusDemo;

/** The demo's phone: it links under a made-up topic, shaped like a real one ("demo" and zeros, which a real one never has), and sends nothing anywhere. */
export const demoPhone: { ntfy: Ntfy; newTopic: () => string } = { ntfy: async () => 200, newTopic: () => "ep-demo-0000-0000" };
