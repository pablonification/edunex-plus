import { contextBridge, ipcRenderer } from "electron";
import type { AuthStatus } from "../shared/auth";
import type { FeedKey, FeedSnapshot } from "../shared/feeds";
import type {
  MaterialDownloadRequest,
  MaterialDownloadResult,
} from "../shared/materials";
import type { InAppNotification } from "../shared/notifications";
import type { AppInfo, NavKey, ShellSettings } from "../shared/shell";
import type {
  SaveDraftInput,
  SaveDraftResult,
  SubmitAnswerInput,
  SubmitAnswerResult,
} from "../shared/submission";

contextBridge.exposeInMainWorld("edunex", {
  version: process.env.npm_package_version ?? "0.0.1",
  platform: process.platform,
  // Manual trigger for the notification carve-out check (#32); the main
  // process also fires one automatically on dev startup.
  fireTestNotification: () => ipcRenderer.invoke("notifications:test"),
  getAppInfo: () => ipcRenderer.invoke("app:info") as Promise<AppInfo>,
  // Application-menu navigation (⌘1–6) arrives over this channel. Main only
  // ever sends NAV_VIEWS keys (both sides share src/shared/shell.ts), so the
  // NavKey type is honest here despite the channel being stringly at runtime.
  onNavigate: (callback: (view: NavKey) => void) => {
    const listener = (_event: unknown, view: NavKey) => callback(view);
    ipcRenderer.on("nav:goto", listener);
    return () => ipcRenderer.removeListener("nav:goto", listener);
  },
  // macOS window-fullscreen state (traffic lights hidden vs. inline).
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
    const listener = (_event: unknown, isFullscreen: boolean) => callback(isFullscreen);
    ipcRenderer.on("window:fullscreen", listener);
    return () => ipcRenderer.removeListener("window:fullscreen", listener);
  },
  // Auth (#18): null until main's startup restore has resolved.
  getAuthState: () => ipcRenderer.invoke("auth:get-state") as Promise<AuthStatus | null>,
  startLogin: () => ipcRenderer.invoke("auth:start-login") as Promise<void>,
  onAuthState: (callback: (status: AuthStatus) => void) => {
    const listener = (_event: unknown, status: AuthStatus) => callback(status);
    ipcRenderer.on("auth:state", listener);
    return () => ipcRenderer.removeListener("auth:state", listener);
  },
  // Sync (#19): feed reads always come through main's persisted snapshot
  // cache. The renderer never receives the bearer token or calls the API.
  getFeed: (feed: FeedKey) =>
    ipcRenderer.invoke("sync:get-feed", feed) as Promise<FeedSnapshot | null>,
  onFeedUpdated: (callback: (snapshot: FeedSnapshot) => void) => {
    const listener = (_event: unknown, snapshot: FeedSnapshot) => callback(snapshot);
    ipcRenderer.on("sync:feed-updated", listener);
    return () => ipcRenderer.removeListener("sync:feed-updated", listener);
  },
  // Materials (#30): listing reads the cached feed above; downloading is an
  // explicit user action that routes through main so the bearer token never
  // reaches the renderer. Main shows the save dialog and writes the bytes.
  downloadMaterial: (request: MaterialDownloadRequest) =>
    ipcRenderer.invoke("materials:download", request) as Promise<MaterialDownloadResult>,
  // Shell preferences (#22): hidden views + the tray opt-out persist in
  // main's userData across restarts; writes push back on shell:settings-updated.
  getShellSettings: () => ipcRenderer.invoke("shell:get-settings") as Promise<ShellSettings>,
  setViewHidden: (view: NavKey, hidden: boolean) =>
    ipcRenderer.invoke("shell:set-view-hidden", view, hidden) as Promise<ShellSettings>,
  setQuitOnClose: (quitOnClose: boolean) =>
    ipcRenderer.invoke("shell:set-quit-on-close", quitOnClose) as Promise<ShellSettings>,
  onShellSettings: (callback: (settings: ShellSettings) => void) => {
    const listener = (_event: unknown, settings: ShellSettings) => callback(settings);
    ipcRenderer.on("shell:settings-updated", listener);
    return () => ipcRenderer.removeListener("shell:settings-updated", listener);
  },
  // Notification Center fallback feed (#23, extended by #24): the persisted
  // in-app entries. OS clicks arrive on a separate channel with the covered
  // task ids so the renderer can land on the To Do destination (#21), or
  // with presence ids for Presence-open alerts (destination: agenda).
  getNotifications: () =>
    ipcRenderer.invoke("notifications:get") as Promise<InAppNotification[]>,
  markNotificationsRead: (ids: string[]) =>
    ipcRenderer.invoke("notifications:mark-read", ids) as Promise<InAppNotification[]>,
  markAllNotificationsRead: () =>
    ipcRenderer.invoke("notifications:mark-all-read") as Promise<InAppNotification[]>,
  onNotificationsUpdated: (callback: (entries: InAppNotification[]) => void) => {
    const listener = (_event: unknown, entries: InAppNotification[]) => callback(entries);
    ipcRenderer.on("notifications:updated", listener);
    return () => ipcRenderer.removeListener("notifications:updated", listener);
  },
  onNotificationClicked: (
    callback: (payload: { taskIds: string[]; presenceIds?: string[] }) => void,
  ) => {
    const listener = (
      _event: unknown,
      payload: { taskIds: string[]; presenceIds?: string[] },
    ) => callback(payload);
    ipcRenderer.on("notifications:clicked", listener);
    return () => ipcRenderer.removeListener("notifications:clicked", listener);
  },
  // Task Answer draft-save (#25): explicit-only write. Create = POST
  // /course/task/answers (201) when no answer id is known, else update =
  // PATCH /course/task/answers/{answerId}. Status refreshes on next sync.
  saveDraft: (input: SaveDraftInput) =>
    ipcRenderer.invoke("tasks:save-draft", input) as Promise<SaveDraftResult>,
  // Final Task Answer submit (#26): explicit-only write. The API receives
  // only the saved answer id and flips is_sent to 1.
  submitAnswer: (input: SubmitAnswerInput) =>
    ipcRenderer.invoke("tasks:submit", input) as Promise<SubmitAnswerResult>,
});
