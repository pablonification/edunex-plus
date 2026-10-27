// Bridge handlers for "Laporkan masalah" (../report.ts): the report's file goes to Downloads, and
// a new issue opens under the official-links rule.
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { app, shell } from "electron";
import { isOfficialUrl } from "../../core/links";
import { EngineError } from "../../engine/errors";
import { reportHandlers as handlersOn } from "../report";
import type { HandlerGroup } from "./context";

const SYSTEMS: Partial<Record<NodeJS.Platform, string>> = { darwin: "macOS", win32: "Windows", linux: "Linux" };

/** The computer's system, as a report names it ("macOS 15.3 (arm64)"). */
export const systemName = () => `${SYSTEMS[process.platform] ?? process.platform} ${process.getSystemVersion()} (${process.arch})`;

export const reportHandlers: HandlerGroup<
  | "report.preview"
  | "report.save"
  | "report.open"
  | "report.reveal"
  | "report.send"
  | "report.note"
  | "report.dismiss"
  | "report.openIssue"
  | "report.windowError"
> = (context) =>
  handlersOn({
    engine: context.engine,
    log: context.log,
    os: systemName,
    lang: context.lang,
    async save(name, text, replacing) {
      let file = replacing;
      if (!file) {
        const folder = app.getPath("downloads");
        const { name: base, ext } = path.parse(name);
        file = path.join(folder, name);
        for (let n = 2; existsSync(file); n++) file = path.join(folder, `${base} (${n})${ext}`);
      }
      await writeFile(file, text, "utf8");
      return file;
    },
    async open(url) {
      if (!isOfficialUrl(url)) throw new EngineError("Rejected", "Only official pages open from the app");
      await shell.openExternal(url);
    },
    reveal: (file) => shell.showItemInFolder(file),
    openIssue: (url) => shell.openExternal(url),
  });
