// @vitest-environment jsdom
// The kit's StatRow and Stat: figures side by side, split by hairlines. Nilai
// shows its figures at the figure size; the first run's three small counts are
// smaller. jsdom can't draw type sizes; this checks the classes that set them.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Stat, StatRow } from "../../src/app/ui/layout";

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

const classes = (element: Element | null | undefined) => (element?.getAttribute("class") ?? "").split(/\s+/);
const figures = (row: HTMLElement) => [...row.querySelectorAll("dl > div > dd:first-of-type")];

describe("StatRow", () => {
  it("figures at the figure size unless asked smaller, and the smaller size wins over the default", () => {
    const row = draw(
      <>
        <StatRow>
          <Stat label="SKS lulus" value="125" />
        </StatRow>
        <StatRow>
          <Stat label="mata kuliah" value="5" size="heading" />
          <Stat label="tugas" value="10" size="heading" />
        </StatRow>
      </>,
    );
    const [nilai, ...counts] = figures(row);
    expect(nilai?.textContent).toBe("125");
    expect(classes(nilai)).toContain("text-figure");
    for (const count of counts) {
      expect(classes(count)).toContain("text-heading");
      expect(classes(count)).not.toContain("text-figure");
    }
  });
});
