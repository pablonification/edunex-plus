// A pretend for ITB's public pages: the academic calendar feed (the goitb.id
// short link and the file it leads to) and SIX's public catalog
// (/pub/kur2024…, no sign-in). Serves the recorded copies (test/fixtures/itb,
// test/fixtures/pub) and lets a test change, break or take down a page.
import fs from "node:fs";
import path from "node:path";
import type { HttpRequest, HttpResponse } from "../../src/engine/http/transport";
import { FIXTURES_DIR, publicPage } from "../kit/fixtures";

/** Where the short link on SIX's home page leads (recorded 2026-10-11). */
export const CALENDAR_FILE_URL = "https://publik.akademik.itb.ac.id/Kalender-Pendidikan-20260710.ics";
const CALENDAR_HOSTS = new Set(["goitb.id", "publik.akademik.itb.ac.id"]);
const ERROR_HTML = "<!DOCTYPE html><html><body><h1>Internal Server Error</h1></body></html>";

export function calendarFixture(): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, "itb", "kalender-pendidikan.ics"), "utf8");
}

export class PretendItb {
  /** The calendar feed's text; tests may edit it. */
  calendar = calendarFixture();
  /** Catalog pages by path; only the recorded programs (154, 174, 182) exist. */
  readonly pages = new Map<string, string>([
    ["/pub/kur2024", publicPage("kur2024")],
    ...["154", "174", "182"].map((id) => [`/pub/kur2024/${id}`, publicPage(`kur2024-${id}`)] as [string, string]),
  ]);
  /** Paths requested, in order, with the time (SIX must be read at human pace). */
  readonly requests: { at: number; host: string; path: string }[] = [];
  private faults: { path: RegExp; status: number; times: number }[] = [];

  constructor(private readonly now: () => number) {}

  serves(url: URL): boolean {
    return CALENDAR_HOSTS.has(url.host) || (url.host === "six.itb.ac.id" && url.pathname.startsWith("/pub/kur2024"));
  }

  /** A program page that answers this status (SIX answers 500 for a few campus programs). */
  fail(path: RegExp, status: number, times = Number.POSITIVE_INFINITY): void {
    this.faults.push({ path, status, times });
  }

  /** A layout change: SIX renames something the readers rely on. */
  changeLayout(path: string, from: string, to: string): void {
    const page = this.pages.get(path);
    if (page === undefined) throw new Error(`No pretend catalog page ${path}`);
    this.pages.set(path, page.split(from).join(to));
  }

  handle(_request: HttpRequest, url: URL): HttpResponse {
    this.requests.push({ at: this.now(), host: url.host, path: url.pathname });
    const fault = this.faults.find((f) => f.path.test(url.pathname) && f.times > 0);
    if (fault) {
      fault.times -= 1;
      return { status: fault.status, headers: { "content-type": "text/html" }, body: ERROR_HTML, url: url.toString() };
    }
    if (CALENDAR_HOSTS.has(url.host)) {
      // The short link redirects to the current file; the transport follows it.
      if (url.toString() !== CALENDAR_FILE_URL && url.pathname !== "/KalenderPendidikan-ics") return { status: 404, headers: {}, body: "Not Found", url: url.toString() };
      return { status: 200, headers: { "content-type": "text/calendar" }, body: this.calendar, url: CALENDAR_FILE_URL };
    }
    const page = this.pages.get(url.pathname);
    if (page === undefined) return { status: 404, headers: { "content-type": "text/html" }, body: "<h1>Not Found</h1>", url: url.toString() };
    return { status: 200, headers: { "content-type": "text/html; charset=UTF-8" }, body: page, url: url.toString() };
  }
}
