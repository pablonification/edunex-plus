// The phone's guide (mobile/src/shell/guide): its steps and their order as data, when it offers itself and when it
// never does, where each move leads (skip at every step), taking it again from Settings, and where a step's caption
// sits beside the part it points at.
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { endGuide, guidePart, guidePartView, guideRunning, resetGuide, setGuideOffers, startGuide } from "../../mobile/src/shell/guide/state";
import { GUIDE_STEPS, guideAfter, guideFirst, guideMayOffer, guideOnScreen, guidePlace, guideTurn } from "../../mobile/src/shell/guide/steps";
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
  const ready = { guideDone: false, firstScanDone: true, offers: true, settling: false, covering: false, nobody: false } as const;
  const calm = { path: "/", toasts: 0, asking: false, sources: ["live", "live"] };

  it("after the first read is in, to a Student who hasn't taken or skipped it", () => {
    expect(guideMayOffer(ready)).toBe(true);
    expect(guideTurn(calm)).toBe(true);
  });

  it("never once it's done or skipped, and not before the first read is said", () => {
    expect(guideMayOffer({ ...ready, guideDone: true })).toBe(false);
    expect(guideMayOffer({ ...ready, guideDone: undefined })).toBe(false);
    expect(guideMayOffer({ ...ready, firstScanDone: false })).toBe(false);
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
    expect(guideTurn({ ...calm, sources: ["live", "connecting"] })).toBe(false); // a system still on its way
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
    expect(guideMayOffer({ ...ready, ...h.engine.snapshot().settings })).toBe(false);
    await h.engine.updateSettings({ firstScanDone: true });
    expect(guideMayOffer({ ...ready, ...h.engine.snapshot().settings })).toBe(true);
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
    guidePart("home.grid")(view);
    expect(guidePartView("home.grid")).toBe(view);
    expect(guidePart("home.grid")).toBe(guidePart("home.grid"));
    guidePart("home.grid")(null);
    expect(guidePartView("home.grid")).toBeUndefined();
  });

  it("the caption sits under the part when it fits, else over it", () => {
    const top = guidePlace({ x: 16, y: 120, width: 358, height: 140 }, frame, 180);
    expect(top.side).toBe("below");
    expect(top.captionTop).toBe(120 + 140 + 6 + 12);
    const low = guidePlace({ x: 16, y: 520, width: 358, height: 180 }, frame, 180);
    expect(low.side).toBe("above");
    expect(low.captionTop + 180).toBeLessThanOrEqual(520 - 6);
  });

  it("a part as tall as the page keeps the caption at the page's foot, clear of the tabs", () => {
    const page = guidePlace({ x: 0, y: 0, width: 390, height: 844 }, frame, 180);
    expect(page.side).toBe("over");
    expect(page.spot).toEqual(frame);
    expect(page.captionTop + 180).toBeLessThanOrEqual(frame.y + frame.height);
  });

  it("a part scrolled away or not laid out isn't on screen", () => {
    expect(guideOnScreen({ x: 16, y: 120, width: 358, height: 140 }, frame)).toBe(true);
    expect(guideOnScreen({ x: 16, y: 900, width: 358, height: 140 }, frame)).toBe(false);
    expect(guideOnScreen({ x: 0, y: 0, width: 0, height: 0 }, frame)).toBe(false);
  });
});
