import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CapturedAuth } from "../../shared/auth";
import { createApplicationRuntime } from "../effect/runtime";
import { createAuthLayer, AuthService } from "./auth-service";
import {
  Clock,
  FileSystem,
  HttpTransport,
  SafeStorage,
  type ClockService,
  type FileSystemService,
  type HttpResponseService,
  type HttpTransportService,
  type IpcHandlerService,
  type IpcMainService,
  type SafeStorageService,
  type WebContentsService,
} from "../platform/services";
import { registerApplicationIpc } from "../ipc/application";

const session: CapturedAuth = {
  accessToken: "eyJ0eXAiOiJK.abc.def",
  refreshToken: "refresh-secret",
  expirationDate: "2069-12-07T00:00:00.000Z",
  verified: true,
  accounts: { "0": { id: 190136 } },
};

const liveRuntimes: Array<ReturnType<typeof createApplicationRuntime>> = [];

afterEach(async () => {
  await Promise.all(liveRuntimes.splice(0).map((runtime) => runtime.shutdown()));
});

function createHarness({
  files = new Map<string, Uint8Array>(),
  apiStatus = 200,
  safeStorageAvailable = true,
}: {
  files?: Map<string, Uint8Array>;
  apiStatus?: number;
  safeStorageAvailable?: boolean;
} = {}) {
  const broadcast = vi.fn<(status: string) => void>();
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fileSystem = createMemoryFileSystem(files);
  const safeStorage = createTestSafeStorage(safeStorageAvailable);
  const clock: ClockService = {
    now: () => 1_700_000_000_000,
    setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimeout: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  };
  const httpTransport: HttpTransportService = {
    request: async (url, init) => {
      requests.push({ url, init });
      return responseFor(apiStatus);
    },
  };
  const platformLayer = Layer.mergeAll(
    Layer.succeed(FileSystem, fileSystem),
    Layer.succeed(Clock, clock),
    Layer.succeed(SafeStorage, safeStorage),
    Layer.succeed(HttpTransport, httpTransport),
  );
  const runtime = createApplicationRuntime(
    createAuthLayer({
      sessionStorePath: "auth-session.enc",
      appVersion: "0.0.1-test",
      broadcast,
    }).pipe(Layer.provide(platformLayer)),
  );
  liveRuntimes.push(runtime);
  const service = runtime.runSync(Effect.service(AuthService));
  return { runtime, service, broadcast, files, requests };
}

describe("Effect auth service", () => {
  it("captures, verifies, persists, and keeps the bearer credentials in main", async () => {
    const h = createHarness();

    await h.runtime.runPromise(h.service.startLogin());
    await h.runtime.runPromise(h.service.capture(session));

    await expect(h.runtime.runPromise(h.service.status())).resolves.toBe("signed-in");
    await expect(h.runtime.runPromise(h.service.accountId())).resolves.toBe("190136");
    await expect(h.runtime.runPromise(h.service.accessToken())).resolves.toBe(session.accessToken);
    expect(h.broadcast).toHaveBeenNthCalledWith(1, "authenticating");
    expect(h.broadcast).toHaveBeenLastCalledWith("signed-in");
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0].url).toBe("https://api-edunex.cognisia.id/login/me");
    expect(new Headers(h.requests[0].init.headers).get("Authorization")).toBe(
      `Bearer ${session.accessToken}`,
    );
    expect(new Headers(h.requests[0].init.headers).get("User-Agent")).toBe(
      "EdunexPlus/0.0.1-test (desktop client; +https://github.com/pablonification/edunex-plus)",
    );

    const encrypted = new TextDecoder().decode(h.files.get("auth-session.enc"));
    expect(encrypted).not.toContain(session.accessToken);
    expect(encrypted).not.toContain(session.refreshToken);
  });

  it("restores a valid persisted session on startup", async () => {
    const files = new Map<string, Uint8Array>();
    const first = createHarness({ files });
    await first.runtime.runPromise(first.service.capture(session));
    await first.runtime.shutdown();

    const second = createHarness({ files });
    await second.runtime.runPromise(second.service.restore());

    await expect(second.runtime.runPromise(second.service.status())).resolves.toBe("signed-in");
    await expect(second.runtime.runPromise(second.service.accountId())).resolves.toBe("190136");
    expect(second.requests.map(({ url }) => url)).toEqual([
      "https://api-edunex.cognisia.id/login/me",
    ]);
  });

  it.each([
    ["missing", undefined],
    ["corrupt", new TextEncoder().encode("not-an-encrypted-session")],
  ])("treats %s credentials as signed out", async (_name, contents) => {
    const files = new Map<string, Uint8Array>();
    if (contents) files.set("auth-session.enc", contents);
    const h = createHarness({ files });

    await h.runtime.runPromise(h.service.restore());

    await expect(h.runtime.runPromise(h.service.status())).resolves.toBe("signed-out");
    expect(h.requests).toHaveLength(0);
    expect(h.broadcast).toHaveBeenCalledWith("signed-out");
  });

  it("keeps a restored session signed in when verification is offline", async () => {
    const files = new Map<string, Uint8Array>();
    const first = createHarness({ files });
    await first.runtime.runPromise(first.service.capture(session));
    await first.runtime.shutdown();

    const offline = createHarness({ files, apiStatus: 0 });
    await offline.runtime.runPromise(offline.service.restore());

    await expect(offline.runtime.runPromise(offline.service.status())).resolves.toBe("signed-in");
    await expect(offline.runtime.runPromise(offline.service.accessToken())).resolves.toBe(
      session.accessToken,
    );
  });

  it("clears an unauthorized restored session and publishes session-expired", async () => {
    const files = new Map<string, Uint8Array>();
    const first = createHarness({ files });
    await first.runtime.runPromise(first.service.capture(session));
    await first.runtime.shutdown();

    const unauthorized = createHarness({ files, apiStatus: 401 });
    await unauthorized.runtime.runPromise(unauthorized.service.restore());

    await expect(unauthorized.runtime.runPromise(unauthorized.service.status())).resolves.toBe(
      "session-expired",
    );
    await expect(unauthorized.runtime.runPromise(unauthorized.service.accessToken())).resolves.toBe(
      null,
    );
    expect(files.has("auth-session.enc")).toBe(false);
    expect(unauthorized.broadcast).toHaveBeenCalledWith("session-expired");
    expect(unauthorized.broadcast).not.toHaveBeenCalledWith("signed-in");
  });

  it("signs out by clearing credentials and returning to the login state", async () => {
    const h = createHarness();
    await h.runtime.runPromise(h.service.capture(session));

    await h.runtime.runPromise(h.service.signOut());

    await expect(h.runtime.runPromise(h.service.status())).resolves.toBe("signed-out");
    await expect(h.runtime.runPromise(h.service.accessToken())).resolves.toBeNull();
    expect(h.files.has("auth-session.enc")).toBe(false);
  });

  it("never falls back to plaintext when safeStorage is unavailable", async () => {
    const h = createHarness({ safeStorageAvailable: false });

    await h.runtime.runPromise(h.service.capture(session));

    await expect(h.runtime.runPromise(h.service.status())).resolves.toBe("signed-in");
    expect(h.files.has("auth-session.enc")).toBe(false);
  });

  it("returns only the public status through the auth IPC seam", async () => {
    const h = createHarness();
    await h.runtime.runPromise(h.service.capture(session));
    const handlers = new Map<string, IpcHandlerService>();
    const ipcMain: IpcMainService = {
      handle: (channel, handler) => handlers.set(channel, handler),
      removeHandler: (channel) => handlers.delete(channel),
    };
    const adapter = registerApplicationIpc({
      ipcMain,
      runtime: h.runtime,
      showTestNotification: () => undefined,
      getAppInfo: () => ({
        version: "test",
        platform: "linux",
        trayActive: false,
        notificationsSupported: false,
      }),
      auth: {
        status: () => h.service.status(),
        startLogin: () => h.service.startLogin(),
        signOut: () => h.service.signOut(),
        accountId: () => h.service.accountId(),
      },
      sync: { read: () => Effect.succeed(null) },
      materialDownloadService: { download: () => Effect.succeed({ ok: false, error: "not used" }) },
      shell: {
        getSettings: () => ({ hiddenViews: [], quitOnClose: false }),
        setViewHidden: () => ({ hiddenViews: [], quitOnClose: false }),
        setQuitOnClose: () => ({ hiddenViews: [], quitOnClose: false }),
      },
      notifications: {
        service: {
          list: () => Effect.succeed([]),
          markRead: () => Effect.succeed([]),
          markAllRead: () => Effect.succeed([]),
        },
      },
      taskAnswerService: {
        saveDraft: () => Effect.succeed({ ok: false, status: 0, created: false, answerId: null }),
        submit: () => Effect.succeed({ ok: false, status: 0 }),
      },
    });

    const publicResult = await handlers.get("auth:get-state")!({ sender: "renderer" });
    expect(publicResult).toBe("signed-in");
    expect(JSON.stringify(publicResult)).not.toContain(session.accessToken);
    expect(JSON.stringify(publicResult)).not.toContain(session.refreshToken);
    expect(JSON.stringify(h.service)).not.toContain(session.accessToken);
    expect(JSON.stringify(h.service)).not.toContain(session.refreshToken);

    const signOutHandler = handlers.get("auth:sign-out");
    if (!signOutHandler) throw new Error("auth sign-out IPC handler was not registered");
    await expect(signOutHandler({ sender: "renderer" })).resolves.toBeUndefined();
    await expect(h.runtime.runPromise(h.service.status())).resolves.toBe("signed-out");
    expect(h.files.has("auth-session.enc")).toBe(false);

    adapter.unregister();
  });

  it("interrupts a pending webview read when the application runtime shuts down", async () => {
    vi.useFakeTimers();
    const files = new Map<string, Uint8Array>();
    const broadcast = vi.fn<(status: string) => void>();
    const clearTimeoutSpy = vi.fn();
    let readSignal: AbortSignal | undefined;
    let resolveRead: (value: unknown) => void = () => undefined;
    const executeJavaScript = vi.fn(
      (_script: string, _userGesture?: boolean, signal?: AbortSignal) => {
        readSignal = signal;
        return new Promise<unknown>((resolve) => {
          resolveRead = resolve;
        });
      },
    );
    const navigateListeners: Array<(event: unknown, url: string) => void> = [];
    const contents: WebContentsService = {
      id: 42,
      send: () => undefined,
      setWindowOpenHandler: () => ({ action: "deny" }),
      loadURL: async () => undefined,
      executeJavaScript,
      on(event, listener) {
        if (event === "did-navigate") {
          navigateListeners.push(listener as (event: unknown, url: string) => void);
        }
      },
      once: () => undefined,
    };
    const clock: ClockService = {
      now: () => 1_700_000_000_000,
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimeout: (timer) => {
        clearTimeoutSpy();
        clearTimeout(timer as ReturnType<typeof setTimeout>);
      },
    };
    const platformLayer = Layer.mergeAll(
      Layer.succeed(FileSystem, createMemoryFileSystem(files)),
      Layer.succeed(Clock, clock),
      Layer.succeed(SafeStorage, createTestSafeStorage(true)),
      Layer.succeed(HttpTransport, {
        request: async () => responseFor(200),
      } satisfies HttpTransportService),
    );
    let runtime: ReturnType<typeof createApplicationRuntime> | null = null;

    try {
      runtime = createApplicationRuntime(
        createAuthLayer({
          sessionStorePath: "auth-session.enc",
          appVersion: "0.0.1-test",
          broadcast,
          forkEffect: (effect) => runtime?.forkSync(effect),
        }).pipe(Layer.provide(platformLayer)),
      );
      const service = runtime.runSync(Effect.service(AuthService));
      await runtime.runPromise(service.attachWebview(contents));

      navigateListeners[0]?.({}, "https://edunex.itb.ac.id/");
      await Promise.resolve();
      expect(executeJavaScript).toHaveBeenCalledTimes(1);
      expect(readSignal?.aborted).toBe(false);

      await runtime.shutdown();
      expect(readSignal?.aborted).toBe(true);
      expect(clearTimeoutSpy).toHaveBeenCalled();

      resolveRead(JSON.stringify(session));
      await Promise.resolve();
      expect(broadcast).not.toHaveBeenCalled();
    } finally {
      await runtime?.shutdown();
      vi.useRealTimers();
    }
  });
});

function createMemoryFileSystem(files: Map<string, Uint8Array>): FileSystemService {
  return {
    readText: (filePath) => new TextDecoder().decode(readFile(files, filePath)),
    readBytes: (filePath) => readFile(files, filePath),
    writeText: (filePath, contents) => files.set(filePath, new TextEncoder().encode(contents)),
    writeBytes: (filePath, contents) => files.set(filePath, new Uint8Array(contents)),
    exists: (filePath) => files.has(filePath),
    remove: (filePath) => {
      files.delete(filePath);
    },
    atomicWrite: (filePath, contents) => files.set(filePath, new TextEncoder().encode(contents)),
  };
}

function readFile(files: Map<string, Uint8Array>, filePath: string): Uint8Array {
  const contents = files.get(filePath);
  if (!contents) throw new Error("missing file");
  return new Uint8Array(contents);
}

function createTestSafeStorage(available: boolean): SafeStorageService {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plaintext) => {
      if (!available) throw new Error("safeStorage unavailable");
      return new TextEncoder().encode(Buffer.from(plaintext, "utf8").toString("base64"));
    },
    decryptString: (ciphertext) => {
      if (!available) throw new Error("safeStorage unavailable");
      return Buffer.from(new TextDecoder().decode(ciphertext), "base64").toString("utf8");
    },
  };
}

function responseFor(status: number): HttpResponseService {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}
