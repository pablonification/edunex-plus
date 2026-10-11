// Start-up, refresh, settings and opening official pages (#71).
import { shell } from "electron";
import { EngineError } from "../../engine/errors";
import { isOfficialUrl } from "../security";
import type { HandlerGroup } from "./context";

export const coreHandlers: HandlerGroup<"app.snapshot" | "app.ready" | "sync.refresh" | "settings.update" | "shell.openExternal"> = (context) => ({
  "app.snapshot": async () => ({ ...context.engine.snapshot(), platform: platform(), vault: context.vaultMode }),
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
});

function platform(): "darwin" | "win32" | "linux" {
  return process.platform === "darwin" || process.platform === "win32" ? process.platform : "linux";
}
