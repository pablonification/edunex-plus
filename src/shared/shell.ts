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

/**
 * Hideable features (#22): the curated rail stays calm by letting students
 * hide pages they never use. Home is pinned — it is the course home base and
 * the fallback when a hidden view was active — so only the five content
 * views can be hidden. The default-visible set is the spec's v1 feature
 * list: every view visible.
 */
export const HIDEABLE_NAV_KEYS = ["todo", "agenda", "presence", "materials", "exams"] as const;

export type HideableNavKey = (typeof HIDEABLE_NAV_KEYS)[number];

export function isHideableNavKey(key: string): key is HideableNavKey {
  return (HIDEABLE_NAV_KEYS as readonly string[]).includes(key);
}

/** Persisted shell preferences, stored by main in userData and served over IPC. */
export interface ShellSettings {
  /** Hideable views currently hidden from navigation. Home can never appear here. */
  hiddenViews: HideableNavKey[];
  /**
   * Tray opt-out (#32 carry-over): when true, closing the window quits the
   * app and stops notification delivery. When false (default), close hides
   * to the tray and notifications keep flowing.
   */
  quitOnClose: boolean;
}

export const DEFAULT_SHELL_SETTINGS: ShellSettings = {
  hiddenViews: [],
  quitOnClose: false,
};

/**
 * Returns safe ShellSettings from arbitrary JSON (disk or IPC). Unknown view
 * keys are dropped, Home can never be hidden, duplicates collapse, and the
 * surviving list follows NAV_VIEWS order so rail/menu order stays stable.
 */
export function sanitizeShellSettings(raw: unknown): ShellSettings {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SHELL_SETTINGS };
  const { hiddenViews, quitOnClose } = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const hidden: HideableNavKey[] = [];
  if (Array.isArray(hiddenViews)) {
    for (const entry of hiddenViews) {
      if (typeof entry !== "string" || !isHideableNavKey(entry) || seen.has(entry)) continue;
      seen.add(entry);
    }
    for (const view of NAV_VIEWS) {
      if (seen.has(view.key)) hidden.push(view.key as HideableNavKey);
    }
  }
  return {
    hiddenViews: hidden,
    quitOnClose: quitOnClose === true,
  };
}
