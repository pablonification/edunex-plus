// Where the Student is, the phone's way: the desktop's routes (src/core/route.ts, which alerts and
// links name too) as Expo Router paths. Screens move with useNav().go(route), as on the desktop
// (src/app/nav.tsx), so a ported screen keeps its calls; Back is the phone's own.
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import type { Route } from "../../src/core/route";

export type { Route } from "../../src/core/route";

/** The path that shows `route`. */
export function hrefOf(route: Route): string {
  switch (route.screen) {
    case "home":
      return "/";
    case "tasks":
      return route.show === "done" ? "/tasks?show=done" : "/tasks";
    case "task":
      return `/task/${route.taskId}`;
    case "exam":
      return `/exam/${encodeURIComponent(route.examId)}`;
    case "course": {
      const query = [route.tab ? `tab=${encodeURIComponent(route.tab)}` : "", route.module !== undefined ? `module=${route.module}` : ""]
        .filter(Boolean)
        .join("&");
      return `/course/${encodeURIComponent(route.code)}${query ? `?${query}` : ""}`;
    }
    case "schedule":
      return "/schedule";
    case "presence":
      return "/presence";
    case "grades":
      return "/grades";
    case "plan":
      return route.tab ? `/plan?tab=${encodeURIComponent(route.tab)}` : "/plan";
  }
}

/** The tabs: going to one switches tab instead of stacking a second copy. */
const TABS = new Set<Route["screen"]>(["home", "tasks", "schedule", "presence"]);

export interface Nav {
  go(route: Route): void;
  /** What this screen shows now (its tab), kept in its place: Back skips it. */
  replace(route: Route): void;
  back(): void;
  canGoBack(): boolean;
}

export function useNav(): Nav {
  return useMemo(
    () => ({
      go(route) {
        const href = hrefOf(route);
        if (TABS.has(route.screen)) {
          // From a screen over the tabs (a Task, the bell, a notification's tap), back down to them first: a plain
          // navigate there would stack a second set of tabs, and Back would show the old screen again.
          if (router.canDismiss()) router.dismissAll();
          router.navigate(href as never);
        } else router.push(href as never);
      },
      replace(route) {
        router.setParams(paramsOf(route) as never);
      },
      back() {
        if (router.canGoBack()) router.back();
        else router.navigate("/" as never);
      },
      canGoBack: () => router.canGoBack(),
    }),
    [],
  );
}

function paramsOf(route: Route): Record<string, string | undefined> {
  switch (route.screen) {
    case "tasks":
      return { show: route.show };
    case "course":
      return { tab: route.tab, module: route.module === undefined ? undefined : String(route.module) };
    case "plan":
      return { tab: route.tab };
    default:
      return {};
  }
}

/** A route's search params, as strings; one given twice counts once. */
export function useParam(name: string): string | undefined {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
}
