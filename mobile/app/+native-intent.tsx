// Links into the app, before Expo Router routes them. Every link goes where it says, except, in a debug QA build
// (EXPO_PUBLIC_R3_GUARD=1), `edunexplus://qa/restore?port=<n>&key=<hex>`: the lead's Mac hands over a Student's
// sessions (../src/qa/restore.ts), and the app opens on Beranda. A release build folds the check away (__DEV__ is
// false) and carries no ../src/qa (metro.config.js).
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (__DEV__ && process.env.EXPO_PUBLIC_R3_GUARD === "1" && /^(edunexplus:\/\/|\/)?qa\/restore\b/.test(path)) {
    const { qaRestore } = require("../src/qa/restore") as typeof import("../src/qa/restore");
    void qaRestore(path);
    return "/";
  }
  return path;
}
