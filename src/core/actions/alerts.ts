// Actions for alerts and the tray (#75).
import { z } from "zod";

export const alertsActions = {
  /** The Student opened the alert history: everything in it counts as read. Only in the app, never in EduNex. */
  "alerts.markRead": { input: z.object({}), output: z.object({}) },
  /** Shows a sample OS notification, so the Student can check that notifications reach them. */
  "alerts.test": { input: z.object({}), output: z.object({ shown: z.boolean() }) },
} as const;
