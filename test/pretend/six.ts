// A pretend SIX for tests. It serves the recorded pages (test/fixtures/six),
// redirects to /login when the session has ended, rate-limits like SIX's
// firewall, and lets a test change a page the way staff would: attendance
// counts, a moved meeting, a released grade, a retake, the study plan, a bill.
import { type CheerioAPI, load } from "cheerio/slim";
import type { HttpRequest, HttpResponse } from "../../src/engine/http/transport";
import { bodyText, exchanges } from "../kit/fixtures";

export const SIX_ORIGIN = "https://six.itb.ac.id";
export const PRETEND_SIX_COOKIE = "khongguan=pretend-six-session";

const LOGIN_HTML = '<!DOCTYPE html><html><head><title>SIX</title></head><body><a href="/login/MS365">Login dengan ITB Account</a></body></html>';
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
  /** Meetings tests added to months other than the recorded one. */
  private readonly addedMeetings: AddedMeeting[] = [];

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
      html.replace(
        new RegExp(`(<td>${code}</td>[\\s\\S]*?)<span title="Hadir \\d+ dari \\d+ pertemuan">[\\d.]+%</span>`),
        `$1<span title="Hadir ${attended} dari ${held} pertemuan">${pct}%</span>`,
      ),
    );
  }

  /** Moves one meeting on the timetable to a new time and room. */
  moveMeeting(meetingId: string, start: string, end: string, room?: string): void {
    this.editPage(/\/kelas\/jadwal\/mahasiswa\/\d+$/, (html) =>
      html.replace(
        new RegExp(`(data-url="[^"]*/pertemuan/${meetingId}/[^"]*"[^>]*>\\s*<small>\\s*)\\d{2}:\\d{2}-\\d{2}:\\d{2}([\\s\\S]*?\\()([^)]*)(\\))`),
        (_, a, b, where, c) => {
          const activity = where.split(" ")[0];
          return `${a}${start}-${end}${b}${room ? `${activity} ${room}` : where}${c}`;
        },
      ),
    );
  }

  /**
   * Puts a meeting on the timetable on a day outside the recorded month. It
   * shows on every month page whose grid holds that day: a month page also
   * shows the edges of the months around it, as SIX's does.
   */
  addMeeting(meeting: AddedMeeting): void {
    this.addedMeetings.push(meeting);
  }

  /** Puts another meeting on the recorded month's timetable, on the day of SIX meeting `beside`, just before it (a lab on a lecture's day). */
  addMeetingBeside(beside: string, meeting: Omit<AddedMeeting, "day">): void {
    this.editPage(/\/kelas\/jadwal\/mahasiswa\/\d+$/, (html) =>
      html.replace(
        new RegExp(`<div title="[^"]*"><a class="linkpertemuan" href="#"\\s+data-kuliah="[^"]*"\\s+data-url="[^"]*/pertemuan/${beside}/`),
        (hit) => `${meetingHtml(meeting)}${hit}`,
      ),
    );
  }

  /** Releases a grade for a course this semester (the Nilai column on the status page). */
  releaseGrade(code: string, grade: string): void {
    this.editPage(/\/statusmhs$/, (html) =>
      html.replace(new RegExp(`(<td>${code}</td>(?:\\s*<td[^>]*>[\\s\\S]*?</td>){4}\\s*<td[^>]*>)\\s*(</td>)`), `$1${grade}$2`),
    );
  }

  // ------------------------------------------------ records: transcript, KRS, bills (#78, #80)

  /**
   * Sets a course's grade for the term it was taken ("" takes it away) on the
   * transcript, and on the curriculum-position page where that attempt is the
   * one it lists.
   */
  gradeCourse(term: string, code: string, grade: string): void {
    this.editRecord(TRANSCRIPT, ($) => transcriptRow($, term, code).children("td").eq(3).text(grade));
    this.editRecord(POSITION, ($) =>
      positionRow($, code)
        .filter((_, tr) => $(tr).children("td").last().text().trim() === term)
        .children("td")
        .eq(4)
        .text(grade),
    );
  }

  /** Puts a transcript row on or off the official transcript (SIX's "Masuk Transkrip" ✓ or ✗). */
  markOnTranscript(term: string, code: string, on: boolean): void {
    const icon = on ? '<i class="fa fa-check fa-fw text-success" aria-hidden="true"></i>' : '<i class="fa fa-times fa-fw text-danger" aria-hidden="true"></i>';
    this.editRecord(TRANSCRIPT, ($) => transcriptRow($, term, code).children("td").eq(5).html(icon));
  }

  /** The Student takes a course again in `term`: a new transcript row without a grade, and the course in progress on the curriculum-position page. */
  retake(code: string, from: string, term: string): void {
    this.editRecord(TRANSCRIPT, ($) => {
      const copy = transcriptRow($, from, code).clone();
      copy.children("td").eq(3).text("");
      copy.children("td").eq(5).html('<i class="fa fa-times fa-fw text-danger" aria-hidden="true"></i>');
      const footer = termHeading($, term).nextAll("tr.warning").first();
      footer.before(copy);
      const sks = Number(copy.children("td").eq(2).text());
      // The term's SKS and the grand total below the last term.
      for (const total of [footer, $("tr.warning").last()])
        total
          .children("th")
          .eq(1)
          .text(String(Number(total.children("th").eq(1).text()) + sks));
    });
    this.editRecord(POSITION, ($) => {
      const row = positionRow($, code);
      row.children("td").eq(4).text("");
      row.children("td").last().text(term);
    });
  }

  /**
   * Sets when a step of the study plan happened ("16 Agu 2026 10.45.42"), or
   * clears it as before the step. SIX's look for a step not taken yet isn't
   * recorded; an empty cell stands in for it.
   */
  krsStep(round: "plan" | "change", label: string, at: string | null): void {
    this.editRecord(KRS, ($) => {
      const rows = $("table").eq(1).find("tr").toArray();
      const split = rows.findIndex((tr) => $(tr).children().length === 1);
      const inRound = round === "plan" ? rows.slice(0, split < 0 ? undefined : split) : rows.slice(split + 1);
      const row = $(inRound.find((tr) => $(tr).children("th").text().trim() === label));
      if (row.length !== 1 || (round === "change" && split < 0)) throw new Error(`No KRS step "${label}" in the ${round} round`);
      if (at) row.attr("class", "success").children("td").html(`\n${at}\n<i class="fa fa-check fa-fw pull-right text-success" aria-hidden="true"></i>`);
      else row.removeAttr("class").children("td").html("");
    });
  }

  /** Takes the change round (URS) off the study plan, as before the Student changed it. */
  dropKrsChange(): void {
    this.editRecord(KRS, ($) => {
      const heading = $("table")
        .eq(1)
        .find("tr")
        .filter((_, tr) => $(tr).children().length === 1);
      heading.nextAll().remove();
      heading.remove();
    });
  }

  /**
   * Changes a course on the study plan: its class, the advisor's approval, or
   * takes it off. SIX's look for a course not approved isn't recorded; an
   * empty cell stands in for it.
   */
  krsCourse(code: string, change: { classNo?: string; approved?: boolean } | "remove"): void {
    this.editRecord(KRS, ($) => {
      const row = $("table")
        .eq(2)
        .find("tr")
        .filter((_, tr) => $(tr).children("td").first().text().trim() === code);
      if (row.length !== 1) throw new Error(`No ${code} on the study plan`);
      const cells = row.children("td");
      if (change === "remove") {
        const total = row.nextAll().last().children("th").first();
        total.text(String(Number(total.text()) - Number(cells.eq(3).text())));
        row.remove();
        return;
      }
      if (change.classNo !== undefined) cells.eq(2).text(change.classNo);
      if (change.approved !== undefined)
        cells.eq(4).html(change.approved ? '<i class="fa fa-check fa-fw text-success" aria-hidden="true" title="Disetujui"></i>' : "");
    });
  }

  /** Sets a term's bill as SIX shows it: Rupiah ("5.400.000" or "-") and the last day to pay ("24 Jan 2027" or "-"). */
  setBill(term: string, bill: { amount: string; paid: string; due: string }): void {
    const [year, n] = term.split("-").map(Number) as [number, number];
    this.editRecord(BILLS, ($) => {
      const yearRow = $("tr.warning").filter((_, tr) => $(tr).text().replace(/\s+/g, " ").trim() === `Tahun ${year} / ${year + 1}`);
      const row = yearRow.nextUntil("tr.warning").filter((_, tr) => $(tr).children("td").first().text().trim().startsWith(`${n}`));
      if (row.length !== 1) throw new Error(`No bill for ${term}`);
      const cells = row.children("td");
      cells.eq(1).text(bill.amount);
      cells.eq(2).text(bill.paid);
      cells.eq(3).text(bill.due);
    });
  }

  private editRecord(path: RegExp, edit: ($: CheerioAPI) => void): void {
    this.editPage(path, (html) => {
      const $ = load(html);
      edit($);
      return $.html();
    });
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

  /** The Student switched SIX to English (its EN switch): the same pages in other words. */
  useEnglish(): void {
    for (const [key, html] of this.pages) this.pages.set(key, inEnglish(html));
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
    let page = this.pages.get(canonical(url.pathname));
    if (!page) return { status: 404, headers: { "content-type": "text/html" }, body: "<h1>Not Found</h1>", url: url.toString() };
    const month = url.searchParams.get("bulan");
    if (month && /\/kelas\/jadwal\/mahasiswa\/\d+$/.test(url.pathname)) page = forMonth(page, month, this.addedMeetings);
    return { status: 200, headers: { "content-type": "text/html; charset=UTF-8" }, body: page, url: url.toString() };
  }

  private toLogin(request: HttpRequest, url: URL): HttpResponse {
    const login = new URL("/login", SIX_ORIGIN).toString();
    if (request.redirect === "manual") return { status: 302, headers: { location: login }, body: "", url: url.toString() };
    return { status: 200, headers: { "content-type": "text/html" }, body: LOGIN_HTML, url: login };
  }
}

const TRANSCRIPT = /\/transkrip\/historis\/\d+$/;
const POSITION = /\/transkrip\/kurikulum\/\d+$/;
const KRS = /\/registrasi\/rencanastudi\/\d+$/;
const BILLS = /\/keuangan$/;

/** A course row's code: the cell's own text, without SIX's curriculum suffix. */
const codeOf = ($: CheerioAPI, tr: Parameters<CheerioAPI>[0]) => $(tr).children("td").first().contents().first().text().trim();

function termHeading($: CheerioAPI, term: string) {
  const [year, n] = term.split("-").map(Number) as [number, number];
  const heading = $("tr.info").filter((_, tr) => $(tr).text().trim() === `Semester ${n} Tahun ${year}/${year + 1}`);
  if (heading.length !== 1) throw new Error(`No term ${term} on the transcript`);
  return heading;
}

function transcriptRow($: CheerioAPI, term: string, code: string) {
  const row = termHeading($, term)
    .nextUntil("tr.warning")
    .filter((_, tr) => codeOf($, tr) === code);
  if (row.length !== 1) throw new Error(`No ${code} in ${term} on the transcript`);
  return row;
}

function positionRow($: CheerioAPI, code: string) {
  const row = $("tr").filter((_, tr) => codeOf($, tr) === code);
  if (row.length !== 1) throw new Error(`No ${code} on the curriculum-position page`);
  return row;
}

// ---------------------------------------------------------------- other months, other words

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY = 86_400_000;

/** A meeting a test puts on a day outside the recorded month. Times are WIB ("08:00"). */
export interface AddedMeeting {
  /** SIX's meeting id. */
  id: string;
  code: string;
  name: string;
  /** "2026-12-03". */
  day: string;
  start: string;
  end: string;
  activity?: string;
  room?: string | null;
}

/** A meeting as SIX's grid shows it in a day. */
const meetingHtml = (m: Omit<AddedMeeting, "day">) => {
  const activity = m.activity ?? "Kuliah";
  return `<div title="${m.name} (${activity})"><a class="linkpertemuan" href="#" data-kuliah="${m.code} ${m.name}" data-url="/app/mahasiswa:18223901+2026-1/kelas/pertemuan/${m.id}/mhs/2021000001"><small>
                                    ${m.start}-${m.end}
                                    <strong>${m.code}</strong>
                                    ${m.name.slice(0, 12)}...
                                    (${activity}${m.room ? ` ${m.room}` : ""})
                                </small></a></div>`;
};

/**
 * The timetable for another month of the term. Only one month was recorded,
 * so another month is that page with its tab active and the month's days in
 * the same grid, with only the meetings tests added (`addMeeting`).
 */
function forMonth(html: string, month: string, added: readonly AddedMeeting[]): string {
  const shown = /<li role="presentation" class="active">\s*<a href="[^"]*bulan=(\d{6})"/.exec(html)?.[1];
  if (shown === month) return html;
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(4)) - 1;
  const first = Date.UTC(year, index, 1);
  const last = Date.UTC(year, index + 1, 0);
  let rows = "";
  let cell = 0;
  for (let monday = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY; monday <= last; monday += 7 * DAY) {
    rows += "<tr>";
    for (let weekday = 0; weekday < 5; weekday++, cell++) {
      const date = new Date(monday + weekday * DAY);
      const name = cell === 0 || date.getUTCDate() === 1 ? `<span class="text-muted">${MONTHS_ID[date.getUTCMonth()]}</span>` : "";
      const meetings = added
        .filter((m) => m.day === date.toISOString().slice(0, 10))
        .map(meetingHtml)
        .join("");
      rows += `<td ><div class="">\n                        ${date.getUTCDate()}\n                        ${name}</div><div style="min-height: 5em;">${meetings}</div></td>`;
    }
    rows += "</tr>";
  }
  return html
    .replace(/<li role="presentation" class="active">/g, '<li role="presentation" >')
    .replace(new RegExp(`<li role="presentation" >(\\s*<a href="[^"]*bulan=${month}")`), '<li role="presentation" class="active">$1')
    .replace(/(<\/thead>)[\s\S]*?(<\/table>)/, `$1${rows}$2`);
}

/** SIX's pages after its language switch. SIX's own English wording was never recorded; the layout is the same. */
function inEnglish(html: string): string {
  const short: Record<string, string> = { Agu: "Aug", Okt: "Oct", Des: "Dec", Mei: "May" };
  const words: [RegExp, string | ((all: string, ...groups: string[]) => string)][] = [
    [/<li class="active"><a href="\/pub\/locale\/id/g, '<li><a href="/pub/locale/id'],
    [/<li><a href="\/pub\/locale\/en/g, '<li class="active"><a href="/pub/locale/en'],
    [/Daftar Kuliah Semester/g, "Courses in Semester"],
    [/Data Mahasiswa/g, "Student Data"],
    [/Status Mahasiswa/g, "Student Status"],
    [/Program Studi/g, "Study Program"],
    [/<th>Nama<\/th>/g, "<th>Name</th>"],
    [/<th>Kode<\/th>/g, "<th>Code</th>"],
    [/<th>Mata Kuliah<\/th>/g, "<th>Course</th>"],
    [/>Kelas<\/th>/g, ">Class</th>"],
    [/>SKS<\/th>/g, ">Credits</th>"],
    [/>Kehadiran<\/th>/g, ">Attendance</th>"],
    [/>Nilai<\/th>/g, ">Grade</th>"],
    [/Hadir (\d+) dari (\d+) pertemuan/g, "Attended $1 of $2 meetings"],
    [/Jadwal Perkuliahan Mahasiswa/g, "Student Class Schedule"],
    [
      />(Senin|Selasa|Rabu|Kamis|Jumat)</g,
      (_, day) => `>${{ Senin: "Monday", Selasa: "Tuesday", Rabu: "Wednesday", Kamis: "Thursday", Jumat: "Friday" }[day]}<`,
    ],
    [/>(Agu|Okt|Des|Mei) (\d{4})</g, (all, month, year) => (short[month] ? `>${short[month]} ${year}<` : all)],
    [
      /<span class="text-muted">(\w+)<\/span>/g,
      (all, month) => (MONTHS_ID.includes(month) ? `<span class="text-muted">${MONTHS_EN[MONTHS_ID.indexOf(month)]}</span>` : all),
    ],
    [/\(Kuliah/g, "(Lecture"],
  ];
  return words.reduce((out, [from, to]) => out.replace(from, to as never), html);
}
