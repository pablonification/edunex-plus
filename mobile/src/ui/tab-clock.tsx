// A tab's own clock: every tab is mounted ahead (an instant switch), and every date on screen hangs
// on the app's minute clock (useFormat, useNow), so each minute's tick drew all five tabs again at once:
// 300–500 ms of a blocked JS thread on `mid`, once a minute, whatever the Student was doing. A tab not
// in front (another tab, or a screen pushed over the tabs) lets the ticks pass and catches up once, the
// moment it's shown again, only if the minute changed while it was away. (Freezing hidden tabs with
// react-freeze was tried and measured: each switch then drew the whole tab again, 100–270 ms.) The same for the
// data: a dataset that changes (SIX's check-in read every 2 minutes in class, a feed's page) redrew every tab that reads
// it, 200–560 ms on a small phone while the Student looked at one; a hidden tab now hears of it when it's shown.
import { useIsFocused } from "expo-router";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { ClockProvider, type UiClock, useClock } from "../../../src/app/i18n";
import { type AppStore, StoreProvider, useBridge, useStore } from "../../../src/app/store";

export function TabClock({ children }: { children: ReactNode }) {
  const parent = useClock();
  const store = useStore();
  const bridge = useBridge();
  const focused = useIsFocused();
  const shown = useRef(focused);
  shown.current = focused;
  const clock = useMemo(() => gated(parent, () => shown.current), [parent]);
  const data = useMemo(() => gatedStore(store, () => shown.current), [store]);
  useEffect(() => {
    if (!focused) return;
    data.catchUp();
    clock.catchUp();
  }, [focused, clock, data]);
  return (
    <StoreProvider store={data} bridge={bridge}>
      <ClockProvider clock={clock}>{children}</ClockProvider>
    </StoreProvider>
  );
}

/**
 * `store` as the tab reads it: the same data, its changes passed on only while `open()`; a listener that missed one
 * hears it once at `catchUp()`. Reads go to the store itself, so a tab drawn for any reason draws what's current.
 */
function gatedStore(store: AppStore, open: () => boolean): AppStore & { catchUp(): void } {
  const missed = new Set<() => void>();
  const data = Object.create(store) as AppStore & { catchUp(): void };
  data.subscribe = (topic, listener) => {
    const stop = store.subscribe(topic, () => {
      if (open()) listener();
      else missed.add(listener);
    });
    return () => {
      missed.delete(listener);
      stop();
    };
  };
  data.catchUp = () => {
    const due = [...missed];
    missed.clear();
    for (const listener of due) listener();
  };
  return data;
}

/** `parent`'s time, its ticks passed on only while `open()`; a tick missed is passed on at `catchUp()`. */
function gated(parent: UiClock, open: () => boolean): UiClock & { catchUp(): void } {
  const listeners = new Set<() => void>();
  let missed = false;
  let stop: (() => void) | null = null;
  const tell = () => {
    for (const listener of listeners) listener();
  };
  return {
    now: parent.now,
    subscribe(listener) {
      listeners.add(listener);
      stop ??= parent.subscribe(() => {
        if (open()) tell();
        else missed = true;
      });
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stop?.();
          stop = null;
        }
      };
    },
    catchUp() {
      if (!missed) return;
      missed = false;
      tell();
    },
  };
}
