// The course page's simple lists: its Tasks (to do, then handed in; each
// opens the Task page), its exams (each opens the exam page) and its
// announcements, with online-meeting links as a button.
import { Fragment, type ReactNode } from "react";
import { opensInBrowser } from "../../../core/course-materials";
import { meetingLinks } from "../../../core/course-meetings";
import type { Exam } from "../../../core/exams";
import type { Announcement, Task } from "../../../core/models";
import { byDeadline, isOpenStatus, submittedAt, taskStatus } from "../../../core/tasks";
import { useOpenExternal } from "../../hooks";
import { useFormat, useNow, useT } from "../../i18n";
import { useSignIn } from "../../shell/source-status";
import { useStatus } from "../../store";
import { Button } from "../../ui/controls";
import { Card } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Section } from "../../ui/layout";
import { ExamRows } from "../exam";
import { TaskRows } from "../tasks";

/** No exam known. Signed out of SIX, only Edunex was asked: said so, with the way to SIX's exam timetable. */
function NoExams() {
  const t = useT();
  const sixOut = useStatus("six").state === "signed-out";
  const { signIn, busy } = useSignIn();
  if (!sixOut) return <p className="text-body text-muted">{t("course.noExams")}</p>;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-body text-muted">{t("course.noExamsNoSix")}</p>
      <Button size="sm" busy={busy} onClick={() => void signIn("six")}>
        {t("action.signInTo", { source: "SIX" })}
      </Button>
    </div>
  );
}

export function TasksTab({ tasks, exams }: { tasks: Task[]; exams: Exam[] }) {
  const t = useT();
  const now = useNow();
  const todo = tasks.filter((task) => isOpenStatus(taskStatus(task, now))).sort(byDeadline);
  const done = tasks.filter((task) => !isOpenStatus(taskStatus(task, now))).sort((a, b) => (submittedAt(b) ?? b.dueAt ?? 0) - (submittedAt(a) ?? a.dueAt ?? 0));
  return (
    <div>
      <Section id="course-todo" title={t("course.todo")} count={todo.length}>
        {todo.length ? <TaskRows tasks={todo} meta="module" label={t("course.todo")} /> : <p className="text-body text-muted">{t("course.nothingTodo")}</p>}
      </Section>
      {/* Always under its own heading, so "no exam yet" never floats between the Task lists. */}
      <Section id="course-exams" title={t("course.exams")} count={exams.length || undefined}>
        {exams.length > 0 ? <ExamRows exams={exams} /> : <NoExams />}
      </Section>
      {done.length > 0 && (
        <Section id="course-done" title={t("course.handedIn")} count={done.length}>
          <TaskRows tasks={done} meta="module" label={t("course.handedIn")} />
        </Section>
      )}
    </div>
  );
}

export function AnnouncementsTab({ announcements, mainCourseId, code }: { announcements: Announcement[] | undefined; mainCourseId: number | null; code: string }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  if (!announcements?.length)
    return (
      <p className="flex items-center gap-2 text-body text-muted">
        <Icons.Megaphone className="size-4" />
        {t("course.noAnnouncements")}
      </p>
    );
  return (
    <ul className="max-w-[760px] space-y-3">
      {announcements.map((item) => {
        const [link] = meetingLinks(item.text).filter(opensInBrowser);
        return (
          <li key={`${item.courseId}:${item.id}`}>
            <Card className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <p className="min-w-0 text-small text-muted">
                  {item.author && <span className="font-semibold text-fg">{item.author}</span>}
                  {item.postedAt !== null && <span className="ml-2">{f.dueLabel(item.postedAt)}</span>}
                  {item.courseId !== mainCourseId && <span className="mt-0.5 block text-faint">{t("course.fromJointClass", { code })}</span>}
                </p>
                {link && (
                  <Button size="sm" variant="primary" icon={<Icons.Video className="size-3.5" />} onClick={() => open(link)}>
                    {t("material.joinMeeting")}
                  </Button>
                )}
              </div>
              <p className="mt-2.5 text-body leading-relaxed break-words whitespace-pre-line">
                <Linked text={item.text} />
              </p>
            </Card>
          </li>
        );
      })}
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
