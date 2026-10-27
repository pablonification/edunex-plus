// SIX's feeds (#76): the student status page (hourly; also the liveness
// check) for who the Student is and this term's courses, with the history of
// each course's attendance count and what it did after each class, and the timetable
// (on launch and twice a day) for this month's and next month's meetings. The
// status page is what the session rests on: SIX changing who the Student is or
// the term is all of SIX changing, but its course table changing is said where
// the courses are listed (FeedSpec.part, ADR 0012), as the timetable changing is
// where it's shown (FeedSpec.shows), and a meeting on it the app can't read marks
// its day (ADR 0013).
import { appendCount, classResults } from "../../../core/attendance";
import type { ClassSession, DatasetValue, SixCourse, SkippedRow, UnreadSession } from "../../../core/models";
import { PartChanged } from "../../errors";
import { Skipped } from "../skipped";
import type { SourceContext } from "../source";
import type { SixClient } from "./client";
import type { SixPages } from "./pages";
import { nextMonth, readMonth, wibMonth } from "./timetable";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function registerSixFeeds(context: SourceContext, client: SixClient): void {
  context.feed({
    name: "six.status",
    every: HOUR,
    jitter: 5 * MINUTE,
    part: ["six.courses"],
    async run(current) {
      const { student, courses, tableChanged, skipped } = await client.status();
      if (!current()) return;
      // A different Student signed in to SIX on this computer: nothing of the last one may show.
      const previous = context.get("six.student");
      if (previous && previous.nim !== student.nim) await context.remove("six.");
      // The course table alone changed: the last courses stay, and the screens listing them say so. Last term's aren't this term's.
      if (!courses && previous && previous.term !== student.term) await context.remove("six.courses");
      await context.set("six.student", student);
      if (!courses) throw new PartChanged(tableChanged.message);
      await saveCourses(context, courses, skipped);
    },
  });
  context.feed({
    name: "six.schedule",
    every: 12 * HOUR,
    jitter: 30 * MINUTE,
    shows: ["six.schedule", "six.scheduleMonths", "six.scheduleUnread"],
    async run() {
      const { sessions, months, unread, skipped } = await readSchedule(client, context.clock.now());
      // The days with a meeting it couldn't read, then the meetings, then the months: for a moment a
      // day may look busier than it is, never free, and the months may lag behind the meetings, never
      // run ahead (a month counted as read before its meetings arrive would call them all missing from SIX).
      await context.set("six.scheduleUnread", unread);
      await context.set("six.schedule", sessions, skipped);
      await context.set("six.scheduleMonths", months);
      // A class on now gets its first look for "Tandai Hadir" at once (after a sign-in, the timetable comes after that feed's first run).
      void context.runNow((feed) => feed === "six.checkIn");
    },
  });
}

/**
 * This term's courses as SIX just showed them, after the count's history and
 * what it did after each class: whoever hears of the new count (the alerts,
 * the screens) finds those already up to date.
 */
export async function saveCourses(
  context: Pick<SourceContext, "clock" | "get" | "set">,
  courses: SixCourse[],
  skipped: readonly SkippedRow[] = [],
): Promise<void> {
  const now = context.clock.now();
  const log = appendCount(context.get("six.countLog") ?? {}, courses, now);
  await context.set("six.countLog", log as DatasetValue<"six.countLog">);
  const results = classResults(context.get("six.classResults") ?? {}, log, context.get("six.schedule") ?? [], now, now);
  await context.set("six.classResults", results as DatasetValue<"six.classResults">);
  await context.set("six.courses", courses, skipped);
}

/**
 * This month's and next month's meetings (the next only when SIX offers it
 * for this term), the months whose own page was read ("2026-10"), and the
 * meetings it couldn't read, by day, with their rows as noted (`skipped`).
 */
export async function readSchedule(
  pages: SixPages,
  now: number,
): Promise<{ sessions: ClassSession[]; months: string[]; unread: UnreadSession[]; skipped: SkippedRow[] }> {
  const skipped = new Skipped();
  const { nim, studentId, term } = await pages.who();
  const base = `/app/mahasiswa:${nim}+${term}/kelas/jadwal/mahasiswa/${studentId}`;
  const thisMonth = wibMonth(now);
  // The meetings of both months as one list: a month with one meeting it can't read isn't the page changing.
  const list = skipped.list();
  const first = readMonth(await pages.page(`${base}?bulan=${thisMonth}`), thisMonth, list);
  const sessions = [...first.sessions];
  const unread = [...first.unread];
  const months = [first.month];
  const following = nextMonth(first.month);
  if (first.months.includes(following)) {
    const second = readMonth(await pages.page(`${base}?bulan=${following}`), following, list);
    sessions.push(...second.sessions);
    unread.push(...second.unread);
    months.push(second.month);
  }
  list.done();
  // The grid shows the edges of the months around it, so a meeting can appear on both pages, read or not.
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const once = <T>(items: T[], key: (item: T) => string) => [...new Map(items.map((item) => [key(item), item])).values()];
  return {
    sessions: [...byId.values()].sort((a, b) => a.start - b.start || a.courseCode.localeCompare(b.courseCode)),
    months: months.map((month) => `${month.slice(0, 4)}-${month.slice(4)}`),
    unread: once(unread, (one) => `${one.day}|${one.row}`).sort((a, b) => a.day.localeCompare(b.day)),
    skipped: once(skipped.rows, (row) => `${row.row}|${row.why}`),
  };
}
