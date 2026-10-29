// The app's side of the home-screen widget (D1): while the app is up, the widget is drawn from its
// engine, again whenever what it shows changes (a dataset, a source's state, the language or the
// theme), when the class on it starts or ends, and as the app goes to the background. The
// background sync (./background.ts) draws it after each round, so it keeps up with the app closed.
import { useEffect } from "react";
import { AppState } from "react-native";
import { getWidgetInfo, requestWidgetUpdate } from "react-native-android-widget";
import type { Event } from "../../../src/core/contract";
import { currentModel, drawingOf, type LiveSource, setLiveSource } from "../widget/draw";
import { saveDemoOffset } from "../widget/saved";
import { WIDGET_NAME } from "../widget/view";
import { type Host, host } from "./host";

/** Events come in bursts during a sync: one drawing after they settle. */
const SETTLE = 1_500;
/** setTimeout's longest wait; a class further off is drawn by the next sync or Android's own update. */
const LONGEST = 2 ** 31 - 1;

const liveOf = (current: Pick<Host, "engine" | "clockOffset">): LiveSource => ({
  snapshot: () => current.engine.snapshot(),
  now: () => Date.now() + current.clockOffset(),
});

/**
 * Draws every widget the Student placed, from `current`'s engine (else the app's, else the disk).
 * Returns when what it says next changes by itself (a class starts or ends), or null.
 */
export async function updateWidgets(current?: Pick<Host, "engine" | "clockOffset">): Promise<number | null> {
  const placed = await getWidgetInfo(WIDGET_NAME);
  if (!placed.length) return null;
  const model = currentModel(current ? liveOf(current) : undefined);
  await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: (info) => drawingOf(model, info) });
  return model?.changesAt ?? null;
}

const REDRAW_ON = new Set<Event["type"]>(["dataset", "dataset.removed", "status", "settings"]);

/** Mount once, inside the app's frame: keeps the widget in step with the app while it's up. */
export function useWidgetUpdates(): void {
  useEffect(() => {
    let gone = false;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let turnover: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;
    let draw: () => void = () => undefined;

    void host().then((current) => {
      if (gone) return;
      setLiveSource(liveOf(current));
      saveDemoOffset(current.clockOffset());
      draw = () => {
        clearTimeout(settle);
        clearTimeout(turnover);
        updateWidgets(current)
          .then((at) => {
            const now = Date.now() + current.clockOffset();
            if (!gone && at !== null && at - now < LONGEST) turnover = setTimeout(draw, Math.max(0, at - now) + 1_000);
          })
          .catch((error) => console.error("[widget] update failed:", error));
      };
      unsubscribe = current.api.onEvent((event) => {
        if (!REDRAW_ON.has((event as Event).type)) return;
        clearTimeout(settle);
        settle = setTimeout(draw, SETTLE);
      });
      draw();
    });
    // Leaving the app: the widget shows exactly what the app last knew.
    const leaving = AppState.addEventListener("change", (state) => {
      if (state === "background") draw();
    });

    return () => {
      gone = true;
      clearTimeout(settle);
      clearTimeout(turnover);
      unsubscribe?.();
      leaving.remove();
      setLiveSource(null);
    };
  }, []);
}
