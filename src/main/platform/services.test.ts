import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  composeApplicationLayer,
  createApplicationRuntime,
} from "../effect/runtime";
import { createPlatformLayer } from "./layer";
import {
  Clock,
  ElectronPlatform,
  FileSystem,
  HttpTransport,
  IpcMain,
  Path,
  Random,
  SafeStorage,
  type ElectronPlatformService,
  type PlatformServices,
} from "./services";
import { fetchTransport, nodeFileSystem, nodePath, systemClock, systemRandom } from "./node";
import type { FileSystemService } from "./services";
import { loadShellSettings, saveShellSettings } from "../shell/settings-store";
import { loadWindowState, saveWindowState } from "../window-state";

function fakeElectron(events: string[]): ElectronPlatformService {
  let window: ReturnType<typeof createNoopWindow> | null = null;
  let tray: ReturnType<typeof createNoopTray> | null = null;

  function createNoopWindow() {
    return {
      webContents: {
        id: 1,
        send: () => undefined,
        setWindowOpenHandler: () => undefined,
        loadURL: async () => undefined,
        executeJavaScript: async () => null,
        on: () => undefined,
        once: () => undefined,
      },
      loadURL: async () => undefined,
      loadFile: async () => undefined,
      on: () => undefined,
      show: () => undefined,
      focus: () => undefined,
      hide: () => undefined,
      destroy: () => events.push("window.destroy"),
      isDestroyed: () => false,
      isMinimized: () => false,
      isMaximized: () => false,
      maximize: () => undefined,
      getBounds: () => ({ width: 1, height: 1, x: 0, y: 0 }),
    };
  }

  function createNoopTray() {
    return {
      setToolTip: () => undefined,
      setContextMenu: () => undefined,
      on: () => undefined,
      destroy: () => events.push("tray.destroy"),
    };
  }

  return {
    platform: "linux",
    appName: "Test",
    appVersion: "0.0.0",
    appPath: "/app",
    userDataPath: "/data",
    isPackaged: false,
    environment: {},
    ipcMain: { handle: () => undefined },
    setAppUserModelId: () => undefined,
    requestSingleInstanceLock: () => true,
    whenReady: async () => undefined,
    on: () => undefined,
    quit: () => undefined,
    setAboutPanelOptions: () => undefined,
    setDockIcon: () => undefined,
    createWindow: () => (window = createNoopWindow()),
    createTray: () => (tray = createNoopTray()),
    buildMenu: (template) => template,
    setApplicationMenu: () => undefined,
    createNotification: () => ({ on: () => undefined, show: () => undefined }),
    notificationsSupported: () => false,
    primaryWorkArea: () => ({ width: 1, height: 1 }),
    showSaveDialog: async () => ({ canceled: true }),
    shutdown: () => {
      tray?.destroy();
      window?.destroy();
      events.push("electron.shutdown");
    },
  };
}

it("provides platform services through the managed application layer", async () => {
  const events: string[] = [];
  const electron = fakeElectron(events);
  const services: PlatformServices = {
    fileSystem: nodeFileSystem,
    path: nodePath,
    clock: { ...systemClock, now: () => 1234 },
    random: { ...systemRandom, next: () => 0.25 },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (value) => new TextEncoder().encode(value),
      decryptString: (value) => new TextDecoder().decode(value),
    },
    httpTransport: fetchTransport,
    ipcMain: electron.ipcMain,
    electron,
  };
  const runtime = createApplicationRuntime(composeApplicationLayer(createPlatformLayer(services)));

  const facts = await runtime.runPromise(
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem;
      const path = yield* Path;
      const clock = yield* Clock;
      const random = yield* Random;
      const safeStorage = yield* SafeStorage;
      const http = yield* HttpTransport;
      const ipc = yield* IpcMain;
      const electron = yield* ElectronPlatform;
      return {
        canRead: typeof fileSystem.readText === "function",
        joined: path.join("a", "b"),
        now: clock.now(),
        random: random.next(),
        encrypted: safeStorage.isEncryptionAvailable(),
        canRequest: typeof http.request === "function",
        canHandleIpc: typeof ipc.handle === "function",
        appName: electron.appName,
      };
    }),
  );

  await runtime.shutdown();
  expect(facts).toEqual({
    canRead: true,
    joined: "a/b",
    now: 1234,
    random: 0.25,
    encrypted: true,
    canRequest: true,
    canHandleIpc: true,
    appName: "Test",
  });
  expect(events).toEqual(["electron.shutdown"]);
});

it("lets persistence use an in-memory filesystem while keeping atomic writes", () => {
  const files = new Map<string, string>();
  const nonces: string[] = [];
  const fileSystem: FileSystemService = {
    readText: (filePath) => {
      const value = files.get(filePath);
      if (value === undefined) throw new Error("missing");
      return value;
    },
    readBytes: (filePath) => new TextEncoder().encode(files.get(filePath) ?? ""),
    writeText: (filePath, contents) => files.set(filePath, contents),
    writeBytes: (filePath, contents) => files.set(filePath, new TextDecoder().decode(contents)),
    exists: (filePath) => files.has(filePath),
    remove: (filePath) => files.delete(filePath),
    atomicWrite: (filePath, contents, nonce) => {
      nonces.push(nonce ?? "missing");
      files.set(filePath, contents);
    },
  };
  const services = {
    fileSystem,
    clock: { now: () => 1700000000000, setTimeout: () => 0, clearTimeout: () => undefined },
    random: { next: () => 0.5 },
  };

  saveShellSettings("shell.json", { hiddenViews: ["exams", "todo"], quitOnClose: true }, services);
  expect(loadShellSettings("shell.json", services)).toEqual({
    hiddenViews: ["todo", "exams"],
    quitOnClose: true,
  });
  saveWindowState("window.json", { width: 1180, height: 780, x: 10, y: 20 }, {
    width: 1512,
    height: 982,
  }, services);
  expect(loadWindowState("window.json", { width: 1512, height: 982 }, services)).toEqual({
    width: 1180,
    height: 780,
    x: 10,
    y: 20,
  });
  expect(nonces).toEqual(["1700000000000-0.5", "1700000000000-0.5"]);
});

it("releases platform-owned window and tray resources during Layer shutdown", async () => {
  const events: string[] = [];
  const electron = fakeElectron(events);
  const services: PlatformServices = {
    fileSystem: nodeFileSystem,
    path: nodePath,
    clock: systemClock,
    random: systemRandom,
    safeStorage: {
      isEncryptionAvailable: () => false,
      encryptString: () => new Uint8Array(),
      decryptString: () => "",
    },
    httpTransport: fetchTransport,
    ipcMain: electron.ipcMain,
    electron,
  };
  const runtime = createApplicationRuntime(composeApplicationLayer(createPlatformLayer(services)));

  await runtime.runPromise(
    Effect.gen(function* () {
      const platform = yield* ElectronPlatform;
      platform.createWindow({
        width: 1,
        height: 1,
        minWidth: 1,
        minHeight: 1,
        title: "Test",
        webPreferences: {
          preload: "test",
          contextIsolation: true,
          nodeIntegration: false,
          webviewTag: false,
        },
      });
      platform.createTray("test");
    }),
  );

  await runtime.shutdown();
  expect(events).toEqual(["tray.destroy", "window.destroy", "electron.shutdown"]);
});
