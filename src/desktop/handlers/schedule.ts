// Bridge handlers for Jadwal (#77): the phone calendar file, written where the
// Student chooses in the system save dialog, and shown in the file manager
// afterwards. Only on the Student's click; reveal only ever shows the file
// saved here last, never a path from the window.
import { app, dialog, shell } from "electron";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { DatasetName, DatasetValue } from "../../core/models";
import { phoneCalendar } from "../../core/phone-calendar";
import { EngineError } from "../../engine/errors";
import type { HandlerGroup } from "./context";

export const scheduleHandlers: HandlerGroup<"schedule.export" | "schedule.reveal"> = (context) => {
  let saved: string | null = null;
  return {
    "schedule.export": async (options) => {
      const window = context.window();
      if (!window) throw new EngineError("Failed", "The window is closed");
      const snapshot = context.engine.snapshot();
      const get = <N extends DatasetName>(name: N) => snapshot.datasets.find((d) => d.name === name)?.value as DatasetValue<N> | undefined;
      const calendar = phoneCalendar(get, context.lang(), Date.now(), options);
      const chosen = await dialog.showSaveDialog(window, {
        defaultPath: path.join(app.getPath("documents"), "Edunex Plus.ics"),
        filters: [{ name: "iCalendar", extensions: ["ics"] }],
      });
      if (chosen.canceled || !chosen.filePath) return { file: null, events: 0 };
      const file = chosen.filePath.toLowerCase().endsWith(".ics") ? chosen.filePath : `${chosen.filePath}.ics`;
      await writeFile(file, calendar.text, "utf8");
      saved = file;
      return { file: path.basename(file), events: calendar.events };
    },
    "schedule.reveal": async () => {
      if (!saved || !existsSync(saved)) throw new EngineError("Rejected", "No calendar file was saved");
      shell.showItemInFolder(saved);
      return {};
    },
  };
};
