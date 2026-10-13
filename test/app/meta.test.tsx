// @vitest-environment jsdom
// The kit's Meta, the one place facts are separated: blanks drop out, text
// with "·" in it becomes separate facts, and every fact carries its own dot in
// a clipped box, so no line can begin or end with one. jsdom can't lay out
// lines; this checks the structure that makes it so, and the harness's check.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Meta } from "../../src/app/ui/layout";
import { assertTidyFacts } from "./tidy-facts";

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
  return container.firstElementChild as HTMLElement;
}

const facts = (meta: HTMLElement) => [...meta.querySelectorAll("[data-fact]")];
/** Each fact's dot box: what it shows. */
const dots = (meta: HTMLElement) => facts(meta).map((fact) => fact.querySelector("[data-sep]")?.textContent ?? "");
const texts = (meta: HTMLElement) => facts(meta).map((fact) => fact.querySelector(":scope > :not([data-sep])")?.textContent ?? "");

describe("Meta", () => {
  it("drops blank parts, so no dot stands next to nothing", () => {
    const meta = draw(
      <Meta>
        {"DK4073"}
        {""}
        {"   "}
        {null}
        {false}
        {undefined}
        <span>TVST C</span>
      </Meta>,
    );
    expect(texts(meta)).toEqual(["DK4073", "TVST C"]);
    expect(meta.textContent).toBe("DK4073 · TVST C");
  });

  it("splits text holding '·' into facts, keeping a plain element's look on each", () => {
    const meta = draw(
      <Meta>
        {"II4091"}
        <span className="text-warning-fg">Dihitung di SIX · tutup 09:30</span>
        {"a ·"}
      </Meta>,
    );
    expect(texts(meta)).toEqual(["II4091", "Dihitung di SIX", "tutup 09:30", "a"]);
    expect(facts(meta).map((fact) => fact.lastElementChild?.firstElementChild?.className ?? null)).toEqual([null, "text-warning-fg", "text-warning-fg", null]);
  });

  it("gives every fact but the first its own dot, hidden from screen readers, in a box pulled out of a clipped line", () => {
    const meta = draw(
      <Meta>
        {"PL3002"}
        {"08:00–10:00"}
        {"R.SG PWK LT.6"}
      </Meta>,
    );
    expect(dots(meta).map((dot) => dot.trim())).toEqual(["", "·", "·"]);
    expect([...meta.querySelectorAll("[aria-hidden]")].map((dot) => dot.textContent)).toEqual(["·", "·"]);
    // The line is clipped on the left, its facts shifted left by one dot box: a dot that starts a line is cut off.
    expect(meta.className).toContain("overflow-x-clip");
    expect(meta.firstElementChild?.className).toContain("-ml-4");
    expect(facts(meta).every((fact) => fact.firstElementChild?.matches("[data-sep].w-4"))).toBe(true);
    expect(meta.textContent).toBe("PL3002 · 08:00–10:00 · R.SG PWK LT.6");
  });

  it("right-aligned: the dot after each fact but the last, clipped on the right", () => {
    const meta = draw(
      <Meta align="end">
        {"Sampai 4 Des"}
        {"hadir 6/7 · 85%"}
      </Meta>,
    );
    expect(texts(meta)).toEqual(["Sampai 4 Des", "hadir 6/7", "85%"]);
    expect(dots(meta).map((dot) => dot.trim())).toEqual(["·", "·", ""]);
    expect(facts(meta).every((fact) => fact.lastElementChild?.matches("[data-sep]"))).toBe(true);
    expect(meta.firstElementChild?.className).toContain("-mr-4");
    expect(meta.textContent).toBe("Sampai 4 Des · hadir 6/7 · 85%");
    expect(() => assertTidyFacts()).not.toThrow();
  });

  it("truncated: one line, the last fact cut short", () => {
    const meta = draw(
      <Meta truncate>
        {"II4091"}
        {"Modul 5 · Tugas sangat panjang"}
      </Meta>,
    );
    expect(meta.firstElementChild?.className).toContain("flex-nowrap");
    expect(facts(meta).map((fact) => fact.className.includes("shrink-0"))).toEqual([true, true, false]);
    expect(facts(meta).at(-1)?.lastElementChild?.className).toContain("truncate");
  });

  it("truncated: an earlier fact as wide as the line ends in '…' at its edge, not cut mid-letter", () => {
    const meta = draw(<Meta truncate>{"Ringkasan bab dua dengan judul yang sangat panjang sekali · cek apakah perlu dikumpulkan ulang"}</Meta>);
    const [long] = facts(meta);
    // Kept from shrinking, but never wider than the line: its text box can cut itself short with "…".
    expect(long?.className).toContain("shrink-0");
    expect(long?.className).toContain("max-w-full");
    expect(long?.lastElementChild?.className).toContain("truncate");
  });
});

describe("the check every screen test runs", () => {
  it("passes Meta's own dots", () => {
    draw(
      <Meta>
        {"a"}
        {"b"}
      </Meta>,
    );
    expect(() => assertTidyFacts()).not.toThrow();
  });

  it("fails on a dot written next to a missing fact", () => {
    const where = "";
    draw(<p>DK4073 · {where}</p>);
    expect(() => assertTidyFacts()).toThrow(/dangling "·"/);
  });

  it("fails on a dot that starts a line", () => {
    draw(<span className="truncate">· Modul 5</span>);
    expect(() => assertTidyFacts()).toThrow(/dangling "·"/);
  });

  it('fails on a tooltip that ends with a dot (an exam with no room: "UTS DK4073 11:00 · ")', () => {
    draw(<span title="UTS DK4073 11:00 · ">UTS</span>);
    expect(() => assertTidyFacts()).toThrow(/dangling "·" in the title/);
  });

  it("fails on a screen-reader name with a dot beside another separator: a fact gone between", () => {
    draw(<button type="button" aria-label="Kam, 15 Okt: UTS DK4073 11:00 · , 2 kuliah" />);
    expect(() => assertTidyFacts()).toThrow(/dangling "·" in the aria-label/);
  });

  it("passes tooltips and names whose dots each sit between two facts", () => {
    draw(<button type="button" aria-label="UTS DK4073 11:00 · TVST C" title="Tugas 02 · II4091" />);
    expect(() => assertTidyFacts()).not.toThrow();
  });

  it("fails on a fact that renders nothing", () => {
    const Empty = () => null;
    draw(
      <Meta>
        {"a"}
        <Empty />
      </Meta>,
    );
    expect(() => assertTidyFacts()).toThrow(/empty fact/);
  });
});
