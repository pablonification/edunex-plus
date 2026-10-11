// Edunex Plus, main process. Loads saved data before anything else, opens the
// window hidden and shows it once the page has drawn that data, starts
// syncing only then, and answers the window through the typed bridge.
import { app, type BrowserWindow, dialog, nativeTheme, powerMonitor, session, shell } from "electron";
import module from "node:module";
import path from "node:path";
import { CHANNEL_EVENT } from "../core/channels";
import type { Event } from "../core/contract";
import type { Settings } from "../core/models";
import { translate } from "../core/strings";
import { systemClock } from "../engine/clock";
import { createEngine, type Engine } from "../engine/engine";
import { EngineError } from "../engine/errors";
import { type Handlers, registerBridge } from "./ipc";
import { installMenu } from "./menu";
import { registerAppScheme, serveApp } from "./protocol";
import { APP_HOST, APP_ORIGIN, APP_SCHEME, contentSecurityPolicy, denyPermissions, guardAppWindow, hardenAllContents, isOfficialUrl } from "./security";
import { signInToEdunex } from "./signin";
import { FileStorage } from "./storage";
import { removeEveryTrace } from "./traces";
import { electronTransport } from "./transport";
import { openVault } from "./vault";
import { BACKGROUND, createMainWindow, loadWindowState } from "./window";

// Later launches start faster: compiled code is cached between runs.
module.enableCompileCache?.();

declare const __APP_VERSION__: string;

const packaged = app.isPackaged;
/** The Vite dev server; honoured only in development. */
const devServer = packaged ? undefined : process.env.ELECTRON_START_URL;
// Development keeps its own name, keychain entry and data folder, apart from the installed app's.
if (!packaged) {
  app.setName("Edunex Plus Dev");
  app.setPath("userData", path.join(app.getPath("appData"), "Edunex Plus Dev"));
}

registerAppScheme();
hardenAllContents();
if (process.platform === "win32") app.setAppUserModelId("id.edunexplus.desktop");

let window: BrowserWindow | null = null;
let engine: Engine | null = null;
let quitting = false;
let syncing = false;

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
  const { vault, mode } = await openVault(new FileStorage(path.join(root, "vault")));

  // The engine talks to EduNex on its own in-memory session; the page gets no permissions at all.
  const engineSession = session.fromPartition("engine", { cache: false });
  denyPermissions(engineSession);
  denyPermissions(session.defaultSession);

  const current = createEngine({ transport: electronTransport(engineSession), clock: systemClock, storage, vault, version: __APP_VERSION__, emit: send });
  engine = current;
  await current.load();
  const settings = current.snapshot().settings;

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

  let signingIn: Promise<boolean> | null = null;
  const signInToEdunexOnce = () =>
    (signingIn ??= (async () => {
      try {
        const token = await signInToEdunex({
          parent: window,
          title: translate(current.snapshot().settings.lang, "signIn.edunexTitle"),
          devTools: !packaged,
        });
        if (!token) return false;
        await current.signIn("edunex", { token });
        return true;
      } finally {
        signingIn = null;
      }
    })());

  const handlers: Handlers = {
    "app.snapshot": async () => ({ ...current.snapshot(), platform: platform(), vault: mode }),
    "app.ready": async () => {
      reveal();
      startSyncing();
      return {};
    },
    "auth.signIn": async ({ source }) => {
      if (source !== "edunex") throw new EngineError("Rejected", "SIX sign-in isn't available yet");
      return { signedIn: await signInToEdunexOnce() };
    },
    "auth.signOut": async ({ source }) => {
      await current.signOut(source);
      if (!source) await removeEveryTrace({ userData, engineSession });
      return {};
    },
    "sync.refresh": async ({ source }) => {
      await current.refresh(source);
      return {};
    },
    "settings.update": async (patch) => {
      const next = await current.updateSettings(patch);
      applySettings(next);
      return next;
    },
    "shell.openExternal": async ({ url }) => {
      if (!isOfficialUrl(url)) throw new EngineError("Rejected", "Only official pages open from the app");
      await shell.openExternal(url);
      return {};
    },
  };
  registerBridge({ window: () => window, isAppUrl, handlers });
  applySettings(settings);
  nativeTheme.on("updated", paintBackground);

  window = createMainWindow({ preload: path.join(__dirname, "preload.cjs"), state: await loadWindowState(storage), devTools: !packaged, storage });
  guardAppWindow(window, isAppUrl);
  const shown = window;
  // If the page never says it's ready (it failed to load), show the window anyway so it can be closed or reloaded.
  const fallback = setTimeout(() => {
    reveal();
    startSyncing();
  }, 6_000);
  shown.once("show", () => clearTimeout(fallback));
  shown.on("close", (event) => {
    // macOS: closing the window keeps the app (and its sync) running, as Mac apps do.
    if (process.platform === "darwin" && !quitting) {
      event.preventDefault();
      shown.hide();
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

function platform(): "darwin" | "win32" | "linux" {
  return process.platform === "darwin" || process.platform === "win32" ? process.platform : "linux";
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
