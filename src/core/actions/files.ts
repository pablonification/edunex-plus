// Reading a file from Edunex's storage into the window, to show it in the app
// (a picture in a lecturer's note). The main process fetches it: the window's
// content policy never lets it reach the internet itself. A file that can't
// be shown comes back as a problem to explain, not as an error.
import { z } from "zod";
import { Bytes } from "./tasks";

/** Why a file can't be shown: its link stopped working, it's gone, it's too big, it isn't what it claims to be, or the storage couldn't be reached. */
export const FileProblem = z.enum(["expired", "missing", "too-big", "unreadable", "unreachable"]);
export type FileProblem = z.infer<typeof FileProblem>;

export const filesActions = {
  /** A picture from Edunex's storage, checked to really be one (PNG, JPEG, GIF or WebP). */
  "files.read": {
    input: z.object({ url: z.string().url().max(4000), as: z.enum(["image"]) }),
    output: z.union([z.object({ bytes: Bytes, type: z.string() }), z.object({ problem: FileProblem })]),
  },
} as const;
