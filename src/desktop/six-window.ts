// SIX in a window of the app, for "Tandai Hadir": SIX's own timetable on the
// class's month, signed in with the session the engine keeps, and the class's
// popup opened the way a click on the class opens it, so the Student only has
// to press SIX's button. The app never presses it. One window at a time; it
// runs on its own in-memory session that holds only SIX's cookie (and
// Microsoft's, should SIX's session have ended and the Student sign in there),
// can't reach the app, refuses every permission and is wiped when it closes.
// Links that leave SIX open in the system browser when they're official. It
// notices the Student pressing something in a class's popup (a request that
// sends, not one that reads, under that class) and closing the window, so the
// app reads SIX again right then.
import { randomUUID } from "node:crypto";
import { BrowserWindow, type Session, session as sessions, shell } from "electron";
import { isOfficialUrl, SIX_WEB } from "../core/links";
import { denyPermissions } from "./security";
import { chromeUserAgent } from "./signin-session";

/** Where the window may go itself: SIX, and Microsoft's sign-in, which SIX sends a Student whose session ended to. */
const STAYS = [/^six\.itb\.ac\.id$/, /(^|\.)microsoftonline\.com$/, /(^|\.)microsoft\.com$/, /(^|\.)live\.com$/, /(^|\.)msauth\.net$/, /(^|\.)msftauth\.net$/];

/** Whether the SIX window goes to `url` itself (else it opens in the system browser, when it's official). */
export function staysInSixWindow(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && STAYS.some((host) => host.test(parsed.hostname));
  } catch {
    return false;
  }
}

/** The click on the class in SIX's timetable that opens its popup; true when the class was there. */
export function openPopupScript(meetingId: string): string {
  if (!/^\d{1,20}$/.test(meetingId)) throw new Error("Not a SIX meeting id");
  return `(() => {
  const link = document.querySelector('a.linkpertemuan[data-url*="/pertemuan/${meetingId}/"]');
  if (!link) return false;
  link.scrollIntoView({ block: "center" });
  link.click();
  return true;
})()`;
}

/**
 * The class a request from the SIX window acts on, when it sends something (a POST, as a form's button
 * does) under that class's meeting on SIX: the Student pressing a button in its popup, "Tandai Hadir" most
 * likely. The popup was never recorded, so it's told by the class it's under, not by its words.
 */
export function pressedMeeting(method: string, url: string): string | null {
  if (/^(GET|HEAD|OPTIONS)$/i.test(method)) return null;
  try {
    const parsed = new URL(url);
    if (`${parsed.protocol}//${parsed.host}` !== SIX_WEB) return null;
    return /\/kelas\/pertemuan\/(\d{1,20})(?:\/|$)/.exec(parsed.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** The engine's SIX session ("khongguan=…") as the cookie to set, or null when it doesn't read as one. */
export function sixCookie(header: string | null): { name: string; value: string } | null {
  const match = header ? /^([A-Za-z0-9_-]+)=([\w%+/=.-]+)$/.exec(header) : null;
  return match ? { name: match[1], value: match[2] } : null;
}

export interface SixWindowOptions {
  /** SIX's timetable on the class's month (`sixTimetableUrl`). */
  url: string;
  meetingId: string;
  /** The engine's SIX session ("khongguan=…"); null: signed out, SIX shows its sign-in. */
  cookie: string | null;
  title: string;
  devTools: boolean;
  /** The Student pressed something in this class's popup, and SIX answered (pressedMeeting). */
  onPressed?(meetingId: string): void;
  /** The window closed: the Student is back from SIX. */
  onClosed?(): void;
}

let open: { window: BrowserWindow; session: Session; show(options: SixWindowOptions): Promise<void> } | null = null;

/** Opens (or brings forward, on this class) the SIX window. */
export function openSixCheckIn(options: SixWindowOptions): Promise<void> {
  if (!options.url.startsWith(`${SIX_WEB}/`)) return Promise.reject(new Error("Only SIX opens in the SIX window"));
  if (open && !open.window.isDestroyed()) return open.show(options);

  // No "persist:" prefix: nothing of it is ever written to disk.
  const session = sessions.fromPartition(`six-${randomUUID()}`, { cache: false });
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
  const leave = (event: { preventDefault(): void }, url: string) => {
    if (staysInSixWindow(url)) return;
    event.preventDefault();
    if (isOfficialUrl(url)) void shell.openExternal(url);
  };
  contents.on("will-navigate", leave);
  contents.on("will-redirect", leave);
  contents.on("will-frame-navigate", (event) => {
    if (!event.isMainFrame) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isOfficialUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.on("page-title-updated", (event) => event.preventDefault());

  // A press counts once SIX has answered it (after a redirect too), so reading the popup again sees what it did.
  const pressing = new Map<number, string>();
  const filter = { urls: [`${SIX_WEB}/*`] };
  session.webRequest.onSendHeaders(filter, (details) => {
    const meetingId = pressedMeeting(details.method, details.url);
    if (meetingId) pressing.set(details.id, meetingId);
  });
  const answered = (details: { id: number; statusCode: number }) => {
    const meetingId = pressing.get(details.id);
    if (meetingId === undefined) return;
    pressing.delete(details.id);
    if (details.statusCode < 400) options.onPressed?.(meetingId);
  };
  session.webRequest.onBeforeRedirect(filter, answered);
  session.webRequest.onCompleted(filter, answered);
  session.webRequest.onErrorOccurred(filter, (details) => pressing.delete(details.id));
  window.once("ready-to-show", () => window.show());

  // The class whose popup opens once SIX's timetable has loaded (null: done, or the Student moved on).
  let pending: string | null = null;
  contents.on("did-finish-load", () => {
    const meetingId = pending;
    if (!meetingId || !new URL(contents.getURL()).pathname.includes("/kelas/jadwal/")) return;
    pending = null;
    void contents.executeJavaScript(openPopupScript(meetingId)).catch(() => undefined);
  });

  const lease = {
    window,
    session,
    async show(next: SixWindowOptions) {
      const cookie = sixCookie(next.cookie);
      if (cookie) await session.cookies.set({ url: `${SIX_WEB}/`, ...cookie, secure: true, httpOnly: true });
      pending = next.meetingId;
      if (!window.isDestroyed()) {
        if (window.isVisible()) window.focus();
        await contents.loadURL(next.url).catch(() => undefined);
      }
    },
  };
  open = lease;
  window.once("closed", () => {
    if (open === lease) open = null;
    options.onClosed?.();
    void Promise.allSettled([session.clearStorageData(), session.clearCache(), session.clearAuthCache()]);
  });
  return lease.show(options);
}

/** Signing out of SIX: the window, and SIX's cookie in it, go. */
export function closeSixWindow(): void {
  if (open && !open.window.isDestroyed()) open.window.destroy();
}
