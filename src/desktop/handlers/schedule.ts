// Bridge handler for Jadwal (#77): the phone calendar file, written where the
// Student chooses in the system save dialog. Only on the Student's click.
import { app, dialog } from "electron";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { DatasetName, DatasetValue } from "../../core/models";
import { phoneCalendar } from "../../core/phone-calendar";
import { EngineError } from "../../engine/errors";
import type { HandlerGroup } from "./context";

export const scheduleHandlers: HandlerGroup<"schedule.export"> = (context) => ({
  "schedule.export": async () => {
    const window = context.window();
    if (!window) throw new EngineError("Failed", "The window is closed");
    const snapshot = context.engine.snapshot();
    const get = <N extends DatasetName>(name: N) => snapshot.datasets.find((d) => d.name === name)?.value as DatasetValue<N> | undefined;
    const calendar = phoneCalendar(get, context.lang(), Date.now());
    const chosen = await dialog.showSaveDialog(window, {
      defaultPath: path.join(app.getPath("documents"), "Edunex Plus.ics"),
      filters: [{ name: "iCalendar", extensions: ["ics"] }],
    });
    if (chosen.canceled || !chosen.filePath) return { file: null, events: 0 };
    const file = chosen.filePath.toLowerCase().endsWith(".ics") ? chosen.filePath : `${chosen.filePath}.ics`;
    await writeFile(file, calendar.text, "utf8");
    return { file: path.basename(file), events: calendar.events };
  },
});
