// "Remind me later": the Beranda items and course banners the Student put off,
// kept on this computer ("local.snoozes", saved with "local.set") and removed
// when they sign out of everything. Each snooze ends (`until`), and it holds
// only while the item still has the facts it had (`facts`): a moved deadline,
// a new count or an item turning urgent brings it back before then.
import { z } from "zod";

export const SnoozeEntry = z.object({
  /** What was put off: "task:117432", "attendance:KU5014" (Beranda's item and the course banner share it). */
  id: z.string().min(1).max(200),
  /** What it said then (deadline, room, count, how urgent): when that changes, it's back. */
  facts: z.string().max(500),
  /** Back at this moment (ms), whatever happens. */
  until: z.number(),
  /** The choice made ("morning", "change"), so the list of snoozed things can say it in the same words. */
  reason: z.string().max(40).optional(),
});
export type SnoozeEntry = z.infer<typeof SnoozeEntry>;

export const snoozeDatasets = {
  "local.snoozes": z.array(SnoozeEntry).max(500),
} as const;
