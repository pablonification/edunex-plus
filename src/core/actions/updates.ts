// "New version available" (#82), and updating from inside the app.
import { z } from "zod";
import { UpdateInstall } from "../models";

export const updatesActions = {
  /** Opens the newer release's GitHub page in the system browser. */
  "app.openRelease": { input: z.object({}), output: z.object({}) },
  /**
   * Starts downloading the newer release for this computer, from GitHub only; progress comes as
   * "update" events. Nothing is installed. A copy that can't update itself opens the release page instead.
   */
  "app.downloadUpdate": { input: z.object({}), output: UpdateInstall },
  /** Only after a download is ready, and only when the Student asks: puts it in place and restarts the app. */
  "app.installUpdate": { input: z.object({}), output: z.object({}) },
} as const;
