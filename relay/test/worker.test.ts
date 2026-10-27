// The relay as Cloudflare runs it (relay/src/worker.ts): the Worker passes /v1/ requests to the one
// Durable Object with the address Cloudflare saw, and the cron trigger knocks on a door only it has.
import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env, RelayObject } from "../src/worker";
import { MAINTAINER, MemoryStore, statusEnvelope } from "./fakes";

/** A Durable Object namespace with its one object, on pretend storage. */
function cloudflare() {
  const store = new MemoryStore();
  const seen: Request[] = [];
  const env: Env = {
    GITHUB_REPO: "pablonification/edunex-plus",
    GITHUB_TOKEN: "github-token",
    MAINTAINER_TOKEN: MAINTAINER,
    GITHUB_API: "https://github.test",
    RELAY: {
      idFromName: (name) => name,
      get: () => ({
        fetch: (request: Request) => {
          seen.push(request);
          return object.fetch(request);
        },
      }),
    },
  };
  const object = new RelayObject({ storage: store }, env);
  return { env, store, seen };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Worker", () => {
  it("passes a report on with the address Cloudflare saw, whatever the sender wrote", async () => {
    const { env, seen } = cloudflare();
    const github = vi.fn(async () => Response.json({ number: 300, html_url: "https://github.com/pablonification/edunex-plus/issues/300" }, { status: 201 }));
    vi.stubGlobal("fetch", github);
    const response = await worker.fetch(
      new Request("https://relay.example.workers.dev/v1/reports", {
        method: "POST",
        headers: { "cf-connecting-ip": "203.0.113.7", "x-relay-address": "198.51.100.1" },
        body: JSON.stringify(statusEnvelope()),
      }),
      env,
    );
    expect(response.status).toBe(201);
    expect(seen[0]!.headers.get("x-relay-address")).toBe("203.0.113.7");
    // GitHub's API, with the token, for this repository only.
    const [url, init] = github.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://github.test/repos/pablonification/edunex-plus/issues");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer github-token");
  });

  it("answers nothing outside /v1/, and only the cron trigger reaches the cron door", async () => {
    const { env, seen, store } = cloudflare();
    expect((await worker.fetch(new Request("https://relay.example.workers.dev/cron", { method: "POST" }), env)).status).toBe(404);
    expect((await worker.fetch(new Request("https://relay.example.workers.dev/v1/%2e%2e/cron", { method: "POST" }), env)).status).toBe(404);
    expect(seen).toEqual([]);

    await store.put("count:2026-01-01:reports", 3);
    await worker.scheduled(null, env);
    expect(new URL(seen[0]!.url).pathname).toBe("/cron");
    // The cron trigger forgot the old day's count.
    expect(store.data.has("count:2026-01-01:reports")).toBe(false);
  });
});
