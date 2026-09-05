export {};

/**
 * The preload-exposed bridge (src/preload/preload.ts). This is the renderer
 * seam from the spec's testing decisions — renderer code only ever touches
 * window.edunex, never Electron APIs.
 */
declare global {
  interface Window {
    edunex: {
      version: string;
      platform: string;
      fireTestNotification(): Promise<void>;
      getAppInfo(): Promise<{
        version: string;
        platform: string;
        trayActive: boolean;
        notificationsSupported: boolean;
      }>;
      onNavigate(callback: (view: string) => void): () => void;
    };
  }
}
