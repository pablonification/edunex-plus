// EduNex sign-in in a window the app owns. It runs on a throwaway in-memory
// session with no access to the app: the Student types their password and 2FA
// code only on Microsoft's page. Once EduNex's website holds the session, the
// app reads the access token, closes the window and wipes everything the
// sign-in left behind. There's no time limit: 2FA takes as long as it takes.
import { BrowserWindow, session } from "electron";
import { randomUUID } from "node:crypto";
import { EDUNEX_SIGN_IN_URL, EDUNEX_SITE_HOST, readSignInToken } from "../engine/sources/edunex/signin";
import { denyPermissions } from "./security";

let open: { window: BrowserWindow; token: Promise<string | null> } | null = null;

function chromeUserAgent(): string {
  const platform =
    process.platform === "darwin" ? "Macintosh; Intel Mac OS X 10_15_7" : process.platform === "win32" ? "Windows NT 10.0; Win64; x64" : "X11; Linux x86_64";
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
}

/** Resolves with the access token, or null when the Student closes the window. */
export function signInToEdunex(options: { parent: BrowserWindow | null; title: string; devTools: boolean }): Promise<string | null> {
  if (open && !open.window.isDestroyed()) {
    open.window.focus();
    return open.token;
  }
  const partition = `signin-${randomUUID()}`;
  const signInSession = session.fromPartition(partition, { cache: false });
  denyPermissions(signInSession);
  // A plain Chrome identity: some sign-in pages turn away browsers they don't know.
  signInSession.setUserAgent(chromeUserAgent());

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
      partition,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false,
      devTools: options.devTools,
    },
  });
  const contents = window.webContents;
  // Pop-ups (some sign-in steps open one) continue in this window instead.
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) setImmediate(() => void contents.loadURL(url).catch(() => undefined));
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (!url.startsWith("https://")) event.preventDefault();
  });
  window.on("page-title-updated", (event) => event.preventDefault());

  const token = new Promise<string | null>((resolve) => {
    let done = false;
    let reading = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      clearInterval(poller);
      clearTimeout(showAnyway);
      open = null;
      if (!window.isDestroyed()) window.destroy();
      void Promise.allSettled([signInSession.clearStorageData(), signInSession.clearCache(), signInSession.clearAuthCache()]).then(() => resolve(value));
    };
    // Reads never stop or reload the page; a slow page just gets read again later.
    const read = async () => {
      if (done || reading || window.isDestroyed()) return;
      let host = "";
      try {
        host = new URL(contents.getURL()).host;
      } catch {
        return;
      }
      if (host !== EDUNEX_SITE_HOST) return;
      reading = true;
      try {
        const raw = await Promise.race([
          contents.executeJavaScript("window.localStorage.getItem('auth')"),
          new Promise((resolveLater) => setTimeout(() => resolveLater(null), 3_000)),
        ]);
        const found = readSignInToken(raw);
        if (found) finish(found);
      } catch {
        // The page is between loads; try on the next tick.
      } finally {
        reading = false;
      }
    };
    const poller = setInterval(() => void read(), 400);
    const showAnyway = setTimeout(() => !window.isDestroyed() && window.show(), 1_500);
    window.once("ready-to-show", () => window.show());
    window.on("closed", () => finish(null));
    void contents.loadURL(EDUNEX_SIGN_IN_URL).catch(() => undefined);
  });

  open = { window, token };
  return token;
}
