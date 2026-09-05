import type { MenuItemConstructorOptions } from "electron";

/**
 * Application menu: without this, the macOS menu bar shows Electron's default
 * ("Electron" app menu) — the loudest possible "this is a web view" tell.
 * Kept a pure template builder (same seam as tray-menu.ts) so the menu shape
 * is unit-testable; main.ts supplies the handlers.
 *
 * Shortcuts are part of the desktop contract: ⌘W closes (which the shell
 * maps to hide-to-tray), ⌘Q really quits, ⌘1–6 switch shell views.
 */
export interface AppMenuHandlers {
  gotoView(view: string): void;
}

export function buildAppMenuTemplate(
  appName: string,
  views: readonly { key: string; label: string }[],
  handlers: AppMenuHandlers,
): MenuItemConstructorOptions[] {
  const isMac = process.platform === "darwin";

  const viewItems: MenuItemConstructorOptions[] = views.map((view, index) => ({
    label: view.label,
    accelerator: `CmdOrCtrl+${index + 1}`,
    click: () => handlers.gotoView(view.key),
  }));

  const macAppMenu: MenuItemConstructorOptions = {
    label: appName,
    submenu: [
      { role: "about", label: `About ${appName}` },
      { type: "separator" },
      { role: "hide", label: `Hide ${appName}` },
      { role: "hideOthers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit", label: `Quit ${appName}` },
    ],
  };

  return [
    ...(isMac ? [macAppMenu] : []),
    {
      label: "File",
      submenu: [isMac ? { role: "close" } : { role: "quit" }],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        ...viewItems,
        { type: "separator" },
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [],
    },
  ];
}
