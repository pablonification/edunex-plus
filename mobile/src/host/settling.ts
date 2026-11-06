// The demo's first sync, played after the first frame (as the real app reads after a sign-in): while it runs, the
// screens draw what's in and fill in as it comes, the welcome isn't shown for the moment before the demo signs in, and
// the top bar says it's reading (`status.settling`, what the flows wait on before they check what's on screen).
import { useSyncExternalStore } from "react";

let settling = false;
const watchers = new Set<() => void>();

export function setSettling(value: boolean): void {
  if (value === settling) return;
  settling = value;
  for (const watcher of watchers) watcher();
}

export function useSettling(): boolean {
  return useSyncExternalStore(
    (watcher) => {
      watchers.add(watcher);
      return () => void watchers.delete(watcher);
    },
    () => settling,
  );
}
