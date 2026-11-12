// Whether the first minute's stage covers the whole screen right now (../welcome.tsx's first frame, then ./scene.tsx
// until it starts lifting). Everything under it is unseen: an endless animation there (a skeleton, the "now" dot)
// would redraw the screen for nobody, and TalkBack must not reach it. Nothing is imported here, so anything may read it.
import { useSyncExternalStore } from "react";

const up = new Set<string>();
const watchers = new Set<() => void>();

/** A part of the first minute says it covers the screen, or no longer does. */
export function setCovering(who: "welcome" | "scene", covering: boolean): void {
  if (covering === up.has(who)) return;
  if (covering) up.add(who);
  else up.delete(who);
  for (const watcher of watchers) watcher();
}

export const firstMinuteCovering = () => up.size > 0;

/** True while the stage covers the screen. */
export function useFirstMinuteCovering(): boolean {
  return useSyncExternalStore((watcher) => {
    watchers.add(watcher);
    return () => void watchers.delete(watcher);
  }, firstMinuteCovering);
}
