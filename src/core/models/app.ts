// The app's own news (#82): a newer release on GitHub.
import { z } from "zod";

export const UpdateNotice = z.object({
  /** The release's version, without a leading "v". */
  version: z.string(),
  /** Its GitHub release page. */
  url: z.string().url(),
});
export type UpdateNotice = z.infer<typeof UpdateNotice>;

export const appDatasets = {
  /** Present only while a newer release exists. */
  "app.update": UpdateNotice,
} as const;
