// @vitest-environment jsdom
// Motion: the CSS and the JS timings stay the same numbers, something animated
// out (a toast, a row, a panel) is really gone once it has left, focus never
// falls off the page, a counting number never shows screen readers or tests a
// value that isn't real, and no animation keeps running on something that has
// gone. Animations run on a fake element.animate (fake-animations.ts) that the
// test ends when it chooses, so nothing here waits on a clock.
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../src/app/i18n";
import { Menu } from "../../src/app/ui/menu";
import { skipAnimations } from "../../src/app/ui/motion/animate";
import { AnimatedNumber } from "../../src/app/ui/motion/animated-number";
import { DisclosurePanel, disclosureTrigger } from "../../src/app/ui/motion/disclosure";
import { focusInsteadOf, PresenceItem, PresenceList } from "../../src/app/ui/motion/presence-list";
import { SlidingHighlight } from "../../src/app/ui/motion/sliding-highlight";
import { DURATION, EASE } from "../../src/app/ui/motion/tokens";
import { ConfirmDialog, dismissToast, Toaster, Tooltip, TooltipProvider, toast } from "../../src/app/ui/overlays";
import { PdfViewer } from "../../src/app/ui/pdf-viewer";
import { playAnimations } from "./fake-animations";
import { openApp } from "./harness";

const css = readFileSync(path.resolve(import.meta.dirname, "../../src/app/styles.css"), "utf8");
const cssValue = (name: string) => css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
let unmount: (() => void) | null = null;
let animations: ReturnType<typeof playAnimations> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
  unmount?.();
  unmount = null;
  animations?.stop();
  animations = null;
  document.body.replaceChildren();
});

/** JS animation running (on the fake), as in the window. */
function animating() {
  animations = playAnimations();
  return animations;
}

const pause = (ms: number) => act(async () => new Promise<void>((resolve) => setTimeout(resolve, ms)));

/** Renders kit pieces as the window does; `show` re-renders. */
async function mount(node: ReactNode) {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  const show = (next: ReactNode) => act(async () => root.render(next));
  await show(node);
  unmount = () => act(() => root.unmount());
  return { container, show, unmount: () => act(() => root.unmount()) };
}

/** Only transform and opacity, or (for a gap closing or a panel growing) the space an element takes. */
const SPACE = ["borderBottomWidth", "borderTopWidth", "height", "marginBottom", "marginTop", "paddingBottom", "paddingTop"];

describe("motion timings", () => {
  it.each(Object.entries(DURATION))("%s lasts as long in JS as in CSS", (name, ms) => {
    expect(cssValue(`--duration-${name}`)).toBe(`${ms}ms`);
  });

  it.each(Object.entries(EASE))("ease %s curves the same in JS as in CSS", (name, curve) => {
    expect(cssValue(`--ease-${name}`)).toBe(curve);
  });
});

describe("toasts", () => {
  it("one that's taken away is gone, and the others and the live region stay", async () => {
    screen = await openApp({ signedIn: true });
    let first = 0;
    await act(async () => {
      first = toast("Draf tersimpan", "success");
      toast("Tugas terkumpul");
    });
    const live = document.querySelector("[aria-live=polite]");
    expect(live?.textContent).toContain("Draf tersimpan");
    expect(live?.querySelectorAll("[role=status]")).toHaveLength(2);

    await act(async () => dismissToast(first));
    expect(screen.text()).not.toContain("Draf tersimpan");
    expect(screen.text()).toContain("Tugas terkumpul");
    expect(document.querySelector("[aria-live=polite]")).toBe(live);
  });

  it("one that goes fades, then its gap closes so the rest slide into place; it takes no clicks meanwhile and is gone after", async () => {
    const { started, on, finishAll } = animating();
    const { container } = await mount(<Toaster />);
    let first = 0;
    await act(async () => {
      first = toast("Draf tersimpan", "success", { label: "Urungkan", onClick: () => {} });
      toast("Tugas terkumpul");
    });
    // Rising in is CSS, and none with Reduce motion.
    const [leaving, staying] = container.querySelectorAll<HTMLElement>("[aria-live] > div");
    expect(leaving.className).toContain("motion-safe:animate-toast-in");
    expect(started).toHaveLength(0);

    await act(async () => dismissToast(first));
    expect(leaving.isConnected).toBe(true);
    // Its card can't be clicked or focused; the box around it catches a second click, so it doesn't
    // land on the page behind; clipped while it shrinks.
    expect(leaving.querySelector("[role=status]")?.hasAttribute("inert")).toBe(true);
    expect(leaving.className).toContain("pointer-events-auto");
    expect(leaving.className).toContain("overflow-clip");
    expect(staying.className).not.toContain("overflow-clip");
    const [fade, gap] = on(leaving);
    expect(fade.moves).toEqual(["opacity"]);
    expect(fade.options.duration).toBe(DURATION.quick);
    expect(gap.moves).toEqual(SPACE);
    expect(gap.keyframes.at(-1)).toMatchObject({ height: "0px", paddingTop: "0px" });
    expect(gap.options.delay).toBeGreaterThan(0);
    expect(on(staying)).toHaveLength(0);

    await finishAll();
    expect(leaving.isConnected).toBe(false);
    expect(container.textContent).toBe("Tugas terkumpul");
  });

  it("the toaster going away stops a toast mid-way out", async () => {
    const { running } = animating();
    const view = await mount(<Toaster />);
    let id = 0;
    await act(async () => {
      id = toast("Draf tersimpan");
    });
    await act(async () => dismissToast(id));
    expect(running()).toHaveLength(2);
    await view.unmount();
    unmount = null;
    expect(running()).toHaveLength(0);
  });
});

describe("a dialog or menu on its way out", () => {
  // jsdom runs no CSS, so Radix drops a closing panel at once. Here every panel reports the
  // animation its classes give its state (data-[state=closed]:animate-pop-out → "pop-out"), as
  // Chromium does, so a closing one stays on screen until its animation ends, as in the window.
  function playCssAnimations() {
    const real = window.getComputedStyle.bind(window);
    const animationName = (element: HTMLElement) =>
      element.getAttribute("class")?.match(new RegExp(`data-\\[state=${element.dataset.state}\\]:animate-([\\w-]+)`))?.[1] ?? "none";
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
      const style = real(element, pseudo);
      if (!(element instanceof HTMLElement) || !element.dataset.state) return style;
      return new Proxy(style, {
        get: (target, key) => {
          if (key === "animationName") return animationName(element);
          const value = Reflect.get(target, key, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    });
    globalThis.CSS ??= { escape: (text: string) => text } as typeof CSS;
  }
  const finishLeaving = (element: Element) =>
    act(async () => {
      element.dispatchEvent(Object.assign(new Event("animationend"), { animationName: "pop-out" }));
    });
  afterEach(() => vi.restoreAllMocks());

  it("a confirm takes the second click of a double-click as nothing, while it fades", async () => {
    playCssAnimations();
    const confirmed = vi.fn();
    function Reset() {
      const [open, setOpen] = useState(true);
      return (
        <I18nProvider lang="id">
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Atur ulang rencana?"
            body="Rencanamu kembali ke rencana awal."
            confirmLabel="Atur ulang"
            onConfirm={() => {
              setOpen(false);
              confirmed();
            }}
          />
        </I18nProvider>
      );
    }
    await mount(<Reset />);
    const question = document.querySelector<HTMLElement>("[role=alertdialog]")!;
    const yes = [...question.querySelectorAll("button")].find((button) => button.textContent === "Atur ulang")!;
    await act(async () => yes.click());
    expect(question.isConnected && question.dataset.state).toBe("closed");
    await act(async () => yes.click());
    expect(confirmed).toHaveBeenCalledOnce();

    await finishLeaving(question);
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
  });

  it("the PDF viewer leaves the way it came, and a click on it while it goes runs nothing", async () => {
    playCssAnimations();
    const downloaded = vi.fn();
    function Reader() {
      const [open, setOpen] = useState(true);
      return (
        <I18nProvider lang="id">
          <TooltipProvider>
            <PdfViewer
              open={open}
              onOpenChange={setOpen}
              name="Modul 01.pdf"
              // Still opening: its toolbar's own buttons are there.
              load={() => new Promise(() => undefined)}
              actions={
                <button type="button" onClick={downloaded}>
                  Unduh
                </button>
              }
              onOpenLink={() => undefined}
            />
          </TooltipProvider>
        </I18nProvider>
      );
    }
    await mount(<Reader />);
    const viewer = document.querySelector<HTMLElement>("[role=dialog]")!;
    await act(async () => viewer.querySelector<HTMLButtonElement>("button[aria-label='Tutup']")!.click());
    expect(viewer.isConnected && viewer.dataset.state).toBe("closed");
    await act(async () => [...viewer.querySelectorAll("button")].find((button) => button.textContent === "Unduh")!.click());
    expect(downloaded).not.toHaveBeenCalled();

    await finishLeaving(viewer);
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("moving to the next control's tooltip takes the last one away at once, so two never show", async () => {
    playCssAnimations();
    const { container } = await mount(
      <TooltipProvider>
        <Tooltip content="Minggu sebelumnya">
          <button type="button">‹</button>
        </Tooltip>
        <Tooltip content="Minggu berikutnya">
          <button type="button">›</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const [back, next] = container.querySelectorAll("button");
    await act(async () => back.focus());
    expect(document.querySelector("[data-radix-popper-content-wrapper]")?.textContent).toContain("Minggu sebelumnya");
    await act(async () => next.focus());
    const showing = [...document.querySelectorAll("[data-radix-popper-content-wrapper]")].map((tip) => tip.textContent);
    expect(showing).toHaveLength(1);
    expect(showing[0]).toContain("Minggu berikutnya");
  });

  it("a menu runs a picked item once, however fast the second click", async () => {
    playCssAnimations();
    const opened = vi.fn();
    const { container } = await mount(
      <TooltipProvider>
        <Menu label="Lainnya" items={[{ label: "Buka di Edunex", onSelect: opened }]} />
      </TooltipProvider>,
    );
    await act(async () => container.querySelector("button")!.click());
    const item = document.querySelector<HTMLElement>("[role=menuitem]")!;
    await act(async () => item.click());
    await act(async () => item.click());
    expect(opened).toHaveBeenCalledOnce();
  });
});

describe("SlidingHighlight", () => {
  function Choice({ value }: { value: string | null }) {
    return (
      <div className="relative">
        <SlidingHighlight active={value} className="rounded-md bg-segment" />
        {["Hari", "Minggu"].map((label) => (
          <button key={label} type="button" data-highlight={label} className="relative">
            {label}
          </button>
        ))}
      </div>
    );
  }
  // jsdom has no layout: "Minggu" sits 64px in and is 80 wide, "Hari" 64; both 28 high.
  function layOut() {
    const box = (name: string, read: (el: HTMLElement) => number) =>
      vi.spyOn(HTMLElement.prototype, name as "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
        return read(this);
      });
    box("offsetLeft", (el) => (el.dataset.highlight === "Minggu" ? 64 : 0));
    box("offsetTop", () => 0);
    box("offsetWidth", (el) => (el.dataset.highlight === "Minggu" ? 80 : 64));
    box("offsetHeight", () => 28);
  }
  afterEach(() => vi.restoreAllMocks());

  it("sits on the picked item at once, glides to the next pick with a transform only, and hides when nothing is picked", async () => {
    layOut();
    const { started } = animating();
    const { container, show } = await mount(<Choice value="Hari" />);
    const highlight = container.querySelector<HTMLElement>("span[aria-hidden]")!;
    expect(highlight.style.translate).toBe("0px 0px");
    expect(highlight.style.width).toBe("64px");
    expect(highlight.hidden).toBe(false);
    expect(started).toHaveLength(0);

    await show(<Choice value="Minggu" />);
    // Already sized and placed on the new pick; the glide plays from the old one back to it.
    expect(highlight.style.translate).toBe("64px 0px");
    expect(highlight.style.width).toBe("80px");
    expect(started).toHaveLength(1);
    const [glide] = started;
    expect(glide.target).toBe(highlight);
    expect(glide.moves).toEqual(["transform"]);
    expect(glide.keyframes).toEqual([{ transform: "translate(-64px, 0px) scale(0.8, 1)" }, { transform: "none" }]);
    expect(glide.options).toMatchObject({ duration: DURATION.quick, easing: EASE.out });
    expect(highlight.className).not.toContain("transition");
    // The buttons keep their own text and roles: nothing is wrapped or cloned.
    expect([...container.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Hari", "Minggu"]);

    await show(<Choice value={null} />);
    expect(highlight.hidden).toBe(true);
    expect(glide.playState).toBe("idle");
  });

  it("picked again mid-glide, it glides on from where it shows, not from the last pick", async () => {
    layOut();
    const { started } = animating();
    const { container, show } = await mount(<Choice value="Hari" />);
    await show(<Choice value="Minggu" />);
    // Half-way: 32px in and 72 wide, on screen.
    const highlight = container.querySelector<HTMLElement>("span[aria-hidden]")!;
    vi.spyOn(highlight, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ x: 132, y: 50, width: 72, height: 28 }));
    vi.spyOn(container.firstElementChild!, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ x: 100, y: 50, width: 200, height: 28 }));
    await show(<Choice value="Hari" />);
    expect(started[0].playState).toBe("idle");
    expect(started[1].keyframes[0]).toEqual({ transform: "translate(32px, 0px) scale(1.125, 1)" });
  });

  it("taken away mid-glide, it stops the glide", async () => {
    layOut();
    const { running } = animating();
    const view = await mount(<Choice value="Hari" />);
    await view.show(<Choice value="Minggu" />);
    expect(running()).toHaveLength(1);
    await view.unmount();
    unmount = null;
    expect(running()).toHaveLength(0);
  });
});

describe("DisclosurePanel", () => {
  const disclosure = (open: boolean) => (
    <>
      <button type="button" {...disclosureTrigger(open, "materi-1")}>
        Baca
      </button>
      <DisclosurePanel open={open} id="materi-1">
        <p>Isi materi minggu ini</p>
      </DisclosurePanel>
    </>
  );

  it("opens under its own button, which says it controls the panel, and closes all the way", async () => {
    const { container, show } = await mount(disclosure(false));
    const button = container.querySelector("button")!;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe("materi-1");
    expect(container.textContent).not.toContain("Isi materi");

    await show(disclosure(true));
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("materi-1")?.textContent).toBe("Isi materi minggu ini");

    await show(disclosure(false));
    expect(container.textContent).not.toContain("Isi materi");
    expect(document.getElementById("materi-1")).toBeNull();
  });

  it("closing it with focus inside gives focus back to its button", async () => {
    const withLink = (open: boolean) => (
      <>
        <button type="button" {...disclosureTrigger(open, "materi-2")}>
          Baca
        </button>
        <DisclosurePanel open={open} id="materi-2">
          <a href="#unduh">Unduh</a>
        </DisclosurePanel>
      </>
    );
    const { container, show } = await mount(withLink(true));
    container.querySelector("a")!.focus();
    await show(withLink(false));
    expect(document.activeElement).toBe(container.querySelector("button"));
  });

  it("grows and shrinks clipped, unclips once open, can't be tabbed into while it closes, and is gone once closed", async () => {
    const { on, finishAll } = animating();
    const { show } = await mount(disclosure(false));
    await show(disclosure(true));
    const panel = document.getElementById("materi-1")!;
    const [grow] = on(panel);
    expect(grow.moves).toEqual(["height", "opacity"]);
    expect(grow.keyframes[0]).toEqual({ height: "0px", opacity: 0 });
    expect(grow.options).toMatchObject({ duration: DURATION.base, easing: EASE.out });
    expect(panel.style.overflow).toBe("clip");
    await finishAll();
    expect(panel.style.overflow).toBe("");
    expect(panel.inert).toBe(false);

    await show(disclosure(false));
    const shrink = on(panel)[1];
    expect(shrink.keyframes.at(-1)).toEqual({ height: "0px", opacity: 0 });
    expect(panel.isConnected).toBe(true);
    expect(panel.inert).toBe(true);
    expect(panel.style.overflow).toBe("clip");
    await finishAll();
    expect(panel.isConnected).toBe(false);
  });

  it("opened again while it closes, it turns around and works again", async () => {
    const { on } = animating();
    const { show } = await mount(disclosure(true));
    const panel = document.getElementById("materi-1")!;
    expect(on(panel)).toHaveLength(0);
    await show(disclosure(false));
    // A third of the way closed.
    vi.spyOn(panel, "offsetHeight", "get").mockReturnValue(40);
    await show(disclosure(true));
    expect(document.getElementById("materi-1")).toBe(panel);
    const [shrink, grow] = on(panel);
    expect(shrink.playState).toBe("idle");
    expect(grow.playState).toBe("running");
    expect(grow.keyframes[0]).toMatchObject({ height: "40px" });
    expect(panel.inert).toBe(false);
    vi.restoreAllMocks();
  });

  it("taken away mid-way, it stops", async () => {
    const { running } = animating();
    const view = await mount(disclosure(false));
    await view.show(disclosure(true));
    expect(running()).toHaveLength(1);
    await view.unmount();
    unmount = null;
    expect(running()).toHaveLength(0);
  });
});

describe("AnimatedNumber", () => {
  const ipk = (value: number) => value.toFixed(2).replace(".", ",");
  const readable = (container: HTMLElement) => [...container.querySelectorAll("span > span:not([aria-hidden])")].map((el) => el.textContent).join("");

  it("shows the new value at once when animations are off", async () => {
    const { container, show } = await mount(<AnimatedNumber value={3.45} format={ipk} />);
    expect(container.textContent).toBe("3,45");
    await show(<AnimatedNumber value={3.5} format={ipk} />);
    expect(container.textContent).toBe("3,50");
  });

  it("while it counts, only a hidden copy moves: what's read is always the true value", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    // The count starts at 1000 ms, however long the test takes.
    vi.spyOn(performance, "now").mockReturnValue(1000);
    skipAnimations(false);
    try {
      const { container, show } = await mount(<AnimatedNumber value={3.45} format={ipk} />);
      await show(<AnimatedNumber value={3.9} format={ipk} />);
      // Every frame asked for so far, at one moment.
      const frame = (at: number) =>
        act(async () => {
          for (const callback of frames.splice(0)) callback(at);
        });
      await frame(1000 + DURATION.slow / 2);
      const counting = container.querySelector("[aria-hidden]")?.textContent ?? "";
      expect(Number(counting.replace(",", "."))).toBeGreaterThan(3.45);
      expect(Number(counting.replace(",", "."))).toBeLessThan(3.9);
      expect(readable(container)).toBe("3,90");

      await frame(1000 + DURATION.slow * 2);
      expect(container.querySelector("[aria-hidden]")).toBeNull();
      expect(container.textContent).toBe("3,90");

      // Reduce motion turned on mid-count: the next frame is the last.
      await show(<AnimatedNumber value={3.2} format={ipk} />);
      await frame(1000 + DURATION.slow / 4);
      skipAnimations(true);
      await frame(1000 + DURATION.slow / 2);
      expect(container.querySelector("[aria-hidden]")).toBeNull();
      expect(frames).toHaveLength(0);
    } finally {
      skipAnimations(true);
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});

describe("PresenceList", () => {
  const rows = (ids: string[]) => (
    <ul aria-label="Perlu kamu">
      <PresenceList>
        {ids.map((id) => (
          <PresenceItem key={id}>
            <span>Tugas {id}</span>
            <button type="button">Tunda {id}</button>
          </PresenceItem>
        ))}
      </PresenceList>
    </ul>
  );
  const focused = () => document.activeElement?.textContent ?? document.activeElement?.tagName;
  const texts = (container: HTMLElement) => [...container.querySelectorAll("li > span:first-child")].map((el) => el.textContent);

  it("a row that leaves is gone, and focus moves to the same button in the next row, then the one before, then the list", async () => {
    const { container, show } = await mount(rows(["A", "B", "C"]));
    [...container.querySelectorAll("button")][1].focus();
    await show(rows(["A", "C"]));
    expect(container.textContent).not.toContain("Tugas B");
    expect(focused()).toBe("Tunda C");

    await show(rows(["A"]));
    expect(focused()).toBe("Tunda A");

    await show(rows([]));
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(document.activeElement).toBe(container.querySelector("ul"));
  });

  it("a row that leaves fades, then its gap closes, and it's taken away once that ends; focus has already moved on", async () => {
    const { on, finishAll } = animating();
    const { container, show } = await mount(rows(["A", "B", "C"]));
    const [a, b, c] = container.querySelectorAll("li");
    b.querySelector("button")!.focus();
    await show(rows(["A", "C"]));
    expect(focused()).toBe("Tunda C");
    expect(b.isConnected).toBe(true);
    expect(b.inert).toBe(true);
    // Clipped only while it shrinks, so the rows around it keep their focus rings.
    expect(b.className).toContain("overflow-clip");
    expect(a.className).not.toContain("overflow-clip");
    const [fade, gap] = on(b);
    expect(fade.moves).toEqual(["opacity"]);
    expect(fade.options).toMatchObject({ duration: DURATION.quick, easing: EASE.standard, fill: "forwards" });
    expect(gap.moves).toEqual(SPACE);
    expect(gap.options).toMatchObject({ duration: DURATION.base, fill: "forwards" });
    expect(gap.options.delay).toBeGreaterThan(0);
    expect(on(a)).toHaveLength(0);
    expect(on(c)).toHaveLength(0);

    await finishAll();
    expect(b.isConnected).toBe(false);
    expect(texts(container)).toEqual(["Tugas A", "Tugas C"]);
  });

  it.each([
    ["with animations off", false],
    ["while rows fade", true],
  ])("an empty-state line that isn't a PresenceItem goes as soon as the first row comes, %s", async (_, moving) => {
    if (moving) animating();
    const list = (ids: string[]) => (
      <ul>
        <PresenceList>
          {ids.length === 0 && <li key="empty">Belum ada tugas</li>}
          {ids.map((id) => (
            <PresenceItem key={id}>Tugas {id}</PresenceItem>
          ))}
        </PresenceList>
      </ul>
    );
    const { container, show } = await mount(list([]));
    await show(list(["A"]));
    expect(container.textContent).toBe("Tugas A");
  });

  it("focus meant for a row that has since left too goes on to where that row sent it", async () => {
    animating();
    const { container, show } = await mount(rows(["A", "B", "C", "D"]));
    const button = (row: string) => [...container.querySelectorAll("button")].find((el) => el.textContent === `Tunda ${row}`)!;
    const fromB = button("B");
    await show(rows(["A", "C", "D"]));
    await show(rows(["A", "D"]));
    // A menu opened from B gives focus back now: B and C are both on their way out.
    expect(focusInsteadOf(fromB)).toBe(true);
    expect(focused()).toBe("Tunda D");
  });

  it("a row that joins appears in its place at once, without rising in", async () => {
    const { started } = animating();
    const { container, show } = await mount(rows(["A", "C"]));
    await show(rows(["A", "B", "C"]));
    expect(texts(container)).toEqual(["Tugas A", "Tugas B", "Tugas C"]);
    expect(started).toHaveLength(0);
  });

  it("a row that comes back before it has gone works again", async () => {
    const { on, finishAll } = animating();
    const { container, show } = await mount(rows(["A", "B", "C"]));
    const b = container.querySelectorAll("li")[1];
    await show(rows(["A", "C"]));
    await show(rows(["A", "B", "C"]));
    expect(container.querySelectorAll("li")[1]).toBe(b);
    expect(b.inert).toBe(false);
    expect(b.hasAttribute("data-leaving")).toBe(false);
    expect(b.className).not.toContain("overflow-clip");
    expect(on(b).map((animation) => animation.playState)).toEqual(["idle", "idle"]);
    await finishAll();
    expect(texts(container)).toEqual(["Tugas A", "Tugas B", "Tugas C"]);
  });

  it("a row can leave again after it came back, and one that left can join again", async () => {
    const { finishAll } = animating();
    const { container, show } = await mount(rows(["A", "B", "C"]));
    await show(rows(["A", "C"]));
    await show(rows(["A", "B", "C"]));
    await show(rows(["A", "C"]));
    await finishAll();
    expect(texts(container)).toEqual(["Tugas A", "Tugas C"]);
    await show(rows(["A", "B", "C"]));
    expect(texts(container)).toEqual(["Tugas A", "Tugas B", "Tugas C"]);
    expect(container.querySelectorAll("li")[1].inert).toBe(false);
  });

  it("a change of the whole list (another filter) swaps at once instead of showing old and new rows together", async () => {
    const { started } = animating();
    const { container, show } = await mount(rows(["A", "B", "C"]));
    await show(rows(["D", "E", "F"]));
    expect(texts(container)).toEqual(["Tugas D", "Tugas E", "Tugas F"]);
    expect(started).toHaveLength(0);
  });

  it("taken away mid-leave, the list stops its rows' animations", async () => {
    const { running } = animating();
    const view = await mount(rows(["A", "B", "C"]));
    await view.show(rows(["A", "C"]));
    expect(running()).toHaveLength(2);
    await view.unmount();
    unmount = null;
    expect(running()).toHaveLength(0);
  });

  it.each([
    ["with animations off", false],
    ["while it fades", true],
  ])("a row taken away from its own menu gives focus to the same menu in the next row, %s", async (_, moving) => {
    const finish = moving ? animating().finishAll : async () => {};
    let remove: (id: string) => void = () => {};
    function Rows() {
      const [ids, setIds] = useState(["A", "B", "C"]);
      remove = (id) => setIds((now) => now.filter((other) => other !== id));
      return (
        <TooltipProvider>
          <ul>
            <PresenceList>
              {ids.map((id) => (
                <PresenceItem key={id}>
                  <span>Tugas {id}</span>
                  <Menu label={`Lainnya ${id}`} items={[{ label: "Ingatkan nanti", onSelect: () => remove(id) }]} />
                </PresenceItem>
              ))}
            </PresenceList>
          </ul>
        </TooltipProvider>
      );
    }
    const { container } = await mount(<Rows />);
    const menuOf = (id: string) => container.querySelector<HTMLElement>(`button[aria-label="Lainnya ${id}"]`)!;
    menuOf("B").focus();
    await act(async () => menuOf("B").click());
    await act(async () => document.querySelector<HTMLElement>("[role=menuitem]")!.click());
    // Radix gives focus back on a timer after the menu closes.
    await pause(30);
    expect(document.activeElement).toBe(menuOf("C"));
    await finish();
    expect(texts(container)).toEqual(["Tugas A", "Tugas C"]);
  });

  it("outside a PresenceList it's a plain list item", async () => {
    const { container } = await mount(
      <ul>
        <PresenceItem className="px-4">Tugas A</PresenceItem>
      </ul>,
    );
    expect(container.querySelector("li")?.outerHTML).toBe('<li class="px-4">Tugas A</li>');
  });
});
