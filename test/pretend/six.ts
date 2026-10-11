// A pretend SIX for tests. It serves the recorded pages (test/fixtures/six),
// redirects to /login when the session has ended, rate-limits like SIX's
// firewall, and lets a test change a page the way staff would: attendance
// counts, a moved meeting, a released grade.
import type { HttpRequest, HttpResponse } from "../../src/engine/http/transport";
import { bodyText, exchanges } from "../kit/fixtures";

export const SIX_ORIGIN = "https://six.itb.ac.id";
export const PRETEND_SIX_COOKIE = "khongguan=pretend-six-session";

const LOGIN_HTML = "<!DOCTYPE html><html><head><title>SIX</title></head><body><a href=\"/login/MS365\">Login dengan ITB Account</a></body></html>";
const MAINTENANCE_HTML = "<!DOCTYPE html><html><body><h1>Service Unavailable</h1></body></html>";

/** "/app/mahasiswa:18223901+2026-1/kelas" and "/app/mahasiswa:18223901/kelas" are the same page. */
const canonical = (path: string) => path.replace(/^(\/app\/mahasiswa:\d+)\+\d{4}-\d/, "$1");

export class PretendSix {
  /** Recorded pages by canonical path; tests may edit them. */
  readonly pages = new Map<string, string>();
  sessionValid = true;
  private rateLimited = 0;
  private faults: { path: RegExp; status: number; times: number }[] = [];
  /** Paths requested, in order (SIX must be read at human pace). */
  readonly requests: { at: number; path: string }[] = [];

  constructor(private readonly now: () => number) {
    for (const ex of exchanges("six")) this.pages.set(canonical(ex.path), bodyText("six", ex.file));
  }

  /** The recorded page whose path matches. */
  page(path: RegExp): string {
    for (const [key, html] of this.pages) if (path.test(key)) return html;
    throw new Error(`No recorded SIX page matches ${path}`);
  }

  /** Changes a page the way SIX staff or the Student's actions would. */
  editPage(path: RegExp, edit: (html: string) => string): void {
    for (const [key, html] of this.pages) if (path.test(key)) this.pages.set(key, edit(html));
  }

  // ------------------------------------------------ acting as SIX staff

  /** Sets a course's attendance count on the status page ("Hadir X dari Y pertemuan"). */
  setAttendance(code: string, attended: number, held: number): void {
    const pct = held ? ((attended / held) * 100).toFixed(2) : "0.00";
    this.editPage(/\/statusmhs$/, (html) =>
      html.replace(new RegExp(`(<td>${code}</td>[\\s\\S]*?)<span title="Hadir \\d+ dari \\d+ pertemuan">[\\d.]+%</span>`), `$1<span title="Hadir ${attended} dari ${held} pertemuan">${pct}%</span>`),
    );
  }

  /** Moves one meeting on the timetable to a new time and room. */
  moveMeeting(meetingId: string, start: string, end: string, room?: string): void {
    this.editPage(/\/kelas\/jadwal\/mahasiswa\/\d+$/, (html) =>
      html.replace(new RegExp(`(data-url="[^"]*/pertemuan/${meetingId}/[^"]*"[^>]*>\\s*<small>\\s*)\\d{2}:\\d{2}-\\d{2}:\\d{2}([\\s\\S]*?\\()([^)]*)(\\))`), (_, a, b, where, c) => {
        const activity = where.split(" ")[0];
        return `${a}${start}-${end}${b}${room ? `${activity} ${room}` : where}${c}`;
      }),
    );
  }

  /** Releases a grade for a course this semester (the Nilai column on the status page). */
  releaseGrade(code: string, grade: string): void {
    this.editPage(/\/statusmhs$/, (html) =>
      html.replace(new RegExp(`(<td>${code}</td>(?:\\s*<td[^>]*>[\\s\\S]*?</td>){4}\\s*<td[^>]*>)\\s*(</td>)`), `$1${grade}$2`),
    );
  }

  // ------------------------------------------------ the outside world

  expireSession(): void {
    this.sessionValid = false;
  }

  /** The next `count` requests get SIX's firewall answer (429). */
  rateLimit(count = 1): void {
    this.rateLimited += count;
  }

  fail(path: RegExp, status: number, times = Number.POSITIVE_INFINITY): void {
    this.faults.push({ path, status, times });
  }

  /** A layout change: SIX renames a table header the readers rely on. */
  changeLayout(path: RegExp, from: string, to: string): void {
    this.editPage(path, (html) => html.split(from).join(to));
  }

  // ------------------------------------------------ answering requests

  handle(request: HttpRequest, url: URL): HttpResponse {
    this.requests.push({ at: this.now(), path: url.pathname });
    if (this.rateLimited > 0) {
      this.rateLimited -= 1;
      return { status: 429, headers: { "content-type": "text/html", "retry-after": "900" }, body: "Too Many Requests", url: url.toString() };
    }
    const fault = this.faults.find((f) => f.path.test(url.pathname) && f.times > 0);
    if (fault) {
      fault.times -= 1;
      return { status: fault.status, headers: { "content-type": "text/html" }, body: MAINTENANCE_HTML, url: url.toString() };
    }
    if (url.pathname === "/login" || url.pathname.startsWith("/pub/")) {
      return { status: 200, headers: { "content-type": "text/html" }, body: LOGIN_HTML, url: url.toString() };
    }
    const cookie = request.headers?.cookie ?? request.headers?.Cookie ?? "";
    if (!this.sessionValid || !cookie.includes(PRETEND_SIX_COOKIE)) return this.toLogin(request, url);
    const page = this.pages.get(canonical(url.pathname));
    if (!page) return { status: 404, headers: { "content-type": "text/html" }, body: "<h1>Not Found</h1>", url: url.toString() };
    return { status: 200, headers: { "content-type": "text/html; charset=UTF-8" }, body: page, url: url.toString() };
  }

  private toLogin(request: HttpRequest, url: URL): HttpResponse {
    const login = new URL("/login", SIX_ORIGIN).toString();
    if (request.redirect === "manual") return { status: 302, headers: { location: login }, body: "", url: url.toString() };
    return { status: 200, headers: { "content-type": "text/html" }, body: LOGIN_HTML, url: login };
  }
}
