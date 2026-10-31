// Tandai Hadir, gone to from here: the classes whose SIX page the Student opened from Beranda this run, and when. When
// SIX then no longer shows the button, the card marks the Student's step ("Sudah ke SIX · 09:07") with the cookie and
// its check, claiming no presence: the button can also go because SIX closed it, and SIX's count after class says
// whether it counted (the class sheet).
import { useCallback, useSyncExternalStore } from "react";
import { useOpenCheckIn } from "../../../../src/app/hooks";

const opened = new Map<string, number>();
const watchers = new Set<() => void>();
let version = 0;

/** Opens SIX's page for a class's Tandai Hadir, remembering it was the Student who went, and when. */
export function useCheckIn(): (sessionId: string, url: string, at: number) => void {
  const open = useOpenCheckIn();
  return useCallback(
    (sessionId: string, url: string, at: number) => {
      opened.set(sessionId, at);
      version++;
      for (const watcher of watchers) watcher();
      open(sessionId, url);
    },
    [open],
  );
}

/** When the Student went to press Tandai Hadir for this class from the app; null if they didn't. */
export function useWentToCheckIn(sessionId: string | null): number | null {
  useSyncExternalStore(
    (watcher) => {
      watchers.add(watcher);
      return () => void watchers.delete(watcher);
    },
    () => version,
  );
  return sessionId !== null ? (opened.get(sessionId) ?? null) : null;
}
