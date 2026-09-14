import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApplicationRuntime } from "../effect/runtime";
import {
  CognisiaService,
  createCognisiaLayer,
  createCognisiaHttpLayer,
} from "./api-service";
import { createEdunexApi } from "./client";
import { AuthService } from "../auth/auth-service";
import {
  HttpTransport,
  type HttpResponseService,
  type HttpTransportService,
} from "../platform/services";

const runtimes: Array<ReturnType<typeof createApplicationRuntime>> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.shutdown()));
});

function response(status: number, body: unknown): HttpResponseService {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

function harness(
  request: HttpTransportService["request"],
  onUnauthorized = vi.fn(),
) {
  const transport: HttpTransportService = { request };
  const runtime = createApplicationRuntime(
    createCognisiaHttpLayer({
      getToken: () => "student-token",
      userAgent: "EdunexPlus/test",
      onUnauthorized,
    }).pipe(Layer.provide(Layer.succeed(HttpTransport, transport))),
  );
  runtimes.push(runtime);
  const service = runtime.runSync(Effect.service(CognisiaService));
  return { runtime, service, onUnauthorized };
}

describe("Effect Cognisia read service", () => {
  it("can reuse the authenticated API owned by AuthService", async () => {
    const requests: string[] = [];
    const transport: HttpTransportService = {
      request: async (url) => {
        requests.push(url);
        return response(200, { ok: true });
      },
    };
    const runtime = createApplicationRuntime(
      createCognisiaLayer().pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(AuthService, {
              api: createEdunexApi({
                baseUrl: "https://api-edunex.cognisia.id",
                getToken: () => "auth-owned-token",
                userAgent: "EdunexPlus/auth-test",
                transport,
              }),
            } as never),
          ),
        ),
      ),
    );
    runtimes.push(runtime);
    const service = runtime.runSync(Effect.service(CognisiaService));

    await expect(runtime.runPromise(service.get("/login/me"))).resolves.toEqual(
      responseResult({ ok: true }),
    );
    expect(requests).toEqual(["https://api-edunex.cognisia.id/login/me"]);
  });

  it("keeps the request contract and normalizes a representative envelope", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const h = harness(async (url, init) => {
      requests.push({ url, init });
      return response(200, {
        data: [{ type: "task", id: "113986", attributes: { title: "Tugas 01" } }],
      });
    });

    const result = await h.runtime.runPromise(h.service.getCourseTasks());

    expect(result.body).toEqual([
      { type: "task", id: "113986", attributes: { title: "Tugas 01" } },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://api-edunex.cognisia.id/course/tasks");
    expect(requests[0].init.method).toBe("GET");
    const headers = new Headers(requests[0].init.headers);
    expect(headers.get("Authorization")).toBe("Bearer student-token");
    expect(headers.get("User-Agent")).toBe("EdunexPlus/test");
  });

  it("returns a failed result for malformed data instead of erasing the cache", async () => {
    const h = harness(async () => response(200, { data: "not-a-collection" }));

    const result = await h.runtime.runPromise(h.service.getAgenda());

    expect(result.status).toBe(200);
    expect(result.ok).toBe(false);
    expect(result.body).toBeNull();
  });

  it("maps network failures to status zero and leaves authorization untouched", async () => {
    const onUnauthorized = vi.fn();
    const h = harness(async () => {
      throw new TypeError("offline");
    }, onUnauthorized);

    const result = await h.runtime.runPromise(h.service.getTodo());

    expect(result).toEqual({ status: 0, ok: false, body: null });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("publishes 401s through the existing unauthorized callback", async () => {
    const onUnauthorized = vi.fn();
    const h = harness(async () => response(401, null), onUnauthorized);

    const result = await h.runtime.runPromise(h.service.getMaterials());

    expect(result.status).toBe(401);
    expect(result.ok).toBe(false);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

function responseResult(body: unknown) {
  return { status: 200, ok: true, body };
}
