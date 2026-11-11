// A page going where something outside it asks (the guide points at parts of a page: one the Student had scrolled
// left the tour pointing at nothing, and a part lower on its page than the room the tour has is brought up into it).
// A tab's scroller says how it goes to an offset (`useScrollAsked`); `scrollPagesTo` asks every one that's mounted.
// Jadwal doesn't take part: its place is the time of day, not an offset from its top.
import { useEffect, useRef } from "react";

const askers = new Set<(y: number) => void>();

/** Every mounted page that takes part goes to `y` from its top (0: its top), at once: what asks measures next. */
export function scrollPagesTo(y: number): void {
  for (const ask of askers) ask(y);
}

/** `to(y)` runs whenever a page's place is asked for, for as long as the caller is mounted. */
export function useScrollAsked(to: (y: number) => void): void {
  const latest = useRef(to);
  latest.current = to;
  useEffect(() => {
    const ask = (y: number) => latest.current(y);
    askers.add(ask);
    return () => void askers.delete(ask);
  }, []);
}
