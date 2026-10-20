// Reading a file from Edunex's storage into the window, to show it in the app
// (a picture in a lecturer's note; a PDF, Word document, spreadsheet,
// PowerPoint slides, text file or old Office file in the viewer). The main
// process fetches it, or takes a copy already on this computer: the window's
// content policy never lets it reach the internet itself. A file that can't be
// shown comes back as a problem to explain, not as an error. And writing a PDF
// the Student filled in the app to a file they choose.
import { z } from "zod";
import { Bytes, MAX_UPLOAD_BYTES } from "./tasks";

/** Why a file can't be shown: its link stopped working, it's gone, it's too big, it isn't what it claims to be, or the storage couldn't be reached. */
export const FileProblem = z.enum(["expired", "missing", "too-big", "unreadable", "unreachable"]);
export type FileProblem = z.infer<typeof FileProblem>;

/** What a file is read in as: each kind is checked for and capped on its own (desktop/remote-files.ts). A CSV is text. */
export const ReadAs = z.enum(["image", "pdf", "docx", "xlsx", "pptx", "text", "doc", "xls", "ppt"]);
export type ReadAs = z.infer<typeof ReadAs>;

/** An app on this computer that opens a file: `id` names it to "files.open" (its place, on macOS). `icon`: a data: URL. */
export const OpenApp = z.object({ id: z.string().max(1000), name: z.string().max(200), icon: z.string().nullable() });
export type OpenApp = z.infer<typeof OpenApp>;

/**
 * A file from Edunex that's on this computer (downloaded, or saved for
 * offline): its name, the apps that open it (the system's own first; none
 * where the system can't list them), the one the Student opened it in last
 * time (else the system's own), and whether the system has its own window to
 * choose another (Windows).
 */
export const LocalCopy = z.object({ name: z.string(), apps: z.array(OpenApp), preferred: z.string().nullable(), chooser: z.boolean() });
export type LocalCopy = z.infer<typeof LocalCopy>;

export const filesActions = {
  /**
   * A picture (PNG, JPEG, GIF or WebP, up to 20 MB), a PDF (up to 100 MB), a
   * Word document (.docx, 50 MB), an Excel workbook (.xlsx, 20 MB), PowerPoint
   * slides (.pptx or .ppsx, 100 MB), text (UTF-8, 5 MB), or an old Word, Excel
   * or PowerPoint file (.doc 50 MB, .xls 20 MB, .ppt 100 MB) from Edunex's
   * storage, checked to really be one.
   */
  "files.read": {
    input: z.object({ url: z.string().url().max(4000), as: ReadAs }),
    output: z.union([z.object({ bytes: Bytes, type: z.string() }), z.object({ problem: FileProblem })]),
  },
  /**
   * A PDF the Student filled in, saved as a new file where they choose in the
   * system save dialog (Downloads, under `name`, unless they pick otherwise).
   * `file`: the name it was saved under; null when they closed the dialog.
   */
  "files.saveCopy": {
    input: z.object({ name: z.string().min(1).max(200), bytes: Bytes.refine((bytes) => bytes.byteLength <= MAX_UPLOAD_BYTES) }),
    output: z.object({ file: z.string().nullable() }),
  },
  /** The copy of this file on this computer, if there is one. Only copies the app made itself, never a place the window names. */
  "files.local": { input: z.object({ url: z.string().url().max(4000) }), output: LocalCopy.nullable() },
  /**
   * Opens the copy on this computer: in `app` (one of the apps "files.local"
   * listed, remembered for files of its kind), else in the system's own app.
   * `choose`: the system's "Open with" window instead.
   */
  "files.open": {
    input: z.object({ url: z.string().url().max(4000), app: z.string().max(1000).optional(), choose: z.boolean().optional() }),
    output: z.object({}),
  },
  /** Shows the copy on this computer in its folder (Finder, File Explorer, the file manager). */
  "files.reveal": { input: z.object({ url: z.string().url().max(4000) }), output: z.object({}) },
} as const;
