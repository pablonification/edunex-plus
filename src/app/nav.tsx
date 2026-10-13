// Where the Student is in the app, with a back history (mouse back button,
// ⌘[ via the menu later). Screens move with go(); nothing reads the URL.
// Before the screen changes, `leave` may hold it (a PDF with unsaved filling
// asks the Student first) and lets it go on only if they say so.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  children,
}: {
  initial?: Route;
  /** Asked before the screen changes; calls `next` when it may (at once, or once the Student agrees). */
  leave?: (next: () => void) => void;
  children: ReactNode;
}) {
  const [history, setHistory] = useState<Route[]>([initial ?? { screen: "home" }]);
  const latestLeave = useRef(leave);
  latestLeave.current = leave;
  const move = useCallback((update: (stack: Route[]) => Route[]) => {
    const next = () => setHistory(update);
    if (latestLeave.current) latestLeave.current(next);
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
