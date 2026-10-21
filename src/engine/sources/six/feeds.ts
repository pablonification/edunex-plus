// SIX's feeds (#76): the student status page (hourly; also the liveness
// check) for who the Student is and this term's courses, and the timetable
// (on launch and twice a day) for this month's and next month's meetings.
import type { ClassSession } from "../../../core/models";
import type { SourceContext } from "../source";
import type { SixClient } from "./client";
import type { SixPages } from "./pages";
import { nextMonth, readTimetable, wibMonth } from "./timetable";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function registerSixFeeds(context: SourceContext, client: SixClient): void {
  context.feed({
    name: "six.status",
    every: HOUR,
    jitter: 5 * MINUTE,
    async run(current) {
      const { student, courses } = await client.status();
      if (!current()) return;
      // A different Student signed in to SIX on this computer: nothing of the last one may show.
      const previous = context.get("six.student");
      if (previous && previous.nim !== student.nim) await context.remove("six.");
      await context.set("six.student", student);
      await context.set("six.courses", courses);
    },
  });
  context.feed({
    name: "six.schedule",
    every: 12 * HOUR,
    jitter: 30 * MINUTE,
    async run() {
      const { sessions, months } = await readSchedule(client, context.clock.now());
      // The meetings first: for a moment the months may lag behind them, never run ahead (a month
      // counted as read before its meetings arrive would call them all missing from SIX).
      await context.set("six.schedule", sessions);
      await context.set("six.scheduleMonths", months);
      // A class on now gets its first look for "Tandai Hadir" at once (after a sign-in, the timetable comes after that feed's first run).
      void context.runNow((feed) => feed === "six.checkIn");
    },
  });
}

/**
 * This month's and next month's meetings (the next only when SIX offers it
 * for this term), and the months whose own page was read ("2026-10").
 */
export async function readSchedule(pages: SixPages, now: number): Promise<{ sessions: ClassSession[]; months: string[] }> {
  const { nim, studentId, term } = await pages.who();
  const base = `/app/mahasiswa:${nim}+${term}/kelas/jadwal/mahasiswa/${studentId}`;
  const thisMonth = wibMonth(now);
  const first = readTimetable(await pages.page(`${base}?bulan=${thisMonth}`), thisMonth);
  const sessions = [...first.sessions];
  const months = [first.month];
  const following = nextMonth(first.month);
  if (first.months.includes(following)) {
    const second = readTimetable(await pages.page(`${base}?bulan=${following}`), following);
    sessions.push(...second.sessions);
    months.push(second.month);
  }
  // The grid shows the edges of the months around it, so a meeting can appear on both pages.
  const byId = new Map(sessions.map((session) => [session.id, session]));
  return {
    sessions: [...byId.values()].sort((a, b) => a.start - b.start || a.courseCode.localeCompare(b.courseCode)),
    months: months.map((month) => `${month.slice(0, 4)}-${month.slice(4)}`),
  };
}
