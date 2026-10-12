// Edunex Plus, main process. Loads saved data before anything else, opens the
// window hidden and shows it once the page has drawn that data, starts
// syncing only then, and answers the window through the typed bridge.

import module from "node:module";
import path from "node:path";
import { app, type BrowserWindow, dialog, nativeTheme, powerMonitor, session } from "electron";
import { CHANNEL_EVENT } from "../core/channels";
import type { Event } from "../core/contract";
import type { Settings } from "../core/models";
import type { Route } from "../core/route";
import { translate } from "../core/strings";
import { systemClock } from "../engine/clock";
import { createEngine, type Engine } from "../engine/engine";
import { demo } from "./demo";
import { alertsHandlers } from "./handlers/alerts";
import { authHandlers } from "./handlers/auth";
import type { DesktopContext } from "./handlers/context";
import { coreHandlers } from "./handlers/core";
import { coursePageHandlers } from "./handlers/course-page";
import { filesHandlers } from "./handlers/files";
import { scheduleHandlers } from "./handlers/schedule";
import { sixHandlers } from "./handlers/six";
import { tasksHandlers } from "./handlers/tasks";
import { updatesHandlers } from "./handlers/updates";
import { type Handlers, registerBridge } from "./ipc";
import { installMenu } from "./menu";
import { createNotifier } from "./notifications";
import { registerAppScheme, serveApp } from "./protocol";
import { APP_HOST, APP_ORIGIN, APP_SCHEME, contentSecurityPolicy, denyPermissions, guardAppWindow, hardenAllContents } from "./security";
import { FileStorage } from "./storage";
import { electronTransport } from "./transport";
import { type AppTray, createTray } from "./tray";
import { openVault } from "./vault";
import { BACKGROUND, createMainWindow, loadWindowState } from "./window";

// Later launches start faster: compiled code is cached between runs.
module.enableCompileCache?.();

declare const __APP_VERSION__: string;

const packaged = app.isPackaged;
/** The Vite dev server; honoured only in development. */
const devServer = packaged ? undefined : process.env.ELECTRON_START_URL;
// Development keeps its own name, keychain entry and data folder, apart from the installed app's (the demo too).
if (!packaged) {
  app.setName(demo ? "Edunex Plus Demo" : "Edunex Plus Dev");
  app.setPath("userData", path.join(app.getPath("appData"), demo?.profile ?? "Edunex Plus Dev"));
}

registerAppScheme();
hardenAllContents();
if (process.platform === "win32") app.setAppUserModelId("id.edunexplus.desktop");

let window: BrowserWindow | null = null;
let engine: Engine | null = null;
let quitting = false;
let syncing = false;
let tray: AppTray | null = null;
const notifier = createNotifier({ lang: () => engine?.snapshot().settings.lang ?? "id", open: openRoute });

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", reveal);
  app.whenReady().then(start).catch(fail);
}

async function start(): Promise<void> {
  const userData = app.getPath("userData");
  const root = path.join(userData, "v2");
  const storage = new FileStorage(path.join(root, "data"));
  void storage.sweep();
  const { vault, mode } = await openVault(new FileStorage(path.join(root, "vault")));

  // The engine talks to the sources on its own in-memory session; the page gets no permissions at all.
  const engineSession = session.fromPartition("engine", { cache: false });
  denyPermissions(engineSession);
  denyPermissions(session.defaultSession);

  const current = createEngine({
    transport: demo?.transport ?? electronTransport(engineSession),
    clock: demo?.clock ?? systemClock,
    storage,
    vault,
    version: __APP_VERSION__,
    checkForUpdates: packaged,
    emit: send,
    // The demo's made-up alerts stay in the app: no OS notifications.
    alert: (notice) => void (demo ? undefined : notifier.show(notice)),
  });
  engine = current;
  await current.load();
  if (demo && (await demo.prepare(current))) syncing = true;

  const csp = contentSecurityPolicy(devServer);
  serveApp(path.join(__dirname, "..", "app"), csp);
  const devOrigin = devServer ? new URL(devServer).origin : null;
  if (devOrigin) {
    session.defaultSession.webRequest.onHeadersReceived({ urls: [`${devOrigin}/*`] }, (details, callback) =>
      callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [csp] } }),
    );
  }
  // Custom schemes have no URL origin ("null"), so the app's own page is matched by scheme and host.
  const isAppUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === `${APP_SCHEME}:`) return parsed.host === APP_HOST;
      return parsed.origin === devOrigin;
    } catch {
      return false;
    }
  };

  const context: DesktopContext = {
    engine: current,
    window: () => window,
    packaged,
    userData,
    engineSession,
    fetchFile: demo?.fetchFile ?? ((url, init) => engineSession.fetch(url, { ...init, bypassCustomProtocolHandlers: true })),
    vaultMode: mode,
    lang: () => current.snapshot().settings.lang,
    send,
    applySettings,
    reveal,
    startSyncing,
    notifier,
  };
  const handlers: Handlers = {
    ...coreHandlers(context),
    ...authHandlers(context),
    ...tasksHandlers(context),
    ...coursePageHandlers(context),
    ...filesHandlers(context),
    ...sixHandlers(context),
    ...alertsHandlers(context),
    ...updatesHandlers(context),
    ...scheduleHandlers(context),
  };
  registerBridge({ window: () => window, isAppUrl, handlers });
  applySettings(current.snapshot().settings);
  nativeTheme.on("updated", paintBackground);

  window = createMainWindow({
    preload: path.join(__dirname, "preload.cjs"),
    state: await loadWindowState(storage),
    devTools: !packaged,
    storage,
    clockOffset: demo?.clockOffset(),
  });
  guardAppWindow(window, isAppUrl);
  const shown = window;
  // If the page never says it's ready (it failed to load), show the window anyway so it can be closed or reloaded.
  const fallback = setTimeout(() => {
    reveal();
    startSyncing();
  }, 6_000);
  shown.once("show", () => clearTimeout(fallback));
  tray = createTray({ lang: current.snapshot().settings.lang, open: reveal, quit: () => app.quit() });
  shown.on("close", (event) => {
    if (quitting) return;
    const { closeToTray, trayExplained } = current.snapshot().settings;
    // Closing the window keeps the app (its sync and alerts) running, as Mac apps do; elsewhere only with a tray to come back from.
    if (closeToTray && (process.platform === "darwin" || tray)) {
      event.preventDefault();
      shown.hide();
      if (!trayExplained) void explainTray(current);
    } else if (!closeToTray && process.platform === "darwin") {
      app.quit();
    }
  });
  shown.on("closed", () => {
    window = null;
  });
  let lastCrash = 0;
  shown.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason === "clean-exit" || Date.now() - lastCrash < 60_000) return;
    lastCrash = Date.now();
    shown.webContents.reload();
  });
  void shown.loadURL(devServer ?? `${APP_ORIGIN}/index.html`);

  powerMonitor.on("resume", () => setTimeout(() => void engine?.refresh().catch(() => undefined), 5_000));
}

function startSyncing(): void {
  if (syncing || !engine) return;
  syncing = true;
  engine.start();
}

function applySettings(settings: Settings): void {
  nativeTheme.themeSource = settings.theme;
  paintBackground();
  tray?.setLang(settings.lang);
  installMenu({ lang: settings.lang, devTools: !packaged, command: (command) => send({ type: "command", command }) });
}

function paintBackground(): void {
  if (window && !window.isDestroyed()) window.setBackgroundColor(nativeTheme.shouldUseDarkColors ? BACKGROUND.dark : BACKGROUND.light);
}

function send(event: Event): void {
  if (window && !window.isDestroyed()) window.webContents.send(CHANNEL_EVENT, event);
}

function reveal(): void {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  if (!window.isVisible()) window.show();
  window.focus();
}

/** A notification was clicked: the window comes forward on the alert's screen. */
function openRoute(route: Route): void {
  reveal();
  send({ type: "navigate", route });
}

/** The first time the window closes into the tray: say so once, and offer to quit instead. */
async function explainTray(current: Engine): Promise<void> {
  const t = (key: Parameters<typeof translate>[1]) => translate(current.snapshot().settings.lang, key);
  const { response } = await dialog.showMessageBox({
    type: "info",
    message: t("tray.explainer.title"),
    detail: t("tray.explainer.body"),
    buttons: [t("tray.explainer.keep"), t("tray.explainer.quit")],
    defaultId: 0,
    cancelId: 0,
  });
  const quit = response === 1;
  await current.updateSettings(quit ? { trayExplained: true, closeToTray: false } : { trayExplained: true });
  if (quit) app.quit();
}

function fail(error: unknown): void {
  console.error("[main] start failed:", error);
  dialog.showErrorBox(translate("id", "app.startFailed"), error instanceof Error ? error.message : String(error));
  app.exit(1);
}

app.on("activate", reveal);
app.on("before-quit", () => {
  quitting = true;
  engine?.stop();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
