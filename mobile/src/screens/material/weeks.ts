// The one rule for "Minggu ini" on material: calendar weeks, Monday to Sunday in WIB, the way Tugas groups its weeks
// (weekStart, src/core/schedule.ts). Materi's "Baru" and a course's "Materi minggu ini" both call this, so they agree.
// No React and nothing from the course's screens here, so either side can import it.
import { wibDay } from "../../../../src/core/course-meetings";
import { weekOffset } from "../../../../src/core/schedule";

/** How many calendar weeks before the week holding `now` this was posted: 0 this week, 1 last week. Null: no date, or ahead of now. */
export function weeksAgo(at: number | null, now: number): number | null {
  if (at === null || at > now) return null;
  return -weekOffset(now, wibDay(at));
}

/** Posted in the calendar week holding `now` (and not ahead of it). */
export const postedThisWeek = (at: number | null, now: number): boolean => weeksAgo(at, now) === 0;
