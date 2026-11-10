// Whether the phone asks for less motion (Android's "Remove animations"): moving things fade instead
// (DESIGN.md, "Motion"). Read once, then followed.
import { NavigationContext } from "expo-router/react-navigation";
import { useContext, useSyncExternalStore } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { useFirstMinuteCovering } from "../shell/first-minute/covering";

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

/** The app in front (Android's foreground); false while it's in the background or behind another app. */
function useAppActive(): boolean {
  return useSyncExternalStore(
    (watcher) => {
      const subscription = AppState.addEventListener("change", watcher);
      return () => subscription.remove();
    },
    () => AppState.currentState === "active",
  );
}

/** Whether this screen is in front; true outside the route tree (a part drawn where no screen holds focus). */
function useShown(): boolean {
  const navigation = useContext(NavigationContext);
  return useSyncExternalStore(
    (watcher) => {
      if (!navigation) return () => undefined;
      const stopFocus = navigation.addListener("focus", watcher);
      const stopBlur = navigation.addListener("blur", watcher);
      return () => {
        stopFocus();
        stopBlur();
      };
    },
    () => navigation?.isFocused() ?? true,
  );
}

/**
 * Whether an endless animation (the wave, the "now" dot, a skeleton, a spinner) may run: its screen in front, the
 * app in the foreground, and no less motion asked for. A loop that runs on a hidden tab, under a pushed screen or in
 * the background redraws every frame for nobody: battery, and Android's tools see the app as never idle (measured
 * on v4: Beranda and Tugas at 120 fps at rest, other screens at ~60 under them). Stop the loop when this turns
 * false, start it again when it turns true.
 */
export function useLoopWhileShown(): boolean {
  const still = useReduceMotion();
  const shown = useShown();
  const active = useAppActive();
  // Nor under the first minute's stage: it covers the whole screen, and a loop redrawing beneath it redraws the stage too.
  const covered = useFirstMinuteCovering();
  return !still && shown && active && !covered;
}
