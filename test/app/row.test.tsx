// @vitest-environment jsdom
// The kit's Row with a control of its own beside its button ("Ingatkan nanti"):
// keyboard focus on the row is framed around the whole line, inside it, so the
// list's clipped edges can't cut the frame down to a stray bar. jsdom can't draw
// outlines; this checks the styles that place the frame. A Row in a list that
// opts in (PresenceList) leaves it gently when the Student removes it.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { List, Row } from "../../src/app/ui/layout";
import { PresenceList } from "../../src/app/ui/motion/presence-list";
import { playAnimations } from "./fake-animations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let animations: ReturnType<typeof playAnimations> | null = null;
afterEach(() => {
  animations?.stop();
  animations = null;
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

  it("with a control beside the button: it's always there, faint at rest, never hidden until the pointer finds it", () => {
    const list = draw(
      <List>
        <Row title="Kumpulkan Tugas 02" onClick={() => undefined} actions={<button type="button">Ingatkan nanti</button>} />
      </List>,
    );
    const control = list.querySelector("li > div");
    expect(control?.textContent).toBe("Ingatkan nanti");
    // Nothing on it, or on the line around it, hides it: no opacity at all, with or without hover.
    for (const element of [control, control?.parentElement])
      expect(classes(element).filter((name) => name.includes("opacity") || name.includes("invisible") || name === "hidden")).toEqual([]);
    // Quiet until the row is hovered or focused: faint, then its full color.
    expect(classes(control)).toEqual(
      expect.arrayContaining([
        "[&_button]:text-faint",
        "group-focus-within/row:[&_button]:text-fg",
        "[@media(hover:hover)]:group-hover/row:[&_button]:text-fg",
      ]),
    );
  });

  it("without one: the button keeps its own ring", () => {
    const list = draw(
      <List>
        <Row title="Tugas 02" onClick={() => undefined} />
      </List>,
    );
    expect(classes(list.querySelector("li > button"))).toContain("focus-ring");
    // Drawn 2px inside the button, so the list's clipped edges can't cut it.
    expect(classes(list.querySelector("li > button"))).toContain("focus-visible:-outline-offset-2");
    expect(classes(list.querySelector("li")).some((name) => name.startsWith("has-[>button:focus-visible]"))).toBe(false);
  });
});

describe("Row in a PresenceList", () => {
  const list = (ids: string[]) => (
    <List>
      <PresenceList>
        {ids.map((id) => (
          <Row key={id} title={`Tugas ${id}`} onClick={() => undefined} />
        ))}
      </PresenceList>
    </List>
  );

  it("a removed row fades out of the list, focus moving on to the next row, and is gone once it has", async () => {
    animations = playAnimations();
    const container = draw(list(["A", "B", "C"]));
    const leaving = container.querySelectorAll("li")[1];
    leaving.querySelector("button")!.focus();
    act(() => root!.render(list(["A", "C"])));
    expect(leaving.isConnected).toBe(true);
    expect(leaving.inert).toBe(true);
    expect(animations.on(leaving).length).toBeGreaterThan(0);
    expect(document.activeElement?.textContent).toBe("Tugas C");

    await animations.finishAll();
    expect(leaving.isConnected).toBe(false);
    expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Tugas A", "Tugas C"]);
  });
});
