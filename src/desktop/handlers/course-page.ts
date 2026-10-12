// Bridge handlers for the course page (#74): saving a course's Edunex files
// for offline reading, by course and module. Only on the Student's click. The
// files go through Chromium's download manager like single downloads, so the
// OS marks them as downloaded from the internet.

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { app, dialog, shell, type WebContents } from "electron";
import { planOfflineFiles } from "../../core/course-materials";
import type { DatasetName, DatasetValue } from "../../core/models";
import { EngineError } from "../../engine/errors";
import { isDownloadable } from "../downloads";
import type { HandlerGroup } from "./context";

export const coursePageHandlers: HandlerGroup<"course.saveOffline"> = (context) => ({
  "course.saveOffline": async ({ code, pick }) => {
    const window = context.window();
    if (!window) throw new EngineError("Failed", "The window is closed");
    const dataset = <N extends DatasetName>(name: N) => context.engine.snapshot().datasets.find((d) => d.name === name)?.value as DatasetValue<N> | undefined;
    const course = dataset("edunex.courses")?.find((c) => c.code === code);
    if (!course) throw new EngineError("Rejected", `${code} isn't one of this term's courses`);
    const plan = planOfflineFiles(
      { code: course.code, name: course.name, mainCourseId: course.edunex.courseId },
      dataset("edunex.outline")?.[code],
      dataset("edunex.materials")?.[code] ?? [],
      context.lang(),
    );

    let root = path.join(app.getPath("documents"), "Edunex Plus");
    if (pick) {
      const chosen = await dialog.showOpenDialog(window, { defaultPath: root, properties: ["openDirectory", "createDirectory"] });
      if (chosen.canceled || !chosen.filePaths[0]) return { folder: null, saved: 0, kept: 0, failed: 0 };
      root = chosen.filePaths[0];
    }
    const folder = path.join(root, plan.folder);
    let saved = 0;
    let kept = 0;
    let failed = 0;
    // One file at a time: polite to Edunex, and each download is told apart by its address.
    for (const file of plan.files) {
      const target = path.join(folder, ...file.folders, file.name);
      if (!target.startsWith(folder + path.sep) || !isDownloadable(file.url)) {
        failed += 1;
        continue;
      }
      if (existsSync(target)) {
        kept += 1;
        continue;
      }
      try {
        mkdirSync(path.dirname(target), { recursive: true });
        await saveTo(window.webContents, file.url, target);
        saved += 1;
      } catch {
        failed += 1;
      }
    }
    mkdirSync(folder, { recursive: true });
    void shell.openPath(folder);
    return { folder, saved, kept, failed };
  },
});

function saveTo(contents: WebContents, url: string, target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const session = contents.session;
    const onWillDownload = (_event: Electron.Event, item: Electron.DownloadItem) => {
      if (item.getURLChain()[0] !== url) return;
      session.removeListener("will-download", onWillDownload);
      item.setSavePath(target);
      item.once("done", (_done, state) => (state === "completed" ? resolve() : reject(new EngineError("Failed", `The download was ${state}`))));
    };
    session.on("will-download", onWillDownload);
    contents.downloadURL(url);
  });
}
