// A skeleton becoming its data, seen arriving (DESIGN.md, "Motion"): the id a screen hands to `CrossFade` around the
// two. It changes once, from "wait" to "data", and only when the Student is looking: data that lands on a hidden tab
// or under a pushed screen, or before the first frame, is simply there when they come to it (a fade started on a
// hidden tab with animations off was left invisible: ui/expressive.tsx, `Rise`).
import { NavigationContext } from "expo-router/react-navigation";
import { useContext, useRef } from "react";
import { firstFrameShown } from "../shell/first-frame";

/** "wait" while the skeleton shows, "data" once the data came in front of the Student; decided once per mount. */
export function useArrivalId(ready: boolean): "wait" | "data" {
  const navigation = useContext(NavigationContext);
  const id = useRef<"wait" | "data" | null>(ready ? "data" : null);
  if (ready && id.current === null) id.current = firstFrameShown() && (navigation?.isFocused() ?? true) ? "data" : "wait";
  return id.current ?? "wait";
}
