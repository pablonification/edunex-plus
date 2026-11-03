// A window of the app that shows Edunex's or SIX's own website, signed in with
// the session the engine keeps (./six-window.ts, ./edunex-window.ts). Each runs
// on its own in-memory session that nothing is written to disk from, refuses
// every permission, can't reach the app, and is wiped when the window closes.
// It keeps to its site and Microsoft's sign-in (where the site sends a Student
// whose session ended); a link that leaves opens in the system browser, when
// the site's rule allows it.
import { randomUUID } from "node:crypto";
import { BrowserWindow, type Session, session as sessions, shell, type WebContents } from "electron";
import { denyPermissions } from "./security";
import { chromeUserAgent } from "./signin-session";

/** Microsoft's sign-in, where Edunex and SIX send a Student whose session ended. */
export const MICROSOFT_SIGN_IN = [/(^|\.)microsoftonline\.com$/, /(^|\.)microsoft\.com$/, /(^|\.)live\.com$/, /(^|\.)msauth\.net$/, /(^|\.)msftauth\.net$/];

/** Whether `url` is an https page on one of `hosts`, with no name or password hidden in it. */
export function onHosts(url: string, hosts: readonly RegExp[]): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && hosts.some((host) => host.test(parsed.hostname));
  } catch {
    return false;
  }
}

/** Whether `url` is a page of `site` (an origin, "https://six.itb.ac.id"), with no name or password hidden in it. */
export function onSite(url: string, site: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === site && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export interface SiteWindowOptions {
  title: string;
  devTools: boolean;
  /** Whether the window goes to `url` itself. */
  stays(url: string): boolean;
  /** Whether a link that leaves may open in the system browser (else it opens nowhere). */
  opensOutside(url: string): boolean;
}

export interface SiteWindow {
  window: BrowserWindow;
  session: Session;
  contents: WebContents;
  /** The blank page the window opens on, loaded: the window is on screen, and Chromium answers the DevTools protocol. */
  ready: Promise<void>;
  /** Brings the window forward, if the Student has seen it, and loads `url` in it. */
  go(url: string): Promise<void>;
}

/**
 * A new site window, on screen at once on a blank page (`ready`) rather than after the site's first page
 * has loaded, which takes seconds; `closed` runs once it's gone and its session is being wiped.
 */
export function createSiteWindow(options: SiteWindowOptions, closed: () => void): SiteWindow {
  // No "persist:" prefix: nothing of it is ever written to disk.
  const session = sessions.fromPartition(`site-${randomUUID()}`, { cache: false });
  denyPermissions(session);
  session.setUserAgent(chromeUserAgent());
  const window = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 480,
    minHeight: 520,
    title: options.title,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      session,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false,
      devTools: options.devTools,
    },
  });
  const contents = window.webContents;
  const outside = (url: string) => {
    if (options.opensOutside(url)) void shell.openExternal(url).catch(() => undefined);
  };
  const leave = (event: { preventDefault(): void }, url: string) => {
    if (options.stays(url)) return;
    event.preventDefault();
    outside(url);
  };
  contents.on("will-navigate", leave);
  contents.on("will-redirect", leave);
  contents.on("will-frame-navigate", (event) => {
    if (!event.isMainFrame) event.preventDefault();
  });
  // A link the site opens in a new tab: its own page in this window, any other the way a link leaving does.
  contents.setWindowOpenHandler(({ url }) => {
    if (options.stays(url)) void contents.loadURL(url).catch(() => undefined);
    else outside(url);
    return { action: "deny" };
  });
  window.on("page-title-updated", (event) => event.preventDefault());
  window.once("ready-to-show", () => window.show());
  const ready = contents.loadURL("about:blank").catch(() => undefined);
  window.once("closed", () => {
    closed();
    void Promise.allSettled([session.clearStorageData(), session.clearCache(), session.clearAuthCache()]);
  });
  return {
    window,
    session,
    contents,
    ready,
    async go(url) {
      await ready;
      if (window.isDestroyed()) return;
      if (window.isVisible()) window.focus();
      await contents.loadURL(url).catch(() => undefined);
    },
  };
}
