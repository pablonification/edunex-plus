// The Student's snoozes ("Ingatkan nanti") and what they marked handled
// ("Sudah beres"), each kept on this computer ("local.snoozes", "local.done")
// and shared by Beranda, the Task page, the course page and Settings. A change
// shows at once: until the engine has saved it, the window keeps its own copy,
// so two changes in a row don't undo each other (local.set replaces the whole
// list). The rules (what matches, until when) live in core/snooze.ts and core/done.ts.
import { useSyncExternalStore } from "react";
import { activeDone, type DoneSubjects, needDoneKey, pruneDone, putAway, taskDoneKey } from "../core/done";
import type { DatasetValue, DoneEntry, DoneHow, SnoozeEntry } from "../core/models";
import { attention, dueItems, homeContext, nowCard, taskNeed, todayPlan } from "../core/needs";
import { activeSnooze, attendanceKey, holding, pruneSnoozes, type SnoozeKey, snoozeKey } from "../core/snooze";
import { takesAnswers, taskStatus } from "../core/tasks";
import { useAttendance } from "./attendance";
import { useHomeWorld } from "./home-world";
import { useNow } from "./i18n";
import { type AppStore, useBridge, useDataset, useStore } from "./store";

type ListName = "local.snoozes" | "local.done";

/** What the window wrote to one list and the engine hasn't confirmed yet, with how many writes are on their way. */
interface Pending<T> {
  entries: T[];
  writes: number;
}

const pendingLists: { [N in ListName]: Pending<N extends "local.snoozes" ? SnoozeEntry : DoneEntry> | null } = {
  "local.snoozes": null,
  "local.done": null,
};
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const publish = () => {
  for (const listener of listeners) listener();
};

/**
 * One saved list as the window shows it, and a way to change it as it stands
 * when called, not as this render saw it: a toast's Undo seconds later mustn't
 * put back what was changed meanwhile.
 */
function useLocalList<T extends SnoozeEntry | DoneEntry>(name: ListName, prune: (entries: T[]) => T[]) {
  const store = useStore();
  const bridge = useBridge();
  const saved = useDataset(name) as T[] | undefined;
  const mine = useSyncExternalStore(subscribe, () => pendingLists[name]) as Pending<T> | null;
  const update = async (change: (current: T[]) => T[]) => {
    const pending = pendingLists[name] as Pending<T> | null;
    const current = pending?.entries ?? (store.dataset(name)?.value as T[] | undefined) ?? [];
    const entries = change(prune(current));
    (pendingLists as Record<ListName, Pending<T> | null>)[name] = { entries, writes: (pending?.writes ?? 0) + 1 };
    publish();
    try {
      await bridge.invoke("local.set", { name, value: entries });
    } finally {
      // The engine sends the saved list before it answers: once every write is answered, that's the one to show.
      const after = pendingLists[name];
      if (after && --after.writes === 0) {
        pendingLists[name] = null;
        publish();
      }
    }
  };
  return { all: mine?.entries ?? saved ?? [], update };
}

export interface Snoozes {
  /** The snoozes not over yet. */
  entries: readonly SnoozeEntry[];
  /** The snooze holding this item back now, if any (same facts, not over). */
  snoozed(key: SnoozeKey): SnoozeEntry | undefined;
  snooze(key: SnoozeKey, until: number, reason?: string): Promise<void>;
  /** Shows it again now. */
  wake(id: string): Promise<void>;
  wakeAll(): Promise<void>;
}

const NONE: readonly never[] = [];

/** The saved snoozes as the window has them (its own copy while a write is on its way), the same list while nothing changes. */
export function useSnoozeEntries(): readonly SnoozeEntry[] {
  const saved = useDataset("local.snoozes");
  const mine = useSyncExternalStore(subscribe, () => pendingLists["local.snoozes"]);
  return mine?.entries ?? saved ?? NONE;
}

/** What's marked handled, likewise: for lists worked out once per change (Tugas & Ujian). */
export function useDoneEntries(): readonly DoneEntry[] {
  const saved = useDataset("local.done");
  const mine = useSyncExternalStore(subscribe, () => pendingLists["local.done"]);
  return mine?.entries ?? saved ?? NONE;
}

export function useSnoozes(): Snoozes {
  const now = useNow();
  const { all, update } = useLocalList<SnoozeEntry>("local.snoozes", (entries) => pruneSnoozes(entries, now));
  return {
    entries: all.filter((entry) => entry.until > now),
    snoozed: (key) => activeSnooze(key, all, now),
    snooze: (key, until, reason) =>
      update((current) =>
        pruneSnoozes([...current.filter((entry) => entry.id !== key.id), { id: key.id, facts: key.facts, until, ...(reason ? { reason } : {}) }], now),
      ),
    wake: (id) => update((current) => current.filter((entry) => entry.id !== id)),
    wakeAll: () => update(() => []),
  };
}

export interface Done {
  /** Every saved entry (one whose item has changed or gone matches nothing). */
  entries: readonly DoneEntry[];
  /** The entry putting this item away now, if any (same facts). */
  done(key: SnoozeKey): DoneEntry | undefined;
  mark(key: SnoozeKey, how: DoneHow): Promise<void>;
  /** Shows it again ("Tampilkan lagi", Undo). */
  unmark(id: string): Promise<void>;
  unmarkAll(): Promise<void>;
}

/** What's still known, so entries about a Task, course or bill that has gone can go. */
function subjects(store: AppStore): DoneSubjects {
  const tasks = store.dataset("edunex.tasks")?.value as DatasetValue<"edunex.tasks"> | undefined;
  const courses = store.dataset("six.courses")?.value as DatasetValue<"six.courses"> | undefined;
  const bills = store.dataset("six.bills")?.value as DatasetValue<"six.bills"> | undefined;
  return {
    tasks: tasks ? new Set(tasks.map((task) => task.id)) : undefined,
    courses: courses ? new Set(courses.map((course) => course.code)) : undefined,
    bills: bills ? new Set(bills.map((bill) => bill.term)) : undefined,
  };
}

export function useDone(): Done {
  const now = useNow();
  const store = useStore();
  const { all, update } = useLocalList<DoneEntry>("local.done", (entries) => pruneDone(entries, now, subjects(store)));
  return {
    entries: all,
    done: (key) => activeDone(key, all),
    mark: (key, how) => update((current) => putAway(current, key, how, now)),
    unmark: (id) => update((current) => current.filter((entry) => entry.id !== id)),
    unmarkAll: () => update(() => []),
  };
}

/**
 * The snoozes and handled entries still hiding something now, on Beranda (its
 * "Perlu perhatianmu", as it shows it, and the deadlines in "Hari ini"), in
 * Tugas & Ujian (a late Task) or on a course page (the attendance banner):
 * what Settings counts. One whose deadline moved, whose count changed or whose
 * Task was handed in hides nothing, so it isn't counted.
 */
export function useHeldBack(): { snoozed: readonly SnoozeEntry[]; done: readonly DoneEntry[] } {
  const { entries } = useSnoozes();
  const { entries: handled } = useDone();
  const world = useHomeWorld();
  const attendance = useAttendance();
  const now = useNow();
  if (!world) return { snoozed: [], done: [] };
  const context = homeContext(world);
  const plan = todayPlan(context);
  const items = [...attention(context, nowCard(context), plan), ...dueItems(context, plan)];
  const keys = items.map(snoozeKey);
  // A late Task put off in Tugas & Ujian, also one Beranda leaves to its Presence window.
  for (const task of world.tasks) {
    const need = taskStatus(task, now) === "overdue" ? taskNeed(task, now) : null;
    if (need) keys.push(snoozeKey(need));
  }
  // A banner's key carries its course's state, so only a course still showing that banner matches.
  if (attendance) for (const { course, health } of attendance.courses) keys.push(attendanceKey(course.code, health));
  // A Task put away on its own page holds for as long as it's open, Beranda's list or not: its reminders are off.
  const doneKeys = [
    ...items.flatMap((need) => needDoneKey(need) ?? []),
    ...world.tasks.filter((task) => takesAnswers(task, now)).map((task) => taskDoneKey(task, "due")),
  ];
  const done = handled.filter((entry) => doneKeys.some((key) => key.id === entry.id && key.facts === entry.facts));
  return { snoozed: holding(entries, keys, now), done: [...new Map(done.map((entry) => [entry.id, entry])).values()] };
}
