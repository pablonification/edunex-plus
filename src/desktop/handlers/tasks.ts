// Bridge handlers for handing in Tasks (#73). Files come only from the
// system's file picker or a drop on the window, and the window refers to them
// by ids issued in ../hand-in.ts: it never names a path on this computer.

import { promises as fs } from "node:fs";
import path from "node:path";
import { dialog, type OpenDialogOptions } from "electron";
import { ANSWER_FILE_TYPES } from "../../core/actions/tasks";
import { translate } from "../../core/strings";
import { contentType, type HandInAction, handInHandlers, type LocalFile } from "../hand-in";
import type { HandlerGroup } from "./context";

export const tasksHandlers: HandlerGroup<HandInAction> = (context) =>
  handInHandlers(context.engine, async () => {
    const title = translate(context.lang(), "handIn.pickTitle");
    // Only the kinds of file Edunex takes in an answer can be picked.
    const options: OpenDialogOptions = {
      title,
      message: title,
      properties: ["openFile", "multiSelections"],
      filters: [{ name: translate(context.lang(), "handIn.pickKinds"), extensions: [...ANSWER_FILE_TYPES] }],
    };
    const window = context.window();
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    if (result.canceled) return [];
    const files: LocalFile[] = [];
    for (const filePath of result.filePaths) {
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat?.isFile()) continue;
      files.push({
        name: path.basename(filePath),
        size: stat.size,
        type: contentType(filePath),
        read: async () => new Uint8Array(await fs.readFile(filePath)),
      });
    }
    return files;
  });
