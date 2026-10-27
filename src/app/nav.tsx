// Where the Student is in the app, with a back history (the mouse's back
// button and ⌘[, shell.tsx). Screens move with go(); nothing reads the URL.
// Back comes back to a screen as the Student left it: where on the screen they
// are (a course's tab and module, a study-plan tab, Tugas & Ujian's "Selesai"),
// which a link or an alert is compared with, is recorded in its route with
// replace(), which adds no step to Back; any other choice (the semester open on
// Nilai, a fold) is kept beside it with usePlaceState().
// Before the screen changes, `leave` may hold it (a PDF with unsaved filling
// asks the Student first) and lets it go on only if they say so. Moving to a
// screen whose code is still loading (later.tsx) is a transition: the one
// before it stays on screen until it can draw, never a blank frame. Any other
// move draws at once, as a transition would draw it a little later.
import { createContext, type ReactNode, startTransition, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Route } from "../core/route";

export type { Route } from "../core/route";

interface Nav {
  route: Route;
  /** The place in history being shown: new with each move, the same while its screen records what it shows (`replace`). */
  place: number;
  /** The place was come back to with Back, not opened: it shows as the Student left it. */
  returned: boolean;
  /**
   * Opens exactly what `route` names. Already shown, a course page opens afresh, and any other screen stays as
   * it is. `keep`: a place picked as a whole (the sidebar, ⌘1–6) is already there when its screen shows it in
   * any tab, and stays as it is.
   */
  go(route: Route, options?: { keep?: boolean }): void;
  /** What this place shows now (its tab, the module picked), kept in its place in history: Back comes back to it, and it adds no step. */
  replace(route: Route): void;
  back(): void;
  canGoBack: boolean;
  /** Where back goes, to name it on the back button. */
  previous: Route | null;
  /** What the screen keeps in its place in history (usePlaceState). */
  kept: Map<string, unknown>;
}

interface Place {
  route: Route;
  id: number;
}

/** Every part `route` names is `place`'s (a course's code, with any tab). */
const shows = (place: Route, route: Route) => Object.entries(route).every(([key, value]) => (place as Record<string, unknown>)[key] === value);
const same = (a: Route, b: Route) => shows(a, b) && shows(b, a);
/**
 * What a route puts on screen: a course with no tab named is on Modul, and its module shows only there (on
 * another tab, it's kept for coming back to it).
 */
function onScreen(route: Route): Route {
  if (route.screen !== "course") return route;
  const { tab, module, ...course } = route;
  if ((tab ?? "modules") !== "modules") return { ...course, tab };
  return module === undefined ? course : { ...course, module };
}

const NavContext = createContext<Nav | null>(null);

export function NavProvider({
  initial,
  leave,
  drawsAtOnce,
  children,
}: {
  initial?: Route;
  /** Asked before the screen changes; calls `next` when it may (at once, or once the Student agrees). */
  leave?: (next: () => void) => void;
  /** Whether a route's screen can draw at once (its code is in); without it, every move is a transition. */
  drawsAtOnce?: (route: Route) => boolean;
  children: ReactNode;
}) {
  const [history, setHistory] = useState<{ stack: Place[]; returned: boolean }>(() => ({
    stack: [{ route: initial ?? { screen: "home" }, id: 0 }],
    returned: false,
  }));
  const ids = useRef(0);
  const kept = useRef(new Map<number, Map<string, unknown>>());
  const latest = useRef({ leave, drawsAtOnce });
  latest.current = { leave, drawsAtOnce };
  // The history on screen: not one still being drawn (a move waiting for its screen's code).
  const shown = useRef(history);
  useLayoutEffect(() => {
    shown.current = history;
  }, [history]);
  /** `update` gives the new history from the one on screen, or null to stay. */
  const move = useCallback((update: (stack: Place[]) => Place[] | null, returned = false) => {
    const next = () => {
      const { drawsAtOnce } = latest.current;
      const to = update(shown.current.stack)?.at(-1);
      // Staying (the place on screen picked again) drops a move still waiting for its screen's code: queued after it,
      // the history on screen is the one that's kept.
      if (!to) return setHistory(() => shown.current);
      const apply = () =>
        setHistory((history) => {
          const stack = update(history.stack);
          return stack ? { stack, returned } : history;
        });
      if (drawsAtOnce?.(to.route)) apply();
      else startTransition(apply);
    };
    const { leave } = latest.current;
    if (leave) leave(next);
    else next();
  }, []);
  const go = useCallback(
    (route: Route, { keep = false } = {}) => {
      const id = ++ids.current;
      move((stack) => {
        const shown = stack.at(-1)!.route;
        if (keep && shows(shown, route)) return null;
        // A link to exactly the course page shown opens it afresh, with no step for Back: what it's about (the class on
        // now, the module it names) may be scrolled out of sight. Any other screen stays: a Task keeps the files being attached.
        if (same(onScreen(shown), onScreen(route))) return route.screen === "course" ? [...stack.slice(0, -1), { route, id }] : null;
        return [...stack.slice(-49), { route, id }];
      });
    },
    [move],
  );
  const back = useCallback(() => move((stack) => (stack.length > 1 ? stack.slice(0, -1) : null), true), [move]);
  // The same screen, still drawn: nothing to leave, nothing to load. Its own place, even with a move to another
  // screen still waiting for its code (a transition) above it.
  const replaceAt = useCallback(
    (id: number, route: Route) =>
      setHistory((history) => {
        const at = history.stack.findIndex((place) => place.id === id);
        if (at < 0 || same(history.stack[at].route, route)) return history;
        return { ...history, stack: history.stack.with(at, { route, id }) };
      }),
    [],
  );
  // A place gone from history (gone back from, or past the 50 kept) is never shown again.
  useEffect(() => {
    for (const id of kept.current.keys()) if (!history.stack.some((place) => place.id === id)) kept.current.delete(id);
  }, [history]);
  const value = useMemo<Nav>(() => {
    const { stack, returned } = history;
    const { route, id } = stack.at(-1)!;
    let here = kept.current.get(id);
    if (!here) kept.current.set(id, (here = new Map()));
    return {
      route,
      place: id,
      returned,
      go,
      replace: (next: Route) => replaceAt(id, next),
      back,
      canGoBack: stack.length > 1,
      previous: stack.at(-2)?.route ?? null,
      kept: here,
    };
  }, [history, go, replaceAt, back]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("NavProvider is missing");
  return nav;
}

/**
 * Like `useState`, for a choice the screen's route doesn't carry (the semester open on Nilai, a fold opened):
 * kept in its place in history, so Back finds it as the Student left it; a new visit starts from `initial`.
 */
export function usePlaceState<T>(key: string, initial: T): [T, (next: T) => void] {
  const { kept } = useNav();
  const [value, setValue] = useState<T>(() => (kept.has(key) ? (kept.get(key) as T) : initial));
  const set = useCallback(
    (next: T) => {
      kept.set(key, next);
      setValue(next);
    },
    [kept, key],
  );
  return [value, set];
}
