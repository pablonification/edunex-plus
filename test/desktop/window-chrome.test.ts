// The main window's title bar per system (src/desktop/window.ts): macOS keeps
// its traffic lights in the sidebar; Windows and Linux lose the system's title
// bar and keep only their window buttons, drawn over the app's top bar in the
// theme's colors, repainted when the system's theme or the app's own changes.
import type { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const theme = vi.hoisted(() => ({ source: "system", systemDark: false }));
vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  const nativeTheme = Object.defineProperties(new EventEmitter(), {
    themeSource: {
      get: () => theme.source,
      set: (value: string) => {
        theme.source = value;
      },
    },
    shouldUseDarkColors: { get: () => theme.source === "dark" || (theme.source === "system" && theme.systemDark) },
  });
  return { BrowserWindow: class {}, nativeTheme, screen: {} };
});

const { nativeTheme } = (await import("electron")) as unknown as { nativeTheme: EventEmitter };
const { BACKGROUND, TITLE_BAR_HEIGHT, followTheme, syncWindowAppearance, titleBarOptions } = await import("../../src/desktop/window");

/** A window that notes how it was painted. */
function paintedWindow() {
  const painted = { background: "", buttons: null as null | { color?: string; symbolColor?: string; height?: number }, destroyed: false };
  return {
    painted,
    isDestroyed: () => painted.destroyed,
    setBackgroundColor: (color: string) => {
      painted.background = color;
    },
    setTitleBarOverlay: (options: { color?: string; symbolColor?: string; height?: number }) => {
      painted.buttons = options;
    },
  };
}

beforeEach(() => {
  theme.source = "system";
  theme.systemDark = false;
  nativeTheme.removeAllListeners();
});

describe("the window's title bar", () => {
  it("macOS: no title bar, the traffic lights inside the sidebar, nothing drawn over the page", () => {
    expect(titleBarOptions(false, "darwin")).toEqual({ titleBarStyle: "hidden", trafficLightPosition: { x: 16, y: 18 } });
    expect(titleBarOptions(true, "darwin")).toEqual(titleBarOptions(false, "darwin"));
  });

  for (const platform of ["win32", "linux"] as const)
    it(`${platform}: no title bar; only the window buttons, see-through, as tall as the top bar, their symbols dark on light and light on dark`, () => {
      const light = titleBarOptions(false, platform);
      const dark = titleBarOptions(true, platform);
      expect(light.titleBarStyle).toBe("hidden");
      expect(light.titleBarOverlay).toEqual({ color: "#01000000", symbolColor: "#1d1d1f", height: 52 });
      expect(dark.titleBarOverlay).toEqual({ color: "#01000000", symbolColor: "#ececef", height: 52 });
    });

  it("the window buttons are exactly as tall as the top bar the page draws", async () => {
    const { readFile } = await import("node:fs/promises");
    const css = await readFile(new URL("../../src/app/styles.css", import.meta.url), "utf8");
    expect(css).toContain(`--title-bar: ${TITLE_BAR_HEIGHT}px;`);
    expect(css).toContain(`env(titlebar-area-height, ${TITLE_BAR_HEIGHT}px)`);
  });
});

describe("the window's colors follow the theme", () => {
  it("Windows: the background and the buttons' symbols repaint for dark and light; macOS repaints only its background", () => {
    const windows = paintedWindow();
    syncWindowAppearance(windows, true, "win32");
    expect(windows.painted).toMatchObject({ background: BACKGROUND.dark, buttons: { symbolColor: "#ececef", height: 52 } });
    syncWindowAppearance(windows, false, "win32");
    expect(windows.painted).toMatchObject({ background: BACKGROUND.light, buttons: { symbolColor: "#1d1d1f" } });

    const mac = paintedWindow();
    syncWindowAppearance(mac, true, "darwin");
    expect(mac.painted).toEqual({ background: BACKGROUND.dark, buttons: null, destroyed: false });
  });

  it("a closed window isn't painted", () => {
    const window = paintedWindow();
    window.painted.destroyed = true;
    syncWindowAppearance(window, true, "win32");
    expect(window.painted.background).toBe("");
  });

  it("choosing Dark or Light in Settings repaints the buttons at once, and so does the system's theme changing under System", () => {
    const window = paintedWindow();
    const follow = followTheme(() => window, "win32");

    follow.set("dark");
    expect(window.painted.buttons?.symbolColor).toBe("#ececef");
    follow.set("light");
    expect(window.painted.buttons?.symbolColor).toBe("#1d1d1f");

    follow.set("system");
    theme.systemDark = true;
    nativeTheme.emit("updated");
    expect(window.painted).toMatchObject({ background: BACKGROUND.dark, buttons: { symbolColor: "#ececef" } });
  });

  it("before the window exists, a theme choice waits for it", () => {
    let window: ReturnType<typeof paintedWindow> | null = null;
    const follow = followTheme(() => window, "win32");
    follow.set("dark");
    window = paintedWindow();
    nativeTheme.emit("updated");
    expect(window.painted.buttons?.symbolColor).toBe("#ececef");
  });
});
