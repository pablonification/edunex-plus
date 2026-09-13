import type { AuthStatus } from "@shared/auth";
import type { FeedKey, FeedSnapshot } from "@shared/feeds";
import type { InAppNotification } from "@shared/notifications";
import type { AppInfo, NavKey, ShellSettings } from "@shared/shell";
import type { SaveDraftInput, SaveDraftResult } from "@shared/submission";

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
      onAuthState(callback: (status: AuthStatus) => void): () => void;
      getFeed(feed: FeedKey): Promise<FeedSnapshot | null>;
      onFeedUpdated(callback: (snapshot: FeedSnapshot) => void): () => void;
      getShellSettings(): Promise<ShellSettings>;
      setViewHidden(view: NavKey, hidden: boolean): Promise<ShellSettings>;
      setQuitOnClose(quitOnClose: boolean): Promise<ShellSettings>;
      onShellSettings(callback: (settings: ShellSettings) => void): () => void;
      getNotifications(): Promise<InAppNotification[]>;
      markNotificationsRead(ids: string[]): Promise<InAppNotification[]>;
      markAllNotificationsRead(): Promise<InAppNotification[]>;
      onNotificationsUpdated(callback: (entries: InAppNotification[]) => void): () => void;
      onNotificationClicked(
        callback: (payload: { taskIds: string[]; presenceIds?: string[] }) => void,
      ): () => void;
      saveDraft(input: SaveDraftInput): Promise<SaveDraftResult>;
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
