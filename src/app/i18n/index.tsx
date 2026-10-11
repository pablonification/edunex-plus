// Language and time for the screens. The language comes from settings; the
// clock ticks once a minute so "in 6 hours" stays true without re-rendering
// every second. Tests pass their own clock.
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { type Format, makeFormat } from "./format";
import { type Lang, type StringKey, type Vars, translate } from "../../core/strings";

export type { Lang, StringKey } from "../../core/strings";
export type { Format } from "./format";

export interface UiClock {
  now(): number;
  subscribe(listener: () => void): () => void;
}

/** Real time (moved by `offsetMs`, for the development demo), published on each minute boundary. */
export function systemClock(offsetMs = 0): UiClock {
  const read = () => Date.now() + offsetMs;
  let current = read();
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const tick = () => {
    current = read();
    for (const listener of listeners) listener();
    timer = setTimeout(tick, 60_000 - (current % 60_000) + 50);
  };
  return {
    now: () => current,
    subscribe(listener) {
      listeners.add(listener);
      if (!timer) timer = setTimeout(tick, 60_000 - (read() % 60_000) + 50);
      return () => {
        listeners.delete(listener);
        if (!listeners.size && timer) {
          clearTimeout(timer);
          timer = null;
        }
      };
    },
  };
}

const LangContext = createContext<Lang>("id");
const ClockContext = createContext<UiClock | null>(null);
const defaultClock = systemClock();

export function I18nProvider({ lang, clock, children }: { lang: Lang; clock?: UiClock; children: ReactNode }) {
  return (
    <LangContext.Provider value={lang}>
      <ClockContext.Provider value={clock ?? defaultClock}>{children}</ClockContext.Provider>
    </LangContext.Provider>
  );
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export type Translate = (key: StringKey, vars?: Vars) => string;

export function useT(): Translate {
  const lang = useLang();
  return useCallback((key: StringKey, vars?: Vars) => translate(lang, key, vars), [lang]);
}

export function useNow(): number {
  const clock = useContext(ClockContext) ?? defaultClock;
  return useSyncExternalStore(clock.subscribe, clock.now);
}

export function useFormat(): Format {
  const lang = useLang();
  const now = useNow();
  return useMemo(() => makeFormat(lang, now), [lang, now]);
}
