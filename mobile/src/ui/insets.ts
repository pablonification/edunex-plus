// What covers the bottom of the screen a page draws under: inside a tab, Android's navigation bar
// (the tabs) already keeps the page clear of the phone's own bar; a screen over the tabs runs to the
// screen's edge (edge to edge) and keeps its last row clear of the phone's bar itself.
import { createContext, useContext, useSyncExternalStore } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** True under the bottom tabs ((tabs)/_layout.tsx provides it). */
export const InTabs = createContext(false);

export function useInTabs(): boolean {
  return useContext(InTabs);
}

/** The room a page's end leaves for the phone's own navigation bar: none inside a tab, its height elsewhere. */
export function useBottomInset(): number {
  const inTabs = useContext(InTabs);
  const { bottom } = useSafeAreaInsets();
  return inTabs ? 0 : bottom;
}

// Where a tab's page ends on the screen (the top of Android's navigation bar under it), as the page measured it: the
// snackbar sits just above it, whatever height the bar has on this phone.
let tabsBottom = 0;
const watchers = new Set<() => void>();

/** A tab's page reports its bottom edge (window coordinates). */
export function reportTabsBottom(y: number): void {
  if (Math.abs(y - tabsBottom) < 1) return;
  tabsBottom = y;
  for (const watcher of watchers) watcher();
}

/** The top of the tabs' bar, in window coordinates (0 before a tab has drawn). */
export function useTabsBottom(): number {
  return useSyncExternalStore(
    (watcher) => {
      watchers.add(watcher);
      return () => void watchers.delete(watcher);
    },
    () => tabsBottom,
  );
}
