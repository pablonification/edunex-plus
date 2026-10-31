// Tandai Hadir, pressed from here: the classes whose SIX page the Student opened from Beranda this run, so the card
// can tell "you pressed it" (the button went away after they went to press it) from "SIX closed it" (it went away on
// its own), and celebrate only the first.
import { useCallback, useSyncExternalStore } from "react";
import { useOpenCheckIn } from "../../../../src/app/hooks";

const opened = new Set<string>();
const watchers = new Set<() => void>();
let version = 0;

/** Opens SIX's page for a class's Tandai Hadir, remembering it was the Student who went. */
export function useCheckIn(): (sessionId: string, url: string) => void {
  const open = useOpenCheckIn();
  return useCallback(
    (sessionId: string, url: string) => {
      opened.add(sessionId);
      version++;
      for (const watcher of watchers) watcher();
      open(sessionId, url);
    },
    [open],
  );
}

/** Whether the Student went to press Tandai Hadir for this class from the app. */
export function useWentToCheckIn(sessionId: string | null): boolean {
  useSyncExternalStore(
    (watcher) => {
      watchers.add(watcher);
      return () => void watchers.delete(watcher);
    },
    () => version,
  );
  return sessionId !== null && opened.has(sessionId);
}
