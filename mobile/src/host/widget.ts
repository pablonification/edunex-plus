// The app's side of the home-screen widget (D1): while the app is up, the widget is drawn from its
// engine, again whenever what it shows changes (a dataset, a source's state, the language or the
// theme), when the class on it starts or ends, and as the app goes to the background. The
// background sync (./background.ts) draws it after each round, so it keeps up with the app closed.
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { getWidgetInfo, requestWidgetUpdateById, type WidgetInfo } from "react-native-android-widget";
import type { Event } from "../../../src/core/contract";
import { perfDoing } from "../perf";
import { changesAtOf, currentDrawing, drawingOf, type LiveSource, setLiveSource } from "../widget/draw";
import { WIDGET_NAMES } from "../widget/names";
import { saveDemoOffset } from "../widget/saved";
import { type Host, host } from "./host";
import { updateIosWidgets } from "./widget-ios";

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
 * What each placed widget last showed (its model, size and look), by Android's widget id: a widget whose next drawing
 * would be the same isn't drawn again. Each drawing is two pictures (light and dark) made and saved as PNGs on the phone,
 * the costly part on a slow phone, and most rounds of a sync change nothing a widget shows.
 */
const lastDrawn = new Map<number, string>();

/** One frame's pause between two widgets: the JS thread draws the app's screens in between. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Draws every widget the Student placed, from `current`'s engine (else the app's, else the disk), each only when what it
 * shows changed. Returns when what any of them says next changes by itself (a class starts or ends), or null.
 */
export async function updateWidgets(current?: Pick<Host, "engine" | "clockOffset">): Promise<number | null> {
  // An iPhone's widgets are WidgetKit's (./widget-ios.ios.ts): the same model, handed over as one document.
  if (Platform.OS === "ios") return updateIosWidgets(current ? liveOf(current) : undefined);
  // The rest is Android's (react-native-android-widget).
  if (Platform.OS !== "android") return null;
  const placed = await Promise.all(WIDGET_NAMES.map(async (name) => ({ name, infos: await getWidgetInfo(name) })));
  const widgets = placed.flatMap(({ name, infos }) => infos.map((info) => ({ name, info })));
  if (!widgets.length) return null;
  // A stall right after is the widgets': Beranda's reasoning again, and the pictures handed to Android (../perf.ts).
  perfDoing("the widget's drawing");
  const drawing = currentDrawing(current ? liveOf(current) : undefined);
  let next: number | null = null;
  for (const { name, info } of widgets) {
    const at = drawing ? changesAtOf(drawing, name, info.widgetId) : null;
    if (at !== null) next = next === null ? at : Math.min(next, at);
    const shown = signature(drawing ? drawing.modelOf(name, info.widgetId) : null, info, drawing?.facts.snapshot.settings);
    if (lastDrawn.get(info.widgetId) === shown) continue;
    lastDrawn.set(info.widgetId, shown);
    await requestWidgetUpdateById({ widgetName: name, widgetId: info.widgetId, renderWidget: (fresh) => drawingOf(drawing, fresh) });
    await breathe();
  }
  return next;
}

/** What a widget shows, as one string: the same string, the same picture. */
function signature(model: unknown, info: WidgetInfo, settings: { theme: string; lang: string } | undefined): string {
  return JSON.stringify([model, info.width, info.height, info.screenInfo.fontScale, settings?.theme, settings?.lang]);
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
