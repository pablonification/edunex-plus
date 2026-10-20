// The tray (menu bar on macOS) icon that keeps the app reachable while its
// window is closed and it keeps alerting: Open and Quit, in the Student's
// language. macOS's menu bar gets a one-colour "Template" glyph it tints itself,
// the app's tile with its "e+" cut out; Windows and Linux the app's own colour
// icon, as their other apps do; each drawn at its sizes (scripts/make-icons.mjs).

import path from "node:path";
import { app, Menu, type NativeImage, nativeImage, Tray } from "electron";
import type { Lang } from "../core/models";
import { translate } from "../core/strings";

export interface AppTray {
  setLang(lang: Lang): void;
  destroy(): void;
}

/** The tray icon, or null where the system has none to offer. */
export function createTray(options: { lang: Lang; open: () => void; quit: () => void }): AppTray | null {
  const image = icon();
  if (image.isEmpty()) return null;
  let tray: Tray;
  try {
    tray = new Tray(image);
  } catch (error) {
    console.error("[tray] unavailable:", error);
    return null;
  }
  const build = (lang: Lang) => {
    tray.setToolTip("Edunex Plus");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: translate(lang, "tray.open"), click: options.open },
        { type: "separator" },
        { label: translate(lang, "tray.quit"), click: options.quit },
      ]),
    );
  };
  build(options.lang);
  // Windows and Linux: a click on the icon opens the window; the menu is on right-click.
  if (process.platform !== "darwin") tray.on("click", options.open);
  return { setLang: build, destroy: () => tray.destroy() };
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
