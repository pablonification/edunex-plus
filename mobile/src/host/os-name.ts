// The phone's system as a report names it: "Android 34" (its API level), "iOS 26.5". One place, so the engine's `os`
// (./host.ts) and a report's own (./report.ts) can't differ: a report sent from an iPhone once said "Android 26.5".

/** `os` and `version` are React Native's `Platform.OS` and `Platform.Version`. */
export function osName(os: string, version: string | number): string {
  return `${os === "ios" ? "iOS" : "Android"} ${version}`;
}
