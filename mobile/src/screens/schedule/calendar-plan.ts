// What Jadwal's ⋮ "Kalender HP" keeps in the phone's "Edunex Plus" calendar (./calendar-sync.tsx), worked out without
// touching the phone (test/mobile/calendar-plan.test.ts): the term's classes, exams, deadlines and ITB's days from a
// week ago (a class moved last week is right there too) to the term's end, and a fingerprint of them that changes only
// when an event does, so the calendar is written again exactly when Jadwal changed.

import type { CalendarEvent, DatasetName, DatasetValue, Lang } from "../../../../src/core/models";
import { type PhoneItem, phoneItems } from "../../../../src/core/phone-calendar";
import { dayStart, shiftDay } from "../../../../src/core/schedule";

const DAY = 24 * 3_600_000;

type Get = <N extends DatasetName>(name: N) => DatasetValue<N> | undefined;

export interface CalendarPlan {
  items: ReturnType<typeof phoneItems>;
  /** Changes when, and only when, an event's time, words, place or link does, or one comes or goes. */
  key: string;
  /**
   * Every event the sources still hold, by UID: the calendar's own, and each ITB date whether or not the calendar
   * carries its kind. One the Student added on Kalender akademik stays when Jadwal's switch writes; only an event gone
   * from its source comes out.
   */
  current: ReadonlySet<string>;
  /** The span the calendar mirrors (ms): an event the app put there before in it, gone from the sources, comes out. */
  span: { from: number; until: number };
  /** The span's days, for saying it. */
  days: { from: string; until: string };
}

/**
 * The term's end: its UAS's last day on ITB's calendar, else the end of SIX's last month published, else four weeks
 * ahead of `today`.
 */
export function termEnd(get: Get, today: string): string {
  const uas = get("itb.calendar")
    ?.events.filter((e) => e.kind === "uas" && e.lastDay >= today)
    .sort((a, b) => a.firstDay.localeCompare(b.firstDay))[0]?.lastDay;
  if (uas) return uas;
  const lastMonth = [...(get("six.scheduleMonths") ?? [])].sort().at(-1);
  return lastMonth ? shiftDay(`${shiftDay(`${lastMonth}-28`, 4).slice(0, 7)}-01`, -1) : shiftDay(today, 27);
}

export function calendarPlan(get: Get, lang: Lang, today: string): CalendarPlan {
  const from = shiftDay(today, -7);
  const until = termEnd(get, today);
  const items = phoneItems(get, lang, Date.parse(`${today}T12:00:00+07:00`), { from, until });
  const key = JSON.stringify(items.map((i) => [i.uid, i.start, i.end, i.summary, i.location ?? "", i.description ?? "", i.url ?? ""]));
  const current = new Set([...items.map((item) => item.uid), ...(get("itb.calendar")?.events ?? []).map((event) => itbUid(event.id))]);
  return { items, key, current, span: { from: dayStart(from), until: dayStart(until) + DAY }, days: { from, until } };
}

/** Whether the calendar is written now: on, not already writing or stopped by a problem, and Jadwal changed since. */
export const needsWrite = (sync: { on: boolean; busy: boolean; problem: unknown; written: string | null }, key: string) =>
  sync.on && !sync.busy && !sync.problem && sync.written !== key;

/** An ITB date's UID in the phone's calendar: the one src/core/phone-calendar.ts gives it. */
export const itbUid = (eventId: string) => `itb-${eventId}@edunex-plus`;

/**
 * One date from Kalender akademik as the phone's event: the very one Jadwal's switch writes for it (same UID, same
 * words), so the two never make two events of one date. `note`: "From ITB's academic calendar" in the Student's language.
 */
export function itbItem(event: Pick<CalendarEvent, "id" | "title" | "firstDay" | "lastDay">, note: string): PhoneItem {
  return {
    kind: "itb",
    uid: itbUid(event.id),
    summary: event.title,
    start: dayStart(event.firstDay),
    end: dayStart(event.lastDay) + DAY,
    description: note,
    allDay: true,
    free: true,
  };
}

/**
 * What a screen says about its own events (a date, an exam's sittings) and the phone's calendar:
 * - "none": not there (or only some of them): the offer to add them.
 * - "added": the Student added them on their own: they can come out again.
 * - "kept": Jadwal's "Kalender HP" switch keeps them: they come out when it's turned off, not one by one (the next
 *   write would put them back).
 */
export type Placement = "none" | "added" | "kept";
export function placement(uids: readonly string[], placed: ReadonlyMap<string, "added" | "kept">, switchOn: boolean): Placement {
  if (uids.length === 0 || !uids.every((uid) => placed.has(uid))) return "none";
  return switchOn && uids.some((uid) => placed.get(uid) === "kept") ? "kept" : "added";
}
