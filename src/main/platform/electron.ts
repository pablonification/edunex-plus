import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  screen,
  Tray,
} from "electron";
import type {
  ElectronPlatformService,
  IpcHandlerService,
  IpcMainService,
  NotificationService,
  SafeStorageService,
  TrayService,
  WebContentsService,
  WindowOptionsService,
  WindowService,
} from "./services";

function createWebContents(contents: Electron.WebContents): WebContentsService {
  const eventSource = contents as unknown as {
    on(event: string, listener: (...args: unknown[]) => void): void;
  };
  return {
    id: contents.id,
    send: (channel, payload) => {
      if (contents.isDestroyed()) return;
      contents.send(channel, payload);
    },
    setWindowOpenHandler: (handler) => {
      contents.setWindowOpenHandler((details) => handler({ url: details.url }));
    },
    loadURL: (url) => contents.loadURL(url).then(() => undefined),
    executeJavaScript: (script, userGesture) => contents.executeJavaScript(script, userGesture),
    on: (event, listener) => {
      if (event === "did-attach-webview") {
        const attachListener = listener as (
          event: unknown,
          contents: WebContentsService,
        ) => void;
        eventSource.on(event, (eventObject, contents) =>
          attachListener(eventObject, createWebContents(contents as Electron.WebContents)),
        );
      } else {
        eventSource.on(event, listener as (...args: unknown[]) => void);
      }
    },
    once: (event, listener) => contents.once(event, listener),
  };
}

function createWindow(window: BrowserWindow): WindowService {
  const eventSource = window as unknown as {
    on(event: string, listener: (...args: unknown[]) => void): void;
  };
  return {
    webContents: createWebContents(window.webContents),
    loadURL: (url) => window.loadURL(url).then(() => undefined),
    loadFile: (filePath) => window.loadFile(filePath).then(() => undefined),
    on(event, listener) {
      eventSource.on(event, listener as unknown as (...args: unknown[]) => void);
    },
    show: () => window.show(),
    focus: () => window.focus(),
    hide: () => window.hide(),
    destroy: () => {
      if (!window.isDestroyed()) window.destroy();
    },
    isDestroyed: () => window.isDestroyed(),
    isMinimized: () => window.isMinimized(),
    isMaximized: () => window.isMaximized(),
    maximize: () => window.maximize(),
    getBounds: () => {
      const bounds = window.getBounds();
      return { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y };
    },
  };
}

function createTray(tray: Tray): TrayService {
  return {
    setToolTip: (tooltip) => tray.setToolTip(tooltip),
    setContextMenu: (menu) => tray.setContextMenu(menu as Electron.Menu),
    on: (event, listener) => tray.on(event, listener),
    destroy: () => tray.destroy(),
  };
}

function createNotification(notification: Electron.Notification): NotificationService {
  return {
    on: (event, listener) => notification.on(event, listener),
    show: () => notification.show(),
  };
}

export const electronIpcMain: IpcMainService = {
  handle(channel, handler) {
    ipcMain.handle(channel, (event, ...args) =>
      handler({ sender: event.sender, channel }, ...args),
    );
  },
  removeHandler(channel) {
    ipcMain.removeHandler(channel);
  },
};

/** Electron's concrete adapter. Main imports this adapter rather than the
 * Electron package, which makes lifecycle/platform failures replaceable. */
export function createElectronPlatform(): ElectronPlatformService {
  const appEvents = app as unknown as {
    on(event: string, listener: (...args: unknown[]) => void): void;
  };
  let window: WindowService | null = null;
  let tray: TrayService | null = null;
  let shutDown = false;

  return {
    platform: process.platform,
    appName: app.name,
    appVersion: app.getVersion(),
    appPath: app.getAppPath(),
    userDataPath: app.getPath("userData"),
    isPackaged: app.isPackaged,
    environment: process.env,
    ipcMain: electronIpcMain,
    setAppUserModelId: (id) => app.setAppUserModelId(id),
    requestSingleInstanceLock: () => app.requestSingleInstanceLock(),
    whenReady: () => app.whenReady().then(() => undefined),
    on: (event, listener) => appEvents.on(event, listener),
    quit: () => app.quit(),
    setAboutPanelOptions: (options) => app.setAboutPanelOptions(options),
    setDockIcon: (filePath) => {
      try {
        app.dock?.setIcon(filePath);
      } catch {
        // A missing dock or icon is cosmetic and must not break startup.
      }
    },
    createWindow: (options: WindowOptionsService) => {
      const created = createWindow(new BrowserWindow(options as Electron.BrowserWindowConstructorOptions));
      window = created;
      return created;
    },
    createTray: (iconPath) => {
      const created = createTray(new Tray(nativeImage.createFromPath(iconPath)));
      tray = created;
      return created;
    },
    buildMenu: (template) => Menu.buildFromTemplate(template as Electron.MenuItemConstructorOptions[]),
    setApplicationMenu: (menu) => Menu.setApplicationMenu(menu as Electron.Menu),
    createNotification: (options) => createNotification(new Notification(options)),
    notificationsSupported: () => Notification.isSupported(),
    primaryWorkArea: () => {
      const workArea = screen.getPrimaryDisplay().workArea;
      return { width: workArea.width, height: workArea.height };
    },
    showSaveDialog: (options) =>
      dialog.showSaveDialog({
        defaultPath: options.defaultPath,
        properties: [
          ...(options.createDirectory ? ["createDirectory" as const] : []),
          ...(options.showOverwriteConfirmation ? ["showOverwriteConfirmation" as const] : []),
        ],
      }),
    shutdown: () => {
      if (shutDown) return;
      shutDown = true;
      try {
        tray?.destroy();
      } finally {
        tray = null;
        try {
          if (window && !window.isDestroyed()) window.destroy();
        } finally {
          window = null;
        }
      }
    },
  };
}

export const electronSafeStorage: SafeStorageService = {
  isEncryptionAvailable: () => {
    // Imported lazily so the service contract remains the only dependency
    // visible to auth code and test layers can replace it entirely.
    const { safeStorage } = require("electron") as typeof import("electron");
    return safeStorage.isEncryptionAvailable();
  },
  encryptString: (plaintext) => {
    const { safeStorage } = require("electron") as typeof import("electron");
    return safeStorage.encryptString(plaintext);
  },
  decryptString: (ciphertext) => {
    const { safeStorage } = require("electron") as typeof import("electron");
    return safeStorage.decryptString(Buffer.from(ciphertext));
  },
};
