import type { MenuItemConstructorOptions } from "electron";

/**
 * Tray menu contract for the shell slice (#32): the tray is what makes
 * close-to-tray survivable — without a visible Quit, hiding the window on
 * close would strand the app with no way out. Kept as a pure template builder
 * so the menu shape is unit-testable without launching Electron; main.ts
 * supplies the real show/quit handlers.
 */
export interface TrayMenuHandlers {
  show(): void;
  quit(): void;
}

export function buildTrayMenuTemplate(handlers: TrayMenuHandlers): MenuItemConstructorOptions[] {
  return [
    { label: "Show Edunex Plus", click: handlers.show },
    { type: "separator" },
    { label: "Quit Edunex Plus", click: handlers.quit },
  ];
}
