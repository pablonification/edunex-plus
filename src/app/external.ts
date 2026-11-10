// One value kept outside React (a dataset of the store, the clock's minute), as a screen reads it. The window reads it
// as React's useSyncExternalStore does: a change redraws what reads it at once, in one go.
//
// A deferred source (the phone's screens, mobile/src/ui/tab-clock.tsx) hands its changes over as a transition instead.
// On the phone the engine, the store and every screen share one JS thread, and a dataset read in the background
// redrew what reads it in one piece: 100–400 ms on a mid-range phone, a tap or a frame waiting behind it. As a
// transition React draws it a part at a time and gives the thread to a tap, a timer or the engine in between. Each
// component keeps the value it was last handed in its own state, so a draw that pauses halfway never mixes two versions
// of a dataset (useSyncExternalStore would then draw it again at once, in one piece).
import { startTransition, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export interface ExternalSource {
  /** Hands changes to the screens as transitions (see above). */
  readonly deferred?: boolean;
}

type Subscribe = (listener: () => void) => () => void;

const never: Subscribe = () => () => undefined;
const nothing = () => undefined;

/**
 * The value `read` gives, again whenever `subscribe` says it changed. `key` names what's read: a new key (another
 * dataset) reads it afresh. `subscribe` must be the same function for as long as `key` is.
 */
export function useExternal<T>(deferred: boolean, key: string, subscribe: Subscribe, read: () => T): T {
  const live = useSyncExternalStore(deferred ? never : subscribe, deferred ? nothing : read) as T;
  const [held, setHeld] = useState<{ key: string; value: T } | null>(() => (deferred ? { key, value: read() } : null));
  const reader = useRef(read);
  reader.current = read;
  let shown = held;
  if (deferred && shown?.key !== key) {
    shown = { key, value: read() };
    setHeld(shown);
  }
  const hand = useCallback(() => {
    const value = reader.current();
    startTransition(() => setHeld((current) => (current?.key === key && Object.is(current.value, value) ? current : { key, value })));
  }, [key]);
  useEffect(() => {
    if (!deferred) return;
    // A change between the first draw and now.
    hand();
    return subscribe(hand);
  }, [deferred, subscribe, hand]);
  return deferred ? (shown as { value: T }).value : live;
}
