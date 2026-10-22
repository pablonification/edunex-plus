// The course page's simple lists: its Tasks and exams (what's still ahead in
// one list, as Tugas & Ujian has it, then Done; each opens its page) and its
// announcements, with online-meeting links as a button and every other link
// opening in the browser.
import { Fragment, type ReactNode } from "react";
import { meetingLinks } from "../../../core/course-meetings";
import type { Exam } from "../../../core/exams";
import { isOfficialUrl, isWebLink } from "../../../core/links";
import type { Announcement } from "../../../core/models";
import { todoCount, todoForCourse } from "../../../core/todo";
import { useOpenExternal, useOpenLink } from "../../hooks";
import { useFormat, useT } from "../../i18n";
import { useTodo } from "../../schedule-data";
import { useSignIn } from "../../shell/source-status";
import { useStatus } from "../../store";
import { Button } from "../../ui/controls";
import { Card } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Section } from "../../ui/layout";
import { PresenceList } from "../../ui/motion/presence-list";
import { WebLink } from "../../ui/rich-text";
import { DoneGroups, TodoRow } from "../tasks";

/** No exam known. Signed out of SIX, only Edunex was asked: said so, with the way to SIX's exam timetable. */
function NoExams() {
  const t = useT();
  const sixOut = useStatus("six").state === "signed-out";
  const { signIn, busy } = useSignIn();
  if (!sixOut) return <p className="mt-3 text-body text-muted">{t("course.noExams")}</p>;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-body text-muted">{t("course.noExamsNoSix")}</p>
      <Button size="sm" busy={busy} onClick={() => void signIn("six")}>
        {t("action.signInTo", { source: "SIX" })}
      </Button>
    </div>
  );
}

/**
 * The course's part of Tugas & Ujian, by the same rules: what's still ahead
 * in one list in order (its Tasks, its exams' parts, its exam periods with no
 * day yet), then Done's groups.
 */
export function TasksTab({ code, exams }: { code: string; exams: Exam[] }) {
  const t = useT();
  const todo = useTodo();
  if (!todo) return null;
  const items = todoForCourse(todo.items, code);
  const done = {
    handedIn: todo.done.handedIn.filter((task) => task.courseCode === code),
    pastExams: todo.done.pastExams.filter((past) => past.exam.courseCode === code),
    closed: todo.done.closed.filter((task) => task.courseCode === code),
  };
  return (
    <div>
      <Section id="course-todo" title={t("course.todo")} count={todoCount(items)}>
        {items.length ? (
          <List label={t("course.todo")}>
            <PresenceList>
              {items.map((item) => (
                <TodoRow key={item.key} item={item} inCourse />
              ))}
            </PresenceList>
          </List>
        ) : (
          <p className="text-body text-muted">{t("course.nothingTodo")}</p>
        )}
        {/* With no exam anywhere, said under the list, never floating between the Task lists. */}
        {exams.length === 0 && <NoExams />}
      </Section>
      <DoneGroups done={done} exams={todo.exams} inCourse />
    </div>
  );
}

export function AnnouncementsTab({
  announcements,
  mainCourseId,
  code,
}: {
  announcements: Announcement[] | undefined;
  mainCourseId: number | null;
  code: string;
}) {
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
        const [link] = meetingLinks(item.text).filter(isOfficialUrl);
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
              <p className="mt-2.5 max-w-prose text-body leading-relaxed break-words whitespace-pre-line">
                <Linked text={item.text} />
              </p>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

/** Plain text with its links made clickable: they open in the browser, as on Edunex. */
function Linked({ text }: { text: string }) {
  const open = useOpenLink();
  const parts: ReactNode[] = text.split(/(https?:\/\/[^\s<>"]+)/g).map((part, index) =>
    index % 2 === 1 && isWebLink(part) ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed text; a position is all they have
      <WebLink key={index} href={part} onOpen={open} className="break-all">
        {part}
      </WebLink>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed text; a position is all they have
      <Fragment key={index}>{part}</Fragment>
    ),
  );
  return <>{parts}</>;
}
