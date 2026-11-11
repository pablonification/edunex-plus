// The phone's guide ("Panduan"), as data and rules: the tour's steps in order, when it offers itself, where it goes
// from a step, and where a step's caption sits beside the part it points at. The desktop's guide
// (src/app/shell/guide.tsx) is the model: an invitation after the first sign-in, then the app's real screens part by
// part, skipped at any step, taken again from Settings › Tentang. No React and no React Native here, so Node's tests
// read it (test/mobile/guide.test.ts); the drawing is ./tour.tsx, loaded only when the tour or its invitation shows.
import type { StringKey } from "../../../../src/core/strings";

/** A tab's route, as Expo Router names it. */
export type GuideTab = "/" | "/schedule" | "/tasks" | "/courses" | "/profile";

export interface GuideStep {
  id: string;
  /** The tab the step opens. */
  tab: GuideTab;
  /** The real part it points at: that view's testID (the screen hands the view over with `guidePart`, ./state.ts). */
  part: string;
  title: StringKey;
  body: StringKey;
}

/**
 * What this app does that Edunex and SIX don't, in the order of the tabs: three parts of Beranda, then one each for
 * Jadwal, Tugas, Kuliah and Profil. A part its page doesn't show right now (no timetable without SIX) is passed over.
 */
export const GUIDE_STEPS: readonly GuideStep[] = [
  { id: "now", tab: "/", part: "home.now", title: "guide.home.now.title", body: "mobile.guide.now.body" },
  { id: "strip", tab: "/", part: "home.strip", title: "mobile.guide.strip.title", body: "mobile.guide.strip.body" },
  { id: "services", tab: "/", part: "home.grid", title: "mobile.guide.services.title", body: "mobile.guide.services.body" },
  { id: "schedule", tab: "/schedule", part: "screen.schedule", title: "guide.schedule.grid.title", body: "mobile.guide.schedule.body" },
  { id: "tasks", tab: "/tasks", part: "screen.tasks", title: "guide.tasks.row.title", body: "mobile.guide.tasks.body" },
  { id: "courses", tab: "/courses", part: "list.courses", title: "guide.presence.row.title", body: "mobile.guide.courses.body" },
  { id: "profile", tab: "/profile", part: "section.academic.screens", title: "mobile.guide.profile.title", body: "mobile.guide.profile.body" },
];

/** Every part a step points at. */
export type GuidePartId = (typeof GUIDE_STEPS)[number]["part"];

/**
 * Whether the guide may offer itself at all (the host's cheap check, on every start): only to a Student who hasn't
 * taken or skipped it, once the first read is in and said, never under the first minute's stage, while the demo
 * signs itself in, or with nobody signed in. `offers` is the demo's switch (./state.ts).
 */
export function guideMayOffer(facts: {
  guideDone: boolean | undefined;
  firstScanDone: boolean | undefined;
  offers: boolean;
  settling: boolean;
  covering: boolean;
  nobody: boolean;
}): boolean {
  return facts.guideDone === false && facts.firstScanDone === true && facts.offers && !facts.settling && !facts.covering && !facts.nobody;
}

/**
 * Whether this is the invitation's turn: on Beranda, with nothing else of the first visit up (the "Semua siap"
 * snackbar or any other, the report question, a system signing in or asking to be signed in again).
 */
export function guideTurn(facts: { path: string; toasts: number; asking: boolean; sources: readonly string[] }): boolean {
  return facts.path === "/" && facts.toasts === 0 && !facts.asking && facts.sources.every((state) => !BUSY.has(state));
}

/** A system on its way in, or one the Student has to sign in to again: the invitation waits for it. */
const BUSY = new Set(["connecting", "expired", "action-needed"]);

/** How long the invitation's turn has to hold before it shows (ms): nothing flashes between two other things. */
export const OFFER_AFTER_MS = 1_500;

export type GuideMove = "next" | "back" | "skip";

/**
 * Where a move leads from step `at`: another step's index, or "end" (the tour is over: skipped, or past its last
 * step). `shown(step)` says whether the step's part is on its page right now; one that isn't is passed over in the
 * direction of travel. Back from the first step that shows stays there.
 */
export function guideAfter(at: number, move: GuideMove, shown: (step: GuideStep) => boolean = () => true): number | "end" {
  if (move === "skip") return "end";
  const by = move === "next" ? 1 : -1;
  for (let i = at + by; i >= 0 && i < GUIDE_STEPS.length; i += by) if (shown(GUIDE_STEPS[i]!)) return i;
  return move === "next" ? "end" : at;
}

/** The first step to show, from `from` on (or "end" when none of them shows). */
export function guideFirst(shown: (step: GuideStep) => boolean = () => true, from = 0): number | "end" {
  return from < GUIDE_STEPS.length && shown(GUIDE_STEPS[from]!) ? from : guideAfter(from, "next", shown);
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The room around the part inside its spotlight, and between the spotlight and the caption (dp). */
export const SPOT_PAD = 6;
export const CAPTION_GAP = 12;

/**
 * The spotlight and the caption's top for a part measured at `part`, within `frame` (the screen between the status
 * bar and the tabs' bar; all in the overlay's own coordinates). The spotlight is the part with a little room, cut to
 * the frame (a long list ends at the tabs). The caption goes under it when it fits, else over it, else (a part as
 * tall as the page) at the frame's foot, over the part's own end.
 */
export function guidePlace(part: Box, frame: Box, captionHeight: number): { spot: Box; captionTop: number; side: "below" | "above" | "over" } {
  const left = Math.max(frame.x, part.x - SPOT_PAD);
  const top = Math.max(frame.y, part.y - SPOT_PAD);
  const right = Math.min(frame.x + frame.width, part.x + part.width + SPOT_PAD);
  const bottom = Math.min(frame.y + frame.height, part.y + part.height + SPOT_PAD);
  const spot = { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  const foot = frame.y + frame.height;
  if (bottom + CAPTION_GAP + captionHeight <= foot) return { spot, captionTop: bottom + CAPTION_GAP, side: "below" };
  if (top - CAPTION_GAP - captionHeight >= frame.y) return { spot, captionTop: top - CAPTION_GAP - captionHeight, side: "above" };
  return { spot, captionTop: Math.max(frame.y, foot - CAPTION_GAP - captionHeight), side: "over" };
}

/** Whether a measured part is on screen at all (a part scrolled away, or not laid out, measures outside or empty). */
export function guideOnScreen(part: Box, frame: Box): boolean {
  return part.width > 0 && part.height > 0 && part.y + part.height > frame.y + 24 && part.y < frame.y + frame.height - 24;
}
