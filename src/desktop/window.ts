// The main window: created hidden and shown only once the page has drawn the
// saved data, with no system title bar: on macOS the traffic lights sit inside
// the sidebar; on Windows and Linux the system draws only its window buttons
// over the right end of the app's own top bar (src/app/shell/shell.tsx), in
// the theme's colors. Its size and place are remembered.
import { BrowserWindow, type BrowserWindowConstructorOptions, nativeTheme, screen } from "electron";
import { z } from "zod";
import type { AppSnapshot } from "../core/contract";
import type { Settings } from "../core/models";
import type { FileStorage } from "./storage";

export const BACKGROUND = { light: "#ffffff", dark: "#161618" } as const;

export type Platform = AppSnapshot["platform"];

/** The system the app runs on, as the window knows it. */
export function currentPlatform(): Platform {
  return process.platform === "darwin" || process.platform === "win32" ? process.platform : "linux";
}

/** The top bar's height (the shell's `--title-bar`): the window buttons fill it, so they sit centred in it. */
export const TITLE_BAR_HEIGHT = 52;
// Fully transparent shows wrong on Linux; almost transparent doesn't. The symbols are the theme's text colors.
const OVERLAY = { color: "#01000000", light: "#1d1d1f", dark: "#ececef" } as const;

type TitleBarOptions = Pick<BrowserWindowConstructorOptions, "titleBarStyle" | "titleBarOverlay" | "trafficLightPosition">;

/** No system title bar anywhere: macOS keeps its traffic lights, Windows and Linux their window buttons, drawn over the top bar. */
export function titleBarOptions(dark: boolean, platform: Platform): TitleBarOptions {
  if (platform === "darwin") return { titleBarStyle: "hidden", trafficLightPosition: { x: 16, y: 18 } };
  return {
    titleBarStyle: "hidden",
    titleBarOverlay: { color: OVERLAY.color, symbolColor: dark ? OVERLAY.dark : OVERLAY.light, height: TITLE_BAR_HEIGHT },
  };
}

type PaintedWindow = Pick<BrowserWindow, "isDestroyed" | "setBackgroundColor" | "setTitleBarOverlay">;

/** Paints the window's own colors for the theme: its background, and Windows' and Linux's window buttons. */
export function syncWindowAppearance(window: PaintedWindow, dark: boolean, platform: Platform): void {
  if (window.isDestroyed()) return;
  window.setBackgroundColor(dark ? BACKGROUND.dark : BACKGROUND.light);
  const { titleBarOverlay } = titleBarOptions(dark, platform);
  if (typeof titleBarOverlay === "object") window.setTitleBarOverlay(titleBarOverlay);
}

/**
 * Keeps the window's own colors on the theme: the system's as it changes, and the
 * one the Student picks in Settings (`set`), painted at once rather than left to
 * the system to announce.
 */
export function followTheme(window: () => PaintedWindow | null, platform: Platform): { set(theme: Settings["theme"]): void } {
  const paint = () => {
    const current = window();
    if (current) syncWindowAppearance(current, nativeTheme.shouldUseDarkColors, platform);
  };
  nativeTheme.on("updated", paint);
  return {
    set(theme) {
      nativeTheme.themeSource = theme;
      paint();
    },
  };
}

const WindowState = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().min(400),
  height: z.number().min(300),
  maximized: z.boolean(),
});
type WindowState = z.infer<typeof WindowState>;

const STATE_KEY = "window.json";

export async function loadWindowState(storage: FileStorage): Promise<WindowState | null> {
  try {
    const parsed = WindowState.safeParse(JSON.parse((await storage.read(STATE_KEY)) ?? "null"));
    if (!parsed.success) return null;
    // Only reuse a place that is still on one of the screens.
    const visible = screen.getAllDisplays().some(({ workArea: a }) => {
      const s = parsed.data;
      return s.x < a.x + a.width - 80 && s.x + s.width > a.x + 80 && s.y >= a.y - 20 && s.y < a.y + a.height - 80;
    });
    return visible ? parsed.data : null;
  } catch {
    return null;
  }
}

export function createMainWindow(options: {
  preload: string;
  state: WindowState | null;
  devTools: boolean;
  storage: FileStorage;
  clockOffset?: number;
}): BrowserWindow {
  const mac = process.platform === "darwin";
  const dark = nativeTheme.shouldUseDarkColors;
  const { state } = options;
  const window = new BrowserWindow({
    width: state?.width ?? 1180,
    height: state?.height ?? 780,
    x: state?.x,
    y: state?.y,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: "Edunex Plus",
    backgroundColor: dark ? BACKGROUND.dark : BACKGROUND.light,
    ...titleBarOptions(dark, currentPlatform()),
    autoHideMenuBar: !mac,
    webPreferences: {
      preload: options.preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false,
      devTools: options.devTools,
      // Only the development demo runs on its own clock (see ./demo.ts).
      additionalArguments: options.clockOffset ? [`--edunex-plus-clock-offset=${Math.round(options.clockOffset)}`] : [],
    },
  });
  if (state?.maximized) window.maximize();

  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return;
    const bounds = window.getNormalBounds();
    void options.storage.write(STATE_KEY, JSON.stringify({ ...bounds, maximized: window.isMaximized() })).catch(() => undefined);
  };
  const later = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 400);
  };
  window.on("resize", later);
  window.on("move", later);
  window.on("close", () => {
    if (timer) clearTimeout(timer);
    save();
  });
  return window;
}
