// Rencana studi's page scroll, for a line that points further down the tab: "1 hal perlu dicek"
// scrolls to the checks, which the desktop shows beside the plan and a phone puts under it.
import { type ComponentRef, createContext, type RefObject, useCallback, useContext } from "react";
import type { ScrollView, View } from "react-native";
import { space } from "../../ui/theme";

const PageScroll = createContext<RefObject<ComponentRef<typeof ScrollView> | null> | null>(null);

export const PageScrollProvider = PageScroll.Provider;

/** Scrolls the page so `target` sits near its top. */
export function useScrollToView(): (target: ComponentRef<typeof View> | null) => void {
  const scroll = useContext(PageScroll);
  return useCallback(
    (target) => {
      const page = scroll?.current;
      const inner = page?.getInnerViewRef();
      if (!page || !inner || !target) return;
      target.measureLayout(inner, (_x, y) => page.scrollTo({ y: Math.max(0, y - space[4]), animated: true }));
    },
    [scroll],
  );
}
