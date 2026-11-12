// The phone's guide (mobile/src/shell/guide): its steps and their order as data, when it offers itself and when it
// never does, where each move leads (skip at every step), taking it again from Settings, and where a step's caption
// sits beside the part it points at.
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { endGuide, guidePart, guidePartView, guideRunning, resetGuide, setGuideOffers, startGuide } from "../../mobile/src/shell/guide/state";
import { GUIDE_STEPS, guideAfter, guideFirst, guideMayOffer, guideSpot, guideTurn } from "../../mobile/src/shell/guide/steps";
import { DEFAULT_SETTINGS, guideDue } from "../../src/core/models";
import { STRINGS } from "../../src/core/strings";
import { startEngine } from "../engine/harness";

const mobile = path.resolve(import.meta.dirname, "../../mobile");
const read = (file: string) => fs.readFileSync(path.join(mobile, file), "utf8");

afterEach(() => resetGuide());

describe("the tour's steps", () => {
  it("go through the tabs in their order, Beranda's three parts first", () => {
    expect(GUIDE_STEPS.map((step) => [step.id, step.tab, step.part])).toEqual([
      ["now", "/", "home.now"],
      ["strip", "/", "home.strip"],
      ["services", "/", "home.grid"],
      ["schedule", "/schedule", "screen.schedule"],
      ["tasks", "/tasks", "screen.tasks"],
      ["courses", "/courses", "list.courses"],
      ["profile", "/profile", "card.profile"],
    ]);
  });

  it("are five to seven, each with a title and one line in both languages", () => {
    expect(GUIDE_STEPS.length).toBeGreaterThanOrEqual(5);
    expect(GUIDE_STEPS.length).toBeLessThanOrEqual(7);
    for (const step of GUIDE_STEPS)
      for (const key of [step.title, step.body]) {
        const entry = STRINGS[key] as { id: string; en: string };
        expect(entry?.id, key).toBeTruthy();
        expect(entry?.en, key).toBeTruthy();
      }
  });

  it("each point at a real part: a view with that testID that hands itself over", () => {
    const sources = [
      "src/screens/home/banner.tsx",
      "src/screens/home/strip.tsx",
      "src/screens/home/grid.tsx",
      "src/screens/schedule/schedule-screen.tsx",
      "src/screens/tasks/list.tsx",
      "src/screens/presence/presence-screen.tsx",
      "src/screens/academic/academic-screen.tsx",
    ]
      .map(read)
      .join("\n");
    for (const step of GUIDE_STEPS) {
      expect(sources, step.part).toContain(`testID="${step.part}"`);
      expect(sources, step.part).toContain(`guidePart("${step.part}")`);
    }
  });
});

describe("when the tour offers itself", () => {
  const ready = { guideDone: false, offers: true, settling: false, covering: false, nobody: false } as const;
  const calm = { path: "/", toasts: 0, asking: false, sources: ["live", "live"] };

  it("once a system is in and Beranda has something to show, to a Student who hasn't taken or skipped it", () => {
    expect(guideMayOffer(ready)).toBe(true);
    expect(guideTurn(calm)).toBe(true);
  });

  it("never once it's done or skipped", () => {
    expect(guideMayOffer({ ...ready, guideDone: true })).toBe(false);
    expect(guideMayOffer({ ...ready, guideDone: undefined })).toBe(false);
  });

  it("doesn't wait for the first read to end (minutes, on a real account): a system still reading is enough", () => {
    expect(guideTurn({ ...calm, sources: ["live", "connecting"] })).toBe(true);
    // Nothing in yet: Beranda has nothing to show.
    expect(guideTurn({ ...calm, sources: ["connecting", "signed-out"] })).toBe(false);
  });

  it("not over the first minute's stage, the sign-in, or the demo signing itself in", () => {
    expect(guideMayOffer({ ...ready, covering: true })).toBe(false);
    expect(guideMayOffer({ ...ready, nobody: true })).toBe(false);
    expect(guideMayOffer({ ...ready, settling: true })).toBe(false);
    expect(guideMayOffer({ ...ready, offers: false })).toBe(false);
  });

  it("waits its turn: one thing at a time", () => {
    expect(guideTurn({ ...calm, toasts: 1 })).toBe(false); // "Semua siap"
    expect(guideTurn({ ...calm, asking: true })).toBe(false); // the report question
    expect(guideTurn({ ...calm, sources: ["live", "expired"] })).toBe(false); // one to sign in to again
    expect(guideTurn({ ...calm, path: "/first-scan" })).toBe(false);
    expect(guideTurn({ ...calm, sources: ["live", "signed-out"] })).toBe(true); // Edunex only is a Student too
  });

  it("is per device and per Student: off by default only on a device already in use, on again after signing out of everything", async () => {
    expect(guideDue(DEFAULT_SETTINGS)).toBe(true);
    const h = await startEngine({ start: false });
    await h.engine.updateSettings({ firstScanDone: true, guideDone: true });
    expect(guideDue(h.engine.snapshot().settings)).toBe(false);
    await h.engine.signOut();
    // The next Student on this phone gets their own first read and their own invitation.
    expect(h.engine.snapshot().settings).toMatchObject({ firstScanDone: false, guideDone: false });
    expect(guideMayOffer({ ...ready, guideDone: h.engine.snapshot().settings.guideDone })).toBe(true);
  });
});

describe("moving through the tour", () => {
  it("Next walks every step and the last one ends it", () => {
    const seen: number[] = [];
    let at: number | "end" = guideFirst();
    while (at !== "end") {
      seen.push(at);
      at = guideAfter(at, "next");
    }
    expect(seen).toEqual(GUIDE_STEPS.map((_, i) => i));
  });

  it("Skip ends it at every step", () => {
    for (let at = 0; at < GUIDE_STEPS.length; at++) expect(guideAfter(at, "skip")).toBe("end");
  });

  it("Back goes one step back, and stays on the first", () => {
    expect(guideAfter(3, "back")).toBe(2);
    expect(guideAfter(0, "back")).toBe(0);
  });

  it("passes over a part its page doesn't show, either way", () => {
    const noTimetable = (step: { part: string }) => step.part !== "home.now" && step.part !== "screen.schedule";
    expect(guideFirst(noTimetable)).toBe(1);
    expect(guideAfter(2, "next", noTimetable)).toBe(4);
    expect(guideAfter(4, "back", noTimetable)).toBe(2);
    expect(guideAfter(1, "back", noTimetable)).toBe(1);
    expect(guideFirst(() => false)).toBe("end");
  });
});

describe("taking it again", () => {
  it("starts whenever it's asked for, done before or not, and ends once", () => {
    expect(guideRunning()).toBe(false);
    startGuide();
    expect(guideRunning()).toBe(true);
    endGuide();
    expect(guideRunning()).toBe(false);
    startGuide();
    expect(guideRunning()).toBe(true);
  });

  it("has its row in Settings › Tentang, named as the desktop's", () => {
    const about = read("src/screens/settings/about.tsx");
    expect(about).toContain('testID="action.guide"');
    expect(about).toContain('t("settings.guide")');
    expect(about).toContain("startGuide()");
  });

  it("the demo starts past the invitation unless its link asks for it", () => {
    setGuideOffers(false);
    const world = read("src/demo/world.ts");
    expect(world).toContain("setGuideOffers(");
    expect(world).toContain("EDUNEX_DEMO_GUIDE");
  });
});

describe("a start where the tour won't show", () => {
  it("the host reads nothing of the tour's drawing until it's needed", () => {
    const host = read("src/shell/guide/host.tsx");
    // Loaded at first use (metro.config.js's inline requires): the drawing is only named inside what draws it.
    expect(host).not.toMatch(/react-native-reanimated|react-native-svg/);
    expect(host).toContain('from "./tour"');
    expect(read("app/_layout.tsx")).toContain("<GuideHost />");
  });
});

describe("a part and its caption", () => {
  const frame = { x: 0, y: 50, width: 390, height: 700 };

  it("a part hands its view over, and takes it back when it goes", () => {
    const view = { measureInWindow: () => undefined };
    const gone = guidePart("home.grid")(view);
    expect(guidePartView("home.grid")).toBe(view);
    expect(guidePart("home.grid")).toBe(guidePart("home.grid"));
    gone?.();
    expect(guidePartView("home.grid")).toBeUndefined();
    // Drawn twice for a moment (its shape while the data comes, cross-fading into the real one): the shape leaving
    // takes only itself out, whichever of the two went in last. (It used to take the real part with it, and the tour
    // found nothing to point at.)
    const shape = { measureInWindow: () => undefined };
    const real = { measureInWindow: () => undefined };
    const shapeGone = guidePart("home.grid")(shape);
    const realGone = guidePart("home.grid")(real);
    shapeGone?.();
    expect(guidePartView("home.grid")).toBe(real);
    realGone?.();
    expect(guidePartView("home.grid")).toBeUndefined();
  });

  it("the caption has one place, the frame's foot, whatever the part: it never jumps from step to step", () => {
    const high = guideSpot({ x: 16, y: 120, width: 358, height: 140 }, frame, 180);
    const low = guideSpot({ x: 16, y: 420, width: 358, height: 100 }, frame, 180);
    expect(high.captionTop).toBe(frame.y + frame.height - 180);
    expect(low.captionTop).toBe(high.captionTop);
  });

  it("a part gets a ring with a little room around it", () => {
    const { spot } = guideSpot({ x: 16, y: 120, width: 358, height: 140 }, frame, 180);
    expect(spot).toEqual({ x: 10, y: 114, width: 370, height: 152 });
  });

  it("a part as tall as its page is pointed at by its top: the ring ends above the caption, never under it", () => {
    const { spot, captionTop } = guideSpot({ x: 0, y: 0, width: 390, height: 844 }, frame, 180);
    expect(spot).not.toBeNull();
    expect(spot?.y).toBe(frame.y);
    expect((spot?.y ?? 0) + (spot?.height ?? 0)).toBe(captionTop - 12);
  });

  it("a part that isn't laid out, or sits where the caption is, gets no ring; the caption stays", () => {
    expect(guideSpot(null, frame, 180).spot).toBeNull();
    expect(guideSpot({ x: 0, y: 0, width: 0, height: 0 }, frame, 180).spot).toBeNull();
    expect(guideSpot({ x: 16, y: 900, width: 358, height: 140 }, frame, 180).spot).toBeNull();
    expect(guideSpot({ x: 16, y: 640, width: 358, height: 100 }, frame, 180)).toEqual({ spot: null, captionTop: frame.y + frame.height - 180 });
  });
});
