// Edunex sign-in in a window the app owns (signin-flow.ts). It runs on the
// throwaway sign-in session (signin-session.ts) with no access to the app: the
// Student types their password and 2FA code only on Microsoft's page. Once
// Microsoft hands back, the window hides; when Edunex's website holds the
// session, the app reads the access token and closes the window. There's no
// time limit on the Student's part: 2FA takes as long as it takes.
import { EDUNEX_SIGN_IN_URL, EDUNEX_SITE_HOST, readSignInToken } from "../engine/sources/edunex/signin";
import { runSignIn, type SignInOptions, type SignInRun } from "./signin-flow";

/** sso-edunex starts it and takes Microsoft's answer; the website then keeps the session. */
const EDUNEX_HOSTS = [new URL(EDUNEX_SIGN_IN_URL).host, EDUNEX_SITE_HOST];

let open: SignInRun<string> | null = null;

/**
 * Resolves with the access token, or null when the Student closes the window (or a quiet try gives up).
 * Already open: a quiet try becomes the Student's, a window of theirs comes forward.
 */
export function signInToEdunex(options: SignInOptions): Promise<string | null> {
  if (open) {
    if (!options.quiet) open.adopt(options.onStep);
    return open.result;
  }
  const run = runSignIn(
    {
      start: EDUNEX_SIGN_IN_URL,
      hosts: EDUNEX_HOSTS,
      read: async (contents) => {
        if (new URL(contents.getURL()).host !== EDUNEX_SITE_HOST) return null;
        return readSignInToken(await contents.executeJavaScript("window.localStorage.getItem('auth')"));
      },
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
export function stopQuietEdunexSignIn(): void {
  if (open?.quiet) open.cancel();
}
