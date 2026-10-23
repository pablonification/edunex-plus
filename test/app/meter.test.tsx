// @vitest-environment jsdom
// The kit's meters: a window's time left, which shrinks every minute, slides
// its fill (a transform) instead of resizing it, and its amber in the last
// minutes is the meter amber, not the brown made for amber text. The absence
// bar takes the same meter colors, one segment per absence allowed, and marks
// what's past its limit by shape as well as color. jsdom draws nothing; this
// checks the styles and parts that do.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ProgressBar } from "../../src/app/ui/display";
import { AbsenceBar, CountdownBar } from "../../src/app/ui/meter";

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

describe("AbsenceBar", () => {
  const bar = (node: ReactNode) => draw(node).querySelector<HTMLElement>("[role=img]");
  const states = (el: HTMLElement | null) => [...(el?.querySelectorAll<HTMLElement>("[data-state]") ?? [])].map((s) => s.dataset.state);

  it("one segment per absence allowed, the used ones filled from the start, as one picture with a name", () => {
    const el = bar(<AbsenceBar allowed={3} used={1} tone="neutral" label="Jatah absen semester ini 3×. Terpakai 1×, sisa 2×." />)!;
    expect(el.getAttribute("aria-label")).toBe("Jatah absen semester ini 3×. Terpakai 1×, sisa 2×.");
    expect(states(el)).toEqual(["used", "left", "left"]);
    expect(el.querySelector('[data-state="used"]')!.className).toContain("bg-muted");
    // Left: a ring that reads on a hovered row, not --field-edge.
    expect(el.querySelector('[data-state="left"]')!.className).toContain("--pip-ring");
    // Never a stop for the keyboard, and the segments are hidden from screen readers.
    expect(el.querySelectorAll("button, [tabindex]")).toHaveLength(0);
    expect([...el.children].every((child) => child.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("full: amber, in the meter's amber; past the limit: a limit line, then red segments, each with a ×", () => {
    const full = bar(<AbsenceBar allowed={2} used={2} tone="warning" label="x" />)!;
    expect(states(full)).toEqual(["used", "used"]);
    expect(full.querySelector('[data-state="used"]')!.className).toContain("bg-meter-warning");
    const over = bar(<AbsenceBar allowed={2} used={2} over={2} tone="danger" label="x" />)!;
    expect(states(over)).toEqual(["used", "used", "limit", "over", "over"]);
    expect(over.querySelector('[data-state="used"]')!.className).toContain("bg-danger-fg");
    expect(over.querySelectorAll('[data-state="over"] svg')).toHaveLength(2);
  });

  it("an estimate is hatched, with nothing used", () => {
    const el = bar(<AbsenceBar allowed={3} used={0} estimate tone="neutral" label="x" />)!;
    expect(states(el)).toEqual(["estimate", "estimate", "estimate"]);
    expect(el.querySelector<HTMLElement>('[data-state="estimate"]')!.style.backgroundImage).toContain("--hatch");
  });

  it("nothing allowed and nothing missed: nothing drawn", () => {
    expect(bar(<AbsenceBar allowed={0} used={0} tone="neutral" label="x" />)).toBeNull();
  });

  it("from 12 segments, one fill split where the used part ends; the bar keeps its width", () => {
    const el = bar(<AbsenceBar allowed={14} used={7} tone="neutral" label="x" />)!;
    expect(states(el)).toEqual(["continuous", "used"]);
    expect(el.querySelector<HTMLElement>('[data-state="used"]')!.style.width).toBe("50%");
    expect(el.querySelector('[data-state="continuous"]')!.className).toContain("w-24");
  });

  it("only color changes move, never width", () => {
    const el = bar(<AbsenceBar allowed={3} used={1} tone="neutral" label="x" />)!;
    const classes = [...el.querySelectorAll<HTMLElement>("[data-state]")].map((s) => s.className).join(" ");
    expect(classes).toContain("transition-colors");
    expect(classes).not.toMatch(/transition-\[width\]|transition-all/);
  });
});

describe("ProgressBar", () => {
  it("moves by sliding at a steady pace (progress doesn't ease), never resized", () => {
    const fill = fillOf(draw(<ProgressBar value={0.25} label="25% terunduh" />));
    expect(fill.style.translate).toBe("-75% 0");
    expect(fill.style.width).toBe("");
    expect(fill.className).toContain("motion-safe:transition-[translate]");
    expect(fill.className).toContain("motion-safe:ease-linear");
  });

  it("knowing how far at last, starts a fresh fill instead of sliding over from where the unknown one sat", () => {
    const container = draw(<ProgressBar value={0} indeterminate label="Mengunduh" />);
    const unknown = fillOf(container);
    expect(unknown.className).toContain("motion-safe:animate-shimmer");
    act(() => root!.render(<ProgressBar value={0.5} label="50% terunduh" />));
    expect(fillOf(container)).not.toBe(unknown);
    expect(fillOf(container).style.translate).toBe("-50% 0");
  });
});
