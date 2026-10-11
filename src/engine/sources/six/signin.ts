// How a SIX session is picked up after the Student signs in. SIX's "Login
// dengan ITB Account" (/login/MS365) goes to Microsoft and back to SIX, which
// then keeps the session in its `khongguan` cookie (about 30 days). The app
// keeps that cookie as a Cookie header, the way every SIX page is asked for.

/** Where SIX's "Login dengan ITB Account" button leads: on to Microsoft. */
export const SIX_SIGN_IN_URL = "https://six.itb.ac.id/login/MS365";
/** SIX's own sign-in page, with that button. */
export const SIX_LOGIN_PAGE = "https://six.itb.ac.id/login";
export const SIX_SITE_HOST = "six.itb.ac.id";
export const SIX_SESSION_COOKIE = "khongguan";

/** Whether the sign-in window shows SIX itself again: not its sign-in, sign-out or public pages. */
export function isSixAfterSignIn(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.host === SIX_SITE_HOST && !/^\/(login|logout|pub)(\/|$)/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

/** The session the engine keeps ("khongguan=…"), from SIX's cookies in the sign-in window; null until SIX has set it. */
export function readSixSession(cookies: readonly { name: string; value: string }[]): string | null {
  const value = cookies.find((cookie) => cookie.name === SIX_SESSION_COOKIE)?.value;
  return value && /^[\w%+/=.-]+$/.test(value) ? `${SIX_SESSION_COOKIE}=${value}` : null;
}
