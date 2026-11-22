// Usage data (ADR 0016): which screen showed, by its route's name in the app's own files only
// ("course/[code]/index" counts as "course"), never what it showed. The engine counts it while the
// Student leaves usage data on (src/engine/usage.ts).
import { useNavigationContainerRef } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { useBridge } from "../../../src/app/store";

/** A route's name as usage data counts it: no groups, no parameters, no index ("(tabs)/index" is "home"). */
export function usageScreenOf(route: string): string {
  const parts = route.split("/").filter((part) => part && !/^[([+]/.test(part) && part !== "index");
  return parts.join("-") || "home";
}

export function useUsageScreens(): void {
  const bridge = useBridge();
  const navigation = useNavigationContainerRef() as unknown as {
    addListener(event: "state", listener: () => void): () => void;
    getCurrentRoute(): { name: string } | undefined;
  };
  useEffect(() => {
    let last: string | null = null;
    const count = (again: boolean) => {
      const name = navigation.getCurrentRoute()?.name;
      if (!name) return;
      const screen = usageScreenOf(name);
      // A screen that only changed what it shows (its tab, a filter) isn't opened again; the app back in front shows it again.
      if (screen === last && !again) return;
      last = screen;
      void bridge.invoke("usage.screen", { screen }).catch(() => undefined);
    };
    const moved = navigation.addListener("state", () => count(false));
    const back = AppState.addEventListener("change", (state) => {
      if (state === "active") count(true);
    });
    return () => {
      moved();
      back.remove();
    };
  }, [navigation, bridge]);
}
