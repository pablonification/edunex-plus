import { useState } from "react";
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
 * Submit lives in #26; no resubmit affordance (verified absent in #12).
 */
export function TaskPageShell({ task, onBack }: TaskPageShellProps) {
  const status = deriveSubmissionStatus(task.isSent, task.dueAt);
  const card = SUBMISSION_CARD[status];
  const [answer, setAnswer] = useState(task.answer ?? "");
  const [answerId, setAnswerId] = useState<string | null>(task.answerId ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveDraft() {
    if (saving) return;
    setSaving(true);
    setError(null);
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

          {status === "submitted" ? (
            <div className="p-5">
              <h3 className="text-[15px] font-semibold text-text-primary">Your answer</h3>
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
              <label
                htmlFor="task-answer-editor"
                className="text-[15px] font-semibold text-text-primary"
              >
                Your answer
              </label>
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
                  {error ?? (saved ? "Draft saved — only you can see it." : "Saving keeps a draft. Submit turns it in.")}
                </p>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => void handleSaveDraft()}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save draft"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
