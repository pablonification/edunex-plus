// How soon a Tugas row runs out, by the calendar (./list.tsx, ./rows.tsx, ./exam-rows.tsx): no React Native here, tested
// in Node. "Hari ini" is the day, not the next 24 hours: 23:59 tonight and 08:00 tomorrow are a day apart.

const DAY = 86_400_000;

const startOfDay = (at: number) => {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Days from today to `at`'s day: 0 today, 1 tomorrow, negative before today. */
export const daysAway = (now: number, at: number): number => Math.round((startOfDay(at) - startOfDay(now)) / DAY);

/** Runs out later today (not already past). */
export const dueToday = (now: number, at: number | null): boolean => at !== null && at >= now && daysAway(now, at) === 0;

/** The days a row shows its time left as a pill: today, tomorrow, and the two days after. */
export const SOON_DAYS = 3;

/**
 * A row's time left when it's soon, as the pill says it: "today" (red), "tomorrow" or "in N days" (amber), up to
 * SOON_DAYS away. Null when past (the late pill says that) or further off (the date alone, quiet).
 */
export function soonness(now: number, at: number): { days: number; tone: "red" | "amber" } | null {
  if (at < now) return null;
  const days = daysAway(now, at);
  if (days > SOON_DAYS) return null;
  return { days, tone: days === 0 ? "red" : "amber" };
}
