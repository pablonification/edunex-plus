// SIX sign-in in a window the app owns (signin-flow.ts), on the throwaway
// sign-in session (signin-session.ts): SIX's "Login dengan ITB Account" →
// Microsoft, where the Student types their password and 2FA code (or nothing
// at all, right after signing in to Edunex) → back to SIX. Once Microsoft hands
// back, the window hides; when SIX shows a signed-in page, the app reads SIX's
// session cookie and closes the window. There's no time limit on the Student's part.
import type { WebContents } from "electron";
import { EngineError } from "../engine/errors";
import { isSixAfterSignIn, readSixSession, SIX_LOGIN_PAGE, SIX_SIGN_IN_URL, SIX_SITE_HOST } from "../engine/sources/six/signin";
import { runSignIn, type SignInOptions, type SignInRun } from "./signin-flow";

/** Only signed-in SIX pages have a Logout link; SIX sets its cookie for visitors who aren't signed in too. */
const SIGNED_IN = `Boolean(document.querySelector('a[href^="/logout"]'))`;
/** Signed in, yet no session cookie this long: SIX keeps its session some other way now. */
const COOKIE_GRACE_MS = 10_000;

let open: SignInRun<string> | null = null;

/**
 * Resolves with the session ("khongguan=…"), or null when the Student closes the window (or a quiet try gives up).
 * Already open: a quiet try becomes the Student's, a window of theirs comes forward.
 */
export function signInToSix(options: SignInOptions): Promise<string | null> {
  if (open) {
    if (!options.quiet) open.adopt(options.onStep);
    return open.result;
  }
  let signedInAt = 0;
  const run = runSignIn(
    {
      start: SIX_SIGN_IN_URL,
      hosts: [SIX_SITE_HOST],
      read: async (contents, session) => {
        if (!isSixAfterSignIn(contents.getURL()) || (await contents.executeJavaScript(SIGNED_IN)) !== true) return null;
        const found = readSixSession(await session.cookies.get({ url: "https://six.itb.ac.id/" }));
        if (found) return found;
        signedInAt ||= Date.now();
        if (Date.now() - signedInAt > COOKIE_GRACE_MS) throw new EngineError("VendorChanged", "SIX's session cookie wasn't there after sign-in");
        return null;
      },
      // Straight to "Login dengan ITB Account"; should SIX refuse that address, its own sign-in page has the button.
      prepare: (contents: WebContents) =>
        contents.once("did-navigate", (_event, url, code) => {
          if (code >= 400 && url.startsWith(SIX_SIGN_IN_URL)) void contents.loadURL(SIX_LOGIN_PAGE).catch(() => undefined);
        }),
    },
    options,
  );
  open = run;
  void run.result
    .catch(() => undefined)
    .finally(() => {
      if (open === run) open = null;
    });
  return run.result;
}

/** Stops the app's own quiet try, if one is running (the Student signed out meanwhile). */
export function stopQuietSixSignIn(): void {
  if (open?.quiet) open.cancel();
}
