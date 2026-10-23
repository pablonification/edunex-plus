// "Mark as done" (Tandai selesai): the Edunex exam windows open for days that
// the Student says they already took, the one thing about an exam no system
// tells the app. Kept on this computer ("local.examMarks", saved with
// "local.set") and removed when they sign out of everything. A mark holds only
// while the window is the one it was made on (`facts`): when Edunex moves it,
// the exam is back in To do.
import { z } from "zod";

export const ExamMark = z.object({
  /** Edunex's own exam id, stable across syncs: "edunex-exam:88002". Not the merged exam's id, which repeats every term (DK4073-UTS). */
  id: z.string().min(1).max(200),
  /** The window when marked, "<start>|<end>" in ms: if Edunex moves it, the mark no longer holds. */
  facts: z.string().max(200),
  /** When the Student marked it (Done says "Ditandai 22 Okt"). */
  at: z.number(),
});
export type ExamMark = z.infer<typeof ExamMark>;

export const examMarkDatasets = {
  "local.examMarks": z.array(ExamMark).max(500),
} as const;
