// "New version available" (#82).
import { z } from "zod";

export const updatesActions = {
  /** Opens the newer release's GitHub page in the system browser. Nothing is downloaded or installed by the app. */
  "app.openRelease": { input: z.object({}), output: z.object({}) },
} as const;
