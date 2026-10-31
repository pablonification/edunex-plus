// Jadwal's agenda as lines for one list: the weeks of the term around today, each under its own line ("Minggu ke-7 ·
// 5–11 Okt"), then its days that hold something, today, and the weekdays SIX says are free ("Kosong"). An empty
// weekend or a weekday SIX hasn't published is left out, as a phone's calendar agenda leaves empty days out: the
// strip on top still shows every day. Pure: the days in (scheduleDays'), the lines and where each day and week sit out.
import { isEmptyDay, type ScheduleDay, shiftDay, weekStart } from "../../../../src/core/schedule";

export type AgendaLine =
  | { type: "week"; key: string; monday: string; days: readonly string[]; uncovered: boolean }
  | {
      type: "day";
      key: string;
      day: ScheduleDay;
      /** SIX's timetable for the day was read and it holds nothing (a weekday, no holiday): "Kosong". */
      free: boolean;
    };

export interface Agenda {
  lines: AgendaLine[];
  /** The line of each day shown, by date. */
  dayAt: ReadonlyMap<string, number>;
  /** The line of each week, by its Monday. */
  weekAt: ReadonlyMap<string, number>;
}

/** Monday is 0. */
const weekday = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;

/** The days the agenda covers: from three weeks before today's to `until`'s week end (at least six weeks ahead, at most 26). */
export function agendaDays(today: string, until: string | null): string[] {
  const first = shiftDay(weekStart(today), -21);
  const least = shiftDay(weekStart(today), 6 * 7 + 6);
  const most = shiftDay(weekStart(today), 26 * 7 + 6);
  const wanted = until && until > least ? shiftDay(weekStart(until), 6) : least;
  const last = wanted < most ? wanted : most;
  const days: string[] = [];
  for (let day = first; day <= last; day = shiftDay(day, 1)) days.push(day);
  return days;
}

export function agendaLines(plan: readonly ScheduleDay[], { six, months, today }: { six: boolean; months: readonly string[]; today: string }): Agenda {
  const covered = new Set(months);
  const lines: AgendaLine[] = [];
  const dayAt = new Map<string, number>();
  const weekAt = new Map<string, number>();
  for (let i = 0; i < plan.length; i += 7) {
    const week = plan.slice(i, i + 7);
    const monday = week[0]!.day;
    const weekdays = week.filter((d) => weekday(d.day) < 5);
    weekAt.set(monday, lines.length);
    lines.push({
      type: "week",
      key: `week-${monday}`,
      monday,
      days: week.map((d) => d.day),
      // SIX is read but hasn't put out this week's timetable yet: said once, on the week's line.
      uncovered: six && !weekdays.some((d) => covered.has(d.day.slice(0, 7))),
    });
    for (const day of week) {
      const empty = isEmptyDay(day);
      const free = six && empty && !day.holiday && weekday(day.day) < 5 && covered.has(day.day.slice(0, 7));
      if (empty && !free && !day.holiday && day.day !== today) continue;
      dayAt.set(day.day, lines.length);
      lines.push({ type: "day", key: `day-${day.day}`, day, free });
    }
  }
  return { lines, dayAt, weekAt };
}

/** The line to bring up for `day`: its own, else the next day shown after it in its week, else its week's line. */
export function lineOf(agenda: Agenda, day: string): number | undefined {
  const own = agenda.dayAt.get(day);
  if (own !== undefined) return own;
  const monday = weekStart(day);
  for (let next = shiftDay(day, 1); weekStart(next) === monday; next = shiftDay(next, 1)) {
    const at = agenda.dayAt.get(next);
    if (at !== undefined) return at;
  }
  return agenda.weekAt.get(monday);
}

/** The day a line stands for at the top of the list: a day's own date, a week's Monday. */
export const dayOfLine = (line: AgendaLine) => (line.type === "day" ? line.day.day : line.monday);
