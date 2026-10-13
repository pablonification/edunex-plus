// The Student's snoozes ("Ingatkan nanti"), kept on this computer
// ("local.snoozes") and shared by Beranda, the course page and Settings. A
// change shows at once: until the engine has saved it, the window keeps its own
// copy, so two snoozes in a row don't undo each other (local.set replaces the
// whole list). The rules (what matches, until when) live in core/snooze.ts.
import { useSyncExternalStore } from "react";
import type { SnoozeEntry } from "../core/models";
import { attention, dueItems, homeContext, nowCard, todayPlan } from "../core/needs";
import { activeSnooze, attendanceKey, holding, pruneSnoozes, type SnoozeKey, snoozeKey } from "../core/snooze";
import { useAttendance } from "./attendance";
import { useHomeWorld } from "./home-world";
import { useNow } from "./i18n";
import { useBridge, useDataset, useStore } from "./store";

/** What the window wrote and the engine hasn't confirmed yet, with how many writes are on their way. */
let pending: { entries: SnoozeEntry[]; writes: number } | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const publish = () => {
  for (const listener of listeners) listener();
};

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

export function useSnoozes(): Snoozes {
  const store = useStore();
  const bridge = useBridge();
  const now = useNow();
  const saved = useDataset("local.snoozes");
  const mine = useSyncExternalStore(subscribe, () => pending);
  const all = mine?.entries ?? saved ?? [];
  /**
   * Changes the list as it stands when called, not as this render saw it: a
   * toast's Undo seconds later mustn't put back what was changed meanwhile.
   */
  const update = async (change: (current: SnoozeEntry[]) => SnoozeEntry[]) => {
    const current = pending?.entries ?? (store.dataset("local.snoozes")?.value as SnoozeEntry[] | undefined) ?? [];
    const entries = change(pruneSnoozes(current, now));
    pending = { entries, writes: (pending?.writes ?? 0) + 1 };
    publish();
    try {
      await bridge.invoke("local.set", { name: "local.snoozes", value: entries });
    } finally {
      // The engine sends the saved list before it answers: once every write is answered, that's the one to show.
      if (pending && --pending.writes === 0) {
        pending = null;
        publish();
      }
    }
  };
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

/**
 * The snoozes still hiding something now, on Beranda (its "Perlu perhatianmu",
 * as it shows it, and the deadlines in "Hari ini") or on a course page (the attendance banner): what Settings
 * counts. One whose deadline moved, whose count changed or whose Task was
 * handed in hides nothing, so it isn't counted.
 */
export function useHeldBack(): readonly SnoozeEntry[] {
  const { entries } = useSnoozes();
  const world = useHomeWorld();
  const attendance = useAttendance();
  const now = useNow();
  if (!world) return [];
  const context = homeContext(world);
  const plan = todayPlan(context);
  const keys = [...attention(context, nowCard(context), plan), ...dueItems(context, plan)].map(snoozeKey);
  // A banner's key carries its course's state, so only a course still showing that banner matches.
  if (attendance) for (const { course, health } of attendance.courses) keys.push(attendanceKey(course.code, health));
  return holding(entries, keys, now);
}
