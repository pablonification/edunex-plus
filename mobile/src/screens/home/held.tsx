// A row's own clock on Beranda: the minute's tick redrew every row (a few ms each on a small phone, 100+ ms for the
// page: PROGRESS.md "FAST", no JS block over 50 ms), though most rows say nothing that changes from one minute to
// the next ("Kam, 15 Okt, 11:00", "dalam 7 hari"). Each row is drawn under a clock held at the moment its words were
// last true for (`heldAt`), and drawn again only when that moment or its data changes (`memoRow`).
import { type ComponentType, createContext, memo, type ReactNode, useContext, useMemo } from "react";
import { ClockProvider, type UiClock, useClock } from "../../../../src/app/i18n";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * The time a row is drawn at: `now` itself while one of its `moments` (a start, an end, a deadline) is within `near`
 * of now, so "dalam 25 mnt" and "Sekarang" move with the clock; further off, now held to the quarter hour (a label a
 * day or more away changes at most that late), never past midnight.
 */
export function heldAt(now: number, moments: readonly number[], near = 3 * HOUR): number {
  if (moments.some((at) => Math.abs(at - now) <= near)) return now;
  const quarter = Math.floor(now / (15 * MINUTE)) * 15 * MINUTE;
  // The day's start in WIB, so a held time never says yesterday's "Besok".
  const dayStart = Math.floor((now + 7 * HOUR) / DAY) * DAY - 7 * HOUR;
  return Math.max(quarter, dayStart);
}

/** The data's own JSON (the row's signature) and every moment in it (a number that's a time: after 2001). */
export function facts(value: unknown): { sig: string; moments: number[] } {
  const moments: number[] = [];
  const sig = JSON.stringify(value, (_key, v: unknown) => {
    if (typeof v === "number" && v > 1e12) moments.push(v);
    return v;
  });
  return { sig, moments };
}

const RealClockContext = createContext<UiClock | null>(null);

/** A clock that says `at` and never ticks: the row is drawn again when `at` changes. */
function HeldClock({ at, children }: { at: number; children: ReactNode }) {
  const real = useClock();
  const clock = useMemo<UiClock>(() => ({ now: () => at, subscribe: () => () => undefined }), [at]);
  return (
    <RealClockContext.Provider value={real}>
      <ClockProvider clock={clock}>{children}</ClockProvider>
    </RealClockContext.Provider>
  );
}

/** Inside a held row, what must be now itself (the times a snooze offers, counted from the moment it's picked). */
export function RealClock({ children }: { children: ReactNode }) {
  const real = useContext(RealClockContext);
  return real ? <ClockProvider clock={real}>{children}</ClockProvider> : children;
}

/**
 * `Row` drawn under a held clock, and drawn again only when `at` or `sig` (its data's JSON, `facts`) changes. Whatever
 * else it's given (callbacks, the courses) is taken as it was then: what changes those must change `sig`.
 */
export function memoRow<P extends object>(Row: ComponentType<P>) {
  return memo(
    function HeldRow({ at, props }: { at: number; sig: string; props: P }) {
      return (
        <HeldClock at={at}>
          <Row {...props} />
        </HeldClock>
      );
    },
    (a, b) => a.at === b.at && a.sig === b.sig,
  );
}
