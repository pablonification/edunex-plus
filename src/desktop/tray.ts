// The tray (menu bar on macOS) icon that keeps the app reachable while its
// window is closed and it keeps alerting: Open and Quit, in the Student's
// language. assets/trayTemplate.png comes from scripts/generate-tray-icon.mjs;
// macOS tints "Template" images itself. Windows shows the same dark glyph,
// which a dark taskbar can hide (a light variant is still to be drawn).
import { app, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import type { Lang } from "../core/models";
import { translate } from "../core/strings";

export interface AppTray {
  setLang(lang: Lang): void;
  destroy(): void;
}

/** The tray icon, or null where the system has none to offer. */
export function createTray(options: { lang: Lang; open: () => void; quit: () => void }): AppTray | null {
  const image = nativeImage.createFromPath(path.join(app.getAppPath(), "assets", "trayTemplate.png"));
  if (image.isEmpty()) return null;
  image.setTemplateImage(true);
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
  return {
    setLang: build,
    destroy: () => tray.destroy(),
  };
}
