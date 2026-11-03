// Edunex and SIX inside the app, signed in (W14 in PROGRESS.md). Every page of theirs the app opens
// ("Buka di Edunex", "Buka di SIX", Tandai Hadir) opens in a page of the app with the app's own
// session, never in the phone's browser, where the Student isn't signed in and would be asked again.
// SIX: the engine's session cookie goes into the web views' cookie store before the page loads.
// Edunex: its website keeps its sign-in in the page storage ("auth"), which the sign-in page left
// there; when it's gone, the engine's token is put back before Edunex's own scripts run. Should
// either still show its sign-in, Microsoft's session (kept in the app's web views until the Student
// signs out) signs it in again without a password.
import { EDUNEX_WEB, SIX_WEB } from "../../../src/core/links";
import { EDUNEX_SIGN_IN_URL, EDUNEX_SITE_HOST } from "../../../src/engine/sources/edunex/signin";
import { SIX_LOGIN_PAGE, SIX_SIGN_IN_URL, SIX_SITE_HOST } from "../../../src/engine/sources/six/signin";

export type Site = "edunex" | "six";

const parse = (url: string): URL | null => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed : null;
  } catch {
    return null;
  }
};

/** Which system's website `url` is, when it opens in the app signed in; null for anywhere else. */
export function siteOf(url: string): Site | null {
  const host = parse(url)?.hostname;
  if (host === EDUNEX_SITE_HOST) return "edunex";
  if (host === SIX_SITE_HOST) return "six";
  return null;
}

/**
 * Where a page the app opens goes: Edunex's and SIX's own in the app's page, signed in ("app"); anything else in the
 * phone's browser ("browser"), except in the demo, which opens no outside page, like the desktop's ("nowhere").
 */
export function whereOpens(url: string, demo: boolean): "app" | "browser" | "nowhere" {
  if (siteOf(url)) return "app";
  return demo ? "nowhere" : "browser";
}

/** Microsoft's sign-in, which both send a Student whose session ended to, and Edunex's own sign-in door. */
const SIGN_IN_HOSTS = [/(^|\.)microsoftonline\.com$/, /(^|\.)microsoft\.com$/, /(^|\.)live\.com$/, /(^|\.)msauth\.net$/, /(^|\.)msftauth\.net$/];

/** Whether the page goes to `url` itself; anywhere else opens in the phone's browser (official pages only). */
export function staysInPage(url: string): boolean {
  const host = parse(url)?.hostname;
  if (!host) return false;
  return host === EDUNEX_SITE_HOST || host === SIX_SITE_HOST || host === new URL(EDUNEX_SIGN_IN_URL).hostname || SIGN_IN_HOSTS.some((h) => h.test(host));
}

/** SIX's own sign-in page (the one with its "Login with Microsoft 365" button), not its Microsoft door. */
export function isSixLoginPage(url: string): boolean {
  const parsed = parse(url);
  return parsed?.hostname === SIX_SITE_HOST && /^\/login\/?$/i.test(parsed.pathname);
}

/** Where a page that landed on SIX's sign-in goes next: straight through Microsoft, which remembers the Student. */
export const SIX_SIGN_IN_AGAIN = SIX_SIGN_IN_URL;
export { SIX_LOGIN_PAGE };

/**
 * Run before Edunex's own scripts on every page: the engine's token as Edunex's saved sign-in, when the page storage
 * has none (Edunex reads `auth`'s accessToken, src/engine/sources/edunex/signin.ts). Only on Edunex's own site.
 */
export function edunexAuthScript(token: string | null): string {
  if (!token || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return "true;";
  const auth = JSON.stringify(JSON.stringify({ accessToken: token }));
  return `(function(){try{if(location.host===${JSON.stringify(EDUNEX_SITE_HOST)}&&!window.localStorage.getItem('auth'))window.localStorage.setItem('auth',${auth});}catch(e){}})();true;`;
}

/** The site's home, for a page asked for without an address. */
export const SITE_HOME: Record<Site, string> = { edunex: `${EDUNEX_WEB}/`, six: `${SIX_WEB}/` };
