// @vitest-environment jsdom
// The kit's StatRow and Stat: figures side by side, split by hairlines. Nilai
// shows three figures in a wide column; the first run's three small counts sit
// in a column about 380 px wide, smaller. jsdom can't measure container
// queries or type sizes; this checks the classes that set them.
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

  it("stays one row from a 320 px wide container, so three short counts in 380 px don't pile up", () => {
    const row = draw(
      <StatRow>
        <Stat label="mata kuliah" value="5" />
        <Stat label="tugas" value="10" />
        <Stat label="pertemuan" value="25" />
      </StatRow>,
    );
    const list = classes(row.querySelector("dl"));
    const items = [...row.querySelectorAll("dl > div")].map(classes);
    // @xs is a 20rem (320 px) container; below it the figures stack.
    expect(list).toEqual(expect.arrayContaining(["grid-cols-1", "@xs:grid-flow-col", "@xs:grid-cols-none", "@xs:divide-x"]));
    for (const item of items) expect(item).toEqual(expect.arrayContaining(["@xs:px-6", "@xs:py-0"]));
    // Nothing switches at a wider container (@sm 384 px, @md 448 px).
    expect([list, ...items].flat().filter((name) => /^@(sm|md):/.test(name))).toEqual([]);
  });
});
