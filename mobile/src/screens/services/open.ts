// Opening a service: a tab or a screen the window names goes through the app's own navigation (a tab switches, never
// stacks); a path of the phone's own is pushed over the tabs.
import { router } from "expo-router";
import { useNav } from "../../nav";
import type { Service } from "./list";

export function useOpenService(): (service: Service) => void {
  const { go } = useNav();
  return (service) => {
    if (typeof service.open === "string") router.push(service.open as never);
    else go(service.open);
  };
}
