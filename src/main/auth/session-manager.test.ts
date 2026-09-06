import { describe, expect, it, vi } from "vitest";
import { createSessionManager } from "./session-manager";
import type { CapturedAuth } from "../../shared/auth";

const session: CapturedAuth = {
  accessToken: "eyJ.abc.def",
  refreshToken: "def50200",
  expirationDate: "2069-12-07T00:00:00.000Z",
  verified: true,
  accounts: { "0": { id: 190136 } },
};

function harness({
  stored = null as CapturedAuth | null,
  apiStatus = 200,
}: { stored?: CapturedAuth | null; apiStatus?: number } = {}) {
  const store = {
    load: vi.fn(() => stored),
    save: vi.fn(() => {}),
    clear: vi.fn(() => {}),
  };
  const api = { get: vi.fn(async () => ({ status: apiStatus, ok: apiStatus < 400, body: null })) };
  const onChange = vi.fn();
  const manager = createSessionManager({ store, api, onChange });
  return { manager, store, api, onChange };
}

describe("session manager", () => {
  it("starts signed-out when nothing is stored", async () => {
    const { manager, onChange } = harness();
    await manager.restore();
    expect(manager.status()).toBe("signed-out");
    expect(onChange).toHaveBeenCalledWith("signed-out");
  });

  it("restores a stored session as signed-in without re-prompting (restart keeps the session)", async () => {
    const { manager, api, onChange } = harness({ stored: session });
    await manager.restore();
    expect(manager.status()).toBe("signed-in");
    expect(api.get).toHaveBeenCalledWith("/login/me");
    expect(onChange).toHaveBeenCalledWith("signed-in");
  });

  it("a 401 on restore clears the stale session and asks for re-login", async () => {
    const { manager, store, onChange } = harness({ stored: session, apiStatus: 401 });
    await manager.restore();
    expect(manager.status()).toBe("session-expired");
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("session-expired");
  });

  it("stays signed-in when restore cannot reach the API (offline ≠ signed out)", async () => {
    const { manager } = harness({ stored: session, apiStatus: 0 });
    await manager.restore();
    expect(manager.status()).toBe("signed-in");
  });

  it("capture persists the tokens and flips to signed-in", async () => {
    const { manager, store, onChange } = harness();
    await manager.capture(session);
    expect(store.save).toHaveBeenCalledWith(session);
    expect(manager.status()).toBe("signed-in");
    expect(onChange).toHaveBeenCalledWith("signed-in");
  });

  it("handleUnauthorized clears the session and pauses into session-expired", async () => {
    const { manager, store } = harness({ stored: session });
    await manager.restore();

    manager.handleUnauthorized();
    expect(manager.status()).toBe("session-expired");
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it("startLogin opens the webview moment", () => {
    const { manager } = harness();
    manager.startLogin();
    expect(manager.status()).toBe("authenticating");
  });

  it("a successful capture from the relogin webview recovers without an app restart", async () => {
    const { manager } = harness({ stored: session });
    await manager.restore();
    manager.handleUnauthorized();

    manager.startLogin();
    await manager.capture(session);
    expect(manager.status()).toBe("signed-in");
  });

  it("capture with a verify 401 goes straight to session-expired, never through signed-in", async () => {
    const { manager, onChange, store } = harness({ apiStatus: 401 });
    manager.startLogin();

    await manager.capture(session);

    expect(manager.status()).toBe("session-expired");
    expect(onChange).not.toHaveBeenCalledWith("signed-in");
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it("capture with the API unreachable still signs in — tokens were just minted", async () => {
    const { manager } = harness({ apiStatus: 0 });
    manager.startLogin();

    await manager.capture(session);

    expect(manager.status()).toBe("signed-in");
  });
});
