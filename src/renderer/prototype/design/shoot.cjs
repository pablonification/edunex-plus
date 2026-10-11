"use strict";
// PROTOTYPE (#83) — throwaway. Screenshots of the design prototype using an
// offscreen Electron window (nothing appears on screen).
// Usage (with the Vite dev server running on 127.0.0.1:5199):
//   env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron src/renderer/prototype/design/shoot.cjs \
//     --variants A --screens today,task --themes light,dark --langs en,id \
//     [--status draft] [--out .scratch/prototype/shots] [--size 1280x820] [--hide-switcher]
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const list = (name, fallback) => arg(name, fallback).split(",").filter(Boolean);
const base = arg("base", "http://127.0.0.1:5199/prototype/design/index.html");
const out = path.resolve(arg("out", path.join(__dirname, "../../../../.scratch/prototype/shots")));
const [width, height] = arg("size", "1280x820").split("x").map(Number);
const status = arg("status", "");
const hideSwitcher = process.argv.includes("--hide-switcher");
// Extra query for one-off states, e.g. --query "step=scan" or --query "tab=grades".
const extra = new URLSearchParams(arg("query", ""));
const suffix = arg("suffix", "");

app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "edunex-shoot-")));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ width, height, show: false, webPreferences: { offscreen: true } });
  for (const variant of list("variants", "A,B,C")) {
    for (const screen of list("screens", "signin,today,tasks,task,course")) {
      for (const theme of list("themes", "light,dark")) {
        for (const lang of list("langs", "en")) {
          const q = new URLSearchParams({ variant, screen, theme, lang });
          if (status && screen === "task") q.set("status", status);
          for (const [k, v] of extra) q.set(k, v);
          await win.loadURL(`${base}?${q}`);
          if (hideSwitcher) {
            await win.webContents.executeJavaScript(
              `document.querySelector("[data-prototype-switcher]")?.remove(); true`,
            );
          }
          await new Promise((r) => setTimeout(r, 900));
          const image = await win.webContents.capturePage();
          const file = path.join(out, `${variant}-${screen}${status && screen === "task" ? `-${status}` : ""}${suffix ? `-${suffix}` : ""}-${theme}-${lang}.png`);
          fs.writeFileSync(file, image.toPNG());
          console.log(file);
        }
      }
    }
  }
  app.exit(0);
});
