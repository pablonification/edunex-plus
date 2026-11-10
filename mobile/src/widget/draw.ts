// Drawing the widgets, wherever Android asks for them: from the running engine when the app is up
// (the app registers it, ../host/widget.ts), else from what the engine saved on disk (./saved.ts),
// so the widgets stay right with the app closed. This file and what it imports stay light: Android
// runs it on its own (a headless task) when a widget is added, resized or due for its update,
// without the app's screens or engine.
import { getLocales } from "expo-localization";
import type { WidgetInfo, WidgetRepresentation, WidgetTaskHandler } from "react-native-android-widget";
import type { Snapshot } from "../../../src/core/snapshot";
import { translate } from "../../../src/core/strings";
import { THEMES, type Theme } from "../ui/theme";
import { chosenCourse, forgetChoice } from "./choice";
import {
  attendanceWidget,
  courseWidget,
  dueWidget,
  examWidget,
  nextWidget,
  servicesWidget,
  type WidgetFacts,
  type WidgetModel,
  widgetFacts,
  widgetModel,
} from "./model";
import { isWidgetName, type WidgetName } from "./names";
import { readSaved } from "./saved";
import { emptyDrawing, todayDrawing, type WidgetSize, widgetDrawing } from "./view";
import { AttendanceView, CourseView, DueView, ExamView, NextView, ServicesView } from "./views";

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

/**
 * Everything any widget needs, worked out once per round of drawing however many are placed: the shared facts, and
 * each widget's own model made only when that widget is drawn (then kept for its other copies).
 */
export interface Drawing {
  facts: WidgetFacts;
  /** "Now" and "Hari ini"'s model. */
  main(): WidgetModel;
  /** The model a placed widget shows, as plain data (the same an iPhone widget would be given). */
  modelOf(name: WidgetName, widgetId: number): unknown;
}

/** What the widgets say now: from `source`, the app's engine, or the disk. Null when nothing is saved yet. */
export function currentDrawing(source: LiveSource | null = live): Drawing | null {
  const saved = source ? { snapshot: source.snapshot(), now: source.now() } : readSaved();
  if (!saved) return null;
  const facts = widgetFacts(saved.snapshot, saved.now);
  const kept = new Map<string, unknown>();
  const once = <T>(key: string, make: () => T): T => {
    if (!kept.has(key)) kept.set(key, make());
    return kept.get(key) as T;
  };
  const main = () => once("main", () => widgetModel(saved.snapshot, saved.now));
  return {
    facts,
    main,
    modelOf(name, widgetId) {
      switch (name) {
        case "Now":
        case "Today":
          return main();
        case "Due":
          return once(name, () => dueWidget(facts));
        case "Attendance":
          return once(name, () => attendanceWidget(facts));
        case "Exam":
          return once(name, () => examWidget(facts));
        case "Next":
          return once(name, () => nextWidget(facts));
        case "Services":
          return once(name, () => servicesWidget(facts));
        case "Course": {
          const code = chosenCourse(widgetId);
          return once(`${name}:${code ?? ""}`, () => courseWidget(facts, code));
        }
      }
    },
  };
}

/** When what the widget `name` says next changes by itself, or null. */
export function changesAtOf(drawing: Drawing, name: WidgetName, widgetId: number): number | null {
  const model = drawing.modelOf(name, widgetId) as { changesAt?: number | null };
  return model.changesAt ?? null;
}

type Pair = { light: React.JSX.Element; dark: React.JSX.Element };

/** One look, or the phone's light and dark when the Student left it to the phone. */
function looks(setting: "system" | "light" | "dark", draw: (theme: Theme) => React.JSX.Element): Pair {
  if (setting === "light" || setting === "dark") {
    const one = draw(THEMES[setting]);
    return { light: one, dark: one };
  }
  return { light: draw(THEMES.light), dark: draw(THEMES.dark) };
}

/** One placed widget, at its size. */
export function drawingOf(drawing: Drawing | null, info: WidgetInfo): WidgetRepresentation {
  if (!drawing) {
    // Nothing saved: the app was never set up here. In the phone's language, as the app's first start.
    const lang = getLocales()[0]?.languageCode === "id" ? "id" : "en";
    return emptyDrawing(translate(lang, "welcome.continueHint"));
  }
  const size: WidgetSize = { width: info.width, height: info.height, fontScale: info.screenInfo.fontScale || 1 };
  const name: WidgetName = isWidgetName(info.widgetName) ? info.widgetName : "Now";
  const { lang, snapshot } = drawing.facts;
  const theme = snapshot.settings.theme;
  switch (name) {
    case "Now":
      return widgetDrawing(drawing.main(), size);
    case "Today":
      return todayDrawing(drawing.main(), size);
    case "Due":
      return looks(theme, (t) => DueView({ model: drawing.modelOf(name, info.widgetId) as ReturnType<typeof dueWidget>, size, theme: t, lang }));
    case "Attendance":
      return looks(theme, (t) => AttendanceView({ model: drawing.modelOf(name, info.widgetId) as ReturnType<typeof attendanceWidget>, size, theme: t, lang }));
    case "Exam":
      return looks(theme, (t) => ExamView({ model: drawing.modelOf(name, info.widgetId) as ReturnType<typeof examWidget>, size, theme: t }));
    case "Next":
      return looks(theme, (t) => NextView({ model: drawing.modelOf(name, info.widgetId) as ReturnType<typeof nextWidget>, size, theme: t }));
    case "Services":
      return looks(theme, (t) => ServicesView({ model: drawing.modelOf(name, info.widgetId) as ReturnType<typeof servicesWidget>, size, theme: t }));
    case "Course":
      return looks(theme, (t) => CourseView({ model: drawing.modelOf(name, info.widgetId) as ReturnType<typeof courseWidget>, size, theme: t }));
  }
}

/** Android's calls (a widget added, resized, due for its update): drawn again from what's known now. */
export const widgetTask: WidgetTaskHandler = async ({ widgetAction, widgetInfo, renderWidget }) => {
  if (widgetAction === "WIDGET_DELETED") {
    forgetChoice(widgetInfo.widgetId);
    return;
  }
  try {
    renderWidget(drawingOf(currentDrawing(), widgetInfo));
  } catch (error) {
    // The widget keeps what it showed last.
    console.error("[widget] drawing failed:", error);
  }
};
