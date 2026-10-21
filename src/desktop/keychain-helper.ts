// macOS: the key the saved sign-ins are locked with, kept by the app's keychain helper
// (native/mac-keychain, docs/adr/0003-mac-keychain-helper.md). macOS lets an app back into a
// keychain entry without asking only while it's the exact build the Student allowed, unless Apple
// issued its certificate; every update is another build, so Electron's safeStorage made macOS ask
// for the Student's password after each one. The helper is the same build in every release, so
// macOS lets it in, and it answers only this app, signed with the project's certificate.
//
// Read once, before Chromium starts (main.ts): with the key in hand the app tells Chromium to leave
// the real keychain alone, so nothing in the app opens it and macOS has nothing to ask.
import { execFileSync } from "node:child_process";
import path from "node:path";

/** Where the helper is in the packaged app (Edunex Plus.app/Contents/Helpers), from `process.resourcesPath`. */
export const helperPath = (resourcesPath: string) => path.join(resourcesPath, "..", "Helpers", "Edunex Plus Keychain");

/** Runs the helper and returns what it printed; throws when it fails or isn't there. */
export type RunHelper = (file: string, args: string[]) => string;

// Long enough for the Student to answer macOS, should it ask: only ever after the helper itself changed.
const runHelper: RunHelper = (file, args) => execFileSync(file, args, { encoding: "utf8", timeout: 120_000, stdio: ["ignore", "pipe", "ignore"] });

/**
 * The key (32 bytes), or null when the helper can't give it: not there, an ad-hoc build it won't
 * answer, a locked keychain, or the Student said no. The vault then locks with safeStorage, as before.
 */
export function readVaultKey(file: string, run: RunHelper = runHelper): Buffer | null {
  try {
    const printed = run(file, ["key"]).trim();
    return /^[0-9a-f]{64}$/.test(printed) ? Buffer.from(printed, "hex") : null;
  } catch {
    return null;
  }
}
