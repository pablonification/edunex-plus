// Reading a file from Edunex's storage into the window, to show it in the app
// (a picture in a lecturer's note, a PDF in the viewer). The main process
// fetches it, or takes a copy already on this computer: the window's content
// policy never lets it reach the internet itself. A file that can't be shown
// comes back as a problem to explain, not as an error. And writing a PDF the
// Student filled in the app to a file they choose.
import { z } from "zod";
import { Bytes, MAX_UPLOAD_BYTES } from "./tasks";

/** Why a file can't be shown: its link stopped working, it's gone, it's too big, it isn't what it claims to be, or the storage couldn't be reached. */
export const FileProblem = z.enum(["expired", "missing", "too-big", "unreadable", "unreachable"]);
export type FileProblem = z.infer<typeof FileProblem>;

export const filesActions = {
  /** A picture (PNG, JPEG, GIF or WebP, up to 20 MB) or a PDF (up to 100 MB) from Edunex's storage, checked to really be one. */
  "files.read": {
    input: z.object({ url: z.string().url().max(4000), as: z.enum(["image", "pdf"]) }),
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
} as const;
