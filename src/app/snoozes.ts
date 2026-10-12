// The Student's snoozes ("Ingatkan nanti"), kept on this computer
// ("local.snoozes") and shared by Beranda, the course page and Settings. A
// change shows at once: until the engine has saved it, the window keeps its own
// copy, so two snoozes in a row don't undo each other (local.set replaces the
// whole list). The rules (what matches, until when) live in core/snooze.ts.
import { useSyncExternalStore } from "react";
import type { SnoozeEntry } from "../core/models";
import { activeSnooze, pruneSnoozes, type SnoozeKey } from "../core/snooze";
import { useNow } from "./i18n";
import { useBridge, useDataset } from "./store";

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
  const bridge = useBridge();
  const now = useNow();
  const saved = useDataset("local.snoozes");
  const mine = useSyncExternalStore(subscribe, () => pending);
  const all = mine?.entries ?? saved ?? [];
  const write = async (entries: SnoozeEntry[]) => {
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
      write(pruneSnoozes([...all.filter((entry) => entry.id !== key.id), { id: key.id, facts: key.facts, until, ...(reason ? { reason } : {}) }], now)),
    wake: (id) => write(pruneSnoozes(all, now).filter((entry) => entry.id !== id)),
    wakeAll: () => write([]),
  };
}
