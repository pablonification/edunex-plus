// Addresses of official pages the app opens in the browser, and the two rules
// for opening a link: the app's own links go only to official pages; a link a
// lecturer wrote (in a note, a Task, an announcement) may go to any web page,
// in the system browser, as Edunex itself opens it.
import type { AcademicCalendar } from "./models";

export const EDUNEX_WEB = "https://edunex.itb.ac.id";

export const edunexCourseUrl = (courseId: number) => `${EDUNEX_WEB}/courses/${courseId}`;

export const SIX_WEB = "https://six.itb.ac.id";

/** SIX's student status page: this term's courses with SKS and attendance. */
export const sixStatusUrl = (nim: string) => `${SIX_WEB}/app/mahasiswa:${nim}/statusmhs`;

/** ITB's academic calendar as a feed, the short link on SIX's home page ("Kalender Pendidikan ITB (iCalendar)"); it redirects to the current file. */
export const ITB_CALENDAR_FEED = "https://goitb.id/KalenderPendidikan-ics";

/**
 * ITB's academic calendar to read, as SIX's home page links it: the document
 * of the term's academic year ("Kalender Pendidikan ITB 2026-2027", `year`
 * 2026) once the calendar read has that year's exam weeks (ITB publishes the
 * two together; a year not published yet has no document to open). Else
 * SIX's home page, which lists every year's.
 */
export function itbCalendar(term: string | null, calendar: AcademicCalendar | undefined): { url: string; year: number | null } {
  const year = term ? /^(\d{4})-[123]$/.exec(term)?.[1] : undefined;
  const published = calendar?.events.some((e) => (e.kind === "uts" || e.kind === "uas") && e.term?.startsWith(`${year}-`));
  return year && published ? { url: `https://goitb.id/Kalender-Pendidikan-${year}`, year: Number(year) } : { url: SIX_WEB, year: null };
}

/** Hosts the app's own links may open in the browser. */
export const OFFICIAL_HOSTS = [
  /(^|\.)itb\.ac\.id$/,
  // ITB's own short links, as SIX's home page uses them for the academic calendar.
  /^goitb\.id$/,
  /^api-edunex\.cognisia\.id$/,
  /^teams\.microsoft\.com$/,
  /^teams\.live\.com$/,
  /(^|\.)zoom\.us$/,
  /^meet\.google\.com$/,
  /(^|\.)webex\.com$/,
];

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Edunex, SIX, ITB and the online-class services: the only pages the app's own links open. */
export function isOfficialUrl(url: string): boolean {
  const parsed = parse(url);
  return parsed?.protocol === "https:" && OFFICIAL_HOSTS.some((host) => host.test(parsed.hostname));
}

/**
 * A web page a lecturer linked to: http or https with a host, and never a
 * name or password inside the address (a classic way to disguise where a
 * link really goes). Other schemes (mailto:, file:, javascript:…) never open.
 */
export function isWebLink(url: string): boolean {
  const parsed = parse(url);
  return parsed !== null && (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname !== "" && !parsed.username && !parsed.password;
}

/** Where a link goes, as the Student reads it: "docs.google.com". */
export function linkHost(url: string): string | null {
  const parsed = parse(url);
  return parsed?.hostname ? parsed.hostname.replace(/^www\./, "") : null;
}

/** Edunex's storage, where lecturers' uploads and Students' answers live: its Azure accounts and its API. */
const STORAGE_HOSTS = [/\.blob\.core\.windows\.net$/, /^api-edunex\.cognisia\.id$/];

/** A file on Edunex's storage, which the app may read in to show (a picture in a note). */
export function isStorageFile(url: string): boolean {
  const parsed = parse(url);
  return parsed?.protocol === "https:" && !parsed.username && !parsed.password && STORAGE_HOSTS.some((host) => host.test(parsed.hostname));
}
