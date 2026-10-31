// Jadwal and the minute's tick. Every date on screen hangs on the app's minute clock (useNow, useFormat), so a
// screen that reads it at the top draws everything again once a minute: Jadwal's whole week did, 250–834 ms of a
// blocked JS thread (mobile/qa/shell-notes.md). Here a part asks only for what it shows of the time (today's date,
// whether its class is over or on now), and draws again only when that changes.
import { useMemo, useRef, useSyncExternalStore } from "react";
import { useClock, useLang } from "../../../../src/app/i18n";
import { wibDay } from "../../../../src/core/course-meetings";
import { makeFormat } from "../../../../src/core/format";
import { dayNoon } from "../../../../src/core/schedule";

/** `select` of the clock's now, read again at each tick: the part draws again only when the answer changes. */
export function useClockSelect<T extends string | number | boolean>(select: (now: number) => T): T {
  const clock = useClock();
  const latest = useRef(select);
  latest.current = select;
  return useSyncExternalStore(clock.subscribe, () => latest.current(clock.now()));
}

/** Today's date (WIB), "2026-10-08": changes once a day. */
export const useToday = () => useClockSelect(wibDay);

/**
 * Dates and times written as the Student's language does, at today's noon: days and times never depend on the
 * minute, so this changes once a day instead of every minute as useFormat does.
 */
export function useDayFormat() {
  const lang = useLang();
  const today = useToday();
  return useMemo(() => makeFormat(lang, dayNoon(today)), [lang, today]);
}

export type Phase = "ahead" | "live" | "past";

/** Where a class stands now: still ahead, on now, or over. */
export const usePhase = (start: number, end: number): Phase => useClockSelect((now) => (now >= end ? "past" : now >= start ? "live" : "ahead"));

/**
 * `value`, or the one before it while `key` says nothing changed: a list worked out again each minute (the exams, the
 * open Tasks) keeps its identity, so what reads it isn't drawn again for nothing.
 */
export function useSteady<T>(value: T, key: string): T {
  const kept = useRef<{ key: string; value: T } | null>(null);
  if (kept.current === null || kept.current.key !== key) kept.current = { key, value };
  return kept.current.value;
}
