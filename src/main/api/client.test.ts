import { describe, expect, it, vi } from "vitest";
import { createEdunexApi } from "./client";

function okResponse(body: unknown = {}) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function fetchOk() {
  return vi.fn(async () => okResponse({ id: 190136 }));
}

describe("edunex api client", () => {
  it("calls the endpoint with the captured bearer token and the app's User-Agent", async () => {
    const fetchImpl = fetchOk();
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => "tok-123",
      userAgent: "EdunexPlus/0.0.1",
      fetchImpl,
    });

    const result = await api.get("/login/me");

    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api-edunex.cognisia.id/login/me");
    expect(init.headers.get("Authorization")).toBe("Bearer tok-123");
    expect(init.headers.get("User-Agent")).toBe("EdunexPlus/0.0.1");
  });

  it("reports 401s and signals the session is gone", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 401 }));
    const onUnauthorized = vi.fn();
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => "stale",
      onUnauthorized,
      fetchImpl,
    });

    const result = await api.get("/login/me");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("treats a missing token as unauthorized without hitting the network", async () => {
    const fetchImpl = fetchOk();
    const onUnauthorized = vi.fn();
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => null,
      onUnauthorized,
      fetchImpl,
    });

    const result = await api.get("/login/me");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("survives network failures as a non-auth error (offline ≠ signed out)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const onUnauthorized = vi.fn();
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => "tok",
      onUnauthorized,
      fetchImpl,
    });

    const result = await api.get("/todo");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("does not fire onUnauthorized for other 4xx/5xx responses", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 500 }));
    const onUnauthorized = vi.fn();
    const api = createEdunexApi({
      baseUrl: "https://api-edunex.cognisia.id",
      getToken: () => "tok",
      onUnauthorized,
      fetchImpl,
    });

    const result = await api.get("/todo");

    expect(result.status).toBe(500);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
