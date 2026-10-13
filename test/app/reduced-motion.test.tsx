// @vitest-environment jsdom
// With Reduce motion turned on in the OS, JS animation doesn't fade, slide or
// count anything either: the CSS rule in styles.css doesn't reach
// element.animate, so each kit piece asks first. Animations would run here (a
// fake element.animate is in place), yet none starts, and everything that goes
// is gone at once.
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AnimatedNumber } from "../../src/app/ui/motion/animated-number";
import { DisclosurePanel } from "../../src/app/ui/motion/disclosure";
import { PresenceItem, PresenceList } from "../../src/app/ui/motion/presence-list";
import { SlidingHighlight } from "../../src/app/ui/motion/sliding-highlight";
import { dismissToast, Toaster, toast } from "../../src/app/ui/overlays";
import { playAnimations } from "./fake-animations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let animations: ReturnType<typeof playAnimations>;
beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }) as unknown as MediaQueryList;
  animations = playAnimations();
});
afterAll(() => animations.stop());

let unmount: (() => void) | null = null;
afterEach(() => {
  unmount?.();
  unmount = null;
  expect(animations.started).toHaveLength(0);
});

async function mount() {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  unmount = () => {
    act(() => root.unmount());
    container.remove();
  };
  return { container, show: (node: ReactNode) => act(async () => root.render(node)) };
}

describe("with Reduce motion on", () => {
  it("a toast rises in only where motion is welcome, and once taken away is gone at once", async () => {
    const { container, show } = await mount();
    await show(<Toaster />);
    let id = 0;
    await act(async () => {
      id = toast("Draf tersimpan", "success");
    });
    const shown = container.querySelector<HTMLElement>("[aria-live] > div")!;
    expect(shown.textContent).toBe("Draf tersimpan");
    expect(shown.className.split(" ").filter((name) => name.includes("animate-"))).toEqual(["motion-safe:animate-toast-in"]);
    await act(async () => dismissToast(id));
    expect(container.textContent).not.toContain("Draf tersimpan");
  });

  it("a row that leaves is gone at once", async () => {
    const { container, show } = await mount();
    const rows = (ids: string[]) => (
      <ul>
        <PresenceList>
          {ids.map((id) => (
            <PresenceItem key={id}>Tugas {id}</PresenceItem>
          ))}
        </PresenceList>
      </ul>
    );
    await show(rows(["A", "B"]));
    await show(rows(["A"]));
    expect(container.textContent).toBe("Tugas A");
  });

  it("a disclosure opens and closes at once", async () => {
    const { container, show } = await mount();
    const panel = (open: boolean) => (
      <DisclosurePanel open={open} id="materi">
        Isi materi
      </DisclosurePanel>
    );
    await show(panel(false));
    await show(panel(true));
    expect(container.textContent).toBe("Isi materi");
    expect(document.getElementById("materi")?.style.overflow).toBe("");
    await show(panel(false));
    expect(container.textContent).toBe("");
  });

  it("a highlight jumps to the new pick", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
      return this.dataset.highlight === "Bulan" ? 64 : 0;
    });
    const { container, show } = await mount();
    const choice = (value: string) => (
      <div className="relative">
        <SlidingHighlight active={value} />
        <button type="button" data-highlight="Minggu">
          Minggu
        </button>
        <button type="button" data-highlight="Bulan">
          Bulan
        </button>
      </div>
    );
    await show(choice("Minggu"));
    await show(choice("Bulan"));
    expect(container.querySelector<HTMLElement>("span[aria-hidden]")?.style.translate).toBe("64px 0px");
    vi.restoreAllMocks();
  });

  it("a number shows its new value at once", async () => {
    const frames = vi.fn();
    vi.stubGlobal("requestAnimationFrame", frames);
    const { container, show } = await mount();
    await show(<AnimatedNumber value={3} />);
    await show(<AnimatedNumber value={4} />);
    expect(container.textContent).toBe("4");
    expect(frames).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
