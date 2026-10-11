// SIX's month timetable (/app/mahasiswa:{nim}+{term}/kelas/jadwal/mahasiswa/{id}?bulan=YYYYMM):
// a Monday-first grid of days, each with its meetings (SIX's meeting id,
// time, course, activity and room). Times are WIB.
import type { ClassSession } from "../../../core/models";
import { changed, clean, COURSE_CODE, type Element, type Nodes, parse } from "./html";

export interface TimetablePage {
  /** The month shown, "202610". */
  month: string;
  /** The months SIX offers for this term, from its tabs. */
  months: string[];
  sessions: ClassSession[];
}

const PAGE = "jadwal";
const WIB = 7 * 3_600_000;
const DAY = 86_400_000;
const MONTH = /[?&]bulan=(\d{4})(\d{2})\b/;
const TIME_RANGE = /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/g;

/** "202610" for a moment, in WIB. */
export function wibMonth(ms: number): string {
  const date = new Date(ms + WIB);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The month after "202612": "202701". */
export function nextMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(4));
  return index === 12 ? `${year + 1}01` : `${year}${String(index + 1).padStart(2, "0")}`;
}

/** Reads one month page. `requested` is the month asked for, used only when SIX doesn't mark one. */
export function readTimetable(html: string, requested: string): TimetablePage {
  const $ = parse(html);
  const tabMonth = (el: Element) => {
    const match = MONTH.exec(clean($(el).attr("href") ?? ""));
    return match ? `${match[1]}${match[2]}` : null;
  };
  const months = $("ul.nav-tabs a[href]")
    .toArray()
    .map(tabMonth)
    .filter((month): month is string => month !== null);
  const month = $("ul.nav-tabs li.active a[href]").toArray().map(tabMonth).find(Boolean) ?? requested;

  const grid = $("table")
    .filter((_, table) => $(table).find("td").length > 0 && $(table).find("thead th").length >= 5)
    .first();
  const rows = grid
    .find("tr")
    .toArray()
    .filter((tr) => $(tr).children("td").length > 0);
  if (!rows.length) throw changed(PAGE, "the month grid is missing");

  // The grid starts on the Monday of the month's first week, which can still be in the month before.
  let year = Number(month.slice(0, 4));
  let index = Number(month.slice(4)) - 1;
  let previousDay = 0;
  let inMonth = false;
  const sessions: ClassSession[] = [];
  for (const tr of rows) {
    $(tr)
      .children("td")
      .each((column, td) => {
        const day = Number(/^(\d{1,2})\b/.exec(clean($(td).children("div").first().text()))?.[1] ?? Number.NaN);
        if (!(day >= 1 && day <= 31)) throw changed(PAGE, "a day without its date");
        if (previousDay === 0 && day > 7) index -= 1;
        else if (day < previousDay) index += 1;
        previousDay = day;
        const date = Date.UTC(year, index, day);
        const shown = new Date(date);
        if (shown.getUTCDate() !== day || shown.getUTCDay() !== (column + 1) % 7) throw changed(PAGE, "the days don't line up with the weekdays");
        year = shown.getUTCFullYear();
        index = shown.getUTCMonth();
        if (`${year}${String(index + 1).padStart(2, "0")}` === month) inMonth = true;
        const meetings = $(td).find("a[data-url*='/pertemuan/']").toArray();
        for (const link of meetings) sessions.push(readMeeting($(link), date));
        // Every time shown in a day must be a meeting the app read: a day it can't read is never shown as free.
        const times = clean($(td).children("div").slice(1).text()).match(TIME_RANGE) ?? [];
        if (times.length !== meetings.length) throw changed(PAGE, "a day with meetings the app can't read");
      });
  }
  if (!inMonth) throw changed(PAGE, "the grid doesn't show the month it names");
  return { month, months, sessions };
}

function readMeeting(link: Nodes, day: number): ClassSession {
  const id = /\/pertemuan\/(\d+)\//.exec(link.attr("data-url") ?? "")?.[1];
  const course = /^([A-Z]{2}\d{4})\s+(\S.*)$/.exec(clean(link.attr("data-kuliah") ?? ""));
  const text = clean(link.find("small").first().text() || link.text());
  const time = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(text);
  // The activity closes the meeting's title: "Komunikasi Pemasaran (UTS)".
  const activity = /\(([^()]+)\)$/.exec(clean(link.parent().attr("title") ?? ""))?.[1]?.trim();
  if (!id || !course || !COURSE_CODE.test(course[1]) || !time || !activity) throw changed(PAGE, "a meeting without its id, course, time or activity");
  const shownCode = clean(link.find("strong").first().text());
  if (shownCode && shownCode !== course[1]) throw changed(PAGE, "a meeting's course codes disagree");

  // The room follows the activity at the end of the line: "(Kuliah R.SG PWK LT.6)", or "(Kuliah)" without one.
  const opens = text.lastIndexOf(`(${activity}`);
  const after = text.slice(opens + activity.length + 1);
  if (opens < 0 || !/^(\s[^]*)?\)$/.test(after)) throw changed(PAGE, "a meeting without its activity and room");
  const room = clean(after.slice(0, -1)) || null;

  const [hourStart, minuteStart, hourEnd, minuteEnd] = time.slice(1).map(Number);
  if (hourStart > 23 || hourEnd > 24 || minuteStart > 59 || minuteEnd > 59) throw changed(PAGE, "a meeting at an impossible time");
  const start = day + (hourStart * 60 + minuteStart) * 60_000 - WIB;
  let end = day + (hourEnd * 60 + minuteEnd) * 60_000 - WIB;
  if (end < start) end += DAY;
  return { id, courseCode: course[1], courseName: course[2], start, end, activity, room };
}
