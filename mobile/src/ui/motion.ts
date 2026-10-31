// Whether the phone asks for less motion (Android's "Remove animations"): moving things fade instead
// (DESIGN.md, "Motion"). Read once, then followed.
import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

let reduced = false;
const watchers = new Set<() => void>();
let watching = false;

function watch(): void {
  if (watching) return;
  watching = true;
  const set = (value: boolean) => {
    if (value === reduced) return;
    reduced = value;
    for (const watcher of watchers) watcher();
  };
  void AccessibilityInfo.isReduceMotionEnabled().then(set, () => undefined);
  AccessibilityInfo.addEventListener("reduceMotionChanged", set);
}

/** Less motion asked for: fade, don't move. */
export function reduceMotion(): boolean {
  watch();
  return reduced;
}

export function useReduceMotion(): boolean {
  watch();
  return useSyncExternalStore(
    (watcher) => {
      watchers.add(watcher);
      return () => void watchers.delete(watcher);
    },
    () => reduced,
  );
}
