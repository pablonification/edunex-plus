import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { createApplicationComposition } from "./application";
import { AuthService } from "./auth/auth-service";
import { CognisiaService } from "./api/api-service";
import { MaterialDownloadService } from "./materials/download";
import { NotificationService } from "./notifications/notification-service";
import { SnapshotCacheService } from "./sync/snapshot-cache";
import { SyncService } from "./sync/sync-engine";
import { TaskAnswerService } from "./tasks/task-answers";
import { createPlatformLayer } from "./platform/layer";
import type {
  ElectronPlatformService,
  FileSystemService,
  IpcMainService,
  PlatformServices,
} from "./platform/services";
import type { LivePlatform } from "./platform/live";

const compositions: Array<ReturnType<typeof createApplicationComposition>> = [];

afterEach(async () => {
  await Promise.all(compositions.splice(0).map((composition) => composition.shutdown()));
});

function createHarness() {
  const files = new Map<string, Uint8Array>();
  let shutdownCalls = 0;
  const fileSystem: FileSystemService = {
    readText: (filePath) => {
      const value = files.get(filePath);
      if (!value) throw new Error("missing");
      return new TextDecoder().decode(value);
    },
    readBytes: (filePath) => files.get(filePath) ?? new Uint8Array(),
    writeText: (filePath, contents) => files.set(filePath, new TextEncoder().encode(contents)),
    writeBytes: (filePath, contents) => files.set(filePath, new Uint8Array(contents)),
    exists: (filePath) => files.has(filePath),
    remove: (filePath) => {
      files.delete(filePath);
    },
    atomicWrite: (filePath, contents) => files.set(filePath, new TextEncoder().encode(contents)),
  };
  const ipcMain: IpcMainService = {
    handle: () => undefined,
    removeHandler: () => undefined,
  };
  const electron: ElectronPlatformService = {
    platform: "linux",
    appName: "Edunex Plus",
    appVersion: "0.0.1-test",
    appPath: "/app",
    userDataPath: "/data",
    isPackaged: false,
    environment: {},
    ipcMain,
    setAppUserModelId: () => undefined,
    requestSingleInstanceLock: () => true,
    whenReady: async () => undefined,
    on: () => undefined,
    quit: () => undefined,
    setAboutPanelOptions: () => undefined,
    setDockIcon: () => undefined,
    createWindow: () => ({}) as never,
    createTray: () => ({}) as never,
    buildMenu: (template) => template,
    setApplicationMenu: () => undefined,
    createNotification: () => ({ on: () => undefined, show: () => undefined }),
    notificationsSupported: () => false,
    showSaveDialog: async () => ({ canceled: true }),
    primaryWorkArea: () => ({ width: 1200, height: 800 }),
    shutdown: () => {
      shutdownCalls += 1;
    },
  };
  const services: PlatformServices = {
    fileSystem,
    path: {
      join: (...parts) => parts.join("/"),
      dirname: (filePath) => filePath.split("/").slice(0, -1).join("/"),
    },
    clock: {
      now: () => 1_700_000_000_000,
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimeout: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
    },
    random: { next: () => 0.5 },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (value) => new TextEncoder().encode(value),
      decryptString: (value) => new TextDecoder().decode(value),
    },
    httpTransport: {
      request: async () => ({
        status: 200,
        ok: true,
        json: async () => ({}),
        arrayBuffer: async () => new ArrayBuffer(0),
      }),
    },
    ipcMain,
    electron,
  };
  const platform: LivePlatform = { services, layer: createPlatformLayer(services) };
  return { platform, shutdownCalls: () => shutdownCalls };
}

function compositionOptions(platform: LivePlatform, onAuthState: (status: string) => void) {
  return {
    platform,
    sessionStorePath: "/data/auth-session.enc",
    snapshotRoot: "/data/feed-snapshots",
    seenLedgerRoot: "/data/seen-ledger",
    notificationFeedRoot: "/data/notifications",
    onAuthState,
  };
}

describe("application composition", () => {
  it("resolves every production service from one runtime and releases it once", async () => {
    const harness = createHarness();
    const states: string[] = [];
    const composition = createApplicationComposition(
      compositionOptions(harness.platform, (status) => states.push(status)),
    );
    compositions.push(composition);

    expect(composition.runtime.runSync(Effect.service(AuthService))).toBe(composition.services.auth);
    expect(composition.runtime.runSync(Effect.service(CognisiaService))).toBe(composition.services.cognisia);
    expect(composition.runtime.runSync(Effect.service(SnapshotCacheService))).toBe(composition.services.snapshotCache);
    expect(composition.runtime.runSync(Effect.service(TaskAnswerService))).toBe(composition.services.taskAnswers);
    expect(composition.runtime.runSync(Effect.service(MaterialDownloadService))).toBe(composition.services.materialDownloads);
    expect(composition.runtime.runSync(Effect.service(NotificationService))).toBe(composition.services.notifications);
    expect(composition.runtime.runSync(Effect.service(SyncService))).toBe(composition.services.sync);

    await composition.runtime.runPromise(composition.services.auth.capture({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expirationDate: "2069-01-01T00:00:00.000Z",
      verified: true,
      accounts: [{ id: "190136" }],
    }));
    await expect(composition.runtime.runPromise(composition.services.sync.isRunning())).resolves.toBe(true);

    await composition.runtime.runPromise(composition.services.auth.signOut());
    expect(states).toEqual(["signed-in", "signed-out"]);
    await expect(composition.runtime.runPromise(composition.services.sync.isRunning())).resolves.toBe(false);

    await Promise.all([composition.shutdown(), composition.shutdown()]);
    expect(harness.shutdownCalls()).toBe(1);
  });
});
