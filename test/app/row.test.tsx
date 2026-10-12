// @vitest-environment jsdom
// The kit's Row with a control of its own beside its button ("Ingatkan nanti"):
// keyboard focus on the row is framed around the whole line, inside it, so the
// list's clipped edges can't cut the frame down to a stray bar. jsdom can't draw
// outlines; this checks the styles that place the frame.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { List, Row } from "../../src/app/ui/layout";

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

describe("Row's focus frame", () => {
  it("with a control beside the button: drawn inside the whole line, not around the button alone", () => {
    const list = draw(
      <List>
        <Row title="UTS Komunikasi Pemasaran" onClick={() => undefined} actions={<button type="button">Ingatkan nanti</button>} />
      </List>,
    );
    const line = list.querySelector("li");
    const button = line?.querySelector(":scope > button");
    // The line shows the frame while its button has keyboard focus, 2px inside its edges.
    expect(classes(line)).toEqual(expect.arrayContaining(["has-[>button:focus-visible]:outline-2", "has-[>button:focus-visible]:outline-offset-[-2px]"]));
    // The button's own ring (2px outside it, cut by the list's edges) is off.
    expect(classes(button)).not.toContain("focus-ring");
    expect(classes(button)).toContain("focus-visible:outline-none");
  });

  it("without one: the button keeps its own ring", () => {
    const list = draw(
      <List>
        <Row title="Tugas 02" onClick={() => undefined} />
      </List>,
    );
    expect(classes(list.querySelector("li > button"))).toContain("focus-ring");
    expect(classes(list.querySelector("li")).some((name) => name.startsWith("has-[>button:focus-visible]"))).toBe(false);
  });
});
