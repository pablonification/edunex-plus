// PROTOTYPE (throwaway) — preload for the spike console window only.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spikeLog', function (cb) {
  ipcRenderer.on('spike:log', function (_event, line) { cb(line); });
});
