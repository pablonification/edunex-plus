// What covers the bottom of the screen a page draws under. On Android, inside a tab, the navigation bar
// (the tabs) sits under the page and already keeps it clear of the phone's own bar; a screen over the tabs runs to the
// screen's edge (edge to edge) and keeps its last row clear of the phone's bar itself. On an iPhone the tabs' bar is
// iOS's own and floats over the page, which runs under it to the screen's edge: a tab keeps its last row clear of the
// bar and the home indicator. Where a page ends, per phone and place: ./page-end.ts.
import { createContext, useContext, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import { IOS_TAB_BAR, type PageEnd, pageEnd } from "./page-end";

/** True under the bottom tabs ((tabs)/_layout.tsx provides it). */
export const InTabs = createContext(false);

export function useInTabs(): boolean {
  return useContext(InTabs);
}

/**
 * What's drawn over the foot of the screen where this is: the phone's own navigation bar (the home indicator) on a
 * screen over the tabs; inside a tab, nothing on Android (the tabs sit under the page) and iOS's tab bar with the home
 * indicator on an iPhone. There iOS says it itself: expo-router gives every tab its own safe area (a SafeAreaProvider
 * inside the tab's view controller), so it follows the bar iOS draws (iOS 26's glass one, the plain one before). That
 * safe area starts as the window's and becomes the tab's a moment later, so it's never taken as less than the bar's
 * standing height over the home indicator: a tab's first frame is already right (Beranda measures its fold once).
 */
export function useBottomInset(): number {
  const inTabs = useContext(InTabs);
  const { bottom } = useSafeAreaInsets();
  if (!inTabs) return bottom;
  if (Platform.OS !== "ios") return 0;
  return Math.max(bottom, (initialWindowMetrics?.insets.bottom ?? 0) + IOS_TAB_BAR);
}

/**
 * Where a scrolling page ends here (./page-end.ts): `strip` to stop the scrolling short of the screen's foot (a margin
 * under the scroll view), `room` to add to the content's end padding. `Page` uses it; so does a screen with a list of
 * its own, so every screen ends the same way.
 */
export function usePageEnd(toFoot = true): PageEnd {
  const inTabs = useContext(InTabs);
  const bottom = useBottomInset();
  return pageEnd({ os: Platform.OS, inTabs, bottom, toFoot });
}

// Where a tab's page ends on the screen (the top of the tabs' bar: under the page on Android, over it on an iPhone), as
// the page measured it: the snackbar sits just above it, whatever height the bar has on this phone.
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

// Where a screen's own bar at its foot begins (the Task's Simpan draf and Kumpulkan), in window coordinates: the
// snackbar sits just above it, never over its buttons. 0 while no such bar is on screen.
let barTop = 0;
const barWatchers = new Set<() => void>();

/** A screen's bottom bar reports its top edge (window coordinates), and 0 when it goes. */
export function reportBarTop(y: number): void {
  if (Math.abs(y - barTop) < 1) return;
  barTop = y;
  for (const watcher of barWatchers) watcher();
}

/** The top of the bar at the foot of the screen in front, in window coordinates (0 when there is none). */
export function useBarTop(): number {
  return useSyncExternalStore(
    (watcher) => {
      barWatchers.add(watcher);
      return () => void barWatchers.delete(watcher);
    },
    () => barTop,
  );
}

/**
 * The room the status bar takes at a tab's top (the notch, the Dynamic Island). On an iPhone a tab learns its own safe
 * area only once it has been shown: before that it reads 0, so the first frame of a tab opened for the first time drew
 * its title over the clock and the next frame moved the whole page down. Never less than the window's own at launch
 * (the app is portrait only, so that doesn't change).
 */
export function useTopInset(): number {
  const { top } = useSafeAreaInsets();
  return Platform.OS === "ios" ? Math.max(top, initialWindowMetrics?.insets.top ?? 0) : top;
}
