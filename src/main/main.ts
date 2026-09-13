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
import { createAuthController } from "./auth/auth-controller";
import { createSnapshotCache } from "./sync/snapshot-cache";
import { createSyncEngine, type SyncEngine } from "./sync/sync-engine";
import { createNotificationStore } from "./notifications/notification-store";
import { createInAppSink, createOsSink } from "./notifications/sinks";
import { createTaskNotifier } from "./notifications/task-notifier";
import type { InAppNotification } from "../shared/notifications";
import { isFeedKey } from "../shared/feeds";
import { DEFAULT_SHELL_SETTINGS, NAV_VIEWS, isHideableNavKey } from "../shared/shell";
import type { HideableNavKey } from "../shared/shell";
import { loadShellSettings, saveShellSettings } from "./shell/settings-store";
import { saveDraftAnswer } from "./tasks/task-answers";

// Windows routes notifications by AppUserModelID; without it they fall under
// Electron's identity or fail entirely (docs/platform-notifications.md).
app.setAppUserModelId("id.edunexplus.desktop");

// One instance at a time: two instances would share the same persist:
// partition and reset its quota DB, wiping on-device storage (spec:
// auth & session). The lock is the guard.
const gotSingleInstanceLock = app.requestSingleInstanceLock();

const windowStatePath = () => path.join(app.getPath("userData"), "window-state.json");
const shellSettingsPath = () => path.join(app.getPath("userData"), "shell-settings.json");
const trayIcon = () =>
  nativeImage.createFromPath(path.join(app.getAppPath(), "assets", "trayTemplate.png"));

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
// Close-to-tray: the window's close event is intercepted and only a real
// quit path (tray Quit / app.quit) may pass through.
let quitting = false;

// Shell preferences (#22): hidden views + the tray opt-out, persisted across
// restarts in userData. Loaded once the app is ready (userData is only
// reliable then); until that moment the default-visible v1 set applies.
let shellSettings = {
  ...DEFAULT_SHELL_SETTINGS,
  hiddenViews: [...DEFAULT_SHELL_SETTINGS.hiddenViews],
};

function visibleViews() {
  const hidden = shellSettings.hiddenViews as readonly string[];
  return NAV_VIEWS.filter((view) => !hidden.includes(view.key));
}

function broadcastShellSettings() {
  if (win && !win.isDestroyed()) win.webContents.send("shell:settings-updated", shellSettings);
}

function persistShellSettings() {
  saveShellSettings(shellSettingsPath(), shellSettings);
}

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
      // The embedded login webview (#18) lives in the renderer on a
      // persistent partition; capture and state stay in main.
      webviewTag: true,
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

  // The login webview (#18) attaches here whenever the renderer mounts it.
  // Main owns the capture loop and popup suppression for its webContents;
  // the loop ends with the webview's own destroyed event.
  win.webContents.on("did-attach-webview", (_event, contents) =>
    authController.attachWebview(contents),
  );

  win.on("resize", queueWindowStateSave);
  win.on("move", queueWindowStateSave);
  win.on("close", (event) => {
    // Synchronous flush: the debounced timer never gets to fire on a real
    // quit, so anything since the last hide-to-tray would be lost.
    flushWindowStateSave();
    if (quitting) return;
    // Tray opt-out (#22): when on, closing the window really closes — the
    // app quits on window-all-closed and notification delivery stops.
    if (shellSettings.quitOnClose) return;
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
      // Hidden views (#22) leave the View menu: navigation only offers what
      // the rail shows, in the same NAV_VIEWS order.
      buildAppMenuTemplate(app.name, visibleViews(), {
        gotoView: sendToView,
        // Dev-only hook to demo the re-login moment (#18) without needing the
        // vendor API to actually reject a session.
        simulateUnauthorized: app.isPackaged ? undefined : () => authController.simulateUnauthorized(),
      }),
    ),
  );
}

let sync: SyncEngine | null = null;

// Auth slice (#18): encrypted token store, capture from the login webview,
// and the signed-out / authenticating / signed-in / session-expired machine.
const authController = createAuthController({
  sessionStorePath: path.join(app.getPath("userData"), "auth-session.enc"),
  appVersion: app.getVersion(),
  broadcast: (status) => {
    if (win && !win.isDestroyed()) win.webContents.send("auth:state", status);
    if (status === "signed-in") sync?.start();
    else sync?.stop();
  },
});

// Notification spine (#23): sink interface with two implementations — the
// OS notification and the persisted in-app fallback feed. Detection is
// id-diff against the snapshot cache plus a per-account seen-ledger, so
// nothing replays across restarts. First sync baselines silently; bursts
// coalesce into one digest; clicks focus the app and land on To Do (#21).
const seenLedgerRoot = path.join(app.getPath("userData"), "seen-ledger");
const inAppFeedRoot = path.join(app.getPath("userData"), "notifications");

function handleNotificationClicked(taskIds: string[]) {
  showWindow();
  if (!win || win.isDestroyed()) return;
  win.webContents.send("nav:goto", "todo");
  win.webContents.send("notifications:clicked", { taskIds });
}

const taskNotifier = createTaskNotifier({
  ledgerRoot: seenLedgerRoot,
  sinks: [
    createOsSink({
      show: ({ title, body }, onClick) => {
        const notification = new Notification({ title, body });
        notification.on("click", onClick);
        notification.show();
      },
      onClicked: (notification) =>
        handleNotificationClicked([...notification.taskIds]),
    }),
    createInAppSink({
      storeFor: (accountId) => createNotificationStore(inAppFeedRoot, accountId),
      getAccountId: authController.accountId,
      broadcast: (_accountId, entries) => {
        if (win && !win.isDestroyed()) win.webContents.send("notifications:updated", entries);
      },
    }),
  ],
});

// Sync slice (#19): main owns the API adapter, timer, and on-device snapshots.
// The renderer only receives a cache snapshot over the preload bridge.
sync = createSyncEngine({
  api: authController.api(),
  cache: createSnapshotCache(path.join(app.getPath("userData"), "feed-snapshots")),
  getAccountId: authController.accountId,
  onUnauthorized: authController.handleUnauthorized,
  taskNotifier,
  onFeedUpdated: (snapshot) => {
    if (win && !win.isDestroyed()) win.webContents.send("sync:feed-updated", snapshot);
  },
});

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", showWindow);

  app.whenReady().then(() => {
    shellSettings = loadShellSettings(shellSettingsPath());
    setApplicationMenu();
    if (isMac() && app.dock) {
      // Cosmetic — a missing icon must never break boot.
      try {
        app.dock.setIcon(path.join(app.getAppPath(), "assets", "icon.png"));
      } catch {}
    }
    createWindow(loadWindowState(windowStatePath(), screen.getPrimaryDisplay().workArea));
    createTray();

    // Restore the session before the renderer finishes booting; until this
    // resolves the renderer holds back the auth-gated UI (status stays null)
    // so a restored session never flashes the login view.
    void authController.restore();

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

  // Auth slice (#18): the renderer asks for the current status or requests
  // the login webview moment; state changes arrive pushed on auth:state.
  ipcMain.handle("auth:get-state", () => authController.status());
  ipcMain.handle("auth:start-login", () => authController.startLogin());
  ipcMain.handle("sync:get-feed", (_event, feed: unknown) => {
    if (!isFeedKey(feed)) return null;
    return sync?.read(feed) ?? null;
  });

  // Shell preferences (#22): the renderer reads the persisted settings,
  // hides/shows hideable views, and flips the tray opt-out. Every write
  // persists to disk, rebuilds the View menu, and pushes to the renderer.
  ipcMain.handle("shell:get-settings", () => shellSettings);
  ipcMain.handle("shell:set-view-hidden", (_event, view: unknown, hidden: unknown) => {
    if (typeof view !== "string" || !isHideableNavKey(view)) return shellSettings;
    const next = new Set<string>(shellSettings.hiddenViews);
    if (hidden === true) next.add(view);
    else next.delete(view);
    shellSettings = {
      ...shellSettings,
      hiddenViews: NAV_VIEWS.map((entry) => entry.key).filter(
        (key): key is HideableNavKey => next.has(key),
      ),
    };
    persistShellSettings();
    setApplicationMenu();
    broadcastShellSettings();
    return shellSettings;
  });
  ipcMain.handle("shell:set-quit-on-close", (_event, value: unknown) => {
    shellSettings = { ...shellSettings, quitOnClose: value === true };
    persistShellSettings();
    broadcastShellSettings();
    return shellSettings;
  });

  // Notification Center fallback feed (#23): the renderer reads the
  // persisted in-app entries and marks them read; new entries arrive pushed
  // on notifications:updated, OS clicks on notifications:clicked.
  ipcMain.handle("notifications:get", (): InAppNotification[] => {
    const accountId = authController.accountId();
    if (!accountId) return [];
    try {
      return createNotificationStore(inAppFeedRoot, accountId).list();
    } catch (error) {
      console.error("[notifications] read failed:", error);
      return [];
    }
  });
  ipcMain.handle("notifications:mark-read", (_event, ids: unknown): InAppNotification[] => {
    const accountId = authController.accountId();
    if (!accountId || !Array.isArray(ids)) return [];
    const wanted = ids.filter((id): id is string => typeof id === "string");
    try {
      return createNotificationStore(inAppFeedRoot, accountId).markRead(wanted);
    } catch (error) {
      console.error("[notifications] mark-read failed:", error);
      return [];
    }
  });
  ipcMain.handle("notifications:mark-all-read", (): InAppNotification[] => {
    const accountId = authController.accountId();
    if (!accountId) return [];
    try {
      return createNotificationStore(inAppFeedRoot, accountId).markAllRead();
    } catch (error) {
      console.error("[notifications] mark-all-read failed:", error);
      return [];
    }
  });

  // Task Answer draft-save (#25): explicit-only write. The renderer sends
  // the editor text with the known answer id (if any); main chooses create
  // (POST → 201) vs update (PATCH → 200) and returns the outcome. Status
  // refreshes on the next sync tick — nothing here touches the cache.
  ipcMain.handle("tasks:save-draft", async (_event, input: unknown) => {
    const { taskId, answer, answerId } = asSaveDraftInput(input);
    try {
      return await saveDraftAnswer(authController.api(), { taskId, answer, answerId });
    } catch (error) {
      console.error("[tasks] save-draft failed:", error);
      return { ok: false, status: 0, created: answerId == null, answerId: answerId ?? null };
    }
  });

  // Deliberate no-op while a tray exists: closing the window must not end the
  // process — the app lives in the tray so notifications keep flowing (spec:
  // shell & navigation). Without a tray (rare Linux setups) a closed window
  // leaves nothing to reach the app through, so quit instead. The tray
  // opt-out (#22) quits on close even when a tray exists.
  app.on("window-all-closed", () => {
    if (!tray || shellSettings.quitOnClose) app.quit();
  });

  app.on("before-quit", () => {
    quitting = true;
    sync?.stop();
  });
}

function asSaveDraftInput(input: unknown): {
  taskId: string;
  answer: string;
  answerId: string | null;
} {
  const record =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  return {
    taskId: typeof record.taskId === "string" ? record.taskId : "",
    answer: typeof record.answer === "string" ? record.answer : "",
    answerId: typeof record.answerId === "string" ? record.answerId : null,
  };
}
