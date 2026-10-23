// Edunex Plus, main process. Loads saved data before anything else, opens the
// window hidden and shows it once the page has drawn that data, starts
// syncing only then, and answers the window through the typed bridge.

import module from "node:module";
import path from "node:path";
import { app, type BrowserWindow, dialog, powerMonitor, session } from "electron";
import { CHANNEL_EVENT } from "../core/channels";
import type { Event } from "../core/contract";
import type { Settings } from "../core/models";
import { DEFAULT_SETTINGS, UpdateNotice } from "../core/models";
import type { Route } from "../core/route";
import { translate } from "../core/strings";
import { systemClock } from "../engine/clock";
import { createEngine, type Engine } from "../engine/engine";
import { demo, demoPhone } from "./demo";
import { createDownloadedFiles, DOWNLOADED_FILES_FOLDER } from "./downloaded-files";
import { createFileCache, FILE_CACHE_FOLDER } from "./file-cache";
import { alertsHandlers } from "./handlers/alerts";
import { authHandlers } from "./handlers/auth";
import type { DesktopContext } from "./handlers/context";
import { coreHandlers } from "./handlers/core";
import { coursePageHandlers } from "./handlers/course-page";
import { edunexNim, filesHandlers, forgetOtherStudentsFiles } from "./handlers/files";
import { phoneHandlers } from "./handlers/phone";
import { scheduleHandlers } from "./handlers/schedule";
import { openCheckIn, sixHandlers } from "./handlers/six";
import { tasksHandlers } from "./handlers/tasks";
import { updatesHandlers } from "./handlers/updates";
import { type Handlers, registerBridge } from "./ipc";
import { helperPath, readVaultKey } from "./keychain-helper";
import { installMenu } from "./menu";
import { createNotifier } from "./notifications";
import { ntfyClient } from "./ntfy";
import { registerAppScheme, serveApp } from "./protocol";
import { APP_HOST, APP_ORIGIN, APP_SCHEME, contentSecurityPolicy, denyPermissions, guardAppWindow, hardenAllContents } from "./security";
import { followAutoUpdates } from "./self-update";
import { FileStorage } from "./storage";
import { electronTransport } from "./transport";
import { type AppTray, createTray } from "./tray";
import { electronUpdater } from "./updater";
import { holdsSafeStorage, openVault } from "./vault";
import { createMainWindow, currentPlatform, followTheme, loadWindowState } from "./window";

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
let theme: ReturnType<typeof followTheme> | null = null;
/** "Perbarui otomatis", once the updater is there. */
let autoUpdates: ReturnType<typeof followAutoUpdates> | null = null;
/** Quitting for good: a ready update has been put in place, or there was none. */
let readyToQuit = false;
/** macOS: the key the saved sign-ins are locked with, from the keychain helper (src/desktop/keychain-helper.ts); null elsewhere. */
let vaultKey: Buffer | null = null;
const notifier = createNotifier({
  lang: () => engine?.snapshot().settings.lang ?? DEFAULT_SETTINGS.lang,
  open: openRoute,
  openCheckIn: (meetingId) => {
    if (!engine) return;
    // The class went off SIX's timetable meanwhile: Beranda, where its attendance is.
    openCheckIn({ engine, lang: () => engine?.snapshot().settings.lang ?? DEFAULT_SETTINGS.lang, packaged }, meetingId).catch(() =>
      openRoute({ screen: "home" }),
    );
  },
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", reveal);
  if (packaged && process.platform === "darwin") {
    vaultKey = readVaultKey(helperPath(process.resourcesPath));
    // Before Chromium starts: with the helper's key, Chromium is told to leave the real keychain
    // alone (it would open "Edunex Plus Safe Storage" to clear its storage on a sign-out), so
    // nothing in the app opens it and macOS has nothing to ask after an update. Not while a sign-in
    // safeStorage locked is still there: this start reads it, the last time macOS asks.
    if (vaultKey && !holdsSafeStorage(vaultFolder(app.getPath("userData")))) app.commandLine.appendSwitch("use-mock-keychain");
  }
  app.whenReady().then(start).catch(fail);
}

/** Where the saved sign-ins are, locked (src/desktop/vault.ts). */
function vaultFolder(userData: string): string {
  return path.join(userData, "v2", "vault");
}

async function start(): Promise<void> {
  const userData = app.getPath("userData");
  const root = path.join(userData, "v2");
  const storage = new FileStorage(path.join(root, "data"));
  void storage.sweep();
  const { vault, mode } = await openVault(new FileStorage(vaultFolder(userData)), vaultKey);

  // The engine talks to the sources on its own in-memory session; the page gets no permissions at all.
  const engineSession = session.fromPartition("engine", { cache: false });
  denyPermissions(engineSession);
  denyPermissions(session.defaultSession);
  // The phone's messages go out on a session of their own, apart from Edunex's.
  const ntfySession = session.fromPartition("ntfy", { cache: false });
  denyPermissions(ntfySession);

  const fileCache = createFileCache(path.join(userData, FILE_CACHE_FOLDER), { owner: () => edunexNim(current) });
  const downloadedFiles = createDownloadedFiles(path.join(userData, DOWNLOADED_FILES_FOLDER), { owner: () => edunexNim(current) });
  let followAccount: (event: Event) => Promise<void> = async () => undefined;
  const current = createEngine({
    transport: demo?.transport ?? electronTransport(engineSession),
    clock: demo?.clock ?? systemClock,
    storage,
    vault,
    version: __APP_VERSION__,
    checkForUpdates: packaged,
    emit: (event) => {
      send(event);
      void followAccount(event);
      autoUpdates?.onEvent(event);
    },
    // The demo's made-up alerts stay in the app: no OS notifications, nothing to a phone.
    alert: (notice) => void (demo ? undefined : notifier.show(notice)),
    phone: demo ? demoPhone : { ntfy: ntfyClient(ntfySession) },
  });
  engine = current;
  await current.load();
  followAccount = forgetOtherStudentsFiles([fileCache, downloadedFiles], edunexNim(current));
  // A new version downloads on a session of its own too, and only when the Student asks; the demo never updates.
  const updater = electronUpdater({
    packaged: packaged && !demo,
    userAgent: `EdunexPlus/${__APP_VERSION__} (+https://github.com/pablonification/edunex-plus)`,
    session: session.fromPartition("updates", { cache: false }),
    notice: () => {
      const dataset = current.snapshot().datasets.find((entry) => entry.name === "app.update");
      const notice = dataset && UpdateNotice.safeParse(dataset.value);
      return notice?.success ? notice.data : null;
    },
    send: (update) => send({ type: "update", update }),
  });
  autoUpdates = followAutoUpdates(updater, () => current.snapshot().settings.autoUpdate);
  autoUpdates.resume();
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
    fileCache,
    downloadedFiles,
    vaultMode: mode,
    platform: demo?.platform ?? currentPlatform(),
    lang: () => current.snapshot().settings.lang,
    send,
    applySettings,
    reveal,
    startSyncing,
    notifier,
    updater,
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
    ...phoneHandlers(context),
  };
  registerBridge({ window: () => window, isAppUrl, handlers });
  theme = followTheme(() => window, currentPlatform());
  applySettings(current.snapshot().settings);

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
  theme?.set(settings.theme);
  tray?.setLang(settings.lang);
  installMenu({ lang: settings.lang, devTools: !packaged, command: (command) => send({ type: "command", command }) });
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
  dialog.showErrorBox(
    translate(engine?.snapshot().settings.lang ?? DEFAULT_SETTINGS.lang, "app.startFailed"),
    error instanceof Error ? error.message : String(error),
  );
  app.exit(1);
}

app.on("activate", reveal);
app.on("before-quit", (event) => {
  quitting = true;
  engine?.stop();
  // "Perbarui otomatis": a downloaded version goes in place first (it waits for this copy to quit), then the app quits.
  if (readyToQuit || !autoUpdates) return;
  event.preventDefault();
  readyToQuit = true;
  void autoUpdates.beforeQuit().finally(() => app.quit());
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
