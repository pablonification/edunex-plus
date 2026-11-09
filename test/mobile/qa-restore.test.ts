// A QA build's session restore (mobile/src/qa) and "[session]" lines (mobile/src/host/session-log.ts), both only with
// EXPO_PUBLIC_R3_GUARD=1. Made-up sessions only.
import { describe, expect, it } from "vitest";
import { sessionLog, sessionWord } from "../../mobile/src/host/session-log";
import { restoreParams, sessionsOf } from "../../mobile/src/qa/link";

describe("the restore link", () => {
  it("reads the port and key, from the whole link or Expo Router's path", () => {
    expect(restoreParams("edunexplus://qa/restore?port=8765&key=0a1b2c3d4e5f")).toEqual({ port: 8765, key: "0a1b2c3d4e5f" });
    expect(restoreParams("/qa/restore?key=deadbeefcafe&port=9000")).toEqual({ port: 9000, key: "deadbeefcafe" });
  });

  it("takes nothing else", () => {
    expect(restoreParams("edunexplus://qa/restore?port=99999&key=0a1b2c3d")).toBeNull();
    expect(restoreParams("edunexplus://qa/restore?port=8765&key=not-hex!")).toBeNull();
    expect(restoreParams("edunexplus://qa/restore?port=8765")).toBeNull();
    expect(restoreParams("edunexplus://task/1?port=8765&key=0a1b2c3d")).toBeNull();
  });

  it("keeps what reads as each system's session, and skips the rest", () => {
    expect(sessionsOf({ edunex: "aaa.bbb.ccc", six: "khongguan=abc%2F123" })).toEqual({ edunex: "aaa.bbb.ccc", six: "khongguan=abc%2F123" });
    expect(sessionsOf({ edunex: null, six: "khongguan=abc" })).toEqual({ edunex: null, six: "khongguan=abc" });
    expect(sessionsOf({ edunex: "not a token", six: "khongguan=a; Path=/" })).toEqual({ edunex: null, six: null });
    expect(sessionsOf(null)).toEqual({ edunex: null, six: null });
  });
});

describe("the [session] lines", () => {
  it("say live, ended or none", () => {
    expect(sessionWord(undefined)).toBe("none");
    expect(sessionWord("signed-out")).toBe("none");
    expect(sessionWord("expired")).toBe("ended");
    for (const state of ["connecting", "live", "offline", "changed", "action-needed"] as const) expect(sessionWord(state)).toBe("live");
  });

  it("one at start, then only when Edunex's or SIX's changes", () => {
    const lines: string[] = [];
    const log = sessionLog((line) => lines.push(line));
    log.saw({ source: "edunex", state: "live" });
    log.begin([
      { source: "edunex", state: "live" },
      { source: "six", state: "signed-out" },
    ]);
    log.saw({ source: "six", state: "connecting" });
    log.saw({ source: "six", state: "live" });
    log.saw({ source: "itb", state: "live" });
    log.saw({ source: "edunex", state: "expired" });
    expect(lines).toEqual(["[session] edunex=live six=none", "[session] edunex=live six=live", "[session] edunex=ended six=live"]);
  });
});
