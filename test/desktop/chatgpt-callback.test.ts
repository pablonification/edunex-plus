import { createServer, get } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listenForCode } from "../../src/desktop/chatgpt/callback";

let redirect: URL;
let abort: AbortController;
let listener: Awaited<ReturnType<typeof listenForCode>>;
beforeEach(async () => {
  const reservation = createServer();
  await new Promise<void>((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const { port } = reservation.address() as AddressInfo;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  redirect = new URL(`http://127.0.0.1:${port}/auth/openai/callback`);
  abort = new AbortController();
  listener = await listenForCode(redirect, "pretend-state", abort.signal, "Return to the app");
});
afterEach(() => listener.close());

describe("the one-time loopback callback", () => {
  it("ignores unrelated paths, wrong state, duplicate parameters and hostile Host headers, then consumes once", async () => {
    expect((await fetch(new URL("/favicon.ico", redirect))).status).toBe(404);
    expect((await fetch(`${redirect}?state=wrong&code=pretend`)).status).toBe(400);
    expect((await fetch(`${redirect}?state=pretend-state&state=wrong&code=pretend`)).status).toBe(400);
    const hostile = await new Promise<number | undefined>((resolve, reject) => {
      get(`${redirect}?state=pretend-state&code=pretend`, { headers: { host: "example.com" } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      }).on("error", reject);
    });
    expect(hostile).toBe(404);
    const response = await fetch(`${redirect}?state=pretend-state&code=pretend`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("Return to the app");
    expect(await listener.code).toBe("pretend");
    expect((await fetch(`${redirect}?state=pretend-state&code=pretend`)).status).toBe(400);
  });

  it.each(["error=access_denied", "", "code=one&code=two"])("ends a verified but unsuccessful callback: %s", async (parameters) => {
    await fetch(`${redirect}?state=pretend-state&${parameters}`);
    await expect(listener.code).rejects.toThrow();
    expect((await fetch(`${redirect}?state=pretend-state&code=pretend`)).status).toBe(400);
  });

  it("cancels a waiting browser, refuses late callbacks, and releases the listening port", async () => {
    abort.abort();
    await expect(listener.code).rejects.toThrow();
    await expect(fetch(`${redirect}?state=pretend-state&code=pretend`)).rejects.toThrow();
    const next = await listenForCode(redirect, "another-state", new AbortController().signal, "Return");
    next.close();
  });

  it("fails cleanly when the configured port is occupied", async () => {
    await expect(listenForCode(redirect, "other", new AbortController().signal, "Return")).rejects.toThrow();
  });
});
