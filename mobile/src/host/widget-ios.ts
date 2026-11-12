// The iPhone's widgets (./widget-ios.ios.ts, which Metro takes on iOS instead of this file). Everywhere else there's
// nothing to do: Android's widgets are ./widget.ts's.
import type { LiveSource } from "../widget/draw";

/** Hands the widgets' document to WidgetKit (iOS only). Returns when to draw again by itself: never, a timeline does. */
export async function updateIosWidgets(_source?: LiveSource): Promise<number | null> {
  return null;
}
