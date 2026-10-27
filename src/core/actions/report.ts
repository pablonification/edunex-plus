// Actions for "Laporkan masalah" (ADR 0007). The window shows the report main hands it, already
// scrubbed, and names it back by its id: it never sends words, pages or an address of its own.
import { z } from "zod";
import { ReportAbout, ReportIssue } from "../models";
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
  /**
   * "Kirim" (ADR 0014): the report shown, with the note, to the maintainer's relay. Filed (with its
   * public issue once there is one, and whether the problem was reported before), kept by the relay
   * to file later, or why not: something in it looks personal, it's too big, the relay asks to wait,
   * or it refused it. No connection is an Offline error.
   */
  "report.send": {
    input: z.object({ id: Shown, note: Note }),
    output: z.union([
      z.object({ result: z.enum(["filed", "stored"]), id: z.string().nullable(), issue: ReportIssue.nullable(), duplicate: z.boolean() }),
      z.object({ result: z.enum(["personal", "too-big", "busy", "failed"]) }),
    ]),
  },
  /** The Student's note on a report sent this session (`sent`: its id at the relay). Public, like the issue. */
  "report.note": {
    input: z.object({ sent: z.string().min(1).max(100), note: z.string().min(1).max(MAX_NOTE) }),
    output: z.object({ result: z.enum(["added", "personal", "gone", "busy", "failed"]) }),
  },
  /** The Student closed the question the app asked about a problem, sending nothing. */
  "report.dismiss": { input: z.object({}), output: z.object({}) },
  /** Opens the public issue of a report this app sent, by its number (any other is refused). */
  "report.openIssue": { input: z.object({ number: z.number().int().positive() }), output: z.object({}) },
  /**
   * Something broke in the window (an error nobody caught, a promise nobody waited for, a panel's
   * crash guard): it goes in the app's own log, which a report carries. `where`: the panel.
   */
  "report.windowError": {
    input: z.object({ kind: z.enum(["error", "rejection", "panel"]), where: z.string().max(80).optional(), message: z.string().max(2000) }),
    output: z.object({}),
  },
} as const;
