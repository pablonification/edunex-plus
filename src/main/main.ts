import { buildTrayMenuTemplate } from "./tray-menu";
import { buildAppMenuTemplate } from "./app-menu";
import { loadWindowState, saveWindowState, type WindowState } from "./window-state";
import { shouldFireStartupTestNotification } from "./notifications";
import { createAuthController, EDUNEX_API_BASE_URL } from "./auth/auth-controller";
import {
  AuthService,
  createAuthLayer,
  edunexUserAgent,
  type AuthServiceShape,
} from "./auth/auth-service";
import {
  createSyncServiceLayer,
  SyncService,
  type SyncServiceShape,
} from "./sync/sync-service";
import {
  createCognisiaLayer,
} from "./api/api-service";
import {
  createSnapshotCacheLayer,
} from "./sync/snapshot-cache-service";
import {
  createMaterialDownloadLayer,
  MaterialDownloadService,
} from "./materials/download";
import {
  createNotificationLayer,
  NotificationService,
} from "./notifications/notification-service";
import type { OutboundNotification } from "../shared/notifications";
import { DEFAULT_SHELL_SETTINGS, NAV_VIEWS, isHideableNavKey } from "../shared/shell";
import type { HideableNavKey } from "../shared/shell";
import { loadShellSettings, saveShellSettings } from "./shell/settings-store";
import {
  createTaskAnswerLayer,
  TaskAnswerService,
} from "./tasks/task-answers";
import {
  createApplicationRuntime,
  composeApplicationLayer,
  RuntimeEffect,
  RuntimeExit,
  type ApplicationRuntime,
} from "./effect/runtime";
import { effectRuntime } from "./effect/effect-runtime";
import { ApplicationLifecycleError, formatSafeCause } from "./effect/conventions";
import { createLivePlatform } from "./platform/live";
import type { WindowService, TrayService } from "./platform/services";
import { registerApplicationIpc } from "./ipc/application";

const livePlatform = createLivePlatform();
const { services } = livePlatform;
const platform = services.electron;
const fileSystem = services.fileSystem;
const pathService = services.path;
const clock = services.clock;
const random = services.random;

// Windows routes notifications by AppUserModelID; without it they fall under
// Electron's identity or fail entirely (docs/platform-notifications.md).
platform.setAppUserModelId("id.edunexplus.desktop");

// One instance at a time: two instances would share the same persist:
// partition and reset its quota DB, wiping on-device storage (spec:
// auth & session). The lock is the guard.
const gotSingleInstanceLock = platform.requestSingleInstanceLock();

const windowStatePath = () => pathService.join(platform.userDataPath, "window-state.json");
const shellSettingsPath = () => pathService.join(platform.userDataPath, "shell-settings.json");
const trayIcon = () =>
  pathService.join(platform.appPath, "assets", "trayTemplate.png");

let win: WindowService | null = null;
let tray: TrayService | null = null;
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
  saveShellSettings(shellSettingsPath(), shellSettings, { fileSystem, clock, random });
}

function isMac() {
  return platform.platform === "darwin";
}

function createWindow(state?: WindowState | null) {
  win = platform.createWindow({
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
      preload: pathService.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // The embedded login webview (#18) lives in the renderer on a
      // persistent partition; capture and state stay in main.
      webviewTag: true,
    },
  });

  const startUrl = platform.environment.ELECTRON_START_URL;
  if (startUrl) void win.loadURL(startUrl);
  else void win.loadFile(pathService.join(__dirname, "../renderer/index.html"));

  if (state?.isMaximized) win.maximize();

  // macOS fullscreen hides the traffic lights (hover-only), so the renderer
  // re-aligns the brand row when they're gone.
  win.on("enter-full-screen", () => win?.webContents.send("window:fullscreen", true));
  win.on("leave-full-screen", () => win?.webContents.send("window:fullscreen", false));

  // The login webview (#18) attaches here whenever the renderer mounts it.
  // Main owns the capture loop and popup suppression for its webContents;
  // the loop ends with the webview's own destroyed event.
  win.webContents.on("did-attach-webview", (_event, contents) => authController.attachWebview(contents));

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
    platform.primaryWorkArea(),
    { fileSystem, clock, random },
  );
}

let windowStateSaveTimer: unknown = null;

// resize/move fire in bursts while the user drags — debounce the writes.
function queueWindowStateSave() {
  if (windowStateSaveTimer) clock.clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = clock.setTimeout(flushWindowStateSave, 400);
}

function flushWindowStateSave() {
  if (windowStateSaveTimer) {
    clock.clearTimeout(windowStateSaveTimer);
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
  platform.createNotification({
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
    tray = platform.createTray(trayIcon());
  } catch {
    return;
  }
  tray.setToolTip("Edunex Plus");
  tray.setContextMenu(
    platform.buildMenu(buildTrayMenuTemplate({ show: showWindow, quit: () => platform.quit() })),
  );
  tray.on("click", showWindow);
}

function sendToView(view: string) {
  win?.webContents.send("nav:goto", view);
}

function setApplicationMenu() {
  platform.setApplicationMenu(
    platform.buildMenu(
      // Hidden views (#22) leave the View menu: navigation only offers what
      // the rail shows, in the same NAV_VIEWS order.
      buildAppMenuTemplate(platform.appName, visibleViews(), {
        gotoView: sendToView,
        // Dev-only hook to demo the re-login moment (#18) without needing the
        // vendor API to actually reject a session.
        simulateUnauthorized: platform.isPackaged ? undefined : () => authController.simulateUnauthorized(),
      }, platform.platform),
    ),
  );
}

let syncService: SyncServiceShape | null = null;

// Auth slice (#52): the state machine, encrypted session store, API adapter,
// and webview capture are all supplied by one managed Effect service. The
// callbacks below are host boundaries only; they never expose the session to
// preload or renderer code.
let authService: AuthServiceShape | null = null;
let applicationRuntimeRef: ApplicationRuntime<any, any> | null = null;

function runAuthEffect<A>(effect: import("./auth/auth-service").AuthEffect<A>): Promise<A> | void {
  const runtime = applicationRuntimeRef;
  if (!runtime || runtime.isShutdown()) return;
  return runtime.runPromise(effect);
}

function notifyAuthUnauthorized() {
  const service = authService;
  const runtime = applicationRuntimeRef;
  if (!service || !runtime || runtime.isShutdown()) return;
  try {
    runtime.runSync(service.handleUnauthorized());
  } catch {
    // Auth callbacks cannot surface private Effect failures to a host API.
  }
}

const authLayer = createAuthLayer({
  sessionStorePath: pathService.join(platform.userDataPath, "auth-session.enc"),
  appVersion: platform.appVersion,
  broadcast: (status) => {
    if (win && !win.isDestroyed()) win.webContents.send("auth:state", status);
    // Authentication owns the session boundary; the synchronization service
    // owns one managed fiber for the currently published session. These calls
    // are synchronous at the lifecycle boundary so a sign-out/401 invalidates
    // its generation before any late HTTP result can publish.
    const service = syncService;
    const runtime = applicationRuntimeRef;
    if (!service || !runtime || runtime.isShutdown()) return;
    try {
      runtime.runSync(status === "signed-in" ? service.start() : service.stop());
    } catch {
      // Lifecycle callbacks cannot surface private Effect failures to auth.
    }
  },
  runEffect: runAuthEffect,
  onUnauthorized: notifyAuthUnauthorized,
});

// Explicit Task Answer commands and Material downloads share the authenticated
// session but are separate managed services. Keeping them in the same layer
// graph makes the dependency and shutdown boundary explicit without giving
// background sync access to either write service.
const taskAnswerLayer = createTaskAnswerLayer().pipe(effectRuntime.Layer.provide(authLayer));
const materialDownloadLayer = createMaterialDownloadLayer({
  baseUrl: EDUNEX_API_BASE_URL,
  userAgent: edunexUserAgent(platform.appVersion),
}).pipe(effectRuntime.Layer.provide(authLayer));

// Notification state and delivery are one managed service graph. The layer
// owns the validated feed/ledger persistence and uses Electron only through
// the platform service; tests can replace delivery with recording sinks.
const seenLedgerRoot = pathService.join(platform.userDataPath, "seen-ledger");
const inAppFeedRoot = pathService.join(platform.userDataPath, "notifications");

function handleTaskNotificationClicked(taskIds: string[]) {
  showWindow();
  if (!win || win.isDestroyed()) return;
  win.webContents.send("nav:goto", "todo");
  win.webContents.send("notifications:clicked", { taskIds });
}

function handlePresenceNotificationClicked(presenceIds: string[]) {
  showWindow();
  if (!win || win.isDestroyed()) return;
  win.webContents.send("nav:goto", "agenda");
  win.webContents.send("notifications:clicked", { taskIds: [], presenceIds });
}

function handleOutboundNotificationClicked(notification: OutboundNotification) {
  if (notification.kind === "presence") {
    handlePresenceNotificationClicked([...notification.presenceIds]);
  } else {
    handleTaskNotificationClicked([...notification.taskIds]);
  }
}

const notificationLayer = createNotificationLayer({
  ledgerRoot: seenLedgerRoot,
  feedRoot: inAppFeedRoot,
  onClicked: handleOutboundNotificationClicked,
  broadcast: (_accountId, entries) => {
    if (win && !win.isDestroyed()) win.webContents.send("notifications:updated", entries);
  },
});

// Resolve the services once from the process-wide managed runtime. Each
// feature owns its state; the sync service below owns its session fiber.
const readAndCacheLayer = effectRuntime.Layer.mergeAll(
  createCognisiaLayer({
    userAgent: edunexUserAgent(platform.appVersion),
    onUnauthorized: notifyAuthUnauthorized,
  }),
  createSnapshotCacheLayer({
    rootDir: pathService.join(platform.userDataPath, "feed-snapshots"),
  }),
).pipe(effectRuntime.Layer.provideMerge(authLayer));
const syncDependenciesLayer = effectRuntime.Layer.mergeAll(
  authLayer,
  readAndCacheLayer,
  notificationLayer,
).pipe(effectRuntime.Layer.provideMerge(livePlatform.layer));
const syncLayer = createSyncServiceLayer({
  onFeedUpdated: (snapshot) => {
    if (win && !win.isDestroyed()) win.webContents.send("sync:feed-updated", snapshot);
  },
}).pipe(effectRuntime.Layer.provide(syncDependenciesLayer));
const applicationLayer = effectRuntime.Layer.mergeAll(
  authLayer,
  taskAnswerLayer,
  materialDownloadLayer,
  readAndCacheLayer,
  notificationLayer,
  syncLayer,
).pipe(effectRuntime.Layer.provideMerge(livePlatform.layer));
const applicationRuntime = createApplicationRuntime(composeApplicationLayer(applicationLayer));
applicationRuntimeRef = applicationRuntime;
const resolvedAuthService = applicationRuntime.runSync(RuntimeEffect.service(AuthService));
const resolvedTaskAnswerService = applicationRuntime.runSync(
  RuntimeEffect.service(TaskAnswerService),
);
const resolvedMaterialDownloadService = applicationRuntime.runSync(
  RuntimeEffect.service(MaterialDownloadService),
);
authService = resolvedAuthService;
const resolvedNotificationService = applicationRuntime.runSync(
  RuntimeEffect.service(NotificationService),
);
const resolvedSyncService = applicationRuntime.runSync(
  RuntimeEffect.service(SyncService),
);
syncService = resolvedSyncService;
const authController = createAuthController({
  runtime: applicationRuntime,
  service: resolvedAuthService,
});

let runtimeShutdownStarted = false;
let runtimeShutdownComplete = false;

const startApplication = RuntimeEffect.try({
  try: () => {
    shellSettings = loadShellSettings(shellSettingsPath(), { fileSystem, clock, random });
    setApplicationMenu();
    if (isMac()) platform.setDockIcon(pathService.join(platform.appPath, "assets", "icon.png"));
    createWindow(loadWindowState(windowStatePath(), platform.primaryWorkArea(), { fileSystem }));
    createTray();

    // Restore the session before the renderer finishes booting; until this
    // resolves the renderer holds back the auth-gated UI (status stays null)
    // so a restored session never flashes the login view.
    void authController.restore();

    platform.setAboutPanelOptions({
      applicationName: "Edunex Plus",
      applicationVersion: platform.appVersion,
      credits: "Unofficial, community-built desktop client for ITB's EduNex.",
    });

    if (shouldFireStartupTestNotification(platform.isPackaged, platform.environment)) showTestNotification();

    platform.on("activate", showWindow);
  },
  catch: () => new ApplicationLifecycleError({ phase: "startup", operation: "electron-ready" }),
});

if (!gotSingleInstanceLock) {
  platform.quit();
} else {
  platform.on("second-instance", showWindow);

  platform.whenReady().then(() => {
    void applicationRuntime
      .runPromiseExit(startApplication)
      .then((exit) => {
        if (RuntimeExit.isFailure(exit)) {
          console.error("[runtime] startup failed:", formatSafeCause(exit.cause));
          platform.quit();
        }
      })
      .catch(() => {
        if (!runtimeShutdownStarted) platform.quit();
      });
  });

  const ipcAdapter = registerApplicationIpc({
    ipcMain: services.ipcMain,
    runtime: applicationRuntime,
    showTestNotification,
    getAppInfo: () => ({
      version: platform.appVersion,
      platform: platform.platform,
      trayActive: tray != null,
      notificationsSupported: platform.notificationsSupported(),
    }),
    auth: {
      status: () => authController.status(),
      startLogin: () => authController.startLogin(),
    },
    sync: {
      read: (feed) => {
        try {
          return applicationRuntime.runSync(resolvedSyncService.read(feed));
        } catch {
          return null;
        }
      },
    },
    materialDownloadService: resolvedMaterialDownloadService,
    shell: {
      getSettings: () => shellSettings,
      setViewHidden: (view, hidden) => {
        if (!isHideableNavKey(view)) return shellSettings;
        const next = new Set<string>(shellSettings.hiddenViews);
        if (hidden) next.add(view);
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
      },
      setQuitOnClose: (quitOnClose) => {
        shellSettings = { ...shellSettings, quitOnClose };
        persistShellSettings();
        broadcastShellSettings();
        return shellSettings;
      },
    },
    notifications: {
      get: () => {
        try {
          return applicationRuntime.runSync(
            resolvedNotificationService.list(authController.accountId()),
          );
        } catch {
          return [];
        }
      },
      markRead: (ids) => {
        try {
          return applicationRuntime.runSync(
            resolvedNotificationService.markRead(authController.accountId(), ids),
          );
        } catch {
          return [];
        }
      },
      markAllRead: () => {
        try {
          return applicationRuntime.runSync(
            resolvedNotificationService.markAllRead(authController.accountId()),
          );
        } catch {
          return [];
        }
      },
    },
    taskAnswerService: resolvedTaskAnswerService,
  });

  // Deliberate no-op while a tray exists: closing the window must not end the
  // process — the app lives in the tray so notifications keep flowing (spec:
  // shell & navigation). Without a tray (rare Linux setups) a closed window
  // leaves nothing to reach the app through, so quit instead. The tray
  // opt-out (#22) quits on close even when a tray exists.
  platform.on("window-all-closed", () => {
    if (!tray || shellSettings.quitOnClose) platform.quit();
  });

  platform.on("before-quit", (...args) => {
    const event = args[0] as { preventDefault(): void } | undefined;
    if (runtimeShutdownComplete) return;
    event?.preventDefault();
    if (runtimeShutdownStarted) return;

    runtimeShutdownStarted = true;
    quitting = true;
    try {
      applicationRuntime.runSync(resolvedSyncService.stop());
    } catch {
      // The managed runtime shutdown below remains the final interruption
      // boundary even if the synchronous lifecycle hook cannot run.
    }
    ipcAdapter.unregister();
    void applicationRuntime.shutdown().then(
      () => {
        runtimeShutdownComplete = true;
        platform.quit();
      },
      () => {
        // Shutdown is best-effort at the final process boundary. Do not keep
        // the Student's quit action stuck behind a failed finalizer.
        runtimeShutdownComplete = true;
        platform.quit();
      },
    );
  });
}
