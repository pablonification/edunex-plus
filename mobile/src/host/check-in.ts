// "Tandai Hadir" on the phone: the desktop's six.openCheckIn (src/desktop/handlers/six.ts) and its
// SIX window (src/desktop/six-window.ts). Opening it checks the class is on SIX's timetable the app
// read, then shows the check-in page (app/check-in/[meetingId].tsx): SIX's timetable on the class's
// month in a web view, signed in with the session the engine keeps, the class's popup opened the
// way a click on the class opens it, so the Student only has to press SIX's button. The app never
// presses it. The demo opens nothing: its SIX is pretend, and the real one isn't the demo's to visit.
//
// The helpers below are copied from src/desktop/six-window.ts, which needs Electron and Node.
import { router } from "expo-router";
import { SIX_WEB, sixTimetableUrl } from "../../../src/core/links";
import type { DatasetName, DatasetValue } from "../../../src/core/models";
import type { Engine } from "../../../src/engine/engine";
import { SixSession } from "../../../src/engine/sources/six";
import { setCookie } from "../../modules/web-cookies";
import type { HostUi } from "./handlers";

/** Where the page may go itself: SIX, and Microsoft's sign-in, which SIX sends a Student whose session ended to. */
const STAYS = [/^six\.itb\.ac\.id$/, /(^|\.)microsoftonline\.com$/, /(^|\.)microsoft\.com$/, /(^|\.)live\.com$/, /(^|\.)msauth\.net$/, /(^|\.)msftauth\.net$/];

/** Whether the check-in page goes to `url` itself (else it opens in the phone's browser, when it's official). */
export function staysInSixPage(url: string): boolean {
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

/** The engine's SIX session ("khongguan=…") as the cookie to set, or null when it doesn't read as one. */
export function sixCookie(header: string | null): { name: string; value: string } | null {
  const match = header ? /^([A-Za-z0-9_-]+)=([\w%+/=.-]+)$/.exec(header) : null;
  return match ? { name: match[1]!, value: match[2]! } : null;
}

type Reader = Pick<Engine, "snapshot" | "session">;

function dataset<N extends DatasetName>(engine: Reader, name: N): DatasetValue<N> | undefined {
  return engine.snapshot().datasets.find((d) => d.name === name)?.value as DatasetValue<N> | undefined;
}

/** SIX's timetable on the class's month, or null when the class (or the Student) isn't in what the app read. */
export function checkInUrl(engine: Reader, meetingId: string): string | null {
  const student = dataset(engine, "six.student");
  const session = dataset(engine, "six.schedule")?.find((s) => s.id === meetingId);
  return student && session ? sixTimetableUrl(student, session.start) : null;
}

/**
 * `HostUi.openCheckIn`: SIX's timetable in the app, on the class when it's there (else on its month), signed in.
 * Never the phone's browser, where the Student isn't signed in to SIX. The demo's page says what the real one shows.
 */
export function checkInOpener(): HostUi["openCheckIn"] {
  return async (meetingId) => {
    router.push(`/check-in/${encodeURIComponent(meetingId)}` as never);
  };
}

/** `HostUi.openPage`: one of Edunex's or SIX's pages in the app, signed in (./signed-pages.ts). */
export function pageOpener(): HostUi["openPage"] {
  return async (url) => {
    router.push({ pathname: "/web", params: { url } } as never);
  };
}

/**
 * Before the page loads: the engine's SIX session put into the web views' cookie store, so SIX opens
 * signed in. Signed out (no session), SIX shows its own sign-in. True when a session was set.
 */
export async function prepareCheckIn(engine: Reader): Promise<boolean> {
  const saved = SixSession.safeParse(engine.session("six"));
  const cookie = sixCookie(saved.success ? saved.data.cookie : null);
  if (!cookie) return false;
  await setCookie(`${SIX_WEB}/`, `${cookie.name}=${cookie.value}; Path=/; Secure; HttpOnly`);
  return true;
}
