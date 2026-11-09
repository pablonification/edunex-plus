// The rows of Tugas & Ujian on the phone: src/app/screens/tasks.tsx's TaskRow, TodoRow, PutOff and
// their date column, the same facts read the phone's way (round 2). A row shows what the Student
// decides on (the title, the course, the day and time it's due); the rest of the desktop's facts
// stay in its accessible name and on the Task's page. A late Task's "Ingatkan nanti" is an alarm on
// the row, a swipe, and its long press. What rows share is in row-parts.tsx.
import { useState } from "react";
import { View } from "react-native";
import { errorKey } from "../../../../src/app/bridge";
import { type Format, type Translate, useFormat, useT } from "../../../../src/app/i18n";
import type { Todo } from "../../../../src/app/schedule-data";
import { useSnoozes } from "../../../../src/app/snoozes";
import { attendanceWindow } from "../../../../src/core/attendance";
import { taskPutAway } from "../../../../src/core/done";
import type { Exam } from "../../../../src/core/exams";
import type { DoneHow, Task, TaskStatus } from "../../../../src/core/models";
import { editView } from "../../../../src/core/task-edits";
import { isOpenStatus, notOpenYet, shortWindow, submittedAt } from "../../../../src/core/tasks";
import { lateSnoozable, type TodoItem } from "../../../../src/core/todo";
import { useNav } from "../../nav";
import { canSnooze, useRowActions, useSnooze } from "../../parts/snooze";
import { CardSlice } from "../../ui/card-list";
import { Button } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { factsLabel, GroupTile, Meta, Row } from "../../ui/layout";
import { SwipeRow } from "../../ui/swipe";
import { Text, type TextTone } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { shortName } from "../home/parts";
import { ExamPartRow, PeriodRow } from "./exam-rows";
import {
  countdown,
  type DueWhen,
  dueWhen,
  formatScore,
  HeroCard,
  inWorld,
  moduleLabel,
  type Quick,
  RowNote,
  type RowWorldValue,
  rowWhen,
  type SignalIcon,
  StatusPill,
  TaskLine,
  useRowWorld,
} from "./row-parts";

export { CourseCodeMark, DateColumn, ExamTitle, formatScore, moduleLabel, useDueWhen } from "./row-parts";

type MarkedHow = Extract<DoneHow, "handedElsewhere" | "notHandingIn" | "groupDone">;

/** "Jum, 16 Okt / 23:59"; "Dikumpulkan 24 Sep" once handed in, with its score over it once graded. */
function taskDate(t: Translate, f: Format, now: number, task: Task, status: TaskStatus): DueWhen {
  const sentAt = submittedAt(task);
  if (sentAt !== null) {
    const sent = t("task.submittedOnDate", { date: f.dayMonth(sentAt) });
    return task.score !== null
      ? { main: t("task.scoreValue", { score: formatScore(task.score, f) }), sub: sent, tone: "fg", late: false, rel: null }
      : { main: sent, sub: null, late: false, rel: null };
  }
  if (task.dueAt === null) return { main: t("task.noDeadline"), sub: null, tone: "muted", late: false, rel: null };
  const late = status === "overdue" || status === "closed";
  return dueWhen(f, now, task.dueAt, late, status === "closed" ? t("task.notHandedIn") : undefined);
}

/**
 * At most one thing Edunex's list doesn't say, the one that changes what to do (the desktop's
 * Signal): marked on its page, changed after the Student handed in, attendance taken by handing
 * in, not open yet, a short window.
 */
function signalOf(t: Translate, world: RowWorldValue, task: Task, status: TaskStatus): { icon: SignalIcon; facts: string[]; tone: TextTone } | null {
  const { f, now } = world;
  const edit = editView(task, world.edits, world.handled);
  const window = isOpenStatus(status) ? attendanceWindow(task, world.presence, now) : null;
  const marked = isOpenStatus(status) ? taskPutAway(task, world.handled) : undefined;
  if (marked) return { icon: "check", facts: [t(`task.marked.${marked.how as MarkedHow}`)], tone: "muted" };
  if (edit?.afterSubmit && task.editedAt !== null && !edit.checked && edit.state !== "none")
    return { icon: "pen", facts: [t("task.editedAfterSubmitLine", { date: f.dayMonth(task.editedAt) })], tone: "warning" };
  if (window)
    return {
      icon: "hand",
      facts: [
        t("task.attendanceLine", {
          when: f.dayTimeRange(window.opensAt, window.closesAt),
        }),
      ],
      tone: "muted",
    };
  if (task.opensAt !== null && notOpenYet(task, now)) return { icon: null, facts: [t("task.opens", { when: f.dayTimeWord(task.opensAt) })], tone: "muted" };
  if (shortWindow(task) !== null && task.opensAt !== null && task.dueAt !== null)
    return { icon: "zap", facts: [t("task.shortWindow"), f.timeRange(task.opensAt, task.dueAt)], tone: "muted" };
  return null;
}

// ------------------------------------------------------------ rows

/**
 * A Task as a row, opening its page. Under "Terlambat" the heading says it's late, and the row
 * says it's still taken. A take-home in Done keeps its exam's look.
 */
export const TaskRow = inWorld(function TaskRow({
  task,
  status,
  meta = "course",
  late = false,
  exam,
  quick,
  onLongPress,
  hero = false,
}: {
  task: Task;
  status: TaskStatus;
  meta?: "course" | "module" | "none";
  late?: boolean;
  exam?: Exam;
  quick?: Quick;
  onLongPress?: () => void;
  /** Tugas's one big card: the nearest deadline (row-parts.tsx HeroCard), the same item, target and name. */
  hero?: boolean;
}) {
  const t = useT();
  const { go } = useNav();
  const world = useRowWorld();
  const course = world.courses?.find((c) => c.code === task.courseCode);
  const module = moduleLabel(t, task.module);
  const date = taskDate(t, world.f, world.now, task, status);
  const signal = signalOf(t, world, task, status);
  const where = module ?? course?.name ?? null;
  const facts = exam
    ? [meta === "course" ? task.courseCode : "", t("exam.takeHome"), task.title]
    : meta === "course"
      ? [task.courseCode, where ?? ""]
      : meta === "module" && module
        ? [module]
        : [];
  const title = task.title;
  const label = factsLabel(
    title,
    ...facts,
    late ? t("home.need.task.overdue") : null,
    ...(signal?.facts ?? []),
    t(`taskStatus.${status}`),
    date.main,
    date.sub,
    date.rel,
  );
  // v4: one meta line that fits in full (the module on a course's page, the kind of a take-home, and when), one status
  // (the countdown once it's within a day or late, the score, or "not handed in"); a calm one's day and time say when on
  // their own. Everything else is in the row's spoken name and on the Task's page.
  const sentAt = submittedAt(task);
  const kind = exam ? t(`exam.kind.${exam.kind}`) : null;
  const away = task.dueAt !== null && sentAt === null && status !== "closed" ? countdown(t, world.now, task.dueAt) : null;
  const when =
    sentAt !== null
      ? t("task.submittedOnDate", { date: world.f.dayMonth(sentAt) })
      : task.dueAt === null
        ? t("task.noDeadline")
        : // The time only beside the countdown: a late or closed one's status is too wide for both.
          rowWhen(world.f, task.dueAt, away !== null && !away.late);
  // On a course's page the module, the exam's kind for a take-home, then when: every row the same. Not the course's code
  // on Tugas: the row's tile is the course, named by the course chips over the list (the code is spoken).
  const lead = meta === "module" && task.module ? t("task.module", { n: task.module.index }) : null;
  const line = [lead, kind, when].filter(Boolean).join(" · ");
  const statusPill =
    sentAt !== null ? (
      task.score !== null ? (
        <StatusPill tone="ok" text={t("task.scoreValue", { score: formatScore(task.score, world.f) })} />
      ) : null
    ) : status === "closed" ? (
      <StatusPill tone="red" text={t("task.notHandedIn")} />
    ) : away && away.tone !== "neutral" ? (
      <StatusPill tone={away.tone} text={away.text} />
    ) : null;
  // The row's title is the Task's own name, a take-home's too: a row never switches to its course's name.
  const name = task.title;
  const open = () => go({ screen: "task", taskId: task.id });
  if (hero && task.dueAt !== null)
    return (
      <HeroCard
        testID={`row.task.${task.id}`}
        label={label}
        onPress={open}
        onLongPress={onLongPress}
        quick={quick}
        code={task.courseCode}
        at={task.dueAt}
        title={name}
        // The course by a name a student says, short ("Proposal Tugas Akhir"): the big card has no tile to name it.
        meta={[course ? shortName(course.name) : task.courseCode, kind, when].filter(Boolean).join(" · ")}
      />
    );
  return (
    <TaskLine
      testID={`row.task.${task.id}`}
      label={label}
      onPress={open}
      onLongPress={onLongPress}
      quick={quick}
      code={meta === "course" ? task.courseCode : null}
      course={course?.name}
      title={name}
      meta={line}
      status={statusPill}
    />
  );
});

/** The Task a late row is about, for its name: a Task, or an exam's take-home. */
export const lateTitle = (item: TodoItem) =>
  item.kind === "task" ? item.task.title : item.kind === "exam" && item.part?.kind === "takehome" ? item.part.task.title : "";

/**
 * A row of the one list, whatever it is: a Task, an exam's part, an exam period. A late one can be
 * put off ("Ingatkan nanti") as on Beranda, the same snooze for the same Task: the alarm, a swipe
 * or a long press.
 */
export const TodoRow = inWorld(function TodoRow({ item, inCourse = false, hero = false }: { item: TodoItem; inCourse?: boolean; hero?: boolean }) {
  const t = useT();
  const { now } = useRowWorld();
  const v = useTheme().v4;
  const late = lateSnoozable(item, now);
  const snoozable = late && canSnooze(late, now) ? late : null;
  const snooze = useSnooze(snoozable);
  const swipe = useRowActions({ snooze: snoozable ? snooze : null });
  if (item.kind === "period") return <PeriodRow item={item} inCourse={inCourse} />;
  const quick = snoozable ? [{ label: t("snooze.actionFor", { title: lateTitle(item) }), onPress: snooze.open }] : undefined;
  const longPress = snoozable ? snooze.open : undefined;
  return (
    <>
      {/* The big card isn't swiped: its long press and TalkBack's actions put it off. */}
      <SwipeRow actions={hero ? [] : swipe} surface={inCourse ? undefined : v.card}>
        {item.kind === "task" ? (
          <TaskRow
            task={item.task}
            status={item.status}
            meta={inCourse ? "module" : "course"}
            late={item.late}
            quick={quick}
            onLongPress={longPress}
            hero={hero}
          />
        ) : (
          <ExamPartRow item={item} inCourse={inCourse} quick={quick} onLongPress={longPress} />
        )}
      </SwipeRow>
      {snooze.sheet}
    </>
  );
});

/** "1 ditunda · Tampilkan" under the late rows, as on Beranda: quiet, opening what's put off, each with Ingatkan sekarang. */
export function PutOff({ putOff, open, onToggle, inCourse = true }: { putOff: Todo["putOff"]; open: boolean; onToggle: () => void; inCourse?: boolean }) {
  const t = useT();
  const theme = useTheme();
  if (!putOff.length) return null;
  return (
    <View style={{ marginTop: space[2], gap: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingLeft: space[4] }}>
        <Icons.Snooze size={16} color={theme.color.onSurfaceVariant} />
        <Text size="bodyMedium" tone="muted" style={{ flex: 1 }}>
          {t("snooze.count", { count: putOff.length })}
        </Text>
        <Button size="sm" variant="ghost" onPress={onToggle} testID="action.putOff">
          {open ? t("snooze.hideList") : t("snooze.showList")}
        </Button>
      </View>
      {open && (
        <View>
          {putOff.map(({ item, entry }, i) =>
            inCourse ? (
              <GroupTile key={item.key} first={i === 0} last={i === putOff.length - 1}>
                <PutOffRow item={item} entry={entry} />
              </GroupTile>
            ) : (
              <CardSlice key={item.key} first={i === 0} last={i === putOff.length - 1} inset={0}>
                <PutOffRow item={item} entry={entry} />
              </CardSlice>
            ),
          )}
        </View>
      )}
    </View>
  );
}

/** A late Task put off: what it is, when it's back, and the way to bring it back now. */
function PutOffRow({ item, entry }: Todo["putOff"][number]) {
  const t = useT();
  const f = useFormat();
  const { wake } = useSnoozes();
  const [failed, setFailed] = useState<string | null>(null);
  const title = lateTitle(item);
  const when = f.dayTimeWord(entry.until);
  return (
    <Row
      wrapTrailing
      testID={`row.putOff.${item.key}`}
      title={title}
      meta={
        <Meta>
          {item.course ?? ""}
          {entry.reason === "change" ? t("snooze.untilChange", { when }) : t("snooze.until", { when })}
        </Meta>
      }
      trailing={
        <Button
          size="sm"
          variant="ghost"
          label={t("snooze.wakeFor", { title })}
          onPress={() => {
            setFailed(null);
            void wake(entry.id).catch((error: unknown) => setFailed(t(errorKey(error))));
          }}
        >
          {t("snooze.wake")}
        </Button>
      }
    >
      {failed && (
        <RowNote tone="danger" icon="alert">
          {failed}
        </RowNote>
      )}
    </Row>
  );
}
