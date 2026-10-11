// The course page's simple lists: its Tasks (each opens the Task page), its
// EduNex exams and its announcements.
import { Fragment, type ReactNode } from "react";
import { opensInBrowser } from "../../../core/course-materials";
import type { Announcement, EdunexExam, Task } from "../../../core/models";
import { useOpenExternal } from "../../hooks";
import { useFormat, useNow, useT } from "../../i18n";
import { useNav } from "../../nav";
import { cx } from "../../ui/cx";
import { Card, EmptyState, SectionTitle, StatusChip } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { isOpenTask } from "./data";

export function TaskRows({ tasks }: { tasks: Task[] }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  if (!tasks.length) return <EmptyState icon={<Icons.ListChecks className="size-5" />} title={t("course.noTasks")} />;
  // Open Tasks first, by deadline.
  const sorted = [...tasks].sort(
    (a, b) => Number(!isOpenTask(a, now)) - Number(!isOpenTask(b, now)) || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity),
  );
  return (
    <Card className="overflow-hidden">
      <ul>
        {sorted.map((task, index) => (
          <li key={task.id} className={cx(index > 0 && "border-t border-line")}>
            <button
              type="button"
              onClick={() => go({ screen: "task", taskId: task.id })}
              className="focus-ring grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-hover"
            >
              <span className="truncate text-body font-medium">{task.title}</span>
              <StatusChip status={task.status} />
              <span className="w-[130px] text-right text-small whitespace-nowrap tabular-nums">
                {task.dueAt !== null && (
                  <>
                    <span className="block font-medium">{f.dueLabel(task.dueAt)}</span>
                    <span className="block text-faint">{f.fromNow(task.dueAt)}</span>
                  </>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TasksTab({ tasks, exams }: { tasks: Task[]; exams: EdunexExam[] | undefined }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="space-y-9">
      <section>
        <SectionTitle count={tasks.length}>{t("course.tasks")}</SectionTitle>
        <TaskRows tasks={tasks} />
      </section>
      <section>
        <SectionTitle count={exams?.length}>{t("course.exams")}</SectionTitle>
        {!exams?.length ? (
          <EmptyState icon={<Icons.ClipboardCheck className="size-5" />} title={t("course.noExams")} />
        ) : (
          <Card className="overflow-hidden">
            <ul>
              {exams.map((exam, index) => (
                <li key={exam.id} className={cx("flex items-center justify-between gap-4 px-4 py-3", index > 0 && "border-t border-line")}>
                  <span className="truncate text-body font-medium">{exam.title ?? t("course.examUntitled")}</span>
                  {exam.start !== null && (
                    <span className="text-small whitespace-nowrap text-muted tabular-nums">
                      {f.dueLabel(exam.start)}
                      {exam.end !== null && `–${f.time(exam.end)}`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

export function AnnouncementsTab({ announcements, mainCourseId }: { announcements: Announcement[] | undefined; mainCourseId: number | null }) {
  const t = useT();
  const f = useFormat();
  if (!announcements?.length) return <EmptyState icon={<Icons.Megaphone className="size-5" />} title={t("course.noAnnouncements")} />;
  return (
    <ul className="space-y-3">
      {announcements.map((item) => (
        <li key={`${item.courseId}:${item.id}`}>
          <Card className="px-4 py-3.5">
            <p className="flex flex-wrap items-center gap-x-2 text-small text-muted">
              {item.author && <span className="font-semibold text-fg">{item.author}</span>}
              {item.postedAt !== null && <span>{f.dueLabel(item.postedAt)}</span>}
              {item.courseId !== mainCourseId && <span className="text-faint">· {t("course.parentClass")}</span>}
            </p>
            <p className="mt-2 text-body leading-relaxed break-words whitespace-pre-line">
              <Linked text={item.text} />
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** Plain text with its official links (online classes, ITB pages) made clickable. */
function Linked({ text }: { text: string }) {
  const open = useOpenExternal();
  const parts: ReactNode[] = text.split(/(https:\/\/[^\s<>"]+)/g).map((part, index) =>
    index % 2 === 1 && opensInBrowser(part) ? (
      <a
        key={index}
        href={part}
        onClick={(event) => {
          event.preventDefault();
          open(part);
        }}
        className="focus-ring rounded-sm break-all text-accent-fg underline decoration-accent-fg/40 underline-offset-2 hover:decoration-accent-fg"
      >
        {part}
      </a>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
  return <>{parts}</>;
}
