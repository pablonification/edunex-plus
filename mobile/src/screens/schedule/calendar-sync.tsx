// Jadwal's ⋮ "Kalender HP" (W13): instead of a one-off "Tambahkan 29 acara", a setting that keeps the phone's
// own "Edunex Plus" calendar the same as Jadwal. Kalender akademik's dates and the exam page's sittings go into that
// same calendar one at a time (`usePlacement` says, on those screens, whether theirs is there and who keeps it). On, the app writes the term's classes, exams, deadlines and ITB's
// days into it (./phone-calendar.ts, the same events as the .ics file), and again whenever any of them changes (a
// class moved, a Task posted); off, the calendar is taken off the phone with every event in it. Whether it's on is
// kept on this phone (a file of its own); a write that fails or a permission taken back is said on Jadwal, with the fix.
import { File, Paths } from "expo-file-system";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useLang } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { calendarPlan, needsWrite, type Placement, placement } from "./calendar-plan";
import { useToday } from "./clock";
import { addToPhoneCalendar, checkPlaced, placedNow, removePhoneCalendar, shareIcs, subscribePlaced } from "./phone-calendar";

const SETTING = "phone-calendar-sync.json";
/**
 * How the events are written (./phone-calendar.ts), counted up when that changes, so a calendar written the old way
 * is written once more: 2 = an iPhone's whole-day events end on their last day, not the day after.
 */
const WRITER = 2;

export type SyncProblem = "denied" | "failed" | null;

interface SyncState {
  on: boolean;
  /** What the calendar was last written from: written again only when it changes. */
  written: string | null;
  /** How many events it holds after the last write. */
  events: number;
  problem: SyncProblem;
  busy: boolean;
  /** The Student just turned it on or asked to try again: calendar access may be asked for (never by a write on its own). */
  ask: boolean;
}

function readSetting(): Pick<SyncState, "on" | "written"> {
  try {
    const file = new File(Paths.document, SETTING);
    const saved = file.exists ? (JSON.parse(file.textSync()) as { on?: unknown; written?: unknown }) : null;
    return { on: saved?.on === true, written: typeof saved?.written === "string" ? saved.written : null };
  } catch {
    return { on: false, written: null };
  }
}

function writeSetting(state: Pick<SyncState, "on" | "written">): void {
  try {
    new File(Paths.document, SETTING).writeSync(JSON.stringify({ on: state.on, written: state.written }));
  } catch {
    // Only whether it's on, and the next start writes the calendar once more.
  }
}

let state: SyncState | null = null;
const listeners = new Set<() => void>();
const current = (): SyncState => {
  state ??= { ...readSetting(), events: 0, problem: null, busy: false, ask: false };
  return state;
};
function set(patch: Partial<SyncState>): void {
  state = { ...current(), ...patch };
  if ("on" in patch || "written" in patch) writeSetting(state);
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** The setting as Jadwal's ⋮ shows it, and what turns it on and off. */
export function useCalendarSync() {
  const now = useSyncExternalStore(subscribe, current);
  return {
    ...now,
    /** On: the calendar is written right away (asking for calendar access first, the only time it asks). */
    turnOn: () => set({ on: true, written: null, problem: null, ask: true }),
    turnOff: async () => {
      set({ on: false, written: null, problem: null, events: 0 });
      await removePhoneCalendar().catch(() => undefined);
    },
    /** After a failure, or once the Student allowed calendar access in Android's settings. */
    retry: () => set({ written: null, problem: null, ask: true }),
  };
}

/** The events the calendar holds: from a week ago (a class moved last week is right there too) to the term's end. */
/** What the events are made from, and a way to make them: worked out only by what needs them (a write, a share). */
function useCalendarSources() {
  const lang = useLang();
  const today = useToday();
  const sources = {
    "six.schedule": useDataset("six.schedule"),
    "six.scheduleMonths": useDataset("six.scheduleMonths"),
    "six.student": useDataset("six.student"),
    "six.courses": useDataset("six.courses"),
    "edunex.courses": useDataset("edunex.courses"),
    "edunex.tasks": useDataset("edunex.tasks"),
    "edunex.exams": useDataset("edunex.exams"),
    "edunex.presence": useDataset("edunex.presence"),
    "edunex.materials": useDataset("edunex.materials"),
    "edunex.announcements": useDataset("edunex.announcements"),
    "itb.calendar": useDataset("itb.calendar"),
  };
  const plan = () => calendarPlan((name) => sources[name as keyof typeof sources] as never, lang, today);
  return { plan, inputs: [lang, today, ...Object.values(sources)] };
}

function useCalendarItems() {
  const { plan, inputs } = useCalendarSources();
  // Worked out again only when one of the datasets the events come from changes (or the day, or the language).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `plan` is new each render; `inputs` are what it reads
  return useMemo(plan, inputs);
}

/**
 * Keeps the phone's calendar written while the setting is on: mounted with Jadwal's tab, which the app keeps mounted
 * all the time it runs. A write waits a moment after a change (a sync changes several datasets at once), and runs again
 * on the next. Off, nothing is worked out: the term's events were made on Jadwal's first draw for nobody.
 */
export function PhoneCalendarSync() {
  const on = useSyncExternalStore(subscribe, current).on;
  return on ? <Writer /> : null;
}

function Writer() {
  const sync = useSyncExternalStore(subscribe, current);
  const { items, key: events, span, current: sources } = useCalendarItems();
  const key = `${WRITER}|${events}`;
  useEffect(() => {
    if (!needsWrite({ on: sync.on, busy: sync.busy, problem: sync.problem, written: sync.written }, key)) return;
    // A moment after the change, off the frame that drew it (a sync's own reads come in bursts).
    const timer = setTimeout(() => {
      set({ busy: true, ask: false });
      addToPhoneCalendar(items, sources, span, { ask: sync.ask, kept: true })
        .then((result) => {
          if (result.kind === "denied") set({ busy: false, problem: "denied" });
          else set({ busy: false, written: key, events: result.events, problem: null });
        })
        .catch(() => set({ busy: false, problem: "failed" }));
    }, 1_500);
    return () => clearTimeout(timer);
  }, [sync.on, sync.busy, sync.problem, sync.written, sync.ask, key, items, span, sources]);
  // Back from Android's settings, where calendar access may have been allowed: try again.
  useEffect(() => {
    const change = AppState.addEventListener("change", (next) => {
      if (next === "active" && current().on && current().problem === "denied") set({ problem: null });
    });
    return () => change.remove();
  }, []);
  return null;
}

/** "Bagikan .ics": the same events as a file, through Android's share sheet, made when it's pressed. */
export function useShareIcs() {
  const { plan } = useCalendarSources();
  return () => shareIcs(plan().items, Date.now());
}

/**
 * Whether these events (a date's, an exam's) are in the phone's calendar, for the screen that offers to add them:
 * the same answer on every screen, and it changes with Jadwal's switch. `looking`: the screen is showing the answer
 * now, so it's checked against the phone once (an event deleted in the phone's calendar app is no longer there).
 */
export function usePlacement(uids: readonly string[], looking: boolean): Placement {
  const placed = useSyncExternalStore(subscribePlaced, placedNow);
  const on = useSyncExternalStore(subscribe, current).on;
  const key = uids.join(" ");
  useEffect(() => {
    if (looking && key) void checkPlaced(key.split(" ")).catch(() => undefined);
  }, [looking, key]);
  return placement(uids, placed, on);
}
