// @vitest-environment jsdom
// The kit's meters: a window's time left, which shrinks every minute, slides
// its fill (a transform) instead of resizing it, and its amber in the last
// minutes is the meter amber, not the brown made for amber text. Attendance
// meters take the same meter colors. jsdom draws nothing; this checks the
// styles that do.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { CountdownBar, ShareMeter } from "../../src/app/ui/meter";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

function draw(node: ReactNode): HTMLElement {
  const container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
  act(() => root!.render(node));
  return container;
}

const MINUTE = 60_000;
const fillOf = (container: HTMLElement) => container.querySelector<HTMLElement>("[role=progressbar] > span")!;

describe("CountdownBar", () => {
  it("half the window gone: the fill is pushed half out of its track, never resized", () => {
    const fill = fillOf(draw(<CountdownBar opensAt={0} closesAt={120 * MINUTE} now={60 * MINUTE} label="60 menit lagi" />));
    expect(fill.style.translate).toBe("-50% 0");
    expect(fill.style.width).toBe("");
    expect(fill.className).toContain("motion-safe:transition-[translate]");
    expect(fill.className).toContain("bg-accent");
  });

  it("in its last 15 minutes, amber that reads amber", () => {
    const fill = fillOf(draw(<CountdownBar opensAt={0} closesAt={120 * MINUTE} now={110 * MINUTE} label="10 menit lagi" />));
    expect(fill.className).toContain("bg-meter-warning");
    expect(fill.className).not.toContain("bg-warning-fg");
  });
});

describe("ShareMeter", () => {
  it.each([
    ["warning", "var(--meter-warning)"],
    ["success", "var(--meter-success)"],
  ] as const)("%s fills in the meter color", (tone, color) => {
    const meter = draw(<ShareMeter share={60} target={80} tone={tone} label="Kehadiran 3/5" />).querySelector("[role=img]")!;
    const fills = [...meter.querySelectorAll<HTMLElement>("span")].filter((span) => span.style.background);
    expect(fills.map((span) => span.style.background)).toEqual([color]);
  });
});
