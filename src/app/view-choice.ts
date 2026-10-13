// Small view choices the Student makes on a screen (Jadwal's week or month,
// "Sisa saja", the calendar's "Kalender lengkap"), kept while the app is open:
// going elsewhere and coming back finds the screen as they left it. A new
// launch starts from each screen's default.
import { useCallback, useState } from "react";
import { type AppStore, useStore } from "./store";

const choices = new WeakMap<AppStore, Map<string, unknown>>();

/** Like `useState`, remembered under `key` for as long as the app is open. */
export function useViewChoice<T>(key: string, initial: T): [T, (next: T | ((current: T) => T)) => void] {
  const store = useStore();
  const [value, setValue] = useState<T>(() => {
    const kept = choices.get(store);
    return kept?.has(key) ? (kept.get(key) as T) : initial;
  });
  const set = useCallback(
    (next: T | ((current: T) => T)) =>
      setValue((current) => {
        const value = typeof next === "function" ? (next as (current: T) => T)(current) : next;
        const kept = choices.get(store) ?? new Map<string, unknown>();
        kept.set(key, value);
        choices.set(store, kept);
        return value;
      }),
    [store, key],
  );
  return [value, set];
}
