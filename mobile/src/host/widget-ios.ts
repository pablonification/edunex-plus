// The iPhone's widgets (./widget-ios.ios.ts, which Metro takes on iOS instead of this file). Everywhere else there's
// nothing to do: Android's widgets are ./widget.ts's.
import type { Lang } from "../../../src/core/strings";
import type { LiveSource } from "../widget/draw";
import type { LivePreview } from "../widget-ios/live-preview";

/** Hands the widgets' document to WidgetKit (iOS only). Returns when to draw again by itself: never, a timeline does. */
export async function updateIosWidgets(_source?: LiveSource): Promise<number | null> {
  return null;
}

/** Starts the Live Activity's preview, a made-up class on now (iOS only: Settings has no row for it elsewhere). */
export async function previewIosLive(_lang: Lang): Promise<LivePreview> {
  return { started: false, why: "failed" };
}
