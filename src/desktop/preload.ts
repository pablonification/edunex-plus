// The whole surface the window gets: ask the engine (invoke) and hear from it
// (onEvent). No Node, no Electron objects, nothing else crosses.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { CHANNEL_EVENT, CHANNEL_INVOKE } from "../core/channels";

// The development demo runs on its own clock; the window shows the same time.
const clockArgument = process.argv.find((arg) => arg.startsWith("--edunex-plus-clock-offset="));

contextBridge.exposeInMainWorld("edunexPlus", {
  clockOffset: clockArgument ? Number(clockArgument.slice(clockArgument.indexOf("=") + 1)) || 0 : 0,
  invoke: (name: string, input: unknown) => ipcRenderer.invoke(CHANNEL_INVOKE, name, input),
  onEvent: (listener: (event: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, payload: unknown) => listener(payload);
    ipcRenderer.on(CHANNEL_EVENT, handler);
    return () => void ipcRenderer.removeListener(CHANNEL_EVENT, handler);
  },
});
