import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("edunex", {
  version: process.env.npm_package_version ?? "0.0.1",
  platform: process.platform,
  // Manual trigger for the notification carve-out check (#32); the main
  // process also fires one automatically on dev startup.
  fireTestNotification: () => ipcRenderer.invoke("notifications:test"),
  getAppInfo: () =>
    ipcRenderer.invoke("app:info") as Promise<{
      version: string;
      platform: string;
      trayActive: boolean;
      notificationsSupported: boolean;
    }>,
  // Application-menu navigation (⌘1–6) arrives over this channel.
  onNavigate: (callback: (view: string) => void) => {
    const listener = (_event: unknown, view: string) => callback(view);
    ipcRenderer.on("nav:goto", listener);
    return () => ipcRenderer.removeListener("nav:goto", listener);
  },
});
