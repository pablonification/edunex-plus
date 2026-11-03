// SIX in a window of the app (./site-window.ts): any SIX page the app links
// to, signed in with the session the engine keeps. For "Tandai Hadir" it opens
// SIX's own timetable on the class's month, and the class's popup the way a
// click on the class opens it, so the Student only has to press SIX's button.
// The app never presses it. One window at a time; it holds only SIX's cookie
// (and Microsoft's, should SIX's session have ended and the Student sign in
// there). Official links that leave SIX open in the system browser. It
// notices the Student pressing something in a class's popup (a request that
// sends, not one that reads, under that class) and closing the window, so the
// app reads SIX again right then.
import { isOfficialUrl, SIX_WEB } from "../core/links";
import { createSiteWindow, MICROSOFT_SIGN_IN, onHosts, onSite, type SiteWindow } from "./site-window";

/** Where the window may go itself: SIX, and Microsoft's sign-in, which SIX sends a Student whose session ended to. */
const STAYS = [/^six\.itb\.ac\.id$/, ...MICROSOFT_SIGN_IN];

/** Whether the SIX window goes to `url` itself (else it opens in the system browser, when it's official). */
export function staysInSixWindow(url: string): boolean {
  return onHosts(url, STAYS);
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
  /** The SIX page to open: for "Tandai Hadir", SIX's timetable on the class's month (`sixTimetableUrl`). */
  url: string;
  /** "Tandai Hadir": the class whose popup opens once the timetable has loaded. */
  meetingId?: string;
  /** The engine's SIX session ("khongguan=…"); null: signed out, SIX shows its sign-in. */
  cookie: string | null;
  title: string;
  devTools: boolean;
  /** The Student pressed something in this class's popup, and SIX answered (pressedMeeting). */
  onPressed?(meetingId: string): void;
  /** The window closed: the Student is back from SIX. */
  onClosed?(): void;
}

let open: { site: SiteWindow; show(options: SixWindowOptions): Promise<void> } | null = null;

/** Opens (or brings forward, on this page) the SIX window. */
export function openSixWindow(options: SixWindowOptions): Promise<void> {
  if (!onSite(options.url, SIX_WEB)) return Promise.reject(new Error("Only SIX opens in the SIX window"));
  if (open && !open.site.window.isDestroyed()) return open.show(options);

  const site = createSiteWindow({ title: options.title, devTools: options.devTools, stays: staysInSixWindow, opensOutside: isOfficialUrl }, () => {
    if (open === lease) open = null;
    options.onClosed?.();
  });
  const { session, contents } = site;

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

  // The class whose popup opens once SIX's timetable has loaded (null: done, none asked, or the Student moved on).
  let pending: string | null = null;
  contents.on("did-finish-load", () => {
    const meetingId = pending;
    if (!meetingId || !new URL(contents.getURL()).pathname.includes("/kelas/jadwal/")) return;
    pending = null;
    void contents.executeJavaScript(openPopupScript(meetingId)).catch(() => undefined);
  });

  const lease = {
    site,
    async show(next: SixWindowOptions) {
      const cookie = sixCookie(next.cookie);
      if (cookie) await session.cookies.set({ url: `${SIX_WEB}/`, ...cookie, secure: true, httpOnly: true });
      pending = next.meetingId ?? null;
      if (!site.window.isDestroyed()) site.window.setTitle(next.title);
      await site.go(next.url);
    },
  };
  open = lease;
  return lease.show(options);
}

/** Signing out of SIX: the window, and SIX's cookie in it, go. */
export function closeSixWindow(): void {
  if (open && !open.site.window.isDestroyed()) open.site.window.destroy();
}
