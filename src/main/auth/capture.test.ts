import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { parseCapturedAuth, createAuthCapture } from "./capture";

const validRaw = {
  accessToken: "eyJ0eXAiOiJK.abc.def",
  refreshToken: "def50200b172",
  expirationDate: "2069-12-07T00:00:00.000Z",
  verified: true,
  accounts: { "0": { id: 190136 }, "1": { id: 2 } },
};

describe("parseCapturedAuth", () => {
  it("accepts the auth JSON exactly as the SPA writes it", () => {
    expect(parseCapturedAuth(validRaw)).toEqual(validRaw);
  });

  it("rejects null, partial and wrong-typed payloads", () => {
    expect(parseCapturedAuth(null)).toBeNull();
    expect(parseCapturedAuth({})).toBeNull();
    expect(parseCapturedAuth({ ...validRaw, accessToken: 42 })).toBeNull();
    expect(parseCapturedAuth({ ...validRaw, accounts: [] })).toBeNull();
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
    const onCaptured = vi.fn();
    const capture = createAuthCapture(h.executeJs, { intervalMs: 1000 });
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
  });

  it("ignores unparsable storage values and keeps polling", async () => {
    const h = harness("not-json");
    const onCaptured = vi.fn();
    const capture = createAuthCapture(h.executeJs, { intervalMs: 1000 });
    capture.start(onCaptured);

    await vi.advanceTimersByTimeAsync(2999);
    expect(onCaptured).not.toHaveBeenCalled();
    expect(h.executeJs).toHaveBeenCalledTimes(3);
  });

  it("stop ends polling without firing", async () => {
    const h = harness(null);
    const onCaptured = vi.fn();
    const capture = createAuthCapture(h.executeJs, { intervalMs: 1000 });
    capture.start(onCaptured);
    capture.stop();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(onCaptured).not.toHaveBeenCalled();
  });

  it("start while already running does not double-poll", async () => {
    const h = harness(null);
    const onCaptured = vi.fn();
    const capture = createAuthCapture(h.executeJs, { intervalMs: 1000 });
    capture.start(onCaptured);
    capture.start(onCaptured);

    await vi.advanceTimersByTimeAsync(2999);
    expect(h.executeJs).toHaveBeenCalledTimes(3);
  });

  it("restarts after stop for the next navigation onto the origin", async () => {
    const h = harness(null);
    const onCaptured = vi.fn();
    const capture = createAuthCapture(h.executeJs, { intervalMs: 1000 });
    capture.start(onCaptured);
    capture.stop();
    capture.start(onCaptured);

    await vi.advanceTimersByTimeAsync(2999);
    expect(h.executeJs).toHaveBeenCalledTimes(3);

    h.setStorage(JSON.stringify(validRaw));
    await vi.advanceTimersByTimeAsync(1000);
    expect(onCaptured).toHaveBeenCalledWith(validRaw);
  });

  it("survives a rejected executeJavaScript (webview navigating)", async () => {
    const executeJs = vi.fn(async () => {
      throw new Error("frame detached");
    });
    const onCaptured = vi.fn();
    const capture = createAuthCapture(executeJs, { intervalMs: 1000 });
    capture.start(onCaptured);

    await vi.advanceTimersByTimeAsync(2999);
    expect(executeJs).toHaveBeenCalledTimes(3);
    expect(onCaptured).not.toHaveBeenCalled();
  });
});
