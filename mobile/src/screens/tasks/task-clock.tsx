// Tugas's own clock. Every row hangs on the app's minute clock (dates, "late", "within a day"), so each minute's
// tick, or coming back to the tab after one, drew every row again: 100–130 ms of a blocked JS thread on `mid` for a
// list that looked the same. This clock passes a tick on only when the list can look different: a moment on it
// crossed (a deadline, its day before, an opening, a sitting's start or end, an attendance window), midnight, a
// moment within the next hour (its "dalam 40 menit" moves), or a quarter of an hour gone, whatever happened.
import { createContext, type ReactNode, type RefObject, useContext, useEffect, useMemo, useRef } from "react";
import { ClockProvider, type UiClock, useClock } from "../../../../src/app/i18n";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** WIB: the day changes at midnight in Jakarta. */
const dayOf = (at: number) => Math.floor((at + 7 * HOUR) / DAY);

const Moments = createContext<RefObject<readonly number[]> | null>(null);

export function TaskClock({ children }: { children: ReactNode }) {
  const parent = useClock();
  const moments = useRef<readonly number[]>([]);
  const clock = useMemo(() => byMoments(parent, () => moments.current), [parent]);
  return (
    <Moments.Provider value={moments}>
      <ClockProvider clock={clock}>{children}</ClockProvider>
    </Moments.Provider>
  );
}

/** The moments the list under TaskClock shows things about: after each render, for the next tick. */
export function useClockMoments(moments: readonly number[]): void {
  const ref = useContext(Moments);
  useEffect(() => {
    if (ref) ref.current = moments;
  });
}

/** The moments in what Tugas lists: every number named like one, an item deep (a Task's, an exam part's, a week's). */
export function momentsOf(items: readonly object[], more: readonly number[] = []): number[] {
  const out: number[] = [...more];
  const NAMES = ["at", "end", "start", "dueAt", "opensAt", "closesAt"];
  const take = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 2) return;
    for (const [key, field] of Object.entries(value)) {
      if (typeof field === "number" && NAMES.includes(key)) out.push(field);
      else if (field && typeof field === "object" && !Array.isArray(field)) take(field, depth + 1);
    }
  };
  for (const item of items) take(item, 0);
  return out;
}

/** Whether going from `from` to `to` can change what the list shows. */
function changes(from: number, to: number, moments: readonly number[]): boolean {
  if (to - from >= 15 * MINUTE || dayOf(from) !== dayOf(to)) return true;
  for (const at of moments) {
    if (at > from && at <= to) return true;
    // "Within a day" turns amber the day before.
    if (at - DAY > from && at - DAY <= to) return true;
    // Close: its time left reads in minutes.
    if (at > to && at - to <= HOUR) return true;
  }
  return false;
}

export function byMoments(parent: UiClock, moments: () => readonly number[]): UiClock {
  const listeners = new Set<() => void>();
  let shown = parent.now();
  let stop: (() => void) | null = null;
  return {
    deferred: parent.deferred,
    now: () => shown,
    subscribe(listener) {
      listeners.add(listener);
      stop ??= parent.subscribe(() => {
        const next = parent.now();
        if (!changes(shown, next, moments())) return;
        shown = next;
        for (const each of listeners) each();
      });
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stop?.();
          stop = null;
        }
      };
    },
  };
}
