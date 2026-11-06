// A clock for screens that never say a time to the minute (Nilai, Rencana studi): it passes the app's minute ticks
// on only when the hour changes. Every date on screen hangs on the minute clock (useFormat → useNow), so without it
// such a screen drew itself again once a minute for nothing: 100–130 ms of a blocked JS thread on `mid`.
import { type ReactNode, useMemo } from "react";
import { ClockProvider, type UiClock, useClock } from "../../../src/app/i18n";

const HOUR = 3_600_000;

export function HourClock({ children }: { children: ReactNode }) {
  const parent = useClock();
  const clock = useMemo(() => hourly(parent), [parent]);
  return <ClockProvider clock={clock}>{children}</ClockProvider>;
}

/** `parent`'s time, read at the last hour it passed on; its ticks passed on when the hour changes. */
function hourly(parent: UiClock): UiClock {
  const hourOf = () => Math.floor(parent.now() / HOUR);
  let shown = parent.now();
  return {
    now: () => shown,
    subscribe(listener) {
      return parent.subscribe(() => {
        if (hourOf() === Math.floor(shown / HOUR)) return;
        shown = parent.now();
        listener();
      });
    },
  };
}
