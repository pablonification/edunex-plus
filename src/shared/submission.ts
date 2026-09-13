/**
 * Submission status (issue #25, pain 3a): the "saved ≠ submitted" trap.
 *
 * The vendor API's `is_sent` field (0 = draft) is the only reliable
 * draft/submitted bit — `sent_at` is stamped on drafts too, so the app
 * derives status from `is_sent` only and never displays `sent_at`.
 *
 * Three states, matching the accepted variant C prototype:
 *   draft     → yellow chip, yellow-edged status card (quiet Save-draft)
 *   submitted → lime chip, green-edged status card (Submit lives in #26)
 *   overdue   → rose chip, rose-edged status card (past deadline, not sent)
 *
 * Overdue derives from the deadline vs `is_sent`: past due AND not
 * submitted. A submitted answer stays submitted even past its deadline.
 */

export type SubmissionStatus = "draft" | "submitted" | "overdue";

/** Chip color per status (BoardUI free-tier Chip). */
export const SUBMISSION_CHIP_COLOR = {
  draft: "yellow",
  submitted: "lime",
  overdue: "rose",
} as const;

/** Short chip label per status for the task list rows. */
export const SUBMISSION_CHIP_LABEL: Record<SubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  overdue: "Overdue",
};

/** Status-card presentation per status (colored edge + status word). */
export const SUBMISSION_CARD = {
  draft: {
    word: "DRAFT — NOT SUBMITTED",
    edgeClass: "border-yellow-400",
    panelClass: "bg-yellow-50",
    titleClass: "text-yellow-900",
    bodyClass: "text-yellow-800/80",
    dot: "yellow",
  },
  submitted: {
    word: "SUBMITTED",
    edgeClass: "border-green-500",
    panelClass: "bg-green-50",
    titleClass: "text-green-900",
    bodyClass: "text-green-800/80",
    dot: "green",
  },
  overdue: {
    word: "OVERDUE — NOT SUBMITTED",
    edgeClass: "border-rose-400",
    panelClass: "bg-rose-50",
    titleClass: "text-rose-900",
    bodyClass: "text-rose-800/80",
    dot: "rose",
  },
} as const;

/**
 * Normalizes the vendor `is_sent` bit. Accepts the numeric (0/1), string
 * ("0"/"1"), and boolean shapes seen across `/todo` and `/course/tasks`
 * payloads. Returns null when the bit is absent or unrecognized — the
 * caller treats unknown as not-sent (draft/overdue), never as submitted.
 */
export function parseIsSent(value: unknown): boolean | null {
  if (value === 1 || value === "1" || value === true) return true;
  if (value === 0 || value === "0" || value === false) return false;
  return null;
}

/**
 * Derives the submission status from `is_sent` only. `sent_at` (or any
 * timestamp) must never be passed here — it is stamped on drafts too and
 * is not evidence of submission.
 *
 * @param isSent  normalized `is_sent` (true = submitted). Null/undefined
 *   means no answer yet — treated as not sent.
 * @param dueAt   API deadline timestamp, or null when the task has none.
 * @param now     current time in ms (defaults to Date.now; injectable).
 */
export function deriveSubmissionStatus(
  isSent: boolean | null | undefined,
  dueAt: string | null | undefined,
  now: number = Date.now(),
): SubmissionStatus {
  if (isSent === true) return "submitted";
  if (typeof dueAt === "string" && dueAt.length > 0) {
    const due = Date.parse(dueAt);
    if (!Number.isNaN(due) && due < now) return "overdue";
  }
  return "draft";
}

/** Save-draft IPC contract (renderer → main → vendor API). */
export interface SaveDraftInput {
  taskId: string;
  answer: string;
  answerId?: string | null;
}

export interface SaveDraftResult {
  ok: boolean;
  status: number;
  created: boolean;
  answerId: string | null;
}
