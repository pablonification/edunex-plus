// The course page's simple lists on the phone (src/app/screens/course/lists.tsx): its Tasks and
// exams (what's still ahead in one list, as Tugas & Ujian has it, then Done's groups; each opens its
// page) and its announcements, with an online-meeting link as a button and every other link opening
// in the browser.
import { Fragment, type ReactNode, useState } from "react";
import { Text as RNText, View } from "react-native";
import { useOpenExternal, useOpenLink } from "../../../../src/app/hooks";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useTodo } from "../../../../src/app/schedule-data";
import { useStatus } from "../../../../src/app/store";
import { meetingLinks } from "../../../../src/core/course-meetings";
import type { Exam } from "../../../../src/core/exams";
import { isOfficialUrl, isWebLink, linkHost } from "../../../../src/core/links";
import type { Announcement } from "../../../../src/core/models";
import { todoCount, todoForCourse } from "../../../../src/core/todo";
import { useSignIn } from "../../shell/source-status";
import { Button } from "../../ui/controls";
import { Card } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Section } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CardRow, doneLines, LineView } from "../tasks/list";
import { PutOff, TodoRow } from "../tasks/rows";

/** No exam known. Signed out of SIX, only Edunex was asked: said so, with the way to SIX's exam timetable. */
function NoExams() {
  const t = useT();
  const sixOut = useStatus("six").state === "signed-out";
  const { signIn, busy } = useSignIn();
  if (!sixOut)
    return (
      <Text size="body" tone="muted" style={{ marginTop: space[3] }}>
        {t("course.noExams")}
      </Text>
    );
  return (
    <View style={{ marginTop: space[3], gap: space[2], alignItems: "flex-start" }}>
      <Text size="body" tone="muted">
        {t("course.noExamsNoSix")}
      </Text>
      <Button size="sm" busy={busy} onPress={() => void signIn("six")}>
        {t("action.signInTo", { source: "SIX" })}
      </Button>
    </View>
  );
}

/**
 * The course's part of Tugas & Ujian, by the same rules: what's still ahead in one list in order
 * (its Tasks, its exams' parts, its exam periods with no day yet), then Done's groups.
 */
export function TasksTab({ code, exams }: { code: string; exams: Exam[] }) {
  const t = useT();
  const todo = useTodo();
  const [putOffOpen, setPutOffOpen] = useState(false);
  if (!todo) return null;
  const items = todoForCourse(todo.items, code);
  const putOff = todo.putOff.filter(({ item }) => item.course === code);
  const done = {
    handedIn: todo.done.handedIn.filter((task) => task.courseCode === code),
    pastExams: todo.done.pastExams.filter((past) => past.exam.courseCode === code),
    closed: todo.done.closed.filter((task) => task.courseCode === code),
    notHandingIn: todo.done.notHandingIn.filter((task) => task.courseCode === code),
  };
  const doneGroups = doneLines(done, todo.exams, t, "course");
  return (
    <View>
      <Section first title={t("course.todo")} count={todoCount(items)} testID="section.course.todo">
        {items.length ? (
          <View>
            {items.map((item, i) => (
              <CardRow key={item.key} first={i === 0} last={i === items.length - 1}>
                <TodoRow item={item} inCourse />
              </CardRow>
            ))}
          </View>
        ) : (
          <Text size="body" tone="muted">
            {t("course.nothingTodo")}
          </Text>
        )}
        <PutOff putOff={putOff} open={putOffOpen} onToggle={() => setPutOffOpen(!putOffOpen)} />
        {/* With no exam anywhere, said under the list, never floating between the Task lists. */}
        {exams.length === 0 && <NoExams />}
      </Section>
      {doneGroups.length > 0 && (
        <View style={{ marginTop: space[8] }}>
          {doneGroups.map((line) => (
            <LineView key={line.key} line={line} inCourse />
          ))}
        </View>
      )}
    </View>
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
  const theme = useTheme();
  const open = useOpenExternal();
  if (!announcements?.length)
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Icons.Megaphone size={16} color={theme.color.muted} />
        <Text size="body" tone="muted">
          {t("course.noAnnouncements")}
        </Text>
      </View>
    );
  return (
    <View style={{ gap: space[3] }}>
      {announcements.map((item) => {
        const [link] = meetingLinks(item.text).filter(isOfficialUrl);
        return (
          <Card
            key={`${item.courseId}:${item.id}`}
            testID={`row.announcement.${item.courseId}-${item.id}`}
            style={{ paddingHorizontal: space[4], paddingVertical: space[4] }}
          >
            <Text size="small" tone="muted">
              {item.author && (
                <Text size="small" weight="semibold">
                  {item.author}
                </Text>
              )}
              {item.author && item.postedAt !== null ? "  " : ""}
              {item.postedAt !== null ? f.dueLabel(item.postedAt) : ""}
            </Text>
            {item.courseId !== mainCourseId && (
              <Text size="small" tone="faint" style={{ marginTop: 2 }}>
                {t("course.fromJointClass", { code })}
              </Text>
            )}
            <Text size="body" selectable style={{ marginTop: space[2.5], lineHeight: 24 }}>
              <Linked text={item.text} />
            </Text>
            {link && (
              <View style={{ marginTop: space[3], flexDirection: "row" }}>
                <Button size="sm" variant="primary" icon={<Icons.Video size={14} color={theme.color.onAccent} />} onPress={() => open(link)}>
                  {t("material.joinMeeting")}
                </Button>
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}

/** Plain text with its links made pressable: they open in the browser, as on Edunex (any web page: a lecturer's link). */
function Linked({ text }: { text: string }) {
  const t = useT();
  const theme = useTheme();
  const open = useOpenLink();
  const parts: ReactNode[] = text.split(/(https?:\/\/[^\s<>"]+)/g).map((part, index) =>
    index % 2 === 1 && isWebLink(part) ? (
      <RNText
        // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed text; a position is all they have
        key={index}
        accessibilityRole="link"
        accessibilityHint={t("link.opensIn", { host: linkHost(part) ?? part })}
        onPress={() => open(part)}
        style={{ color: theme.color.accentFg, textDecorationLine: "underline" }}
      >
        {part}
      </RNText>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed text; a position is all they have
      <Fragment key={index}>{part}</Fragment>
    ),
  );
  return <>{parts}</>;
}
