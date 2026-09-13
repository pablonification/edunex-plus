import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { formatTimestamp, type TaskItem } from "../feeds/feed-data";

export interface TaskPageShellProps {
  task: TaskItem;
  onBack: () => void;
}

/**
 * The task destination for To Do clicks. Submission controls deliberately
 * land in issue #25; this shell gives that work a stable page to fill.
 */
export function TaskPageShell({ task, onBack }: TaskPageShellProps) {
  return (
    <section className="mx-auto max-w-3xl" aria-labelledby="task-page-title">
      <Button variant="ghost" size="small" onClick={onBack}>
        ← Back to To Do
      </Button>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip color="blue" variant="caption">Task</Chip>
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
        <div className="rounded-lg bg-background-primary-default p-5 shadow-sm">
          <h3 className="text-[15px] font-semibold text-text-primary">Answer</h3>
          <p className="mt-2 text-body-regular leading-5 text-text-secondary">
            Submission details will appear here in #25.
          </p>
        </div>
      </div>
    </section>
  );
}
