// SIX sign-in in a window the app owns, on the throwaway sign-in session
// (signin-session.ts): SIX's "Login dengan ITB Account" → Microsoft, where the
// Student types their password and 2FA code (or nothing at all, right after
// signing in to EduNex) → back to SIX. Once SIX shows a signed-in page, the app
// reads SIX's session cookie and closes the window. There's no time limit.
import type { BrowserWindow } from "electron";
import { EngineError } from "../engine/errors";
import { isSixAfterSignIn, readSixSession, SIX_LOGIN_PAGE, SIX_SIGN_IN_URL } from "../engine/sources/six/signin";
import { openSignInWindow } from "./signin-session";

/** Only signed-in SIX pages have a Logout link; SIX sets its cookie for visitors who aren't signed in too. */
const SIGNED_IN = `Boolean(document.querySelector('a[href^="/logout"]'))`;
/** Signed in, yet no session cookie this long: SIX keeps its session some other way now. */
const COOKIE_GRACE_MS = 10_000;

let open: { window: BrowserWindow; session: Promise<string | null> } | null = null;

/** Resolves with the session ("khongguan=…"), or null when the Student closes the window. */
export function signInToSix(options: { parent: BrowserWindow | null; title: string; devTools: boolean }): Promise<string | null> {
  if (open && !open.window.isDestroyed()) {
    open.window.focus();
    return open.session;
  }
  const { window, session: signInSession } = openSignInWindow(options);
  const contents = window.webContents;

  const session = new Promise<string | null>((resolve, reject) => {
    let done = false;
    let reading = false;
    let signedInAt = 0;
    const finish = (outcome: () => void) => {
      if (done) return;
      done = true;
      clearInterval(poller);
      clearTimeout(showAnyway);
      open = null;
      if (!window.isDestroyed()) window.destroy();
      outcome();
    };
    // Reads never stop or reload the page; a slow page just gets read again later.
    const read = async () => {
      if (done || reading || window.isDestroyed() || !isSixAfterSignIn(contents.getURL())) return;
      reading = true;
      try {
        const signedIn = await Promise.race([contents.executeJavaScript(SIGNED_IN), new Promise((resolveLater) => setTimeout(() => resolveLater(false), 3_000))]);
        if (signedIn !== true) return;
        const found = readSixSession(await signInSession.cookies.get({ url: "https://six.itb.ac.id/" }));
        if (found) return finish(() => resolve(found));
        signedInAt ||= Date.now();
        if (Date.now() - signedInAt > COOKIE_GRACE_MS) finish(() => reject(new EngineError("VendorChanged", "SIX's session cookie wasn't there after sign-in")));
      } catch {
        // The page is between loads; try on the next tick.
      } finally {
        reading = false;
      }
    };
    const poller = setInterval(() => void read(), 400);
    const showAnyway = setTimeout(() => !window.isDestroyed() && window.show(), 1_500);
    window.once("ready-to-show", () => window.show());
    window.on("closed", () => finish(() => resolve(null)));
    // Straight to "Login dengan ITB Account"; should SIX refuse that address, its own sign-in page has the button.
    contents.once("did-navigate", (_event, url, code) => {
      if (code >= 400 && url.startsWith(SIX_SIGN_IN_URL)) void contents.loadURL(SIX_LOGIN_PAGE).catch(() => undefined);
    });
    void contents.loadURL(SIX_SIGN_IN_URL).catch(() => undefined);
  });

  open = { window, session };
  return session;
}
