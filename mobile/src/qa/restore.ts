// QA session restore (a debug build with EXPO_PUBLIC_R3_GUARD=1 only; app/+native-intent.tsx): the lead's Mac
// hands a real Student's sessions to the app, so a QA run needn't sign in through Microsoft each time.
// `edunexplus://qa/restore?port=<n>&key=<hex>` reads http://127.0.0.1:<port>/session?key=<key> (the Mac, over
// `adb reverse`), answered with `{ "edunex": "<jwt>" | null, "six": "khongguan=…" | null }`, and signs in with them
// exactly as a sign-in page would: the engine's signIn (the vault, then a full read), as src/desktop/signin-both.ts.
// The log says which went in, never what they are. A release build has none of this (metro.config.js).
import { host } from "../host/host";
import { restoreParams, sessionsOf } from "./link";

export async function qaRestore(link: string): Promise<void> {
  const params = restoreParams(link);
  if (!params) return console.warn("[qa] restore failed: not a restore link");
  let sessions: { edunex: string | null; six: string | null };
  try {
    const response = await fetch(`http://127.0.0.1:${params.port}/session?key=${params.key}`);
    if (!response.ok) return console.warn(`[qa] restore failed: the Mac answered ${response.status}`);
    sessions = sessionsOf(await response.json());
  } catch (error) {
    return console.warn(`[qa] restore failed: no answer from 127.0.0.1:${params.port} (${error instanceof Error ? error.name : "error"})`);
  }
  const { engine, start } = await host();
  // The engine's feeds run, as once the screens are up; each signIn below then reads its system afresh.
  start();
  const signIn = async (source: "edunex" | "six", session: object | null) => {
    if (!session) return "skip";
    try {
      await engine.signIn(source, session);
      return "ok";
    } catch (error) {
      // The engine's own error kind, never the session.
      return `fail(${error instanceof Error ? error.name : "error"})`;
    }
  };
  const [edunex, six] = await Promise.all([
    signIn("edunex", sessions.edunex ? { token: sessions.edunex } : null),
    signIn("six", sessions.six ? { cookie: sessions.six } : null),
  ]);
  console.info(`[qa] restore edunex=${edunex} six=${six}`);
}
