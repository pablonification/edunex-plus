// "Laporkan masalah" in the main process (ADR 0007): the report the engine scrubbed goes to the
// window to read, then out the way the Student picks, one step at a time. Choosing a way saves
// the report file, their note in it, to Downloads (for LINE always: the file is the message; for
// GitHub when there's a page to attach). On GitHub, a new issue then opens on their click, filled
// in; LINE needs nothing opened (the window shows the maintainer's QR code). The window names the
// report it showed back by its id, so what goes is exactly what the Student read. A relay that
// posts the report itself would be one more way here.
//
// No Electron here, so the window's tests run these as main does: ./handlers/report.ts gives them
// the system (Downloads, the browser, the file manager).
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Lang } from "../core/models";
import { hasPages, type ReportPreview, reportFile, reportFileName, reportIssueUrl } from "../core/report";
import type { Engine } from "../engine/engine";
import { EngineError } from "../engine/errors";
import type { Handlers } from "./ipc";

export interface ReportDesk {
  engine: Pick<Engine, "report">;
  /** The computer's system, as the report names it ("macOS 15.3 (arm64)"). */
  os(): string;
  lang(): Lang;
  /**
   * Writes the report's file where the Student finds it (Downloads) under `name`, next to any file
   * already called that; or over `replacing`, the one saved for this report before. Where it went.
   */
  save(name: string, text: string, replacing: string | null): Promise<string>;
  /** Opens a new issue in the browser, under the official-links rule. */
  open(url: string): Promise<void>;
  reveal(file: string): void;
}

export function reportHandlers(desk: ReportDesk): Pick<Handlers, "report.preview" | "report.save" | "report.open" | "report.reveal"> {
  /** The report the window shows now: the only one it can send. */
  let shown: ReportPreview | null = null;
  /** Its file, once saved. */
  let saved: { id: string; file: string } | null = null;
  const showing = (id: string) => {
    if (!shown || shown.id !== id) throw new EngineError("Rejected", "That report isn't the one shown");
    return shown;
  };

  return {
    "report.preview": async (about) => {
      shown = { id: randomUUID(), os: desk.os(), report: desk.engine.report(about) };
      saved = null;
      return shown;
    },
    "report.save": async ({ id, via, note }) => {
      const report = showing(id);
      if (via === "github" && !hasPages(report)) return { file: null };
      const text = reportFile(report, note);
      const file = await desk.save(reportFileName(report.report.at), text, saved?.id === id ? saved.file : null);
      saved = { id, file };
      return { file: { name: path.basename(file), bytes: Buffer.byteLength(text) } };
    },
    "report.open": async ({ id, note }) => {
      await desk.open(reportIssueUrl(showing(id), note, desk.lang()));
      return {};
    },
    "report.reveal": async ({ id }) => {
      if (saved?.id !== id) throw new EngineError("Rejected", "No file was saved for that report");
      desk.reveal(saved.file);
      return {};
    },
  };
}
