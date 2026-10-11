// The throwaway browser session every sign-in window runs on, shared so one
// Microsoft sign-in can cover both systems: right after the Student signs in
// to EduNex, SIX's "Login dengan ITB Account" finds Microsoft's session and
// comes straight back (no second password or 2FA), and the other way round.
// It lives only in memory, has no access to the app, and is wiped as soon as
// nothing needs it: when the other system needs no sign-in, when the Student
// moves on, a few minutes after the last sign-in window closed, and on quit.
import { app, BrowserWindow, type Session, session as sessions } from "electron";
import { randomUUID } from "node:crypto";
import { denyPermissions } from "./security";

/** How long Microsoft's session is kept after the last sign-in window closed. */
const KEEP_MS = 5 * 60_000;

interface Shared {
  partition: string;
  session: Session;
  /** Sign-in windows open on it now. */
  windows: number;
  timer: ReturnType<typeof setTimeout> | null;
  wipeWhenClosed: boolean;
}

let shared: Shared | null = null;

function chromeUserAgent(): string {
  const platform =
    process.platform === "darwin" ? "Macintosh; Intel Mac OS X 10_15_7" : process.platform === "win32" ? "Windows NT 10.0; Win64; x64" : "X11; Linux x86_64";
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
}

function borrow(): Shared {
  if (!shared) {
    // No "persist:" prefix: nothing of it is ever written to disk.
    const partition = `signin-${randomUUID()}`;
    const session = sessions.fromPartition(partition, { cache: false });
    denyPermissions(session);
    // A plain Chrome identity: some sign-in pages turn away browsers they don't know.
    session.setUserAgent(chromeUserAgent());
    shared = { partition, session, windows: 0, timer: null, wipeWhenClosed: false };
  }
  if (shared.timer) clearTimeout(shared.timer);
  shared.timer = null;
  shared.windows += 1;
  return shared;
}

function giveBack(lease: Shared): void {
  if (shared !== lease) return;
  lease.windows -= 1;
  if (lease.windows > 0) return;
  if (lease.wipeWhenClosed) void forgetSignInSession();
  else lease.timer = setTimeout(() => void forgetSignInSession(), KEEP_MS);
}

async function wipe(lease: Shared): Promise<void> {
  if (shared === lease) shared = null;
  if (lease.timer) clearTimeout(lease.timer);
  await Promise.allSettled([lease.session.clearStorageData(), lease.session.clearCache(), lease.session.clearAuthCache()]);
}

/** Wipes the shared sign-in session now, or as soon as its last open sign-in window closes. */
export async function forgetSignInSession(): Promise<void> {
  if (!shared) return;
  if (shared.windows > 0) {
    shared.wipeWhenClosed = true;
    return;
  }
  await wipe(shared);
}

app.on("before-quit", () => {
  if (shared) void wipe(shared);
});

/**
 * A sign-in window on the shared session. It can't reach the app; pop-ups
 * (some sign-in steps open one) continue in the same window. The caller shows
 * it, loads the sign-in page and destroys it when done.
 */
export function openSignInWindow(options: { parent: BrowserWindow | null; title: string; devTools: boolean }): { window: BrowserWindow; session: Session } {
  const lease = borrow();
  const window = new BrowserWindow({
    parent: options.parent ?? undefined,
    width: 480,
    height: 700,
    minWidth: 380,
    minHeight: 520,
    title: options.title,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      partition: lease.partition,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false,
      devTools: options.devTools,
    },
  });
  const contents = window.webContents;
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) setImmediate(() => void contents.loadURL(url).catch(() => undefined));
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (!url.startsWith("https://")) event.preventDefault();
  });
  window.on("page-title-updated", (event) => event.preventDefault());
  window.once("closed", () => giveBack(lease));
  return { window, session: lease.session };
}
