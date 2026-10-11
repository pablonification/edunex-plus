// Edunex sign-in in a window the app owns. It runs on the throwaway sign-in
// session (signin-session.ts) with no access to the app: the Student types
// their password and 2FA code only on Microsoft's page. Once Edunex's website
// holds the session, the app reads the access token and closes the window;
// the sign-in session is wiped once SIX doesn't need it for its own sign-in.
// There's no time limit: 2FA takes as long as it takes.
import type { BrowserWindow } from "electron";
import { EDUNEX_SIGN_IN_URL, EDUNEX_SITE_HOST, readSignInToken } from "../engine/sources/edunex/signin";
import { openSignInWindow } from "./signin-session";

let open: { window: BrowserWindow; token: Promise<string | null> } | null = null;

/** Resolves with the access token, or null when the Student closes the window. */
export function signInToEdunex(options: { parent: BrowserWindow | null; title: string; devTools: boolean }): Promise<string | null> {
  if (open && !open.window.isDestroyed()) {
    open.window.focus();
    return open.token;
  }
  const { window } = openSignInWindow(options);
  const contents = window.webContents;

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
      resolve(value);
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
