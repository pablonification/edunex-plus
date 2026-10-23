// "Laporkan masalah" in the main process (ADR 0007): the report the engine scrubbed goes to the
// window to read, then out the way the Student picks. GitHub: the file with the scrubbed pages is
// saved to Downloads and a new issue opens, filled in, for them to drag it in. LINE: the summary is
// copied, the same file saved, and the maintainer's LINE opens. The window names the report it
// showed back by its id, so what goes is exactly what the Student read. A relay that posts the
// report itself would be one more `via` here, with the same preview.
//
// No Electron here, so the window's tests run these as main does: ./handlers/report.ts gives them
// the system (Downloads, the clipboard, the browser).
import { randomUUID } from "node:crypto";
import path from "node:path";
import { MAINTAINER_LINE } from "../core/links";
import type { Lang } from "../core/models";
import { hasPages, type ReportPreview, reportFile, reportFileName, reportIssueUrl, reportSummary } from "../core/report";
import type { Engine } from "../engine/engine";
import { EngineError } from "../engine/errors";
import type { Handlers } from "./ipc";

export interface ReportDesk {
  engine: Pick<Engine, "report">;
  /** The computer's system, as the report names it ("macOS 15.3 (arm64)"). */
  os(): string;
  lang(): Lang;
  /** Saves the report's file where the Student finds it (Downloads), next to any with its name; where it went. */
  save(name: string, text: string): Promise<string>;
  copy(text: string): void;
  /** Opens one of the two report addresses (a new issue, the maintainer's LINE) in the browser, under the official-links rule. */
  open(url: string): Promise<void>;
  reveal(file: string): void;
}

export function reportHandlers(desk: ReportDesk): Pick<Handlers, "report.preview" | "report.send" | "report.copy" | "report.reveal"> {
  /** The report the window shows now: the only one it can send. */
  let shown: ReportPreview | null = null;
  /** Its file, once saved: sent both ways, it's saved once. */
  let saved: { id: string; file: string } | null = null;
  const showing = (id: string) => {
    if (!shown || shown.id !== id) throw new EngineError("Rejected", "That report isn't the one shown");
    return shown;
  };
  const summary = (report: ReportPreview, note: string) => reportSummary(report, note, saved?.id === report.id ? path.basename(saved.file) : null, desk.lang());

  return {
    "report.preview": async (about) => {
      shown = { id: randomUUID(), os: desk.os(), report: desk.engine.report(about) };
      saved = null;
      return shown;
    },
    "report.send": async ({ id, via, note }) => {
      const report = showing(id);
      if (hasPages(report) && saved?.id !== id) saved = { id, file: await desk.save(reportFileName(report.report.at), reportFile(report)) };
      if (via === "github") await desk.open(reportIssueUrl(report, summary(report, note), desk.lang()));
      else {
        desk.copy(summary(report, note));
        await desk.open(MAINTAINER_LINE.url);
      }
      return { file: saved?.id === id ? path.basename(saved.file) : null };
    },
    "report.copy": async ({ id, note }) => {
      desk.copy(summary(showing(id), note));
      return {};
    },
    "report.reveal": async ({ id }) => {
      if (saved?.id !== id) throw new EngineError("Rejected", "No file was saved for that report");
      desk.reveal(saved.file);
      return {};
    },
  };
}
