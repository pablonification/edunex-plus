// The app's side of the home-screen widget (D1): while the app is up, the widget is drawn from its
// engine, again whenever what it shows changes (a dataset, a source's state, the language or the
// theme), when the class on it starts or ends, and as the app goes to the background. The
// background sync (./background.ts) draws it after each round, so it keeps up with the app closed.
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { getWidgetInfo, requestWidgetUpdate } from "react-native-android-widget";
import type { Event } from "../../../src/core/contract";
import { perfDoing } from "../perf";
import { currentModel, drawingOf, type LiveSource, setLiveSource } from "../widget/draw";
import { saveDemoOffset } from "../widget/saved";
import { WIDGET_NAMES } from "../widget/view";
import { type Host, host } from "./host";

/** Events come in bursts during a sync: one drawing after they settle. */
const SETTLE = 1_500;
/**
 * The app's first drawing of the widget waits for the start to settle: the widget already shows what the app knew when
 * it was last left, and working out what it says (Beranda's reasoning, again) in the first second held the JS thread
 * while Beranda and the tabs were drawing.
 */
const AFTER_START = 8_000;
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
  // The widget is Android's only (react-native-android-widget); an iPhone has none to draw.
  if (Platform.OS !== "android") return null;
  const placed = await Promise.all(WIDGET_NAMES.map(async (name) => ((await getWidgetInfo(name)).length ? name : null)));
  const names = placed.filter((name) => name !== null);
  if (!names.length) return null;
  // A stall right after is the widget's: Beranda's reasoning again, and the drawing handed to Android (../perf.ts).
  perfDoing("the widget's drawing");
  const model = currentModel(current ? liveOf(current) : undefined);
  for (const name of names) await requestWidgetUpdate({ widgetName: name, renderWidget: (info) => drawingOf(model, info) });
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
      settle = setTimeout(draw, AFTER_START);
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
