// Files from Edunex go through Chromium's own download manager, so the OS
// marks them as downloaded from the internet (quarantine / Mark of the Web).
// They land in Downloads under their own name; nothing opens by itself
// (open-with.ts opens one when the Student asks).

import { existsSync } from "node:fs";
import path from "node:path";
import { app, type WebContents } from "electron";
import { EngineError } from "../engine/errors";

/** Where Edunex keeps files: its storage on Azure, its API, ITB's own sites. */
const FILE_HOSTS = [/\.blob\.core\.windows\.net$/, /^api-edunex\.cognisia\.id$/, /(^|\.)itb\.ac\.id$/];

export function isDownloadable(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && FILE_HOSTS.some((host) => host.test(parsed.hostname));
  } catch {
    return false;
  }
}

export function download(contents: WebContents, url: string, name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const session = contents.session;
    const onWillDownload = (_event: Electron.Event, item: Electron.DownloadItem) => {
      if (item.getURLChain()[0] !== url) return;
      session.removeListener("will-download", onWillDownload);
      const target = freePath(app.getPath("downloads"), safeName(name));
      item.setSavePath(target);
      item.once("done", (_done, state) => {
        if (state !== "completed") return reject(new EngineError("Failed", `The download was ${state}`));
        resolve(target);
      });
    };
    session.on("will-download", onWillDownload);
    contents.downloadURL(url);
  });
}

/** A file name with no folders or characters the file system refuses. */
export function safeName(name: string): string {
  const clean = name
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  return clean || "file";
}

/** "Notes.pdf", then "Notes (2).pdf" … so nothing already there is replaced. */
function freePath(folder: string, name: string): string {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let candidate = path.join(folder, name);
  for (let n = 2; existsSync(candidate); n++) candidate = path.join(folder, `${base} (${n})${ext}`);
  return candidate;
}
