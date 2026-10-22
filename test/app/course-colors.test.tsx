// @vitest-environment jsdom
// Course colors in the window: every course draws a palette color that reads
// in light and dark (never the grey of "unknown" or a status hue), the first
// time this version shows them each keeps the color nearest the one it had,
// and they're remembered, so connecting SIX or a restart never moves them. A
// course the app doesn't know is an outline, never grey.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { CourseDot } from "../../src/app/ui/display";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
  document.body.replaceChildren();
});

/** Each sidebar course and the color its dot draws, as "PL3002 indigo". */
const sidebar = () =>
  [...document.querySelectorAll<HTMLButtonElement>("aside li button")].map((button) => {
    const tone = button.querySelector<HTMLElement>('[style*="--course-"]')?.style.background ?? "";
    return `${button.querySelector(".tabular-nums")?.textContent} ${/--course-([a-z-]+)/.exec(tone)?.[1] ?? "none"}`;
  });
const colorWrites = () => screen!.calls.filter((call) => call.name === "local.set" && (call.input as { name: string }).name === "local.courseColors");

describe("each course's color", () => {
  it("comes from the palette; the first time, each keeps the color nearest its old one and the grey and the brown are gone", async () => {
    screen = await openApp({ signedIn: true, six: true });
    // Before: DK4073 sky, II4091 purple, KU5014 brown, PL3002 slate (it looked switched off), PL3032 pink.
    expect(sidebar()).toEqual(["DK4073 blue", "II4091 purple", "KU5014 cyan", "PL3002 indigo", "PL3032 pink"]);
    // Remembered at once, in one write.
    expect(colorWrites()).toHaveLength(1);
    expect(screen.engine.snapshot().datasets.find((d) => d.name === "local.courseColors")?.value).toEqual({
      picks: {},
      automatic: { DK4073: "blue", II4091: "purple", KU5014: "cyan", PL3002: "indigo", PL3032: "pink" },
    });
  });

  it("never moves by itself: not when SIX connects, not after a restart, and nothing more is written", async () => {
    screen = await openApp({ signedIn: true });
    const before = sidebar();
    expect(colorWrites()).toHaveLength(1);
    await screen.engineDoes(() => screen!.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
    expect(screen.engine.snapshot().datasets.some((d) => d.name === "six.courses")).toBe(true);
    expect(sidebar()).toEqual(before);
    const first = screen;
    first.close();
    screen = await openApp({ world: first.world, storage: first.storage, vault: first.vault });
    expect(sidebar()).toEqual(before);
    expect(colorWrites()).toHaveLength(0);
  });

  it("in the rail (zoomed in), each course's code stays under its dot: the color is never the only way to tell them apart", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const code = [...document.querySelectorAll("aside li button span")].find((span) => span.textContent === "PL3002")!;
    expect(code.className).not.toContain("sr-only");
    expect(code.className).toContain("max-[52rem]:text-micro");
  });
});

describe("a course the app doesn't know", () => {
  it("is an outline, never a grey square: grey isn't a course color", () => {
    const container = document.body.appendChild(document.createElement("div"));
    const root = createRoot(container);
    act(() => root.render(<CourseDot color={undefined} />));
    const mark = container.firstElementChild as HTMLElement;
    expect(mark.style.background).toBe("");
    expect(mark.className).toContain("border-faint");
    act(() => root.unmount());
  });
});
