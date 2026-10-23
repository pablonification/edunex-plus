// Actions for "Laporkan masalah" (ADR 0007). The window shows the report main hands it, already
// scrubbed, and names it back to send: it never sends words or pages of its own, nor an address.
import { z } from "zod";
import { ReportAbout } from "../models";
import { MAX_NOTE, ReportPreview } from "../report";

const Shown = z.string().min(1).max(100);

export const reportActions = {
  /** What a report about `about` would send, scrubbed already, for the Student to read. Nothing is sent. */
  "report.preview": { input: ReportAbout, output: ReportPreview },
  /**
   * Sends the report last shown (`id`) the way the Student picked, with their note. "github": saves
   * its file to Downloads and opens a new issue, filled in. "line": copies the summary, saves the
   * file and opens the maintainer's LINE. `file`: the saved file's name; null without a page to send.
   */
  "report.send": {
    input: z.object({ id: Shown, via: z.enum(["github", "line"]), note: z.string().max(MAX_NOTE) }),
    output: z.object({ file: z.string().nullable() }),
  },
  /** Copies the summary of the report last shown again ("Salin laporan"). */
  "report.copy": { input: z.object({ id: Shown, note: z.string().max(MAX_NOTE) }), output: z.object({}) },
  /** Shows the file saved for that report in its folder, to drag it into the issue or the chat. */
  "report.reveal": { input: z.object({ id: Shown }), output: z.object({}) },
} as const;
