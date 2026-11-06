// On the phone Nilai stays open under Rencana studi (the stack keeps it), so its plan state
// (src/app/study-plan.ts's usePlan keeps the screen's last change as a draft over the saved plan)
// could hold an older plan than the one the planner just saved, and its next change would write
// that older plan back. The desktop never has two of these screens open at once. This gives the
// screen a new key when it comes back into view after the saved plan changed elsewhere, so its
// plan state starts again from what's saved; a change made on the screen itself keeps it.
import { useIsFocused } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useDataset } from "../../../../src/app/store";

export function useFreshPlan(): number {
  const stored = useDataset("local.plan");
  const focused = useIsFocused();
  const [generation, setGeneration] = useState(0);
  const wasFocused = useRef(focused);
  const atBlur = useRef(stored);
  useEffect(() => {
    if (wasFocused.current && !focused) atBlur.current = stored;
    if (!wasFocused.current && focused && stored !== atBlur.current) setGeneration((n) => n + 1);
    wasFocused.current = focused;
  }, [focused, stored]);
  return generation;
}
