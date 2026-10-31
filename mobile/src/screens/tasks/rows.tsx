// The rows of Tugas & Ujian on the phone: src/app/screens/tasks.tsx's TaskRow, TodoRow, PutOff and
// their date column, the same facts read the phone's way (round 2). A row shows what the Student
// decides on (the title, the course, the day and time it's due); the rest of the desktop's facts
// stay in its accessible name and on the Task's page. A late Task's "Ingatkan nanti" is an alarm on
// the row, a swipe, and its long press. What rows share is in row-parts.tsx.
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import { errorKey } from "../../../../src/app/bridge";
import { type Format, type Translate, useFormat, useT } from "../../../../src/app/i18n";
import type { Todo } from "../../../../src/app/schedule-data";
import { useSnoozes } from "../../../../src/app/snoozes";
import { attendanceWindow, presenceOptional } from "../../../../src/core/attendance";
import { taskPutAway } from "../../../../src/core/done";
import type { Exam } from "../../../../src/core/exams";
import type { DoneHow, Task, TaskStatus } from "../../../../src/core/models";
import { editView } from "../../../../src/core/task-edits";
import { isOpenStatus, notOpenYet, shortWindow, submittedAt } from "../../../../src/core/tasks";
import { lateSnoozable, type TodoItem } from "../../../../src/core/todo";
import { useNav } from "../../nav";
import { canSnooze, useRowActions, useSnooze } from "../../parts/snooze";
import { Button, IconButton } from "../../ui/controls";
import { StatusChip } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, GroupTile, Meta, Row } from "../../ui/layout";
import { SwipeRow } from "../../ui/swipe";
import { Text, type TextTone } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { ExamPartRow, PeriodRow } from "./exam-rows";
import {
  DateColumn,
  type DueWhen,
  dueWhen,
  ExamTitle,
  formatScore,
  inWorld,
  moduleLabel,
  RowMeta,
  RowNote,
  type RowWorldValue,
  type SignalIcon,
  useRowWorld,
} from "./row-parts";

export { CourseCodeMark, DateColumn, ExamTitle, formatScore, moduleLabel, useDueWhen } from "./row-parts";

/** Statuses worth a chip in a list: the rest are said by the segment, the group and the date. */
const LOUD: readonly TaskStatus[] = ["draft", "in_review"];

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
  const optional = presenceOptional(world.countedIn(task.courseCode));
  const window = isOpenStatus(status) ? attendanceWindow(task, world.presence, now) : null;
  const marked = isOpenStatus(status) ? taskPutAway(task, world.handled) : undefined;
  if (marked) return { icon: "check", facts: [t(`task.marked.${marked.how as MarkedHow}`)], tone: "muted" };
  if (edit?.afterSubmit && task.editedAt !== null && !edit.checked && edit.state !== "none")
    return { icon: "pen", facts: [t("task.editedAfterSubmitLine", { date: f.dayMonth(task.editedAt) })], tone: "warning" };
  if (window)
    return {
      icon: "hand",
      facts: [
        t(optional ? "task.attendanceLineOptional" : "task.attendanceLine", {
          when: `${f.relativeDay(window.opensAt)} ${f.timeRange(window.opensAt, window.closesAt)}`,
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
  actions,
  onLongPress,
}: {
  task: Task;
  status: TaskStatus;
  meta?: "course" | "module" | "none";
  late?: boolean;
  exam?: Exam;
  actions?: ReactNode;
  onLongPress?: () => void;
}) {
  const t = useT();
  const { go } = useNav();
  const world = useRowWorld();
  const course = world.courses?.find((c) => c.code === task.courseCode);
  const module = moduleLabel(t, task.module);
  const date = taskDate(t, world.f, world.now, task, status);
  const signal = signalOf(t, world, task, status);
  const chip = LOUD.includes(status);
  const where = module ?? course?.name ?? null;
  const facts = exam
    ? [meta === "course" ? task.courseCode : "", t("exam.takeHome"), task.title]
    : meta === "course"
      ? [task.courseCode, where ?? ""]
      : meta === "module" && module
        ? [module]
        : [];
  const title = exam ? `${t(`exam.kind.${exam.kind}`)} ${course?.name ?? exam.courseCode}` : task.title;
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
  const code = meta === "course" ? task.courseCode : null;
  const rest = exam ? [t("exam.takeHome"), task.title] : meta === "course" ? [where] : meta === "module" ? [module] : [];
  return (
    <Row
      testID={`row.task.${task.id}`}
      label={label}
      onPress={() => go({ screen: "task", taskId: task.id })}
      onLongPress={onLongPress}
      actions={actions}
      title={
        exam ? (
          <ExamTitle kind={t(`exam.kind.${exam.kind}`)} name={course?.name ?? exam.courseCode} />
        ) : (
          <Text size="bodyLarge" numberOfLines={2}>
            {task.title}
          </Text>
        )
      }
      meta={<RowMeta code={code} color={world.colorOf(task.courseCode)} rest={rest} />}
      trailing={
        <>
          {chip && <StatusChip status={status} />}
          <DateColumn main={date.main} sub={date.sub} tone={date.tone} late={date.late && status === "overdue"} />
        </>
      }
    >
      {late && <RowNote>{t("home.need.task.overdue")}</RowNote>}
      {signal && (
        <RowNote icon={signal.icon} tone={signal.tone}>
          {signal.facts.join("  ·  ")}
        </RowNote>
      )}
    </Row>
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
export const TodoRow = inWorld(function TodoRow({ item, inCourse = false }: { item: TodoItem; inCourse?: boolean }) {
  const t = useT();
  const { now } = useRowWorld();
  const theme = useTheme();
  const late = lateSnoozable(item, now);
  const snoozable = late && canSnooze(late, now) ? late : null;
  const snooze = useSnooze(snoozable);
  const swipe = useRowActions({ snooze: snoozable ? snooze : null });
  if (item.kind === "period") return <PeriodRow item={item} inCourse={inCourse} />;
  const alarm = snoozable ? (
    <IconButton label={t("snooze.actionFor", { title: lateTitle(item) })} onPress={snooze.open} testID="action.snooze">
      <Icons.Snooze size={20} color={theme.color.onSurfaceVariant} />
    </IconButton>
  ) : undefined;
  const longPress = snoozable ? snooze.open : undefined;
  return (
    <>
      <SwipeRow actions={swipe}>
        {item.kind === "task" ? (
          <TaskRow task={item.task} status={item.status} meta={inCourse ? "module" : "course"} late={item.late} actions={alarm} onLongPress={longPress} />
        ) : (
          <ExamPartRow item={item} inCourse={inCourse} actions={alarm} onLongPress={longPress} />
        )}
      </SwipeRow>
      {snooze.sheet}
    </>
  );
});

/** "1 ditunda · Tampilkan" under the late rows, as on Beranda: quiet, opening what's put off, each with Ingatkan sekarang. */
export function PutOff({ putOff, open, onToggle }: { putOff: Todo["putOff"]; open: boolean; onToggle: () => void }) {
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
          {putOff.map(({ item, entry }, i) => (
            <GroupTile key={item.key} first={i === 0} last={i === putOff.length - 1}>
              <PutOffRow item={item} entry={entry} />
            </GroupTile>
          ))}
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
