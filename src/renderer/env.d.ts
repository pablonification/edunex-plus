import type { AppInfo, NavKey } from "@shared/shell";

export {};

/**
 * The preload-exposed bridge (src/preload/preload.ts). This is the renderer
 * seam from the spec's testing decisions — renderer code only ever touches
 * window.edunex, never Electron APIs. Shared types come from src/shared.
 */
declare global {
  interface Window {
    edunex: {
      version: string;
      platform: string;
      fireTestNotification(): Promise<void>;
      getAppInfo(): Promise<AppInfo>;
      onNavigate(callback: (view: NavKey) => void): () => void;
    };
  }
}
