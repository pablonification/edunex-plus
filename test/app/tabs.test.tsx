// @vitest-environment jsdom
// Tabs and segmented pickers: one underline or highlight that follows the pick
// (jsdom has no layout, so item positions are made up here and only where the
// highlight sits is read), every tab names a panel that exists, and a picker
// works with the keyboard as a radio group does, even with nothing picked (the
// IPK target while another value is typed).
import * as Tabs from "@radix-ui/react-tabs";
import { act, type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Segmented } from "../../src/app/ui/controls";
import { TabBar } from "../../src/app/ui/tabs";
import { records } from "../engine/grades-records";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
let unmount: (() => void) | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
  unmount?.();
  unmount = null;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

async function mount(node: ReactNode) {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(async () => root.render(node));
  unmount = () => act(() => root.unmount());
  return container;
}

/** Made-up layout: items 80 px wide, 100 px apart, in the order they're drawn. */
function layOut() {
  const place = (el: HTMLElement) => [...(el.parentElement?.querySelectorAll("[data-highlight]") ?? [])].indexOf(el);
  const box = (name: string, read: (el: HTMLElement) => number) =>
    vi.spyOn(HTMLElement.prototype, name as "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
      return this.dataset.highlight === undefined ? 0 : read(this);
    });
  box("offsetLeft", (el) => place(el) * 100);
  box("offsetTop", () => 0);
  box("offsetWidth", () => 80);
  box("offsetHeight", () => 28);
}

const highlight = (group: Element) => group.querySelector<HTMLElement>(":scope > span[aria-hidden]")!;

async function press(element: Element, key: string) {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

/** Radix tabs switch on mouse down, as a real click starts. */
async function pick(tab: Element) {
  await act(async () => {
    tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  });
}

/** Each tab and whether the panel it names is in the page, as a tab panel. */
const controls = () =>
  [...document.querySelectorAll("[role=tab]")].map((tab) => {
    const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
    return [tab.textContent, panel?.getAttribute("role") === "tabpanel"];
  });

describe("TabBar", () => {
  function Bar() {
    const [value, setValue] = useState("modules");
    return (
      <Tabs.Root value={value} onValueChange={setValue}>
        <TabBar
          value={value}
          label="KU5014"
          tabs={[
            { value: "modules", label: "Modul", count: 12 },
            { value: "meetings", label: "Pertemuan" },
          ]}
        />
        <Tabs.Content value="modules">Isi modul</Tabs.Content>
        <Tabs.Content value="meetings">Isi pertemuan</Tabs.Content>
      </Tabs.Root>
    );
  }

  it("draws the underline under the picked tab and moves it to the next pick; the panel swaps at once", async () => {
    layOut();
    const container = await mount(<Bar />);
    const list = container.querySelector("[role=tablist]")!;
    expect(list.getAttribute("aria-label")).toBe("KU5014");
    const tabs = [...list.querySelectorAll("[role=tab]")];
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute("data-highlight")])).toEqual([
      ["Modul12", "modules"],
      ["Pertemuan", "meetings"],
    ]);
    expect(highlight(list).style.translate).toBe("0px 0");
    expect(highlight(list).style.width).toBe("80px");

    await pick(tabs[1]);
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(highlight(list).style.translate).toBe("100px 0");
    expect(container.querySelector("[role=tabpanel]:not([hidden])")?.textContent).toBe("Isi pertemuan");
  });

  it("each tab names a panel that exists", async () => {
    await mount(<Bar />);
    expect(controls()).toEqual([
      ["Modul12", true],
      ["Pertemuan", true],
    ]);
  });
});

describe("Segmented", () => {
  function Picker({ start }: { start: string | null }) {
    const [value, setValue] = useState(start);
    return (
      <Segmented
        label="Target IPK"
        value={value}
        onChange={setValue}
        options={["3", "3.5", "3.75"].map((v) => ({ value: v, label: v.replace(".", ","), name: `Target IPK ${v.replace(".", ",")}` }))}
      />
    );
  }
  const radios = (container: Element) => [...container.querySelectorAll<HTMLButtonElement>("[role=radio]")];

  it("with nothing picked, the first choice is the one Tab stop and no highlight shows", async () => {
    const container = await mount(<Picker start={null} />);
    expect(radios(container).map((r) => [r.getAttribute("aria-label"), r.getAttribute("aria-checked"), r.tabIndex])).toEqual([
      ["Target IPK 3", "false", 0],
      ["Target IPK 3,5", "false", -1],
      ["Target IPK 3,75", "false", -1],
    ]);
    expect(highlight(container.firstElementChild!).hidden).toBe(true);
  });

  it("the arrow keys move the choice, the focus and the highlight; clicking the picked one keeps it", async () => {
    layOut();
    const container = await mount(<Picker start="3.5" />);
    const group = container.querySelector("[role=radiogroup]")!;
    expect(highlight(group).style.translate).toBe("100px 0px");
    await press(radios(container)[1], "ArrowRight");
    expect(radios(container).map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "false", "true"]);
    expect(document.activeElement).toBe(radios(container)[2]);
    expect(radios(container).map((r) => r.tabIndex)).toEqual([-1, -1, 0]);
    expect(highlight(group).style.translate).toBe("200px 0px");
    // Round to the first.
    await press(radios(container)[2], "ArrowDown");
    expect(document.activeElement).toBe(radios(container)[0]);
    await act(async () => radios(container)[0].click());
    expect(radios(container)[0].getAttribute("aria-checked")).toBe("true");
  });
});

describe("tabs on the screens", () => {
  it("a course: every tab names its panel, also while Edunex's part is still coming", async () => {
    screen = await openApp({ signedIn: true });
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("KU5014"))!;
    await screen.click(card);
    expect(controls().every(([, exists]) => exists)).toBe(true);
    expect(controls()).toHaveLength(5);

    await screen.apply({ type: "dataset", dataset: { name: "edunex.materials", value: {}, fetchedAt: 0, hash: "none-yet" } });
    expect(document.querySelector("main [role=tabpanel]:not([hidden]) [aria-busy=true]")).not.toBeNull();
    expect(controls().every(([, exists]) => exists)).toBe(true);
  });

  it("Rencana studi and adding a course to a semester: every tab names its panel", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-11T09:00:00+07:00" }), signedIn: true });
    const data = await records();
    let hash = 0;
    for (const [name, value] of [
      ["six.transcript", data.transcript],
      ["six.progress", data.progress],
      ["six.curriculum", data.curriculum],
      ["itb.catalog", data.catalog],
      ["itb.calendar", data.calendar],
    ] as const)
      await screen.apply({ type: "dataset", dataset: { name, value: value as never, fetchedAt: 0, hash: `t${++hash}` } });
    await screen.click("Rencana studi");
    expect(controls().length).toBeGreaterThan(1);
    expect(controls().every(([, exists]) => exists)).toBe(true);

    const semester = [...document.querySelectorAll<HTMLElement>("section[aria-label]")].find((el) => /^Semester 8/.test(el.getAttribute("aria-label") ?? ""))!;
    await screen.click([...semester.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Tambah mata kuliah")!);
    const dialog = document.querySelector("[role=dialog]")!;
    const inDialog = [...dialog.querySelectorAll("[role=tab]")];
    expect(inDialog).toHaveLength(4);
    for (const tab of inDialog) {
      const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
      expect(panel?.getAttribute("role")).toBe("tabpanel");
      expect(dialog.contains(panel)).toBe(true);
    }
    // Tab goes from the tabs straight to the first course's button: a list that took focus itself
    // would scroll the search and the tabs out of view.
    const list = dialog.querySelector("[role=tablist]")!;
    const next = [...dialog.querySelectorAll<HTMLElement>("button, input, [tabindex]")].find(
      (el) =>
        el.tabIndex >= 0 &&
        !el.closest("[hidden]") &&
        !(el as HTMLButtonElement).disabled &&
        !list.contains(el) &&
        list.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
    )!;
    expect(next.tagName).toBe("BUTTON");
    expect(document.getElementById(inDialog[0].getAttribute("aria-controls")!)?.contains(next)).toBe(true);
    // The picked tab's panel holds its courses.
    await pick(inDialog[3]);
    expect(document.getElementById(inDialog[3].getAttribute("aria-controls")!)?.textContent).toMatch(/^Ketik/);
  });

  it("Nilai's IPK target is one Tab stop, and the arrow keys change it", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-11T09:00:00+07:00" }), signedIn: true });
    const data = await records();
    let hash = 0;
    for (const [name, value] of [
      ["six.transcript", data.transcript],
      ["six.progress", data.progress],
      ["six.curriculum", data.curriculum],
      ["itb.catalog", data.catalog],
      ["itb.calendar", data.calendar],
    ] as const)
      await screen.apply({ type: "dataset", dataset: { name, value: value as never, fetchedAt: 0, hash: `g${++hash}` } });
    await screen.click("Nilai");
    await screen.click("Target IPK 3,50");
    const group = document.querySelector("[role=radiogroup][aria-label='Target IPK']")!;
    const picks = [...group.querySelectorAll<HTMLButtonElement>("[role=radio]")];
    expect(picks.map((p) => p.tabIndex)).toEqual([-1, 0, -1]);
    // The typed value sits beside the picks, not among them.
    expect(group.querySelector("input")).toBeNull();
    await press(picks[1], "ArrowRight");
    expect(screen.store.dataset("local.plan")?.value).toMatchObject({ target: 3.75 });
    expect(document.activeElement).toBe(picks[2]);

    // A typed target that counts looks like the box at rest, its number showing: no blue border, which
    // reads as focus (blue is for actions and links).
    const other = document.querySelector<HTMLInputElement>("input[aria-label='Target IPK lainnya']")!;
    const resting = other.className;
    await act(async () => {
      other.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(other, "3,6");
      other.dispatchEvent(new Event("input", { bubbles: true }));
      other.blur();
    });
    expect(screen.store.dataset("local.plan")?.value).toMatchObject({ target: 3.6 });
    expect(picks.map((p) => p.getAttribute("aria-checked"))).toEqual(["false", "false", "false"]);
    expect(other.value).toBe("3,60");
    expect(other.className).toBe(resting);
  });
});
