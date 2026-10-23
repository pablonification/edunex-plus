// Bridge handlers for "Laporkan masalah" (../report.ts): the report's file goes to Downloads, its
// summary to the clipboard, and only the two report addresses open, under the official-links rule.
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { app, clipboard, shell } from "electron";
import { isOfficialUrl } from "../../core/links";
import { EngineError } from "../../engine/errors";
import { reportHandlers as handlersOn } from "../report";
import type { HandlerGroup } from "./context";

const SYSTEMS: Partial<Record<NodeJS.Platform, string>> = { darwin: "macOS", win32: "Windows", linux: "Linux" };

export const reportHandlers: HandlerGroup<"report.preview" | "report.send" | "report.copy" | "report.reveal"> = (context) =>
  handlersOn({
    engine: context.engine,
    os: () => `${SYSTEMS[process.platform] ?? process.platform} ${process.getSystemVersion()} (${process.arch})`,
    lang: context.lang,
    async save(name, text) {
      const folder = app.getPath("downloads");
      const { name: base, ext } = path.parse(name);
      let file = path.join(folder, name);
      for (let n = 2; existsSync(file); n++) file = path.join(folder, `${base} (${n})${ext}`);
      await writeFile(file, text, "utf8");
      return file;
    },
    copy: (text) => clipboard.writeText(text),
    async open(url) {
      if (!isOfficialUrl(url)) throw new EngineError("Rejected", "Only official pages open from the app");
      await shell.openExternal(url);
    },
    reveal: (file) => shell.showItemInFolder(file),
  });
