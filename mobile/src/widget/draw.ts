// Drawing the widget, wherever Android asks for it: from the running engine when the app is up
// (the app registers it, ../host/widget.ts), else from what the engine saved on disk (./saved.ts),
// so the widget stays right with the app closed. This file and what it imports stay light: Android
// runs it on its own (a headless task) when a widget is added, resized or due for its update,
// without the app's screens or engine.
import { getLocales } from "expo-localization";
import type { WidgetInfo, WidgetRepresentation, WidgetTaskHandler } from "react-native-android-widget";
import type { Snapshot } from "../../../src/core/snapshot";
import { translate } from "../../../src/core/strings";
import { type WidgetModel, widgetModel } from "./model";
import { readSaved } from "./saved";
import { emptyDrawing, widgetDrawing } from "./view";

/** The engine as the app has it running: its snapshot and its moment (the demo's runs ahead). */
export interface LiveSource {
  snapshot(): Pick<Snapshot, "datasets" | "statuses" | "settings">;
  now(): number;
}

let live: LiveSource | null = null;

/** The app is up: draw from its engine. Null again when it goes. */
export function setLiveSource(source: LiveSource | null): void {
  live = source;
}

/** What the widget says now: from `source`, the app's engine, or the disk. Null when nothing is saved yet. */
export function currentModel(source: LiveSource | null = live): WidgetModel | null {
  const saved = source ? { snapshot: source.snapshot(), now: source.now() } : readSaved();
  return saved ? widgetModel(saved.snapshot, saved.now) : null;
}

/** One placed widget, at its size. */
export function drawingOf(model: WidgetModel | null, info: WidgetInfo): WidgetRepresentation {
  if (!model) {
    // Nothing saved: the app was never set up here. In the phone's language, as the app's first start.
    const lang = getLocales()[0]?.languageCode === "id" ? "id" : "en";
    return emptyDrawing(translate(lang, "welcome.continueHint"));
  }
  return widgetDrawing(model, { width: info.width, height: info.height, fontScale: info.screenInfo.fontScale || 1 });
}

/** Android's calls (the widget added, resized, due for its update): drawn again from what's known now. */
export const widgetTask: WidgetTaskHandler = async ({ widgetAction, widgetInfo, renderWidget }) => {
  if (widgetAction === "WIDGET_DELETED") return;
  try {
    renderWidget(drawingOf(currentModel(), widgetInfo));
  } catch (error) {
    // The widget keeps what it showed last.
    console.error("[widget] drawing failed:", error);
  }
};
