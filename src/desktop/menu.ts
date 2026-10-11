// The application menu, in the Student's language. Settings (⌘,) and Refresh
// (⌘R) are sent to the window as commands; standard items use OS roles so the
// system names and shortcuts apply.
import { app, Menu, type MenuItemConstructorOptions } from "electron";
import { type Lang, translate } from "../core/strings";

export function installMenu(options: { lang: Lang; devTools: boolean; command: (command: "settings" | "refresh") => void }): void {
  const t = (key: Parameters<typeof translate>[1]) => translate(options.lang, key);
  const mac = process.platform === "darwin";
  const settings: MenuItemConstructorOptions = { label: t("menu.settings"), accelerator: "CmdOrCtrl+,", click: () => options.command("settings") };
  const developer: MenuItemConstructorOptions[] = options.devTools
    ? [{ type: "separator" }, { role: "reload", accelerator: "CmdOrCtrl+Shift+R" }, { role: "toggleDevTools" }]
    : [];

  const template: MenuItemConstructorOptions[] = [
    mac
      ? {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            settings,
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        }
      : { label: t("menu.file"), submenu: [settings, { type: "separator" }, { role: "quit" }] },
    { role: "editMenu" },
    {
      label: t("menu.view"),
      submenu: [
        { label: t("menu.refresh"), accelerator: "CmdOrCtrl+R", click: () => options.command("refresh") },
        ...developer,
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
