// Actions for the course page (#74): saving a course's files for offline
// reading. Single downloads and online-class links use "files.download" and
// "shell.openExternal"; the contract calculator saves with "local.set".
import { z } from "zod";

export const coursePageActions = {
  /**
   * Saves every file of a course from EduNex into <folder>/<course>/<module>/,
   * by default Documents/Edunex Plus. `pick`: the Student chooses the folder
   * first. Files already there are kept, so saving again fetches only what's new.
   */
  "course.saveOffline": {
    input: z.object({ code: z.string().min(1).max(20), pick: z.boolean() }),
    /** folder: null when the Student closed the folder picker. */
    output: z.object({ folder: z.string().nullable(), saved: z.number(), kept: z.number(), failed: z.number() }),
  },
} as const;
