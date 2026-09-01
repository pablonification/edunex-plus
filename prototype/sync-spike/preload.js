// PROTOTYPE (throwaway) — preload for the spike console window only.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spikeLog', function (cb) {
  ipcRenderer.on('spike:log', function (_event, line) { cb(line); });
});

// Renderer-side heartbeat: the main process logs how many times this 250ms
// interval fired in the last second. In a hidden window Chromium clamps
// timers — that contrast against the unthrottled main-process tick is one of
// the things this spike proves.
contextBridge.exposeInMainWorld('spikeRenderHeartbeat', function () {
  let fires = 0;
  setInterval(function () { fires++; }, 250);
  setInterval(function () {
    ipcRenderer.send('spike:render-ticks', fires);
    fires = 0;
  }, 1000);
});
