// Where the Student is in the app, with a back history (mouse back button,
// ⌘[ via the menu later). Screens move with go(); nothing reads the URL.
// Before the screen changes, `leave` may hold it (a PDF with unsaved filling
// asks the Student first) and lets it go on only if they say so. Moving to a
// screen whose code is still loading (later.tsx) is a transition: the one
// before it stays on screen until it can draw, never a blank frame. Any other
// move draws at once, as a transition would draw it a little later.
import { createContext, type ReactNode, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "../core/route";

export type { Route } from "../core/route";

interface Nav {
  route: Route;
  go(route: Route): void;
  back(): void;
  canGoBack: boolean;
  /** Where back goes, to name it on the back button. */
  previous: Route | null;
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
  const [history, setHistory] = useState<Route[]>([initial ?? { screen: "home" }]);
  const latest = useRef({ leave, drawsAtOnce, history });
  latest.current = { leave, drawsAtOnce, history };
  const move = useCallback((update: (stack: Route[]) => Route[]) => {
    const next = () => {
      const { drawsAtOnce, history } = latest.current;
      const to = update(history).at(-1);
      if (drawsAtOnce && to && drawsAtOnce(to)) setHistory(update);
      else startTransition(() => setHistory(update));
    };
    const { leave } = latest.current;
    if (leave) leave(next);
    else next();
  }, []);
  const go = useCallback(
    (route: Route) => move((stack) => (JSON.stringify(stack.at(-1)) === JSON.stringify(route) ? stack : [...stack.slice(-49), route])),
    [move],
  );
  const back = useCallback(() => move((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack)), [move]);
  useEffect(() => {
    const onMouse = (event: MouseEvent) => {
      if (event.button === 3) back();
    };
    window.addEventListener("mouseup", onMouse);
    return () => window.removeEventListener("mouseup", onMouse);
  }, [back]);
  const value = useMemo<Nav>(
    () => ({ route: history.at(-1)!, go, back, canGoBack: history.length > 1, previous: history.at(-2) ?? null }),
    [history, go, back],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("NavProvider is missing");
  return nav;
}
