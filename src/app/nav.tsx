// Where the Student is in the app, with a back history (mouse back button,
// ⌘[ via the menu later). Screens move with go(); nothing reads the URL.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

export function NavProvider({ initial, children }: { initial?: Route; children: ReactNode }) {
  const [history, setHistory] = useState<Route[]>([initial ?? { screen: "home" }]);
  const go = useCallback((route: Route) => {
    setHistory((stack) => (JSON.stringify(stack.at(-1)) === JSON.stringify(route) ? stack : [...stack.slice(-49), route]));
  }, []);
  const back = useCallback(() => setHistory((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack)), []);
  useEffect(() => {
    const onMouse = (event: MouseEvent) => {
      if (event.button === 3) back();
    };
    window.addEventListener("mouseup", onMouse);
    return () => window.removeEventListener("mouseup", onMouse);
  }, [back]);
  const value = useMemo<Nav>(() => ({ route: history.at(-1)!, go, back, canGoBack: history.length > 1, previous: history.at(-2) ?? null }), [history, go, back]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("NavProvider is missing");
  return nav;
}
