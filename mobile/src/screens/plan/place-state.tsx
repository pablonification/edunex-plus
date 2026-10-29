// What Rencana studi keeps while it's open (src/app/nav.tsx's usePlaceState): a fold opened, a
// search typed, chips picked. The desktop keeps them with the screen's place in history; on the
// phone they're kept for as long as the screen is in the stack, so switching tabs (or views)
// and coming back finds them as the Student left them.
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";

const Kept = createContext<Map<string, unknown> | null>(null);

export function PlaceStateProvider({ children }: { children: ReactNode }) {
  const kept = useRef(new Map<string, unknown>()).current;
  return <Kept.Provider value={kept}>{children}</Kept.Provider>;
}

/** Like `useState`, kept under `key` while the screen is open; plain `useState` outside a provider. */
export function usePlaceState<T>(key: string, initial: T): [T, (next: T) => void] {
  const kept = useContext(Kept);
  const [value, setValue] = useState<T>(() => (kept?.has(key) ? (kept.get(key) as T) : initial));
  const set = useCallback(
    (next: T) => {
      kept?.set(key, next);
      setValue(next);
    },
    [kept, key],
  );
  return [value, set];
}
