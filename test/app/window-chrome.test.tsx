// @vitest-environment jsdom
// The window has no system title bar (src/desktop/window.ts): the app's own top
// bar and the top of its sidebar move the window, and on Windows and Linux the
// system draws its window buttons over the top bar's right end. jsdom lays
// nothing out, so what's checked is what the browser is told: which parts move
// the window, which take clicks, and which keep clear of the window buttons.
import { afterEach, describe, expect, it } from "vitest";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
  delete document.documentElement.dataset.platform;
});

const CONTROLS = "button, a, input, select, textarea, [role=button], [tabindex]";
const moves = (element: Element) => element.classList.contains("drag");
/** Every control inside a part that moves the window still takes its clicks. */
function controlsTakeClicks(part: Element) {
  for (const control of part.querySelectorAll(CONTROLS)) expect(control.closest(".no-drag"), control.outerHTML.slice(0, 120)).not.toBeNull();
}
const topBar = () => document.querySelector("header")!;
const sidebarTop = () => [...document.querySelectorAll("aside div")].find((div) => div.textContent === "Edunex Plus")!;

describe("the window's top on Windows and Linux", () => {
  for (const platform of ["win32", "linux"] as const)
    it(`${platform}: the top bar and the sidebar's top move the window, as tall as the window buttons; the buttons in them still click`, async () => {
      screen = await openApp({ signedIn: true, six: true, platform });
      expect(document.documentElement.dataset.platform).toBe(platform);
      expect(moves(topBar())).toBe(true);
      expect(moves(sidebarTop())).toBe(true);
      expect(topBar().className).toContain("h-(--title-bar)");
      expect(sidebarTop().className).toContain("h-(--title-bar)");
      controlsTakeClicks(topBar());
      // A course's page adds the back button.
      await screen.apply({ type: "navigate", route: { screen: "course", code: "DK4073" } });
      expect(topBar().querySelector("button")?.getAttribute("aria-label")).toMatch(/^Kembali ke/);
      controlsTakeClicks(topBar());
    });

  it("the top bar keeps its right end free for the window buttons", async () => {
    screen = await openApp({ signedIn: true, platform: "win32" });
    expect(topBar().className).toContain("pr-[calc(--spacing(5)+var(--window-controls))]");
    expect(topBar().className).not.toMatch(/\bpx-/);
  });

  it("the sidebar's top keeps its left end free for window buttons a Linux desktop puts there", async () => {
    screen = await openApp({ signedIn: true, platform: "linux" });
    expect(sidebarTop().className).toContain("pl-[calc(--spacing(5)+var(--window-controls-start))]");
    expect(sidebarTop().className).not.toMatch(/\bpx-/);
  });

  it("the welcome screen moves the window by its top, and its language choice keeps clear of the window buttons", async () => {
    screen = await openApp({ platform: "win32" });
    expect(screen.text()).toContain("Selamat datang di Edunex Plus");
    const language = screen.button("English").closest(".no-drag")!;
    expect(language.className).toContain("right-[calc(--spacing(4)+var(--window-controls))]");
    const band = [...document.querySelectorAll(".drag")].find((element) => element.className.includes("h-(--title-bar)"));
    expect(band).toBeDefined();
    // At the window's smallest the welcome scrolls; the band and the language choice stay at the top rather than scroll away.
    expect(band!.classList.contains("fixed")).toBe(true);
    expect(language.classList.contains("fixed")).toBe(true);
  });

  it("a dialog's tint takes the clicks over the top bar, so a click there closes the dialog instead of moving the window", async () => {
    screen = await openApp({ signedIn: true, platform: "win32" });
    await screen.click(/Pengaturan/);
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
    expect(document.querySelector(".bg-scrim")?.classList.contains("no-drag")).toBe(true);
  });
});

describe("the window's top on macOS", () => {
  it("keeps the traffic lights' room in the sidebar, and its top bar moves the window too", async () => {
    screen = await openApp({ signedIn: true });
    expect(document.documentElement.dataset.platform).toBe("darwin");
    expect(moves(topBar())).toBe(true);
    expect(sidebarTop().className).toContain("h-11");
    expect(moves(sidebarTop().previousElementSibling!)).toBe(true);
  });
});
