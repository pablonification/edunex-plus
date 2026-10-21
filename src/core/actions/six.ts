// Actions for SIX (#76).
import { z } from "zod";

export const sixActions = {
  /**
   * The Student is done connecting (they left the welcome screen). The sign-in
   * windows' shared Microsoft session, kept for a few minutes so one sign-in
   * can cover Edunex and SIX, is wiped now.
   */
  "auth.signInDone": { input: z.object({}), output: z.object({}) },
  /**
   * "Tandai Hadir": opens SIX in a window of the app, signed in, on the
   * timetable with this class's popup up, for the Student to press SIX's
   * button themselves. The meeting must be on the timetable the app read.
   */
  "six.openCheckIn": { input: z.object({ meetingId: z.string().regex(/^\d{1,20}$/) }), output: z.object({}) },
} as const;
