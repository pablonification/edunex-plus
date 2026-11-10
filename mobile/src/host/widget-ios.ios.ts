// The app's side of the iPhone's widgets (mobile/qa/superapp-ios-widgets.md): whenever Android's widgets are drawn
// again (./widget.ts's updateWidgets: the app's events, leaving the app, the background sync), the iPhone's get the
// same model as one document (../widget-ios/doc.ts), handed to WidgetKit through expo-widgets, which keeps it in the
// shared store (the App Group) and asks iOS to draw the widgets again.
//
// iOS draws a widget only when asked, and lets an app in the background ask a few dozen times a day: so the app
// writes a timeline, the document now and again at each moment it changes by itself (a class starts or ends, a
// window closes, midnight), and the widget turns over on time with the app closed.
//
// The class on now also gets a Live Activity (../widget-ios/live.tsx): started while the app is open during a class
// (iOS lets an app start one only from the foreground), kept up to date, and ended once the class is over.
//
// Metro takes this file on iOS only; ./widget-ios.ts is every other platform's (nothing to do).
import { getLocales } from "expo-localization";
import { AppState } from "react-native";
import type { Snapshot } from "../../../src/core/snapshot";
import { translate } from "../../../src/core/strings";
import { hrefOf } from "../nav";
import { perfDoing } from "../perf";
import type { LiveSource } from "../widget/draw";
import type { WidgetTarget } from "../widget/model";
import { widgetModel } from "../widget/model";
import { readSaved } from "../widget/saved";
import { type IosWidgetDoc, iosWidgetDoc, setupDoc } from "../widget-ios/doc";
import { type LiveDoc, liveDoc } from "../widget-ios/live-doc";
import { DEMO } from "./version";
import type { updateIosWidgets as Contract } from "./widget-ios";

/** The app's deep links (app.config.ts's scheme), as Android's widget makes them (../widget/view.tsx's tap). */
const SCHEME = DEMO ? "edunexplusdemo" : "edunexplus";
const TITLE = DEMO ? "Edunex Plus Demo" : "Edunex Plus";

/** How far ahead the timeline goes, and how many moments at most: each is Beranda's reasoning again. */
const HORIZON = 36 * 60 * 60 * 1000;
const MOST = 8;

export function linkOf(open: WidgetTarget): string {
  switch (open.kind) {
    case "app":
      return `${SCHEME}://`;
    case "url":
      return open.url;
    case "route":
      return `${SCHEME}://${hrefOf(open.route).replace(/^\//, "")}`;
    case "class":
      return `${SCHEME}://schedule?class=${encodeURIComponent(open.sessionId)}`;
    case "checkIn":
      // The demo's SIX is pretend: Presensi instead, as its "Tandai Hadir" opens nothing.
      return DEMO ? `${SCHEME}://presence` : `${SCHEME}://check-in/${encodeURIComponent(open.meetingId)}`;
  }
}

type Widgets = { now: import("expo-widgets").Widget<IosWidgetDoc>; today: import("expo-widgets").Widget<IosWidgetDoc> };
let widgets: Widgets | null | undefined;

/** The two widgets, loaded on first use; null when this build has no widget extension (built before expo-widgets). */
function loaded(): Widgets | null {
  if (widgets !== undefined) return widgets;
  try {
    widgets = {
      now: (require("../widget-ios/now") as typeof import("../widget-ios/now")).default,
      today: (require("../widget-ios/today") as typeof import("../widget-ios/today")).default,
    };
  } catch (error) {
    console.warn("[widget-ios] no widgets in this build:", error);
    widgets = null;
  }
  return widgets;
}

type Factory = import("expo-widgets").LiveActivityFactory<LiveDoc>;
let factory: Factory | null | undefined;

function liveFactory(): Factory | null {
  if (factory !== undefined) return factory;
  try {
    factory = (require("../widget-ios/live") as typeof import("../widget-ios/live")).default;
  } catch (error) {
    console.warn("[widget-ios] no Live Activity in this build:", error);
    factory = null;
  }
  return factory;
}

/** What was handed over last: the same timeline twice isn't asked for again (iOS counts the asks). */
let last = "";

/** The next midnight after `at`, on the phone's clock: "Hari ini" turns over. */
function midnightAfter(at: number): number {
  const day = new Date(at);
  day.setHours(24, 0, 0, 0);
  return day.getTime();
}

const breath = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** The timeline's moments and what the widgets say at each, from `snapshot` at `now`. */
async function timeline(snapshot: Pick<Snapshot, "datasets" | "statuses" | "settings">, now: number): Promise<{ at: number; doc: IosWidgetDoc }[]> {
  const entries: { at: number; doc: IosWidgetDoc }[] = [];
  let at = now;
  while (entries.length < MOST) {
    const model = widgetModel(snapshot, at);
    entries.push({ at, doc: iosWidgetDoc(model, TITLE, linkOf) });
    const turns = model.changesAt;
    const next = Math.min(turns ?? Number.POSITIVE_INFINITY, midnightAfter(at));
    if (next - now > HORIZON) break;
    // A second after the moment, so the class that starts at 08:00 is on by then.
    at = next + 1_000;
    // Each moment is Beranda's reasoning again: let a frame through between them.
    await breath();
  }
  return entries;
}

export const updateIosWidgets: typeof Contract = async (source?: LiveSource) => {
  const all = loaded();
  if (!all) return null;
  perfDoing("the iPhone widgets' timeline");
  const saved = source ? { snapshot: source.snapshot(), now: source.now() } : readSaved();
  // The demo's clock runs ahead of the phone's: the timeline is on the phone's.
  const offset = saved ? saved.now - Date.now() : 0;
  const entries = saved
    ? await timeline(saved.snapshot, saved.now)
    : [
        {
          at: Date.now(),
          doc: setupDoc(TITLE, translate(getLocales()[0]?.languageCode === "id" ? "id" : "en", "welcome.continueHint"), `${SCHEME}://`),
        },
      ];
  if (saved && entries[0]) await updateLive(liveDoc(saved.snapshot, saved.now, entries[0].doc), offset);
  const key = JSON.stringify(entries.map((entry) => entry.doc)) + entries.map((entry) => entry.at - entries[0]!.at).join();
  if (key === last) return null;
  last = key;
  const items = entries.map((entry) => ({ date: new Date(entry.at - offset), props: entry.doc }));
  try {
    all.now.updateTimeline(items);
    all.today.updateTimeline(items);
  } catch (error) {
    last = "";
    console.error("[widget-ios] update failed:", error);
  }
  // The timeline turns the widgets over by itself: the app needn't wake for it.
  return null;
};

/** The Live Activity running for a class: `key` is "" for one found running when the app started. */
let running: { key: string; json: string; activity: import("expo-widgets").LiveActivity<LiveDoc> } | null = null;

/** Starts, updates or ends the class's Live Activity so it matches `next` (null: no class on). */
async function updateLive(next: LiveDoc | null, offset: number): Promise<void> {
  const live = liveFactory();
  if (!live) return;
  try {
    if (!running) {
      // The app was closed with one running: take it over, and end any others.
      const [first, ...rest] = live.getInstances();
      for (const other of rest) await other.end("immediate");
      if (first) running = { key: "", json: "", activity: first };
    }
    if (!next) {
      await running?.activity.end("default");
      running = null;
      return;
    }
    // Its moments on the phone's clock: the demo's runs ahead of it.
    const props: LiveDoc = {
      ...next,
      startsAt: next.startsAt - offset,
      endsAt: next.endsAt - offset,
      presence: next.presence ? { ...next.presence, closesAt: next.presence.closesAt - offset } : null,
    };
    const json = JSON.stringify(props);
    if (running && (running.key === props.key || running.key === "")) {
      if (running.json !== json) await running.activity.update(props, new Date(props.endsAt));
      running = { ...running, key: props.key, json };
      return;
    }
    // Another class: the last one's activity goes at once.
    await running?.activity.end("immediate");
    running = null;
    if (AppState.currentState !== "active") return;
    running = { key: props.key, json, activity: live.start(props, props.url, new Date(props.endsAt)) };
  } catch (error) {
    // Live Activities turned off in Settings, or iOS said no: the widgets don't depend on it.
    console.warn("[widget-ios] Live Activity:", error);
  }
}
