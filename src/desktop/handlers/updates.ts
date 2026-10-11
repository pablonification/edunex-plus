// "New version available" (#82): the release page opens in the browser.
import { shell } from "electron";
import { UpdateNotice } from "../../core/models";
import { EngineError } from "../../engine/errors";
import type { HandlerGroup } from "./context";

export const updatesHandlers: HandlerGroup<"app.openRelease"> = (context) => ({
  "app.openRelease": async () => {
    // Only the page the update check built from GitHub's answer, never a URL from the window.
    const notice = context.engine.snapshot().datasets.find((dataset) => dataset.name === "app.update");
    if (!notice) throw new EngineError("Rejected", "No newer release");
    await shell.openExternal(UpdateNotice.parse(notice.value).url);
    return {};
  },
});
