// Actions for "Laporkan masalah" (ADR 0007). The window shows the report main hands it, already
// scrubbed, and names it back by its id: it never sends words, pages or an address of its own.
import { z } from "zod";
import { ReportAbout } from "../models";
import { MAX_NOTE, ReportPreview } from "../report";

const Shown = z.string().min(1).max(100);
const Via = z.enum(["line", "github"]);
const Note = z.string().max(MAX_NOTE);

export const reportActions = {
  /** What a report about `about` would send, scrubbed already, for the Student to read. Nothing is sent. */
  "report.preview": { input: ReportAbout, output: ReportPreview },
  /**
   * The Student chose a way: saves the report file, with their note, to Downloads (for LINE always,
   * for GitHub when there's a page to attach). Chosen again, the same file is written over.
   * `file`: its name and size; null when nothing needed saving.
   */
  "report.save": {
    input: z.object({ id: Shown, via: Via, note: Note }),
    output: z.object({ file: z.object({ name: z.string(), bytes: z.number() }).nullable() }),
  },
  /** Opens a new GitHub issue, filled in with the report and the note. (LINE is reached by its QR code, nothing to open.) */
  "report.open": { input: z.object({ id: Shown, note: Note }), output: z.object({}) },
  /** Shows the report file in its folder, to drag it into the chat or the issue. */
  "report.reveal": { input: z.object({ id: Shown }), output: z.object({}) },
} as const;
