// A tab's own clock: every tab is mounted ahead (an instant switch), and every date on screen hangs
// on the app's minute clock (useFormat, useNow), so each minute's tick drew all five tabs again at once:
// 300–500 ms of a blocked JS thread on `mid`, once a minute, whatever the Student was doing. A tab not
// in front (another tab, or a screen pushed over the tabs) lets the ticks pass and catches up once, the
// moment it's shown again, only if the minute changed while it was away. (Freezing hidden tabs with
// react-freeze was tried and measured: each switch then drew the whole tab again, 100–270 ms.)
import { useIsFocused } from "expo-router";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { ClockProvider, type UiClock, useClock } from "../../../src/app/i18n";

export function TabClock({ children }: { children: ReactNode }) {
  const parent = useClock();
  const focused = useIsFocused();
  const shown = useRef(focused);
  shown.current = focused;
  const clock = useMemo(() => gated(parent, () => shown.current), [parent]);
  useEffect(() => {
    if (focused) clock.catchUp();
  }, [focused, clock]);
  return <ClockProvider clock={clock}>{children}</ClockProvider>;
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
