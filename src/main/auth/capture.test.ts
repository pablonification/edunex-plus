import { Effect } from "effect";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  parseCapturedAuth,
  createAuthCapture,
  type AuthCaptureEffect,
} from "./capture";
import { systemClock } from "../platform/node";

const validRaw = {
  accessToken: "eyJ0eXAiOiJK.abc.def",
  refreshToken: "def50200b172",
  expirationDate: "2069-12-07T00:00:00.000Z",
  verified: true,
  accounts: { "0": { id: 190136 }, "1": { id: 2 } },
};

function captureOptions() {
  return {
    intervalMs: 1000,
    clock: systemClock,
    fork: (effect: AuthCaptureEffect) => Effect.runFork(effect),
  };
}

describe("parseCapturedAuth", () => {
  it("accepts the auth JSON exactly as the SPA writes it", () => {
    expect(parseCapturedAuth(validRaw)).toEqual(validRaw);
  });

  it("accepts accounts as the SSO webhook's array of identities", () => {
    const withArray = {
      ...validRaw,
      accounts: [{ id: 190136, level: "STUDENT" }, { id: 187138, level: "LECTURER" }],
    };
    expect(parseCapturedAuth(withArray)).toEqual(withArray);
  });

  it("rejects null, partial and wrong-typed payloads", () => {
    expect(parseCapturedAuth(null)).toBeNull();
    expect(parseCapturedAuth({})).toBeNull();
    expect(parseCapturedAuth({ ...validRaw, accessToken: 42 })).toBeNull();
    expect(parseCapturedAuth({ ...validRaw, accounts: "nope" })).toBeNull();
  });
});

describe("auth capture loop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function harness(initialStorage: unknown) {
    let storage = initialStorage;
    const executeJs = vi.fn(async () => storage);
    return {
      executeJs,
      setStorage(next: unknown) {
        storage = next;
      },
    };
  }

  it("polls localStorage.auth until it appears, then fires once and stops", async () => {
    const h = harness(null);
    const onCaptured = vi.fn(() => Effect.void);
    const capture = createAuthCapture(h.executeJs, captureOptions());
    capture.start(onCaptured);

    await vi.advanceTimersByTimeAsync(1500);
    expect(onCaptured).not.toHaveBeenCalled();
    expect(h.executeJs).toHaveBeenCalledTimes(2);

    // The SPA writes `auth` ~2s after the redirect-back (auth-spike).
    h.setStorage(JSON.stringify(validRaw));
    await vi.advanceTimersByTimeAsync(1000);
    expect(onCaptured).toHaveBeenCalledWith(validRaw);

    expect(h.executeJs).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.executeJs).toHaveBeenCalledTimes(3);
    capture.stop();
  });

  it("ignores unparsable storage values and keeps polling", async () => {
    const h = harness("not-json");
    const onCaptured = vi.fn(() => Effect.void);
    const capture = createAuthCapture(h.executeJs, captureOptions());
    capture.start(onCaptured);

    await vi.advanceTimersByTimeAsync(2999);
    expect(onCaptured).not.toHaveBeenCalled();
    expect(h.executeJs).toHaveBeenCalledTimes(3);
    capture.stop();
  });

  it("stop ends polling without firing", async () => {
    const h = harness(null);
    const onCaptured = vi.fn(() => Effect.void);
    const capture = createAuthCapture(h.executeJs, captureOptions());
    capture.start(onCaptured);
    capture.stop();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(onCaptured).not.toHaveBeenCalled();
  });

  it("start while already running does not double-poll", async () => {
    const h = harness(null);
    const onCaptured = vi.fn(() => Effect.void);
    const capture = createAuthCapture(h.executeJs, captureOptions());
    capture.start(onCaptured);
    capture.start(onCaptured);

    await vi.advanceTimersByTimeAsync(2999);
    expect(h.executeJs).toHaveBeenCalledTimes(3);
    capture.stop();
  });

  it("restarts after stop for the next navigation onto the origin", async () => {
    const h = harness(null);
    const onCaptured = vi.fn(() => Effect.void);
    const capture = createAuthCapture(h.executeJs, captureOptions());
    capture.start(onCaptured);
    capture.stop();
    capture.start(onCaptured);

    await vi.advanceTimersByTimeAsync(2999);
    // The first run was already in flight when it was stopped; it is ignored
    // after settling, while the restarted run owns the subsequent polls.
    expect(h.executeJs).toHaveBeenCalledTimes(4);

    h.setStorage(JSON.stringify(validRaw));
    await vi.advanceTimersByTimeAsync(1000);
    expect(onCaptured).toHaveBeenCalledWith(validRaw);
    capture.stop();
  });

  it("survives a rejected executeJavaScript (webview navigating)", async () => {
    const executeJs = vi.fn(async () => {
      throw new Error("frame detached");
    });
    const onCaptured = vi.fn(() => Effect.void);
    const capture = createAuthCapture(executeJs, captureOptions());
    capture.start(onCaptured);

    await vi.advanceTimersByTimeAsync(2999);
    expect(executeJs).toHaveBeenCalledTimes(3);
    expect(onCaptured).not.toHaveBeenCalled();
    capture.stop();
  });

  it("aborts a pending read and ignores its late result after stop", async () => {
    let resolveRead!: (value: unknown) => void;
    let signal!: AbortSignal;
    const executeJs = vi.fn((readSignal: AbortSignal) => {
      signal = readSignal;
      return new Promise<unknown>((resolve) => {
        resolveRead = resolve;
      });
    });
    const onCaptured = vi.fn(() => Effect.void);
    const capture = createAuthCapture(executeJs, captureOptions());

    capture.start(onCaptured);
    expect(signal.aborted).toBe(false);

    capture.stop();
    expect(signal.aborted).toBe(true);

    resolveRead(JSON.stringify(validRaw));
    await Promise.resolve();
    expect(onCaptured).not.toHaveBeenCalled();
  });
});
