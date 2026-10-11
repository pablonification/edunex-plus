// The main window: created hidden and shown only once the page has drawn the
// saved data, with native chrome per platform (hidden title bar with the
// traffic lights inside the sidebar on macOS, the standard frame elsewhere).
// Its size and place are remembered.
import { BrowserWindow, nativeTheme, screen } from "electron";
import { z } from "zod";
import type { FileStorage } from "./storage";

export const BACKGROUND = { light: "#ffffff", dark: "#161618" } as const;

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

export function createMainWindow(options: { preload: string; state: WindowState | null; devTools: boolean; storage: FileStorage; clockOffset?: number }): BrowserWindow {
  const mac = process.platform === "darwin";
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
    backgroundColor: nativeTheme.shouldUseDarkColors ? BACKGROUND.dark : BACKGROUND.light,
    titleBarStyle: mac ? "hidden" : "default",
    trafficLightPosition: mac ? { x: 16, y: 18 } : undefined,
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
