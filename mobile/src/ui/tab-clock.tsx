// A tab's own clock: every tab is mounted ahead (an instant switch), and every date on screen hangs
// on the app's minute clock (useFormat, useNow), so each minute's tick drew all five tabs again at once:
// 300–500 ms of a blocked JS thread on `mid`, once a minute, whatever the Student was doing. A tab not
// in front (another tab, or a screen pushed over the tabs) lets the ticks pass and catches up once, the
// moment it's shown again, only if the minute changed while it was away. (Freezing hidden tabs with
// react-freeze was tried and measured: each switch then drew the whole tab again, 100–270 ms.) The same for the
// data: a dataset that changes (SIX's check-in read every 2 minutes in class, a feed's page) redrew every tab that reads
// it, 200–560 ms on a small phone while the Student looked at one; a hidden tab now hears of it when it's shown.
// A hidden tab also draws for the first time on its own turn: the four drawn at once with Beranda held Beranda's data
// back about 400 ms on a start with saved data (Redroid, compared on one machine). Each now waits for the start to
// settle, then one tab every 300 ms once the JS thread is idle; opened before its turn, it draws at once.
import { useIsFocused } from "expo-router";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
  const [drawn, setDrawn] = useState(focused);
  useEffect(() => {
    if (drawn) return;
    if (focused) {
      setDrawn(true);
      return;
    }
    return queueFirstDraw(() => setDrawn(true));
  }, [focused, drawn]);
  useEffect(() => {
    if (!focused) return;
    data.catchUp();
    clock.catchUp();
  }, [focused, clock, data]);
  if (!drawn) return null;
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

/** The hidden tabs' first draws, one at a time: the first after `FIRST_MS`, then one every `NEXT_MS`. */
const FIRST_MS = 800;
const NEXT_MS = 300;
const waiting: (() => void)[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function pump(delay: number): void {
  timer = setTimeout(() => {
    whenIdle(() => {
      waiting.shift()?.();
      if (waiting.length) pump(NEXT_MS);
      else timer = null;
    });
  }, delay);
}

/** `run` once the JS thread is idle (React Native's requestIdleCallback), or on the next frame without it. */
function whenIdle(run: () => void): void {
  const idle = (globalThis as { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(run, { timeout: 1000 });
  else requestAnimationFrame(run);
}

/** Calls `draw` on its turn; the returned function takes it out of the line (the tab was shown first, or went). */
function queueFirstDraw(draw: () => void): () => void {
  waiting.push(draw);
  if (timer === null) pump(FIRST_MS);
  return () => {
    const at = waiting.indexOf(draw);
    if (at >= 0) waiting.splice(at, 1);
  };
}
