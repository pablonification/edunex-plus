// The screens' view of the store and the clock (../../app/_layout.tsx puts it around the tabs and every screen over
// them): the same data, each change handed over as a transition (src/app/external.ts). A dataset the engine reads in
// the background, or the minute's tick, then redraws what reads it a part at a time, with a tap, a frame or the
// engine's next step let in between; drawn in one piece it held a mid-range phone's JS thread 100–400 ms. What sits
// outside the screens (the welcome, the sign-in, the toasts) still hears of a change at once.
import { type ReactNode, useMemo } from "react";
import { ClockProvider, type UiClock, useClock } from "../../../src/app/i18n";
import { deferredStore, StoreProvider, useBridge, useStore } from "../../../src/app/store";

export function DeferredScreens({ children }: { children: ReactNode }) {
  const store = useStore();
  const bridge = useBridge();
  const clock = useClock();
  const view = useMemo(() => deferredStore(store), [store]);
  const later = useMemo(() => deferredClock(clock), [clock]);
  return (
    <StoreProvider store={view} bridge={bridge}>
      <ClockProvider clock={later}>{children}</ClockProvider>
    </StoreProvider>
  );
}

/** `clock`'s time and ticks, each tick handed over as a transition. */
export function deferredClock(clock: UiClock): UiClock {
  return { deferred: true, now: () => clock.now(), subscribe: (listener) => clock.subscribe(listener) };
}
