// What the iPhone's Live Activity for the class on now says (./live.tsx; qa/superapp-ios-widgets.md, "The Live
// Activity"): the widget's class (./doc.ts, from Android's model) and the two moments iOS counts down to itself, the
// class's end and its Presence window's close, from the same reasoning Beranda's card uses (src/core/needs.ts). Pure:
// the snapshot, the moment and the widget's document in, the activity's props out (null when no class is on).

import { snapshotHomeWorld } from "../../../src/core/home-world";
import { homeContext, nowCard } from "../../../src/core/needs";
import type { Snapshot } from "../../../src/core/snapshot";
import type { DocPalette, IosWidgetDoc, Pair } from "./doc";

export interface LiveDoc {
  v: 1;
  /** One activity per class: a new class ends the last one's and starts its own. */
  key: string;
  code: string;
  name: string | null;
  /** "08:00–10:00 · R.SG PWK LT.6". */
  detail: string;
  /** On the phone's clock (the demo's runs ahead: the writer moves them back). */
  startsAt: number;
  endsAt: number;
  /** The Presence to fill in for this class, its window closing at `closesAt`; or SIX's "Tandai Hadir", open now. */
  presence: { label: string; closesAt: number; url: string } | null;
  checkIn: { label: string; url: string } | null;
  color: Pair;
  colors: { light: DocPalette; dark: DocPalette };
  url: string;
}

export function liveDoc(snapshot: Pick<Snapshot, "datasets" | "statuses" | "settings">, now: number, doc: IosWidgetDoc): LiveDoc | null {
  const klass = doc.now?.kind === "class" && doc.now.live ? doc.now : null;
  if (!klass) return null;
  const world = snapshotHomeWorld(snapshot, now);
  const card = world ? nowCard(homeContext(world)) : null;
  const slot = card?.class?.session ?? card?.meeting?.meeting ?? null;
  if (card?.state !== "live" || !slot) return null;
  const presence = card.presence && card.presence.code === klass.code && card.presence.session.closesAt > now ? card.presence : null;
  // The widget's buttons, in the model's words: the Presence one is the line that isn't "Tandai Hadir".
  const checkIn = doc.actions.find((one) => one.primary) ?? null;
  const fill = doc.actions.find((one) => !one.primary) ?? null;
  return {
    v: 1,
    key: `${klass.code}@${slot.start}`,
    code: klass.code,
    name: klass.name,
    detail: [klass.time, klass.where].filter(Boolean).join(" · "),
    startsAt: slot.start,
    endsAt: slot.end,
    presence: presence && fill ? { label: fill.label, closesAt: presence.session.closesAt, url: fill.url } : null,
    checkIn: checkIn ? { label: checkIn.label, url: checkIn.url } : null,
    color: klass.color,
    colors: doc.colors,
    url: klass.url,
  };
}
