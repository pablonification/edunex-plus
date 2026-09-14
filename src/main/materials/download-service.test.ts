import { Effect, Fiber, Layer } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthServiceShape } from "../auth/auth-service";
import { AuthService } from "../auth/auth-service";
import { createApplicationRuntime } from "../effect/runtime";
import {
  ElectronPlatform,
  FileSystem,
  HttpTransport,
  type ElectronPlatformService,
  type FileSystemService,
  type HttpResponseService,
  type HttpTransportService,
} from "../platform/services";
import {
  createMaterialDownloadLayer,
  MaterialDownloadService,
} from "./download";

const liveRuntimes: Array<ReturnType<typeof createApplicationRuntime>> = [];

afterEach(async () => {
  await Promise.all(liveRuntimes.splice(0).map((runtime) => runtime.shutdown()));
});

function response({
  status = 200,
  bytes = [1, 2, 3],
  arrayBuffer = async () => new Uint8Array(bytes).buffer,
}: {
  status?: number;
  bytes?: number[];
  arrayBuffer?: () => Promise<ArrayBuffer>;
} = {}): HttpResponseService {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => ({}),
    arrayBuffer,
  };
}

function materialServiceHarness({
  token = "tok-123" as string | null,
  request = async () => response(),
  saveDialog = async () => ({ canceled: false, filePath: "/tmp/slide.pdf" }),
  writeBytes = () => undefined,
}: {
  token?: string | null;
  request?: HttpTransportService["request"];
  saveDialog?: ElectronPlatformService["showSaveDialog"];
  writeBytes?: FileSystemService["writeBytes"];
} = {}) {
  const unauthorized = vi.fn();
  const auth = {
    accessToken: () => Effect.succeed(token),
    handleUnauthorized: () => Effect.sync(unauthorized),
  } as unknown as AuthServiceShape;
  const transport: HttpTransportService = { request };
  const fileSystem = { writeBytes } as unknown as FileSystemService;
  const electron = { showSaveDialog: saveDialog } as unknown as ElectronPlatformService;
  const platformLayer = Layer.mergeAll(
    Layer.succeed(AuthService, auth),
    Layer.succeed(HttpTransport, transport),
    Layer.succeed(FileSystem, fileSystem),
    Layer.succeed(ElectronPlatform, electron),
  );
  const runtime = createApplicationRuntime(
    createMaterialDownloadLayer({
      baseUrl: "https://api-edunex.cognisia.id",
      userAgent: "EdunexPlus/0.0.1-test",
    }).pipe(Layer.provide(platformLayer)),
  );
  liveRuntimes.push(runtime);
  return {
    runtime,
    service: runtime.runSync(Effect.service(MaterialDownloadService)),
    unauthorized,
    request,
    saveDialog,
    writeBytes,
  };
}

const requestFor = (result: HttpResponseService = response()): HttpTransportService["request"] =>
  vi.fn(async () => result);

const requestForBytes = (bytes: number[]): HttpTransportService["request"] =>
  requestFor(response({ bytes }));

const material = {
  fileUrl: "/blob-storage/materials/1/slide.pdf",
  fileName: "slide.pdf",
};

describe("Effect Material Download service", () => {
  it("uses the injected HTTP and filesystem services for one explicit download", async () => {
    const request = requestForBytes([4, 5, 6]);
    const saveDialog = vi.fn(async () => ({ canceled: false, filePath: "/tmp/slide.pdf" }));
    const writeBytes = vi.fn();
    const h = materialServiceHarness({ request, saveDialog, writeBytes });

    await expect(h.runtime.runPromise(h.service.download(material))).resolves.toEqual({
      ok: true,
      filePath: "/tmp/slide.pdf",
    });

    expect(saveDialog).toHaveBeenCalledWith({
      defaultPath: "slide.pdf",
      createDirectory: true,
      showOverwriteConfirmation: true,
    });
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("https://api-edunex.cognisia.id/blob-storage/materials/1/slide.pdf");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok-123");
    expect(new Headers(init.headers).get("User-Agent")).toBe("EdunexPlus/0.0.1-test");
    expect(writeBytes).toHaveBeenCalledWith("/tmp/slide.pdf", new Uint8Array([4, 5, 6]));
  });

  it("keeps dialog cancellation quiet and does not fetch or write", async () => {
    const request = requestForBytes([1]);
    const writeBytes = vi.fn();
    const h = materialServiceHarness({
      request,
      saveDialog: async () => ({ canceled: true }),
      writeBytes,
    });

    await expect(h.runtime.runPromise(h.service.download(material))).resolves.toEqual({
      ok: false,
      error: "Download cancelled.",
      cancelled: true,
    });
    expect(request).not.toHaveBeenCalled();
    expect(writeBytes).not.toHaveBeenCalled();
  });

  it("maps missing and unauthorized sessions without exposing credentials", async () => {
    const missing = materialServiceHarness({ token: null });
    await expect(missing.runtime.runPromise(missing.service.download(material))).resolves.toEqual({
      ok: false,
      error: "Session expired — please sign in again.",
    });
    expect(missing.unauthorized).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(missing.service)).not.toContain("tok-123");

    const unauthorized = materialServiceHarness({ request: requestFor(response({ status: 401 })) });
    await expect(
      unauthorized.runtime.runPromise(unauthorized.service.download(material)),
    ).resolves.toEqual({ ok: false, error: "Session expired — please sign in again." });
    expect(unauthorized.unauthorized).toHaveBeenCalledTimes(1);
  });

  it("maps HTTP, decoding, and persistence failures to safe results without retrying", async () => {
    const serverError = materialServiceHarness({
      request: requestFor(response({ status: 503 })),
    });
    await expect(serverError.runtime.runPromise(serverError.service.download(material))).resolves.toEqual({
      ok: false,
      error: "Download failed (server returned 503).",
    });

    const malformed = materialServiceHarness({
      request: requestFor(response({ arrayBuffer: async () => Promise.reject(new Error("bad bytes")) })),
    });
    await expect(malformed.runtime.runPromise(malformed.service.download(material))).resolves.toEqual({
      ok: false,
      error: "Download failed — check your connection and try again.",
    });

    const writeBytes = vi.fn(() => {
      throw new Error("EPERM");
    });
    const persistence = materialServiceHarness({ writeBytes });
    await expect(persistence.runtime.runPromise(persistence.service.download(material))).resolves.toEqual({
      ok: false,
      error: "Could not save the file — check the destination and try again.",
    });

    const repeatedRequest = requestForBytes([7]);
    const repeated = materialServiceHarness({ request: repeatedRequest });
    await repeated.runtime.runPromise(repeated.service.download(material));
    await repeated.runtime.runPromise(repeated.service.download(material));
    expect(repeatedRequest).toHaveBeenCalledTimes(2);
  });

  it("interrupts an explicit download before it can start an HTTP request", async () => {
    let releaseDialog!: (value: { canceled: boolean; filePath?: string }) => void;
    const saveDialog = vi.fn(() => new Promise<{ canceled: boolean; filePath?: string }>((resolve) => {
      releaseDialog = resolve;
    }));
    const request = requestForBytes([1]);
    const writeBytes = vi.fn();
    const h = materialServiceHarness({ saveDialog, request, writeBytes });

    const fiber = await h.runtime.fork(h.service.download(material));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await h.runtime.runPromise(Fiber.interrupt(fiber));
    releaseDialog({ canceled: false, filePath: "/tmp/late.pdf" });

    expect(request).not.toHaveBeenCalled();
    expect(writeBytes).not.toHaveBeenCalled();
  });
});
