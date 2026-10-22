import { afterEach, describe, expect, it, vi } from "vitest";
import { createChatGptConnection } from "../../src/desktop/chatgpt/connection";
import { MemoryVault } from "../pretend/memory";

const config = { clientId: "oaiapp_pretend", redirectUri: "http://127.0.0.1:1455/auth/openai/callback" };
const identity = { issuer: "https://auth.openai.com" as const, clientId: config.clientId, subject: "pretend-student", name: "Dimas Pratama" };
const vault = () => new MemoryVault();
afterEach(() => vi.useRealTimers());

describe("the local ChatGPT connection", () => {
  it("works with an older vault, keeps a verified identity across restarts, and only exposes its name", async () => {
    const saved = vault();
    const options = { config, vault: saved, signIn: async () => identity };
    const c = createChatGptConnection(options);
    expect(await c.status()).toEqual({ available: true, connecting: false, name: null });
    expect(await c.connect()).toEqual({ available: true, connecting: false, name: identity.name });
    expect(await createChatGptConnection(options).status()).toEqual(await c.status());
    expect([...saved.secrets.values()]).toEqual([JSON.stringify(identity)]);
    await saved.set("edunex.session", "pretend-edunex");
    await c.disconnect();
    expect(await c.status()).toEqual({ available: true, connecting: false, name: null });
    expect(await saved.get("edunex.session")).toBe("pretend-edunex");
    const changedClient = createChatGptConnection({ ...options, config: { ...config, clientId: "oaiapp_another" } });
    await saved.set("chatgpt.identity", JSON.stringify(identity));
    expect((await changedClient.status()).name).toBeNull();
  });

  it("is unavailable without configuration, and tolerates a damaged saved identity", async () => {
    const saved = vault();
    await saved.set("chatgpt.identity", "not json");
    const c = createChatGptConnection({ config: null, vault: saved, signIn: async () => identity });
    expect(await c.status()).toEqual({ available: false, connecting: false, name: null });
    await expect(c.connect()).rejects.toThrow();
  });

  it("allows one attempt, expires after ten minutes, and never saves a late identity after cancellation", async () => {
    vi.useFakeTimers();
    const saved = vault();
    let deliver: (value: typeof identity) => void = () => undefined;
    let signal: AbortSignal;
    const c = createChatGptConnection({
      config,
      vault: saved,
      signIn: async (s) => {
        signal = s;
        return new Promise((resolve) => {
          deliver = resolve;
        });
      },
    });
    const signingIn = c.connect();
    expect((await c.status()).connecting).toBe(true);
    await expect(c.connect()).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(signal!.aborted).toBe(true);
    await c.disconnect();
    deliver(identity);
    await expect(signingIn).rejects.toThrow();
    expect(saved.secrets.size).toBe(0);
  });

  it("finishes deleting even when sign-out arrives while the vault is writing", async () => {
    const saved = vault();
    let finish: () => void = () => undefined;
    let writing: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      writing = resolve;
    });
    const original = saved.set.bind(saved);
    saved.set = async (key, value) => {
      writing();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      await original(key, value);
    };
    const c = createChatGptConnection({ config, vault: saved, signIn: async () => identity });
    const connecting = c.connect();
    await started;
    const removing = c.disconnect();
    finish();
    await Promise.allSettled([connecting, removing]);
    expect(saved.secrets.size).toBe(0);
  });
});
