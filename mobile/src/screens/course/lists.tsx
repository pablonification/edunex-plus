// The course page's simple lists on the phone (round 2, v4; src/app/screens/course/lists.tsx). Tugas: the course's
// part of Tugas & Ujian by the same rules, what's still ahead in one white card, then Done's groups, each under its
// title in its own card (the rows are Tugas's own, each opening its page). Pengumuman: each announcement on a white
// card, who and when over its text, an online meeting's link as its one button and every other link opening in the
// browser.
import { Children, Fragment, type ReactNode, useState } from "react";
import { Text as RNText, View } from "react-native";
import { useOpenExternal, useOpenLink } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useTodo } from "../../../../src/app/schedule-data";
import { useSourceState } from "../../../../src/app/store";
import { meetingLinks } from "../../../../src/core/course-meetings";
import type { Exam } from "../../../../src/core/exams";
import { isOfficialUrl, isWebLink, linkHost } from "../../../../src/core/links";
import type { Announcement } from "../../../../src/core/models";
import { taskStatus } from "../../../../src/core/tasks";
import { todoCount, todoForCourse } from "../../../../src/core/todo";
import { useSignIn } from "../../shell/source-status";
import { BigButton } from "../../ui/big-button";
import { Icons } from "../../ui/icons";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { SectionTitle } from "../../ui/v4-list";
import { useCardStyle } from "../home/now";
import { PastExamRow } from "../tasks/exam-rows";
import { doneLines, type Line } from "../tasks/list";
import { PutOff, TaskRow, TodoRow } from "../tasks/rows";
import { FlatRows } from "./flat";

/** Rows flat on the page, a line between them. */
function Rows({ children, testID }: { children: ReactNode[]; testID?: string }) {
  const v = useTheme().v4;
  return (
    <FlatRows testID={testID} inset={space[4]}>
      {/* Children.map keys each wrapper by its row's own key. */}
      {Children.map(children, (child, i) => (
        <View style={i > 0 ? { borderTopWidth: 1, borderTopColor: v.line } : undefined}>{child}</View>
      ))}
    </FlatRows>
  );
}

/** A quiet line where a list has nothing. */
function Quiet({ children }: { children: string }) {
  const v = useTheme().v4;
  return (
    <Text size="bodyLarge" style={{ color: v.muted, marginLeft: space[1] }}>
      {children}
    </Text>
  );
}

/** No exam known. Signed out of SIX, only Edunex was asked: said so, with the way to SIX's exam timetable. */
function NoExams() {
  const t = useT();
  const v = useTheme().v4;
  const sixOut = useSourceState("six") === "signed-out";
  const { signIn, busy } = useSignIn();
  if (!sixOut)
    return (
      <Text size="bodyMedium" style={{ color: v.muted, marginTop: space[3], marginLeft: space[1] }}>
        {t("course.noExams")}
      </Text>
    );
  return (
    <View style={{ marginTop: space[3], gap: space[2] }}>
      <Text size="bodyMedium" style={{ color: v.muted, marginLeft: space[1] }}>
        {t("course.noExamsNoSix")}
      </Text>
      <BigButton variant="outline" onPress={busy ? undefined : () => void signIn("six")}>
        {t("action.signInTo", { source: "SIX" })}
      </BigButton>
    </View>
  );
}

/**
 * The course's part of Tugas & Ujian, by the same rules: what's still ahead in one list in order (its Tasks, its
 * exams' parts, its exam periods with no day yet), then Done's groups.
 */
export function TasksTab({ code, exams }: { code: string; exams: Exam[] }) {
  const t = useT();
  const now = useNow();
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
  // Done's groups: each title, then its rows in one card.
  const groups: { key: string; title: string; count?: number; rows: ReactNode[] }[] = [];
  for (const line of doneLines(done, todo.exams, t, "course") as Line[]) {
    if (line.type === "heading") groups.push({ key: line.key, title: line.title, count: line.count, rows: [] });
    else if (line.type === "done")
      groups.at(-1)?.rows.push(<TaskRow key={line.key} task={line.task} status={taskStatus(line.task, now)} meta="module" exam={line.exam} />);
    else if (line.type === "past") groups.at(-1)?.rows.push(<PastExamRow key={line.key} past={line.past} inCourse />);
  }
  const open = todoCount(items);
  return (
    <View testID="section.course.todo">
      <SectionTitle first>{open ? `${t("course.todo")} · ${open}` : t("course.todo")}</SectionTitle>
      {items.length ? (
        <Rows>
          {items.map((item) => (
            <TodoRow key={item.key} item={item} inCourse />
          ))}
        </Rows>
      ) : (
        <Quiet>{t("course.nothingTodo")}</Quiet>
      )}
      <PutOff putOff={putOff} open={putOffOpen} onToggle={() => setPutOffOpen(!putOffOpen)} />
      {/* With no exam anywhere, said under the list, never floating between the Task lists. */}
      {exams.length === 0 && <NoExams />}
      {groups
        .filter((group) => group.rows.length > 0)
        .map((group) => (
          <View key={group.key}>
            <SectionTitle>{group.count !== undefined ? `${group.title} · ${group.count}` : group.title}</SectionTitle>
            <Rows>{group.rows}</Rows>
          </View>
        ))}
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
  const v = useTheme().v4;
  const surface = useCardStyle();
  const open = useOpenExternal();
  if (!announcements?.length)
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginLeft: space[1] }}>
        <Icons.Megaphone size={18} color={v.muted} />
        <Quiet>{t("course.noAnnouncements")}</Quiet>
      </View>
    );
  return (
    <View style={{ gap: space[3] }}>
      {announcements.map((item) => {
        const [link] = meetingLinks(item.text).filter(isOfficialUrl);
        // Who and when, then (for the joint class's) where it came from: one line.
        const meta = [
          item.postedAt !== null ? f.dueLabel(item.postedAt) : "",
          item.courseId !== mainCourseId ? t("course.fromJointClass", { code }) : "",
        ].filter(Boolean);
        return (
          <View key={`${item.courseId}:${item.id}`} testID={`row.announcement.${item.courseId}-${item.id}`} style={[surface, { padding: space[4] }]}>
            {item.author && (
              <Text size="bodyLarge" weight="semibold" style={{ color: v.fg }}>
                {item.author}
              </Text>
            )}
            {meta.length > 0 && (
              <Text size="bodyMedium" tabular style={{ color: v.muted, marginTop: 2 }}>
                {meta.join(" · ")}
              </Text>
            )}
            <Text size="bodyLarge" selectable style={{ color: v.fg2, marginTop: space[3], lineHeight: 24 }}>
              <Linked text={item.text} />
            </Text>
            {link && (
              <View style={{ marginTop: space[4] }}>
                <BigButton icon={<Icons.Video size={20} color={v.onBrand} />} onPress={() => open(link)} testID="action.announcementJoin">
                  {t("material.joinMeeting")}
                </BigButton>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Plain text with its links made pressable: they open in the browser, as on Edunex (any web page: a lecturer's link). */
function Linked({ text }: { text: string }) {
  const t = useT();
  const v = useTheme().v4;
  const open = useOpenLink();
  const parts: ReactNode[] = text.split(/(https?:\/\/[^\s<>"]+)/g).map((part, index) =>
    index % 2 === 1 && isWebLink(part) ? (
      <RNText
        // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed text; a position is all they have
        key={index}
        accessibilityRole="link"
        accessibilityHint={t("link.opensIn", { host: linkHost(part) ?? part })}
        onPress={() => open(part)}
        style={{ color: v.brandInk, textDecorationLine: "underline" }}
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
