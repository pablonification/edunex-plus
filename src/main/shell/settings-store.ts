import { readFileSync, writeFileSync } from "node:fs";
import {
  DEFAULT_SHELL_SETTINGS,
  sanitizeShellSettings,
  type ShellSettings,
} from "../../shared/shell";

/**
 * Shell preferences persistence (#22): hidden views + the tray opt-out live
 * in userData as plain JSON (no secrets — safeStorage is for tokens only).
 * Corrupt or hand-edited files fall back to the default-visible set rather
 * than stranding navigation.
 */

export function loadShellSettings(filePath: string): ShellSettings {
  try {
    return sanitizeShellSettings(JSON.parse(readFileSync(filePath, "utf8")));
  } catch {
    return { ...DEFAULT_SHELL_SETTINGS, hiddenViews: [...DEFAULT_SHELL_SETTINGS.hiddenViews] };
  }
}

export function saveShellSettings(filePath: string, settings: ShellSettings): void {
  try {
    writeFileSync(filePath, JSON.stringify(sanitizeShellSettings(settings)));
  } catch {
    // userData may not exist yet on first run before app is ready — skip.
  }
}
