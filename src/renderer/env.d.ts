import type { AuthStatus } from "@shared/auth";
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
      onFullscreenChange(callback: (isFullscreen: boolean) => void): () => void;
      getAuthState(): Promise<AuthStatus | null>;
      startLogin(): Promise<void>;
      dismissLogin(): Promise<void>;
      onAuthState(callback: (status: AuthStatus) => void): () => void;
    };
  }
}

/**
 * The embedded login webview (#18): a plain <webview> tag on the persistent
 * auth partition. Capture of localStorage.auth happens in main via the
 * did-attach-webview hook — the renderer never touches token contents.
 */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        partition?: string;
        allowpopups?: string;
      };
    }
  }
}
