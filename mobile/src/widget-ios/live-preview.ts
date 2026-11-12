// Settings' "Coba Aktivitas Langsung" on an iPhone (../screens/settings/about.tsx): the class's Live Activity
// (./live.tsx), started now with a made-up class, so it can be looked at on the Lock Screen and in the Dynamic Island
// without waiting for a real one. The same props as the real one (./live-doc.ts's LiveDoc), handed to the same factory
// (../host/widget-ios.ios.ts), so a preview that draws says the real one will. Pure: the words and the moment in, the
// props out, and the rule that keeps the preview running once the app is left.

import { makeFormat } from "../../../src/core/format";
import { type Lang, translate } from "../../../src/core/strings";
import { courseColor, DOC_COLORS } from "./doc";
import type { LiveDoc } from "./live-doc";

/** The preview's key: no class has it (a class's is "<code>@<start>"). */
export const PREVIEW_KEY = "preview";
/** A course code no course has: a code is a name, the same in both languages. */
const SAMPLE_CODE = "XX1234";

const MINUTE = 60_000;
/** Already on for a while, so the bar starts part of the way through. */
const STARTED_AGO = 5 * MINUTE;
/** Long enough to lock the phone and watch the bar and the countdown move, short enough to wait out. */
const LASTS = 15 * MINUTE;
/** The Presence window closes before the class ends, as a real one does: its countdown shows first. */
const WINDOW_LASTS = 10 * MINUTE;

/** A made-up class on now at `now` (the phone's clock), with its Presence window open; `url` is where a tap goes. */
export function previewLiveDoc(lang: Lang, now: number, url: string): LiveDoc {
  const startsAt = now - STARTED_AGO;
  const endsAt = now + LASTS;
  return {
    v: 1,
    key: PREVIEW_KEY,
    code: SAMPLE_CODE,
    name: translate(lang, "mobile.livePreview.course"),
    detail: `${makeFormat(lang, now).timeRange(startsAt, endsAt)} · ${translate(lang, "mobile.livePreview.room")}`,
    startsAt,
    endsAt,
    presence: { label: translate(lang, "home.need.presence", { course: SAMPLE_CODE }), closesAt: now + WINDOW_LASTS, url },
    checkIn: null,
    color: courseColor("--course-indigo"),
    colors: DOC_COLORS,
    url,
  };
}

/** The preview that was started: the activity's id (ActivityKit's) and its end on the phone's clock. Kept on disk. */
export interface PreviewMark {
  id: string;
  endsAt: number;
}

/** The mark as it was written, or null when there's none or it isn't whole. */
export function parseMark(text: string | null): PreviewMark | null {
  try {
    const value = JSON.parse(text ?? "null") as { id?: unknown; endsAt?: unknown } | null;
    return value && typeof value.id === "string" && typeof value.endsAt === "number" ? { id: value.id, endsAt: value.endsAt } : null;
  } catch {
    return null;
  }
}

/**
 * What the widgets' update does with the running activity (`runningId`), which ends an activity whenever no class is
 * on, so also the moment the app is left: "keep" the preview until its own end, "handOver" the preview's activity to
 * a real class that started meanwhile (`real`), else the "usual" rule (it isn't the preview, or the preview is over).
 */
export function previewStep(mark: PreviewMark | null, runningId: string | null, real: boolean, now: number): "keep" | "handOver" | "usual" {
  if (!mark || runningId !== mark.id || now >= mark.endsAt) return "usual";
  return real ? "handOver" : "keep";
}

/** What Settings' row is told: it runs until `until`, or why it didn't start. */
export type LivePreview = { started: true; until: number } | { started: false; why: "off" | "failed" };

/**
 * Why iOS didn't start it: "off" when Live Activities are turned off for the app in the iPhone's Settings
 * (expo-widgets' LiveActivitiesNotSupportedException), else "failed".
 */
export function previewProblem(error: unknown): "off" | "failed" {
  const said = error instanceof Error ? `${(error as { code?: unknown }).code ?? ""} ${error.message}` : "";
  return /not[ _]supported/i.test(said) ? "off" : "failed";
}
