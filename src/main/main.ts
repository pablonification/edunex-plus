import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Notification,
  Tray,
  nativeImage,
  screen,
} from "electron";
import path from "node:path";
import { buildTrayMenuTemplate } from "./tray-menu";
import { buildAppMenuTemplate } from "./app-menu";
import { loadWindowState, saveWindowState, type WindowState } from "./window-state";
import { shouldFireStartupTestNotification } from "./notifications";
import { NAV_VIEWS } from "../shared/shell";

// Windows routes notifications by AppUserModelID; without it they fall under
// Electron's identity or fail entirely (docs/platform-notifications.md).
app.setAppUserModelId("id.edunexplus.desktop");

// One instance at a time: two instances would share the same persist:
// partition and reset its quota DB, wiping on-device storage (spec:
// auth & session). The lock is the guard.
const gotSingleInstanceLock = app.requestSingleInstanceLock();

const windowStatePath = () => path.join(app.getPath("userData"), "window-state.json");
const trayIcon = () =>
  nativeImage.createFromPath(path.join(app.getAppPath(), "assets", "trayTemplate.png"));

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
// Close-to-tray: the window's close event is intercepted and only a real
// quit path (tray Quit / app.quit) may pass through.
let quitting = false;

function isMac() {
  return process.platform === "darwin";
}

function createWindow(state?: WindowState | null) {
  win = new BrowserWindow({
    width: state?.width ?? 1180,
    height: state?.height ?? 780,
    x: state?.x,
    y: state?.y,
    minWidth: 960,
    minHeight: 600,
    title: "Edunex Plus",
    // macOS: hidden titlebar so the sidebar runs to the window's top edge and
    // the traffic lights sit inside it — the stock bar over a web-style card
    // was the loudest "website in a window" tell.
    titleBarStyle: isMac() ? "hidden" : "default",
    trafficLightPosition: { x: 16, y: 18 },
    // macOS: native translucent sidebar material behind the rail. Non-mac
    // windows keep an opaque background (no vibrancy there).
    vibrancy: isMac() ? "sidebar" : undefined,
    visualEffectState: isMac() ? "followWindow" : undefined,
    backgroundColor: isMac() ? "#00000000" : "#f6f6f7",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) win.loadURL(startUrl);
  else win.loadFile(path.join(__dirname, "../renderer/index.html"));

  if (state?.isMaximized) win.maximize();

  // macOS fullscreen hides the traffic lights (hover-only), so the renderer
  // re-aligns the brand row when they're gone.
  win.on("enter-full-screen", () => win?.webContents.send("window:fullscreen", true));
  win.on("leave-full-screen", () => win?.webContents.send("window:fullscreen", false));

  win.on("resize", queueWindowStateSave);
  win.on("move", queueWindowStateSave);
  win.on("close", (event) => {
    // Synchronous flush: the debounced timer never gets to fire on a real
    // quit, so anything since the last hide-to-tray would be lost.
    flushWindowStateSave();
    if (quitting) return;
    if (tray) {
      event.preventDefault();
      win?.hide();
    }
    // No tray support (rare Linux setups): let the close through — the app
    // quits on window-all-closed rather than stranding a windowless process.
  });

  win.on("closed", () => {
    win = null;
  });
}

function persistWindowStateNow() {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  const bounds = win.getBounds();
  saveWindowState(
    windowStatePath(),
    {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: win.isMaximized(),
    },
    screen.getPrimaryDisplay().workArea,
  );
}

let windowStateSaveTimer: NodeJS.Timeout | null = null;

// resize/move fire in bursts while the user drags — debounce the writes.
function queueWindowStateSave() {
  if (windowStateSaveTimer) clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = setTimeout(flushWindowStateSave, 400);
}

function flushWindowStateSave() {
  if (windowStateSaveTimer) {
    clearTimeout(windowStateSaveTimer);
    windowStateSaveTimer = null;
  }
  persistWindowStateNow();
}

function showWindow() {
  if (!win || win.isDestroyed()) createWindow();
  else {
    win.show();
    win.focus();
  }
}

function showTestNotification() {
  new Notification({
    title: "Edunex Plus",
    body: "Signed shell is live — OS notifications work on this build.",
  }).show();
}

function createTray() {
  try {
    // Files named *Template.png render as monochrome menu-bar icons on macOS;
    // createFromPath picks up the sibling @2x automatically. Throws on Linux
    // setups with no StatusNotifier support — then there is no tray to hide
    // into and window close really closes (see docs/platform-notifications.md).
    tray = new Tray(trayIcon());
  } catch {
    return;
  }
  tray.setToolTip("Edunex Plus");
  tray.setContextMenu(
    Menu.buildFromTemplate(buildTrayMenuTemplate({ show: showWindow, quit: () => app.quit() })),
  );
  tray.on("click", showWindow);
}

function sendToView(view: string) {
  win?.webContents.send("nav:goto", view);
}

function setApplicationMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildAppMenuTemplate(app.name, NAV_VIEWS, { gotoView: sendToView }),
    ),
  );
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", showWindow);

  app.whenReady().then(() => {
    setApplicationMenu();
    if (isMac() && app.dock) {
      // Cosmetic — a missing icon must never break boot.
      try {
        app.dock.setIcon(path.join(app.getAppPath(), "assets", "icon.png"));
      } catch {}
    }
    createWindow(loadWindowState(windowStatePath(), screen.getPrimaryDisplay().workArea));
    createTray();

    app.setAboutPanelOptions({
      applicationName: "Edunex Plus",
      applicationVersion: app.getVersion(),
      credits: "Unofficial, community-built desktop client for ITB's EduNex.",
    });

    if (shouldFireStartupTestNotification(app.isPackaged, process.env)) showTestNotification();

    app.on("activate", showWindow);
  });

  ipcMain.handle("notifications:test", showTestNotification);
  ipcMain.handle("app:info", () => ({
    version: app.getVersion(),
    platform: process.platform,
    trayActive: tray != null,
    notificationsSupported: Notification.isSupported(),
  }));

  // Deliberate no-op while a tray exists: closing the window must not end the
  // process — the app lives in the tray so notifications keep flowing (spec:
  // shell & navigation). Without a tray (rare Linux setups) a closed window
  // leaves nothing to reach the app through, so quit instead.
  app.on("window-all-closed", () => {
    if (!tray) app.quit();
  });

  app.on("before-quit", () => {
    quitting = true;
  });
}
