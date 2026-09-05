import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Persists window bounds across launches — table stakes for a desktop app.
 * Stored in the app's userData dir; sanitized before use so a corrupt or
 * hand-edited file can't create an off-screen or 0px window.
 */

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

const MIN_SIZE = 200;

/**
 * Returns a safe WindowState from arbitrary JSON, or null when unusable.
 * Positions are dropped (not clamped) when they fall far off-screen —
 * guessing the right work-area per monitor is worse than letting the OS
 * cascade a fresh window.
 */
export function sanitizeWindowState(
  raw: unknown,
  workArea: { width: number; height: number },
): WindowState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { width, height, x, y, isMaximized } = raw as Record<string, unknown>;

  if (typeof width !== "number" || typeof height !== "number") return null;
  if (width < MIN_SIZE || height < MIN_SIZE) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  const state: WindowState = {
    width: Math.round(width),
    height: Math.round(height),
  };

  if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
    const onScreenish =
      x > -width * 0.5 && y > -height * 0.5 && x < workArea.width && y < workArea.height;
    if (onScreenish) {
      state.x = Math.round(x);
      state.y = Math.round(y);
    }
  }

  if (isMaximized === true) state.isMaximized = true;
  return state;
}

export function loadWindowState(filePath: string, workArea: { width: number; height: number }) {
  try {
    return sanitizeWindowState(JSON.parse(readFileSync(filePath, "utf8")), workArea);
  } catch {
    return null;
  }
}

export function saveWindowState(
  filePath: string,
  state: WindowState,
  workArea: { width: number; height: number },
): void {
  try {
    writeFileSync(filePath, JSON.stringify(sanitizeWindowState(state, workArea)));
  } catch {
    // userData may not exist yet on first run before app is ready — skip.
  }
}
