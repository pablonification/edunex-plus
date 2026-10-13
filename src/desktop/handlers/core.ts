// Start-up, refresh, settings, opening official pages and lecturers' links (#71).
import { shell } from "electron";
import { isOfficialUrl, isWebLink } from "../../core/links";
import { EngineError } from "../../engine/errors";
import { download, isDownloadable } from "../downloads";
import type { HandlerGroup } from "./context";

type Core = "app.snapshot" | "app.ready" | "sync.refresh" | "settings.update" | "shell.openExternal" | "shell.openLink" | "files.download" | "local.set";

export const coreHandlers: HandlerGroup<Core> = (context) => ({
  "app.snapshot": async () => ({ ...context.engine.snapshot(), platform: context.platform, vault: context.vaultMode }),
  "app.ready": async () => {
    context.reveal();
    context.startSyncing();
    return {};
  },
  "sync.refresh": async ({ source }) => {
    await context.engine.refresh(source);
    return {};
  },
  "settings.update": async (patch) => {
    const next = await context.engine.updateSettings(patch);
    context.applySettings(next);
    return next;
  },
  "shell.openExternal": async ({ url }) => {
    if (!isOfficialUrl(url)) throw new EngineError("Rejected", "Only official pages open from the app");
    await shell.openExternal(url);
    return {};
  },
  // A lecturer's link opens like it does on Edunex: any web page, but in the system browser, never in the app.
  "shell.openLink": async ({ url }) => {
    if (!isWebLink(url)) throw new EngineError("Rejected", "Only web pages open from a lecturer's link");
    await shell.openExternal(url);
    return {};
  },
  "files.download": async ({ url, name }) => {
    if (!isDownloadable(url)) throw new EngineError("Rejected", "Only Edunex's files download from the app");
    const window = context.window();
    if (!window) throw new EngineError("Failed", "The window is closed");
    return { path: await download(window.webContents, url, name) };
  },
  "local.set": async ({ name, value }) => {
    await context.engine.setLocal(name, value);
    return {};
  },
});
