// Development only. The demo (scripts/demo) runs this same main process on the
// pretend Edunex and SIX the tests use, with made-up data, for walkthroughs,
// screenshots and recordings. It sets these hooks before main loads; a
// packaged app never has them.
import { app } from "electron";
import type { Clock } from "../engine/clock";
import type { Engine } from "../engine/engine";
import type { Transport } from "../engine/http/transport";
import type { FetchFile } from "./remote-files";

export interface DemoHooks {
  transport: Transport;
  clock: Clock;
  /** The data folder's name under the system's app data: never a real profile. */
  profile: string;
  /** What a sign-in hands back (Edunex's token, SIX's cookie), with no sign-in window. */
  signIn(source: "edunex" | "six"): Promise<string>;
  /** Before the window opens, e.g. sign in and sync. True when it started the engine itself. */
  prepare(engine: Engine): Promise<boolean>;
  /** How far the demo's clock is ahead of real time (ms), so the window shows the same time. */
  clockOffset(): number;
  /** Files from the pretend storage, for the window to show (pictures in notes). */
  fetchFile?: FetchFile;
}

declare global {
  var __edunexPlusDemo: DemoHooks | undefined;
}

export const demo: DemoHooks | undefined = app.isPackaged ? undefined : globalThis.__edunexPlusDemo;
