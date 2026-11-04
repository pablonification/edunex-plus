// Edunex in a window of the app (./site-window.ts): any Edunex page the app
// links to (a course, a Task, a Presence), signed in with the access token the
// engine keeps. Edunex's website keeps its session in `localStorage.auth`
// (src/engine/sources/edunex/signin.ts); before the website's own code runs,
// the window puts the token there once, as the website would after a sign-in.
// It counts that as signed in while `verified` is true and `expirationDate` is
// ahead (its `initialize` and `isLoggedIn`, in its public JavaScript). Should
// the token have ended, Edunex shows its own sign-in in the window. One window
// at a time; it holds only Edunex's session (and Microsoft's, should the
// Student sign in there). A link that leaves Edunex opens in the system
// browser, as Edunex itself opens a lecturer's link. Closing it, or signing out
// of Edunex, wipes it, and the app reads Edunex's attendance again.
import { EDUNEX_WEB, isWebLink } from "../core/links";
import { EDUNEX_SIGN_IN_URL } from "../engine/sources/edunex/signin";
import { createSiteWindow, MICROSOFT_SIGN_IN, onHosts, onSite, type SiteWindow } from "./site-window";

/** Where the window may go itself: Edunex, its sign-in, and Microsoft's, which it sends a Student whose session ended to. */
const STAYS = [/^edunex\.itb\.ac\.id$/, new RegExp(`^${new URL(EDUNEX_SIGN_IN_URL).hostname.replaceAll(".", "\\.")}$`), ...MICROSOFT_SIGN_IN];

/** How long a token whose end isn't written in it is taken to last; Edunex says so itself if it ended sooner. */
const UNKNOWN_END = 12 * 3_600_000;

/** Whether the Edunex window goes to `url` itself (else it opens in the system browser, when it's a web page). */
export function staysInEdunexWindow(url: string): boolean {
  return onHosts(url, STAYS);
}

/** The website's saved session for the engine's access token, as its sign-in saves it (no refresh token: the app never keeps one). */
export function edunexAuth(token: string, now: number): string {
  let ends = now + UNKNOWN_END;
  try {
    const exp = (JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: unknown }).exp;
    if (typeof exp === "number" && Number.isFinite(exp)) ends = exp * 1000;
  } catch {
    // Not readable: the guess above.
  }
  return JSON.stringify({ accessToken: token, expirationDate: new Date(ends).toISOString(), verified: true });
}

/**
 * Run before each page's own code: on Edunex, the first page this window shows gets the session.
 * Once only (`sessionStorage` lasts as long as the window), so a Student whose token ended and who
 * signs in on Edunex's page keeps the session they signed in with.
 */
export function signInScript(auth: string): string {
  return `(() => {
  if (location.origin !== ${JSON.stringify(EDUNEX_WEB)} || sessionStorage.getItem("edunexPlus")) return;
  sessionStorage.setItem("edunexPlus", "1");
  if (!localStorage.getItem("auth")) localStorage.setItem("auth", ${JSON.stringify(auth)});
})()`;
}

export interface EdunexWindowOptions {
  /** The Edunex page to open. */
  url: string;
  /** The engine's access token; null: signed out, Edunex shows its sign-in. */
  token: string | null;
  now: number;
  title: string;
  devTools: boolean;
  /** The window closed: the Student is back from Edunex. */
  onClosed?(): void;
}

let open: SiteWindow | null = null;

/** Opens (or brings forward, on this page) the Edunex window. */
export async function openEdunexWindow(options: EdunexWindowOptions): Promise<void> {
  if (!onSite(options.url, EDUNEX_WEB)) throw new Error("Only Edunex opens in the Edunex window");
  if (open && !open.window.isDestroyed()) return open.go(options.url);

  const site = createSiteWindow({ title: options.title, devTools: options.devTools, stays: staysInEdunexWindow, opensOutside: isWebLink }, () => {
    if (open === site) open = null;
    options.onClosed?.();
  });
  open = site;
  if (options.token) {
    // On the blank page the window opens on: Chromium answers only once the window has a page.
    // Never longer than SETUP_MS: past it, Edunex shows its sign-in.
    await site.ready;
    await Promise.race([signIn(site, signInScript(edunexAuth(options.token, options.now))), new Promise((done) => setTimeout(done, SETUP_MS))]);
  }
  return site.go(options.url);
}

/** How long the window waits for Chromium to take the sign-in before it opens the page anyway. */
const SETUP_MS = 2_000;

/** Chromium's own way to run a script before a page's: the token never goes on the page's address or into a file. */
async function signIn(site: SiteWindow, script: string): Promise<void> {
  const tools = site.contents.debugger;
  try {
    tools.attach("1.3");
    await tools.sendCommand("Page.enable");
    await tools.sendCommand("Page.addScriptToEvaluateOnNewDocument", { source: script });
  } catch {
    // Not signed in here, then: Edunex shows its own sign-in.
  }
}

/** Signing out of Edunex: the window, and Edunex's session in it, go. */
export function closeEdunexWindow(): void {
  if (open && !open.window.isDestroyed()) open.window.destroy();
}
