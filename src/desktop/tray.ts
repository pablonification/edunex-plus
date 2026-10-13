// The tray (menu bar on macOS) icon that keeps the app reachable while its
// window is closed and it keeps alerting: Open and Quit, in the Student's
// language. The icons come from scripts/generate-tray-icon.mjs: macOS tints
// the "Template" image itself; Windows gets the dark or the light glyph to
// match its taskbar, and switches when the Student changes it.

import path from "node:path";
import { app, Menu, type NativeImage, nativeImage, nativeTheme, Tray } from "electron";
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
  const repaint = () => {
    if (!tray.isDestroyed()) tray.setImage(icon());
  };
  if (process.platform === "win32") nativeTheme.on("updated", repaint);
  return {
    setLang: build,
    destroy: () => {
      nativeTheme.off("updated", repaint);
      tray.destroy();
    },
  };
}

function icon(): NativeImage {
  const assets = path.join(app.getAppPath(), "assets");
  // The taskbar's own theme, which can differ from the apps' (Windows' "custom" colors).
  if (process.platform === "win32" && nativeTheme.shouldUseDarkColorsForSystemIntegratedUI)
    return nativeImage.createFromPath(path.join(assets, "trayLight.png"));
  const image = nativeImage.createFromPath(path.join(assets, "trayTemplate.png"));
  image.setTemplateImage(true);
  return image;
}
