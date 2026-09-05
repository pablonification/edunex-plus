import { app, BrowserWindow, ipcMain, Menu, Notification, Tray, nativeImage } from "electron";
import path from "node:path";
import { buildTrayMenuTemplate } from "./tray-menu";
import { shouldFireStartupTestNotification } from "./notifications";

// Windows routes notifications by AppUserModelID; without it they fall under
// Electron's identity or fail entirely (docs/platform-notifications.md).
app.setAppUserModelId("id.edunexplus.desktop");

// One instance at a time: two instances would share the same persist:
// partition and reset its quota DB, wiping on-device storage (spec:
// auth & session). The lock is the guard.
const gotSingleInstanceLock = app.requestSingleInstanceLock();

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
// Close-to-tray: the window's close event is intercepted and only a real
// quit path (tray Quit / app.quit) may pass through.
let quitting = false;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "Edunex Plus",
    backgroundColor: "#e9eaec",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) win.loadURL(startUrl);
  else win.loadFile(path.join(__dirname, "../renderer/index.html"));

  win.on("close", (event) => {
    if (quitting) return;
    if (tray) {
      event.preventDefault();
      win?.hide();
    }
    // No tray support (rare Linux setups): let the close through — hiding
    // would strand the app with no way back.
  });

  win.on("closed", () => {
    win = null;
  });
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
    tray = new Tray(
      nativeImage.createFromPath(path.join(app.getAppPath(), "assets", "trayTemplate.png")),
    );
  } catch {
    return;
  }
  tray.setToolTip("Edunex Plus");
  tray.setContextMenu(
    Menu.buildFromTemplate(buildTrayMenuTemplate({ show: showWindow, quit: () => app.quit() })),
  );
  tray.on("click", showWindow);
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", showWindow);

  app.whenReady().then(() => {
    createTray();
    createWindow();

    if (shouldFireStartupTestNotification(app.isPackaged, process.env)) showTestNotification();

    app.on("activate", showWindow);
  });

  ipcMain.handle("notifications:test", showTestNotification);

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
