// "Remind me later": the Beranda items and course banners the Student put off,
// kept on this computer ("local.snoozes", saved with "local.set") and removed
// when they sign out of everything. Each snooze ends (`until`), and it holds
// only while the item still has the facts it had (`facts`): a moved deadline,
// a new count or an item turning urgent brings it back before then.
//
// "Handled" (sudah beres): what the Student put away for good, where only they
// can know it's dealt with ("local.done"). A list of its own, so an older
// version ignores it and a bad entry drops only this list, never the snoozes.
// It holds while the item keeps its facts: only a new fact brings it back.
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

/** Which "handled": a change checked, a class's warning seen, a hand-in Edunex can't see, a payment SIX hasn't shown. */
export const DoneHow = z.enum(["checked", "gotIt", "groupDone", "handedElsewhere", "notHandingIn", "paid"]);
export type DoneHow = z.infer<typeof DoneHow>;

export const DoneEntry = z.object({
  /** The item's id, as Beranda and the Task page know it: "task:117001:edited", "task:117001", "attendance:KU5014", "bill:2026-1". */
  id: z.string().min(1).max(200),
  /** The facts it had when put away: when they differ, it's back. */
  facts: z.string().max(500),
  /** When the Student put it away (ms): for "Sudah dicek hari ini, 20:16", and for pruning. */
  at: z.number(),
  how: DoneHow,
});
export type DoneEntry = z.infer<typeof DoneEntry>;

/** Whose snoozes and handled list these are: a different Student signing in to Edunex starts with none, even after the last one signed out of Edunex alone. */
export const LocalOwner = z.object({ nim: z.string().max(40) });

export const snoozeDatasets = {
  "local.snoozes": z.array(SnoozeEntry).max(500),
  "local.done": z.array(DoneEntry).max(500),
  "local.owner": LocalOwner,
} as const;
