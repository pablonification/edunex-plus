import { effectRuntime } from "../effect/effect-runtime";

/**
 * The application-facing platform contracts.  None of these types mention
 * Node or Electron, which keeps feature code runnable in a plain test process.
 * Production implementations live in `node.ts` and `electron.ts`; tests can
 * provide the same contracts through Effect Layers.
 */

export interface FileSystemService {
  readText(filePath: string): string;
  readBytes(filePath: string): Uint8Array;
  writeText(filePath: string, contents: string): void;
  writeBytes(filePath: string, contents: Uint8Array): void;
  exists(filePath: string): boolean;
  remove(filePath: string): void;
  /** Writes a temporary file and renames it into place. */
  atomicWrite(filePath: string, contents: string, nonce?: string): void;
}

export interface PathService {
  join(...parts: string[]): string;
  dirname(filePath: string): string;
}

export interface ClockService {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(timer: unknown): void;
}

export interface RandomService {
  next(): number;
}

export interface SafeStorageService {
  isEncryptionAvailable(): boolean;
  encryptString(plaintext: string): Uint8Array;
  decryptString(ciphertext: Uint8Array): string;
}

export interface HttpResponseService {
  readonly status: number;
  readonly ok: boolean;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface HttpTransportService {
  request(url: string, init: RequestInit): Promise<HttpResponseService>;
}

export interface IpcEventService {
  readonly sender: unknown;
  readonly channel?: string;
}

export type IpcHandlerService = (
  event: IpcEventService,
  ...args: unknown[]
) => unknown | Promise<unknown>;

export interface IpcMainService {
  handle(channel: string, handler: IpcHandlerService): void;
  removeHandler(channel: string): void;
}

export interface WebContentsService {
  readonly id: number;
  send(channel: string, payload?: unknown): void;
  setWindowOpenHandler(handler: (details: { url: string }) => { action: "deny" | "allow" }): void;
  loadURL(url: string): Promise<void>;
  executeJavaScript(
    script: string,
    userGesture?: boolean,
    signal?: AbortSignal,
  ): Promise<unknown>;
  on(
    event: "did-navigate" | "did-navigate-in-page",
    listener: (event: unknown, url: string) => void,
  ): void;
  on(
    event: "did-attach-webview",
    listener: (event: unknown, contents: WebContentsService) => void,
  ): void;
  once(event: "destroyed", listener: () => void): void;
}

export interface WindowBoundsService {
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
}

export interface WindowCloseEventService {
  preventDefault(): void;
}

export interface WindowService {
  readonly webContents: WebContentsService;
  loadURL(url: string): Promise<void>;
  loadFile(filePath: string): Promise<void>;
  on(event: "close", listener: (event: WindowCloseEventService) => void): void;
  on(event: "closed" | "resize" | "move" | "enter-full-screen" | "leave-full-screen", listener: () => void): void;
  show(): void;
  focus(): void;
  hide(): void;
  destroy(): void;
  isDestroyed(): boolean;
  isMinimized(): boolean;
  isMaximized(): boolean;
  maximize(): void;
  getBounds(): WindowBoundsService;
}

export interface TrayService {
  setToolTip(tooltip: string): void;
  setContextMenu(menu: unknown): void;
  on(event: "click", listener: () => void): void;
  destroy(): void;
}

export interface NotificationService {
  on(event: "click", listener: () => void): void;
  show(): void;
}

/** Renderer-independent menu data understood by the Electron adapter. */
export interface MenuItemTemplate {
  readonly label?: string;
  readonly role?: string;
  readonly type?: "separator";
  readonly accelerator?: string;
  readonly click?: () => void;
  readonly submenu?: readonly MenuItemTemplate[];
}

export interface SaveDialogResultService {
  canceled: boolean;
  filePath?: string;
}

export interface WindowOptionsService {
  readonly width: number;
  readonly height: number;
  readonly x?: number;
  readonly y?: number;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly title: string;
  readonly titleBarStyle?: "default" | "hidden";
  readonly trafficLightPosition?: { x: number; y: number };
  readonly vibrancy?: string;
  readonly visualEffectState?: string;
  readonly backgroundColor?: string;
  readonly webPreferences: {
    readonly preload: string;
    readonly contextIsolation: boolean;
    readonly nodeIntegration: boolean;
    readonly webviewTag: boolean;
  };
}

export interface ElectronPlatformService {
  readonly platform: NodeJS.Platform;
  readonly appName: string;
  readonly appVersion: string;
  readonly appPath: string;
  readonly userDataPath: string;
  readonly isPackaged: boolean;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly ipcMain: IpcMainService;
  setAppUserModelId(id: string): void;
  requestSingleInstanceLock(): boolean;
  whenReady(): Promise<void>;
  on(
    event: "activate" | "second-instance" | "window-all-closed" | "before-quit",
    listener: (...args: unknown[]) => void,
  ): void;
  quit(): void;
  setAboutPanelOptions(options: {
    applicationName: string;
    applicationVersion: string;
    credits: string;
  }): void;
  setDockIcon(filePath: string): void;
  createWindow(options: WindowOptionsService): WindowService;
  createTray(iconPath: string): TrayService;
  buildMenu(template: unknown): unknown;
  setApplicationMenu(menu: unknown): void;
  createNotification(options: { title: string; body: string }): NotificationService;
  notificationsSupported(): boolean;
  showSaveDialog(options: {
    defaultPath: string;
    createDirectory: boolean;
    showOverwriteConfirmation: boolean;
  }): Promise<SaveDialogResultService>;
  primaryWorkArea(): { width: number; height: number };
  /** Releases owned tray/window resources during the managed runtime shutdown. */
  shutdown(): void;
}

export class FileSystem extends effectRuntime.Context.Service<FileSystem, FileSystemService>()(
  "EdunexPlus/FileSystem",
) {}

export class Path extends effectRuntime.Context.Service<Path, PathService>()(
  "EdunexPlus/Path",
) {}

export class Clock extends effectRuntime.Context.Service<Clock, ClockService>()(
  "EdunexPlus/Clock",
) {}

export class Random extends effectRuntime.Context.Service<Random, RandomService>()(
  "EdunexPlus/Random",
) {}

export class SafeStorage extends effectRuntime.Context.Service<SafeStorage, SafeStorageService>()(
  "EdunexPlus/SafeStorage",
) {}

export class HttpTransport extends effectRuntime.Context.Service<HttpTransport, HttpTransportService>()(
  "EdunexPlus/HttpTransport",
) {}

export class IpcMain extends effectRuntime.Context.Service<IpcMain, IpcMainService>()(
  "EdunexPlus/IpcMain",
) {}

export class ElectronPlatform extends effectRuntime.Context.Service<
  ElectronPlatform,
  ElectronPlatformService
>()("EdunexPlus/ElectronPlatform") {}

export type PlatformServices = {
  readonly fileSystem: FileSystemService;
  readonly path: PathService;
  readonly clock: ClockService;
  readonly random: RandomService;
  readonly safeStorage: SafeStorageService;
  readonly httpTransport: HttpTransportService;
  readonly ipcMain: IpcMainService;
  readonly electron: ElectronPlatformService;
};
