// "Laporkan masalah" on the phone (A9): the desktop's src/desktop/report.ts and its handlers
// (src/desktop/handlers/report.ts), answered in the app's own JS thread. The engine builds and
// scrubs the report; the screen shows it and names it back by its id, so what goes is exactly what
// the Student read. "Kirim langsung" posts that same report to the maintainer's relay, through the
// engine (ADR 0014). Choosing LINE or GitHub writes the report's file, the Student's note in it,
// into the app's own cache, never a folder other apps read; "Bagikan" (the desktop's "reveal")
// hands it to the phone's share sheet, where the Student picks LINE's chat, Drive or Files. The
// file goes when another report is shown, and when the app starts again.
import { randomUUID } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Linking, Platform } from "react-native";
import { isOfficialUrl, reportIssuePage } from "../../../src/core/links";
import type { Lang } from "../../../src/core/models";
import { needsFile, type ReportPreview, reportFile, reportFileName, reportIssueUrl } from "../../../src/core/report";
import type { AppLog } from "../../../src/engine/app-log";
import type { Engine } from "../../../src/engine/engine";
import { EngineError } from "../../../src/engine/errors";
import type { Handlers } from "./handlers";

type ReportAction =
  | "report.preview"
  | "report.save"
  | "report.open"
  | "report.reveal"
  | "report.send"
  | "report.note"
  | "report.dismiss"
  | "report.openIssue"
  | "report.windowError";

export interface ReportContext {
  engine: Pick<Engine, "report" | "reports" | "snapshot">;
  /** The app's own log, which every report carries: the screens' errors go in it. */
  log: Pick<AppLog, "add">;
  /** The phone's system, as the report names it ("Android 34"), as the engine's own `os`. */
  os?(): string;
  /** The demo opens nothing outside the app, like the desktop's. */
  demo: boolean;
}

/** Where a chosen report's file waits to be shared: the app's cache, emptied as the app starts. */
const folder = () => new Directory(Paths.cache, "reports");

function clearFiles(): void {
  try {
    const dir = folder();
    if (dir.exists) dir.delete();
  } catch {
    // Android clears the cache by itself when it needs the room.
  }
}

/** The report actions on the phone. Made once, with the host: any file left from the app's last run goes. */
export function phoneReportHandlers(context: ReportContext): Pick<Handlers, ReportAction> {
  const { engine } = context;
  clearFiles();
  /** The report the screen shows now: the only one it can send. */
  let shown: ReportPreview | null = null;
  /** Its file, once written. */
  let saved: { id: string; file: File } | null = null;
  const showing = (id: string) => {
    if (!shown || shown.id !== id) throw new EngineError("Rejected", "That report isn't the one shown");
    return shown;
  };
  const lang = (): Lang => engine.snapshot().settings.lang;
  const open = async (url: string) => {
    if (context.demo) return;
    await Linking.openURL(url);
  };

  return {
    "report.preview": async (about) => {
      shown = { id: randomUUID(), os: context.os?.() ?? `Android ${Platform.Version}`, report: await engine.report(about) };
      saved = null;
      clearFiles();
      return shown;
    },
    // Chosen again, the same file is written over (the note may have changed).
    "report.save": async ({ id, via, note }) => {
      const report = showing(id);
      if (via === "github" && !needsFile(report)) return { file: null };
      const text = reportFile(report, note);
      let file = saved?.id === id ? saved.file : null;
      if (!file) {
        const dir = folder();
        if (!dir.exists) dir.create({ intermediates: true });
        file = new File(dir, reportFileName(report.report.at));
      }
      if (!file.exists) file.create();
      file.writeSync(text);
      saved = { id, file };
      return { file: { name: file.name, bytes: new TextEncoder().encode(text).byteLength } };
    },
    "report.open": async ({ id, note }) => {
      const url = reportIssueUrl(showing(id), note, lang());
      if (!isOfficialUrl(url)) throw new EngineError("Rejected", "Only official pages open from the app");
      await open(url);
      return {};
    },
    // The desktop shows the file in its folder; the phone hands it to the share sheet.
    "report.reveal": async ({ id }) => {
      if (saved?.id !== id || !saved.file.exists) throw new EngineError("Rejected", "No file was saved for that report");
      if (!(await Sharing.isAvailableAsync())) throw new EngineError("Rejected", "This phone can't share files");
      await Sharing.shareAsync(saved.file.uri, { mimeType: "application/json", dialogTitle: saved.file.name });
      return {};
    },
    // "Kirim": exactly the report shown, with the system it named, to the maintainer's relay.
    "report.send": async ({ id, note }) => {
      const report = showing(id);
      return engine.reports.send(report.report, { note, os: report.os });
    },
    "report.note": async ({ sent, note }) => ({ result: await engine.reports.note(sent, note) }),
    "report.dismiss": async () => {
      await engine.reports.dismiss();
      return {};
    },
    // Only the issue of a report this app sent, its address made here from its number.
    "report.openIssue": async ({ number }) => {
      if (!engine.reports.filed(number)) throw new EngineError("Rejected", "That isn't the issue of a report this app sent");
      await open(reportIssuePage(number));
      return {};
    },
    "report.windowError": async ({ kind, where, message }) => {
      context.log.add("error", "window", where ? `${kind} in ${where}: ${message}` : `${kind}: ${message}`);
      return {};
    },
  };
}
