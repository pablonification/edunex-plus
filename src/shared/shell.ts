/**
 * Contracts shared between the main process and the renderer. The tsconfigs
 * for src/main, src/preload and src/renderer all include this directory —
 * it must stay dependency-free (no Electron imports) so every side can use
 * it.
 */

/** The shell views: single source of truth for the curated rail and the
 * application menu's ⌘1–6 mapping (same keys, same order). */
export const NAV_VIEWS = [
  { key: "home", label: "Home" },
  { key: "todo", label: "To Do" },
  { key: "agenda", label: "Agenda" },
  { key: "presence", label: "Presence" },
  { key: "materials", label: "Materials" },
  { key: "exams", label: "Exams" },
] as const;

export type NavKey = (typeof NAV_VIEWS)[number]["key"];

/** Runtime facts for the shell's System panel, served by main over app:info. */
export interface AppInfo {
  version: string;
  platform: string;
  trayActive: boolean;
  notificationsSupported: boolean;
}
