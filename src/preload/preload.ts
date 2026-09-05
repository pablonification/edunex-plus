import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("edunex", {
  version: process.env.npm_package_version ?? "0.0.1",
  // Manual trigger for the notification carve-out check (#32); the main
  // process also fires one automatically on dev startup.
  fireTestNotification: () => ipcRenderer.invoke("notifications:test"),
});
