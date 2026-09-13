import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { StatusDot } from "@/components/ui/status-dot";
import { formatTimestamp, type TaskItem } from "../feeds/feed-data";
import {
  SUBMISSION_CARD,
  SUBMISSION_CHIP_COLOR,
  SUBMISSION_CHIP_LABEL,
  deriveSubmissionStatus,
  type SubmissionStatus,
} from "@shared/submission";

export interface TaskPageShellProps {
  task: TaskItem;
  onBack: () => void;
}

const SUBMISSION_BODY: Record<SubmissionStatus, string> = {
  draft: "A saved draft is only visible to you — it does not count as turned in.",
  submitted: "The lecturer sees this answer. Submission is final — editing is not offered.",
  overdue: "Past the deadline and not submitted. Save a draft now to keep your work.",
};

/**
 * Task destination for To Do clicks (issue #25, pain 3a): status-first
 * answer page. The status card leads with a colored edge, status word, and
 * StatusDot — derived from `is_sent` only — and Save-draft is a visually
 * quiet secondary action wired to the verified create/update contract.
 * Submit is available only after an answer has been saved; no resubmit
 * affordance is offered (verified absent in #12).
 */
export function TaskPageShell({ task, onBack }: TaskPageShellProps) {
  const status = deriveSubmissionStatus(task.isSent, task.dueAt);
  const card = SUBMISSION_CARD[status];
  const [answer, setAnswer] = useState(task.answer ?? "");
  const [answerId, setAnswerId] = useState<string | null>(task.answerId ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [submissionReceipt, setSubmissionReceipt] = useState(false);

  useEffect(() => {
    // A sync snapshot is authoritative, including an unexpected server-side
    // rejection/reversion of a just-submitted answer.
    setSubmissionReceipt(false);
  }, [task.id, task.isSent]);

  async function handleSaveDraft() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSubmitError(null);
    setSaved(false);
    try {
      const result = await window.edunex.saveDraft({
        taskId: task.id,
        answer,
        answerId,
      });
      if (result.ok) {
        if (result.answerId) setAnswerId(result.answerId);
        setSaved(true);
      } else if (result.status === 401) {
        setError("Your session expired — sign in again, then retry saving.");
      } else {
        setError("Couldn't save the draft. Check your connection and try again.");
      }
    } catch {
      setError("Couldn't save the draft. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (submitting || !answerId || status === "submitted") return;
    setSubmitting(true);
    setSubmitError(null);
    setError(null);
    setSaved(false);
    try {
      const result = await window.edunex.submitAnswer({ answerId });
      if (result.ok) {
        // The receipt acknowledges the explicit write. The status card stays
        // derived from task.isSent until the next sync confirms the server.
        setSubmissionReceipt(true);
      } else if (result.status === 401) {
        setSubmitError("Your session expired — sign in again, then retry submitting.");
      } else {
        setSubmitError("Couldn't submit the answer. Check your connection and try again.");
      }
    } catch {
      setSubmitError("Couldn't submit the answer. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl" aria-labelledby="task-page-title">
      <Button variant="ghost" size="small" onClick={onBack}>
        ← Back to To Do
      </Button>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip color="blue" variant="caption">Task</Chip>
            <Chip color={SUBMISSION_CHIP_COLOR[status]} variant="caption">
              {SUBMISSION_CHIP_LABEL[status]}
            </Chip>
            {task.courseCode && (
              <span className="text-caption-1-semibold text-text-tertiary">{task.courseCode}</span>
            )}
          </div>
          <h2 id="task-page-title" className="mt-2 text-[24px] font-semibold tracking-tight text-text-primary">
            {task.title}
          </h2>
          {task.courseName && <p className="mt-1 text-body-regular text-text-secondary">{task.courseName}</p>}
        </div>

        <div className="shrink-0 rounded-lg bg-background-secondary-default px-3 py-2 text-right">
          <p className="text-caption-1-semibold uppercase tracking-[0.08em] text-text-tertiary">Due</p>
          <time
            className="mt-1 block text-body-medium text-text-primary"
            dateTime={task.dueAt ?? undefined}
          >
            {task.dueAt ? formatTimestamp(task.dueAt) : "No deadline"}
          </time>
        </div>
      </div>

      <div className="mt-7 rounded-xl bg-background-secondary-default/80 p-2">
        <div className="overflow-hidden rounded-lg bg-background-primary-default shadow-sm">
          <div className={`flex items-center gap-3 border-l-4 ${card.edgeClass} ${card.panelClass} px-5 py-4`}>
            <StatusDot color={card.dot} />
            <div className="min-w-0 flex-1">
              <p className={`text-[15px] font-bold tracking-tight ${card.titleClass}`}>
                {card.word}
              </p>
              <p className={`mt-0.5 text-[13px] ${card.bodyClass}`}>
                {SUBMISSION_BODY[status]}
              </p>
            </div>
          </div>

          {status === "submitted" || submissionReceipt ? (
            <div className="p-5">
              <div
                className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3.5"
                role="status"
                aria-live="polite"
              >
                <StatusDot color="green" />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-green-900">Submission receipt</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-green-800/80">
                    {status === "submitted"
                      ? "Your answer was submitted successfully. The lecturer can see it now."
                      : "Your answer was sent. The next sync will confirm the submitted status."}
                  </p>
                  {answerId && (
                    <p className="mt-1 text-[12px] text-green-800/70">Answer ID {answerId}</p>
                  )}
                </div>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold text-text-primary">Your answer</h3>
              {answer ? (
                <p className="mt-2 whitespace-pre-wrap text-body-regular leading-5 text-text-secondary">
                  {answer}
                </p>
              ) : (
                <p className="mt-2 text-body-regular leading-5 text-text-tertiary">
                  No answer text in the latest snapshot.
                </p>
              )}
            </div>
          ) : (
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="task-answer-editor"
                  className="text-[15px] font-semibold text-text-primary"
                >
                  Your answer
                </label>
                <button
                  type="button"
                  className="rounded-sm px-1 text-[13px] font-medium text-accent-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                  aria-expanded={explainerOpen}
                  aria-controls="submission-difference-explainer"
                  onClick={() => setExplainerOpen((open) => !open)}
                >
                  What's the difference?
                </button>
              </div>
              {explainerOpen && (
                <div
                  id="submission-difference-explainer"
                  className="mt-3 grid gap-3 rounded-lg bg-background-secondary-default p-3.5 text-[13px]"
                  role="region"
                  aria-label="Difference between saving and submitting"
                >
                  <div className="flex items-start gap-2.5">
                    <StatusDot color="yellow" />
                    <div>
                      <p className="font-semibold text-text-primary">Saved draft</p>
                      <p className="mt-0.5 leading-5 text-text-secondary">
                        Only you can see a saved draft. It does not count as turned in.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <StatusDot color="green" />
                    <div>
                      <p className="font-semibold text-text-primary">Submitted</p>
                      <p className="mt-0.5 leading-5 text-text-secondary">
                        Your lecturer can see it, and the answer is final.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <textarea
                id="task-answer-editor"
                rows={5}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Write your answer here. Saving keeps it as a draft — only Submit turns it in."
                className="mt-3 w-full resize-y rounded-lg border border-border-button-default bg-background-primary-default px-3.5 py-3 text-[14px] leading-relaxed text-text-primary outline-none placeholder:text-text-tertiary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-text-tertiary" aria-live="polite">
                  {submitError ?? error ?? (
                    saved
                      ? "Draft saved — only you can see it."
                      : answerId
                        ? "Saving keeps a draft. Submit turns it in."
                        : "Save a draft to unlock final submission."
                  )}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => void handleSaveDraft()}
                    disabled={saving || submitting}
                  >
                    {saving ? "Saving…" : "Save draft"}
                  </Button>
                  {answerId && !submissionReceipt && (
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => void handleSubmit()}
                      disabled={saving || submitting}
                    >
                      {submitting ? "Submitting…" : "Submit answer"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
