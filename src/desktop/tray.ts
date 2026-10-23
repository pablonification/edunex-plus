// The tray (menu bar on macOS) icon that keeps the app reachable while its
// window is closed and it keeps alerting, with a menu of what the Student
// needs to know now (./tray-menu.ts says what's in it). macOS's menu bar gets
// a one-colour "Template" glyph it tints itself, the app's tile with its "e+"
// cut out; Windows and Linux the app's own colour icon, as their other apps
// do; each drawn at its sizes (scripts/make-icons.mjs).

import path from "node:path";
import { app, Menu, type MenuItemConstructorOptions, type NativeImage, nativeImage, Tray } from "electron";
import type { TrayAction, TrayEntry, TrayMenu } from "./tray-menu";

export interface AppTray {
  /** What the menu reads changed: it's built again within a second, and at most once a second. */
  changed(): void;
  /** Built again now (new settings: its language, how far Perlu perhatianmu looks). */
  update(): void;
  destroy(): void;
}

/** How long changes gather before the menu is built again: a sync sends many at once. */
const GATHER = 1_000;
const MINUTE = 60_000;

/**
 * The tray icon, or null where the system has none to offer. `menu` builds
 * it from what the engine has now; besides on changes, it's built each
 * minute on the minute, for what time alone moves (a class starting, a
 * deadline passing, a new day), and set again only when it says something new.
 */
export function createTray(options: { menu: () => TrayMenu; now: () => number; act: (action: TrayAction) => void }): AppTray | null {
  const image = icon();
  if (image.isEmpty()) return null;
  let tray: Tray;
  try {
    tray = new Tray(image);
  } catch (error) {
    console.error("[tray] unavailable:", error);
    return null;
  }
  let shown = "";
  let gathering: ReturnType<typeof setTimeout> | null = null;
  let ticking: ReturnType<typeof setTimeout> | null = null;
  // Linux shows a menu's change only once it's set again: every change sets it whole.
  const update = () => {
    if (gathering) clearTimeout(gathering);
    gathering = null;
    let menu: TrayMenu;
    try {
      menu = options.menu();
    } catch (error) {
      // The menu as it was beats no menu: Open and Quit are still in it.
      console.error("[tray] menu not built:", error);
      return;
    }
    const said = JSON.stringify(menu);
    if (said === shown) return;
    shown = said;
    tray.setToolTip(menu.tooltip);
    tray.setContextMenu(Menu.buildFromTemplate(menu.entries.map((entry) => menuItem(entry, options.act))));
  };
  const tick = () => {
    ticking = setTimeout(
      () => {
        update();
        tick();
      },
      MINUTE - (options.now() % MINUTE) + 50,
    );
    ticking.unref?.();
  };
  update();
  tick();
  // Windows and Linux: a click on the icon opens the window; the menu is on right-click. (Linux's
  // AppIndicator has no click of its own: it only shows the menu, with "Buka Edunex Plus" in it.)
  if (process.platform !== "darwin") tray.on("click", () => options.act({ kind: "window" }));
  return {
    changed() {
      if (gathering) return;
      gathering = setTimeout(update, GATHER);
      gathering.unref?.();
    },
    update,
    destroy() {
      if (gathering) clearTimeout(gathering);
      if (ticking) clearTimeout(ticking);
      tray.destroy();
    },
  };
}

function menuItem(entry: TrayEntry, act: (action: TrayAction) => void): MenuItemConstructorOptions {
  if (entry.type === "separator") return { type: "separator" };
  const label = systemLabel(entry.label);
  // A section's label: macOS 14 draws a real one; elsewhere a line that can't be clicked.
  if (entry.type === "header") return headers() ? { type: "header", label } : { label, enabled: false };
  const { action } = entry;
  return action ? { label, click: () => act(action) } : { label, enabled: false };
}

/** Windows and Linux read "&" as the key to underline: "&&" is one "&", as a Task's title has it. */
function systemLabel(label: string): string {
  return process.platform === "darwin" ? label : label.replaceAll("&", "&&");
}

/** Section labels as macOS draws them, from macOS 14 on. */
function headers(): boolean {
  return process.platform === "darwin" && Number(process.getSystemVersion().split(".")[0]) >= 14;
}

function icon(): NativeImage {
  const assets = path.join(app.getAppPath(), "assets");
  // Windows picks the size its display scaling needs (16 px at 100%, 24 at 150%...) from the .ico.
  if (process.platform === "win32") return nativeImage.createFromPath(path.join(assets, "tray.ico"));
  if (process.platform !== "darwin") return nativeImage.createFromPath(path.join(assets, "tray.png"));
  const image = nativeImage.createFromPath(path.join(assets, "trayTemplate.png"));
  image.setTemplateImage(true);
  return image;
}
