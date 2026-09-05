import { contextBridge, ipcRenderer } from "electron";
import type { AppInfo, NavKey } from "../shared/shell";

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
});
