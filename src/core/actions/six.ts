// Actions for SIX (#76).
import { z } from "zod";

export const sixActions = {
  /**
   * The Student is done connecting (they left the welcome screen). The sign-in
   * windows' shared Microsoft session, kept for a few minutes so one sign-in
   * can cover Edunex and SIX, is wiped now.
   */
  "auth.signInDone": { input: z.object({}), output: z.object({}) },
} as const;
