// The rows of Tugas & Ujian on the phone: src/app/screens/tasks.tsx's TaskRow, TodoRow, PutOff and
// their date column, with the same facts in the same order. A late Task's "Ingatkan nanti" is an
// alarm on the row, a swipe, and its long press; each row's accessible name says every fact the
// row shows (and the status the desktop leaves to its screen reader text).
import type { ReactNode } from "react";
import { View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { errorKey } from "../../../../src/app/bridge";
import { useCourseColor, useTermCourses } from "../../../../src/app/courses";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import type { Todo } from "../../../../src/app/schedule-data";
import { useDone, useSnoozes } from "../../../../src/app/snoozes";
import { useDataset } from "../../../../src/app/store";
import { attendanceWindow, presenceOptional } from "../../../../src/core/attendance";
import { taskPutAway } from "../../../../src/core/done";
import type { Exam } from "../../../../src/core/exams";
import type { DoneHow, Task, TaskModule, TaskStatus } from "../../../../src/core/models";
import { editView } from "../../../../src/core/task-edits";
import { isOpenStatus, moduleName, notOpenYet, shortWindow, submittedAt } from "../../../../src/core/tasks";
import { lateSnoozable, type TodoItem } from "../../../../src/core/todo";
import { useNav } from "../../nav";
import { canSnooze, useRowActions, useSnooze } from "../../parts/snooze";
import { toast } from "../../swaps/overlays";
import { Button, IconButton } from "../../ui/controls";
import { CourseDot, StatusChip, Tag } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Meta, Row } from "../../ui/layout";
import { SwipeRow } from "../../ui/swipe";
import { Text, type TextTone } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { ExamPartRow, PeriodRow } from "./exam-rows";

const DAY = 86_400_000;

/** Statuses worth a chip in a list: the rest are said by the segment and the date. */
const LOUD: readonly TaskStatus[] = ["draft", "overdue", "in_review"];

export function moduleLabel(t: Translate, module: TaskModule | null): string | null {
  if (!module) return null;
  return factsLabel(t("task.module", { n: module.index }), moduleName(module));
}

export function formatScore(score: number, f: Format): string {
  return Number.isInteger(score) ? String(score) : f.number(score, 2).replace(/[.,]?0+$/, "");
}

/** "● DK4073": a course's code with its dot. */
export function CourseCodeMark({ code }: { code: string }) {
  const color = useCourseColor()(code);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <CourseDot color={color} size={8} />
      <Text size="small" weight="medium">
        {code}
      </Text>
    </View>
  );
}

/** The right-hand column: a main line over a quieter one, in the row's tone. */
export function DateColumn({ main, sub, tone }: { main: string; sub?: string | null; tone?: TextTone }) {
  return (
    <View style={{ alignItems: "flex-end" }}>
      <Text size="small" tone={tone ?? "fg"} tabular numberOfLines={1}>
        {main}
      </Text>
      {sub ? (
        <Text size="small" tone={tone ?? "faint"} tabular numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** A deadline's two lines, the desktop's DueWhen: its day and time over how long until it; amber within a day, red once late. */
export function useDueWhen(): (at: number, late: boolean, under?: string) => { main: string; sub: string | null; tone?: TextTone } {
  const f = useFormat();
  const now = useNow();
  return (at, late, under) => {
    const soon = !late && at > now && at - now < DAY;
    const repeats = under === undefined && Math.abs(f.dayOffset(at)) === 1 && Math.abs(at - now) >= DAY;
    return { main: f.dueLabel(at), sub: repeats ? null : (under ?? f.fromNow(at)), tone: late ? "danger" : soon ? "warning" : undefined };
  };
}

/** "Jum, 16 Okt, 23:59 / dalam 8 hari"; "Dikumpulkan 24 Sep" once handed in, with its score over it once graded. */
function useTaskDate(): (task: Task, status: TaskStatus) => { main: string; sub: string | null; tone?: TextTone } {
  const t = useT();
  const f = useFormat();
  const due = useDueWhen();
  return (task, status) => {
    const sentAt = submittedAt(task);
    if (sentAt !== null) {
      const sent = t("task.submittedOnDate", { date: f.dayMonth(sentAt) });
      return task.score !== null ? { main: t("task.scoreValue", { score: formatScore(task.score, f) }), sub: sent, tone: "fg" } : { main: sent, sub: null };
    }
    if (task.dueAt === null) return { main: t("task.noDeadline"), sub: null, tone: "faint" };
    return due(task.dueAt, status === "overdue" || status === "closed", status === "closed" ? t("task.notHandedIn") : undefined);
  };
}

type MarkedHow = Extract<DoneHow, "handedElsewhere" | "notHandingIn" | "groupDone">;

/**
 * At most one thing Edunex's list doesn't say, the one that changes what to do (the desktop's
 * Signal): marked on its page, changed after the Student handed in, attendance taken by handing
 * in, not open yet, a short window.
 */
function useSignal(task: Task, status: TaskStatus): { icon: ReactNode; facts: string[]; tone: TextTone } | null {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const presence = useDataset("edunex.presence");
  const { entries: handled } = useDone();
  const edits = useDataset("edunex.taskEdits");
  const countedIn = useAttendance()?.courses.find((entry) => entry.course.code === task.courseCode)?.health.countedIn;
  const edit = editView(task, edits, handled);
  const optional = presenceOptional(countedIn);
  const c = theme.color;
  const window = isOpenStatus(status) ? attendanceWindow(task, presence, now) : null;
  const marked = isOpenStatus(status) ? taskPutAway(task, handled) : undefined;
  if (marked) return { icon: <Icons.Check size={14} weight="bold" color={c.muted} />, facts: [t(`task.marked.${marked.how as MarkedHow}`)], tone: "muted" };
  if (edit?.afterSubmit && task.editedAt !== null && !edit.checked && edit.state !== "none")
    return {
      icon: <Icons.PenLine size={14} color={c.warningFg} />,
      facts: [t("task.editedAfterSubmitLine", { date: f.dayMonth(task.editedAt) })],
      tone: "warning",
    };
  if (window)
    return {
      icon: <Icons.Hand size={14} color={c.muted} />,
      facts: [
        t(optional ? "task.attendanceLineOptional" : "task.attendanceLine", {
          when: `${f.relativeDay(window.opensAt)} ${f.timeRange(window.opensAt, window.closesAt)}`,
        }),
      ],
      tone: "muted",
    };
  if (task.opensAt !== null && notOpenYet(task, now)) return { icon: null, facts: [t("task.opens", { when: f.dueLabel(task.opensAt) })], tone: "muted" };
  if (shortWindow(task) !== null && task.opensAt !== null && task.dueAt !== null)
    return { icon: <Icons.Zap size={14} color={c.muted} />, facts: [t("task.shortWindow"), f.timeRange(task.opensAt, task.dueAt)], tone: "muted" };
  return null;
}

/** "UTS Komunikasi Pemasaran": the kind's quiet tag, then the course. */
export function ExamTitle({ kind, name }: { kind: string; name: string }) {
  return (
    // The tag level with the name's first line (22 high): 2 to centre its 18, 2 more to meet the letters, which sit low
    // in their line.
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
      <View style={{ marginTop: 4 }}>
        <Tag>{kind}</Tag>
      </View>
      <Text size="body" weight="medium" numberOfLines={2} style={{ flexShrink: 1 }}>
        {name}
      </Text>
    </View>
  );
}

/**
 * A Task as a row, opening its page. Under "Terlambat" the heading says it's late (no chip on every
 * row), and the row says it's still taken. A take-home in Done keeps its exam's look.
 */
export function TaskRow({
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
  const course = useTermCourses()?.find((c) => c.code === task.courseCode);
  const module = moduleLabel(t, task.module);
  const date = useTaskDate()(task, status);
  const signal = useSignal(task, status);
  const chip = LOUD.includes(status) && !(late && status === "overdue");
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
  );
  return (
    <Row
      testID={`row.task.${task.id}`}
      label={label}
      onPress={() => go({ screen: "task", taskId: task.id })}
      onLongPress={onLongPress}
      actions={actions}
      title={exam ? <ExamTitle kind={t(`exam.kind.${exam.kind}`)} name={course?.name ?? exam.courseCode} /> : task.title}
      meta={
        facts.length ? (
          <Meta>
            {facts[0] && meta === "course" ? <CourseCodeMark code={task.courseCode} /> : facts[0]}
            {facts.slice(1)}
          </Meta>
        ) : undefined
      }
      trailing={
        <>
          {chip && <StatusChip status={status} />}
          <DateColumn {...date} />
        </>
      }
    >
      {late && (
        <Text size="small" tone="muted" style={{ marginTop: space[1] }}>
          {t("home.need.task.overdue")}
        </Text>
      )}
      {signal && (
        // The icon level with the first line (19 high) when the line wraps.
        <View style={{ marginTop: space[1], flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          {signal.icon && <View style={{ paddingTop: 2.5 }}>{signal.icon}</View>}
          <Text size="small" tone={signal.tone} weight={signal.tone === "warning" ? "medium" : "regular"} style={{ flexShrink: 1 }}>
            {signal.facts.join("  ·  ")}
          </Text>
        </View>
      )}
    </Row>
  );
}

/** The Task a late row is about, for its name: a Task, or an exam's take-home. */
export const lateTitle = (item: TodoItem) =>
  item.kind === "task" ? item.task.title : item.kind === "exam" && item.part?.kind === "takehome" ? item.part.task.title : "";

/**
 * A row of the one list, whatever it is: a Task, an exam's part, an exam period. A late one can be
 * put off ("Ingatkan nanti") as on Beranda, the same snooze for the same Task: the alarm, a swipe
 * or a long press.
 */
export function TodoRow({ item, inCourse = false }: { item: TodoItem; inCourse?: boolean }) {
  const t = useT();
  const now = useNow();
  const theme = useTheme();
  const late = lateSnoozable(item, now);
  const snoozable = late && canSnooze(late, now) ? late : null;
  const snooze = useSnooze(snoozable);
  const swipe = useRowActions({ snooze: snoozable ? snooze : null });
  if (item.kind === "period") return <PeriodRow item={item} inCourse={inCourse} />;
  const alarm = snoozable ? (
    <IconButton label={t("snooze.actionFor", { title: lateTitle(item) })} onPress={snooze.open} testID="action.snooze">
      <Icons.Snooze size={20} color={theme.color.faint} />
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
}

/** "1 ditunda · Tampilkan" under the late rows, as on Beranda: quiet, opening what's put off, each with Ingatkan sekarang. */
export function PutOff({ putOff, open, onToggle }: { putOff: Todo["putOff"]; open: boolean; onToggle: () => void }) {
  const t = useT();
  const theme = useTheme();
  if (!putOff.length) return null;
  return (
    <View style={{ marginTop: space[2.5], gap: space[2.5] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[1] }}>
        <Icons.Snooze size={14} color={theme.color.faint} />
        <Text size="small" tone="muted" style={{ flex: 1 }}>
          {t("snooze.count", { count: putOff.length })}
        </Text>
        <Button size="sm" variant="ghost" onPress={onToggle} testID="action.putOff">
          <Text size="small" weight="medium" tone="accent">
            {open ? t("snooze.hideList") : t("snooze.showList")}
          </Text>
        </Button>
      </View>
      {open && (
        <View style={{ borderRadius: 12, borderWidth: 0.5, borderColor: theme.color.edge, backgroundColor: theme.color.surface, overflow: "hidden" }}>
          {putOff.map(({ item, entry }, i) => (
            <View key={item.key} style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: theme.color.line } : null}>
              <PutOffRow item={item} entry={entry} />
            </View>
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
  const title = lateTitle(item);
  const when = f.dueLabel(entry.until);
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
          onPress={() => void wake(entry.id).catch((error: unknown) => toast(t(errorKey(error)), "danger"))}
        >
          {t("snooze.wake")}
        </Button>
      }
    />
  );
}
