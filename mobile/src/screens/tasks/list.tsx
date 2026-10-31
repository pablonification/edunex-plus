// Tugas & Ujian on the phone (S2): src/app/screens/tasks.tsx's TasksScreen with the same data, the
// same groups in the same order and the same words. Everything still ahead in one list, ordered by
// the moment each runs out; an exam period going on sits on top; Done holds what's handed in, the
// exams behind the Student and what closed. Belum selesai / Selesai at the top, the course chips
// scrolling sideways under it, and the list itself one FlashList (cards drawn row by row).
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useScrollToTop } from "expo-router";
import { type ReactNode, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useTermCourses } from "../../../../src/app/courses";
import { useNow, useT } from "../../../../src/app/i18n";
import { type Todo, useTodo } from "../../../../src/app/schedule-data";
import { useBridge, useStatus } from "../../../../src/app/store";
import type { Exam } from "../../../../src/core/exams";
import type { Task } from "../../../../src/core/models";
import type { StringKey } from "../../../../src/core/strings";
import { taskStatus } from "../../../../src/core/tasks";
import { type PastExam, type TodoGroup, type TodoItem, todoCount, todoCounted, todoForCourse, todoGroup } from "../../../../src/core/todo";
import { useNav } from "../../nav";
import { TabHeader, usePullToRefresh, useRefresh, useSignIn } from "../../shell/source-status";
import { Button, Chip, ChipRow, Segmented } from "../../ui/controls";
import { CourseDot, EmptyState, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { PageHeader } from "../../ui/layout";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
import { PastExamRow } from "./exam-rows";
import { PutOff, TaskRow, TodoRow } from "./rows";

const GROUPS: { group: TodoGroup; title: StringKey }[] = [
  { group: "overdue", title: "tasks.group.overdue" },
  { group: "thisWeek", title: "tasks.group.thisWeek" },
  { group: "nextWeek", title: "tasks.group.nextWeek" },
  { group: "later", title: "tasks.group.later" },
  { group: "undated", title: "tasks.group.undated" },
];

// The course filter the Student last chose, kept while the app runs (per bridge), as on the desktop.
const lastCourse = new WeakMap<object, string | null>();

/** Where a row sits in its card: the card's corners and hairlines are drawn row by row. */
interface Place {
  first: boolean;
  last: boolean;
}

/** One line of the list. */
export type Line =
  | { type: "heading"; key: string; title: string; count?: number; first: boolean }
  | ({ type: "todo"; key: string; item: TodoItem } & Place)
  | ({ type: "done"; key: string; task: Task; exam?: Exam } & Place)
  | ({ type: "past"; key: string; past: PastExam } & Place)
  | { type: "putOff"; key: string; putOff: Todo["putOff"] }
  | { type: "gap"; key: string }
  | { type: "empty"; key: string; title: string; description?: string; showAll: boolean; done: boolean }
  | { type: "loading"; key: string }
  | { type: "examsNoSix"; key: string };

function card<T>(items: readonly T[], line: (item: T, place: Place) => Line): Line[] {
  return items.map((item, i) => line(item, { first: i === 0, last: i === items.length - 1 }));
}

/** Done's groups: handed in, not handing in, past exams, closed; each newest first. A take-home keeps its exam's look. */
export function doneLines(done: Todo["done"], exams: readonly Exam[], heading: (key: StringKey) => string, prefix = "tasks"): Line[] {
  const examOf = (task: Task) => exams.find((exam) => exam.tasks.some((item) => item.id === task.id));
  const sections = [
    { id: "submitted", title: "tasks.group.submitted" as const, tasks: done.handedIn },
    { id: "notHandingIn", title: "tasks.group.notHandingIn" as const, tasks: done.notHandingIn },
    { id: "pastExams", title: "tasks.group.pastExams" as const, tasks: null },
    { id: "closed", title: "tasks.group.closed" as const, tasks: done.closed },
  ];
  const lines: Line[] = [];
  for (const section of sections) {
    const count = section.tasks ? section.tasks.length : done.pastExams.length;
    if (!count) continue;
    lines.push({ type: "heading", key: `${prefix}-${section.id}`, title: heading(section.title), count, first: lines.length === 0 });
    lines.push(
      ...(section.tasks
        ? card(section.tasks, (task, place): Line => ({ type: "done", key: `${section.id}:${task.id}`, task, exam: examOf(task), ...place }))
        : card(done.pastExams, (past, place): Line => ({ type: "past", key: `past:${past.exam.id}`, past, ...place }))),
    );
  }
  return lines;
}

/**
 * The screen. `show`: "done" while Selesai is picked, kept in the route (`?show=done`), so Back and
 * a link come back to it.
 */
export function TasksScreen({ show: shown }: { show?: "done" }) {
  const t = useT();
  const theme = useTheme();
  const todo = useTodo();
  const courses = useTermCourses();
  const bridge = useBridge();
  const pull = usePullToRefresh();
  // A tap on Tugas while it's open scrolls back to the top, as every tab built on Page does.
  const list = useRef<FlashListRef<Line>>(null);
  useScrollToTop(list);
  const { replace } = useNav();
  const six = useStatus("six");
  const show = shown ?? "open";
  const setShow = (next: "open" | "done") => replace(next === "done" ? { screen: "tasks", show: "done" } : { screen: "tasks" });
  const [course, setCourseState] = useState<string | null>(lastCourse.get(bridge) ?? null);
  const setCourse = (value: string | null) => {
    lastCourse.set(bridge, value);
    setCourseState(value);
  };
  const [putOffOpen, setPutOffOpen] = useState(false);

  const now = todo?.now ?? 0;
  const items = todoForCourse(todo?.items ?? [], course);
  const mine = (code: string) => course === null || code === course;
  const done = {
    handedIn: (todo?.done.handedIn ?? []).filter((task) => mine(task.courseCode)),
    pastExams: (todo?.done.pastExams ?? []).filter((past) => mine(past.exam.courseCode)),
    closed: (todo?.done.closed ?? []).filter((task) => mine(task.courseCode)),
    notHandingIn: (todo?.done.notHandingIn ?? []).filter((task) => mine(task.courseCode)),
  };
  const doneCount = done.handedIn.length + done.pastExams.length + done.closed.length + done.notHandingIn.length;
  const during = items.filter((item) => item.kind === "period" && item.state === "during");
  const rest = items.filter((item) => !during.includes(item));
  const putOff = (todo?.putOff ?? []).filter(({ item }) => mine(item.course ?? ""));
  if (putOffOpen && !putOff.length) setPutOffOpen(false);
  const groups = GROUPS.map(({ group, title }) => ({ group, title, items: rest.filter((item) => todoGroup(item, now) === group) })).filter(
    (group) => group.items.length > 0 || (group.group === "overdue" && putOff.length > 0),
  );
  const nothingToDo = !rest.some(todoCounted) && putOff.length === 0;
  const examsNoSix = six.state === "signed-out" && show === "open" && course === null;
  const codes = new Set([
    ...(todo?.items ?? []).map((item) => item.course),
    ...(todo?.exams ?? []).map((exam) => exam.courseCode),
    ...[...(todo?.done.handedIn ?? []), ...(todo?.done.closed ?? []), ...(todo?.done.notHandingIn ?? [])].map((task) => task.courseCode),
  ]);
  const withItems = (courses ?? []).filter((c) => codes.has(c.code));

  const lines: Line[] = [];
  const todoCard = (list: readonly TodoItem[]) => card(list, (item, place): Line => ({ type: "todo", key: item.key, item, ...place }));
  if (!todo) lines.push({ type: "loading", key: "loading" });
  else if (show === "done") {
    if (doneCount === 0) lines.push({ type: "empty", key: "empty", title: t("tasks.noneDone"), showAll: false, done: true });
    else lines.push(...doneLines(done, todo.exams, t));
  } else {
    if (during.length) lines.push(...todoCard(during), { type: "gap", key: "gap-during" });
    if (nothingToDo) {
      lines.push({
        type: "empty",
        key: "empty",
        title: course !== null ? t("tasks.noneForCourse", { code: course }) : t("tasks.empty.title"),
        description: course === null ? t("tasks.empty.hint") : undefined,
        showAll: course !== null,
        done: false,
      });
      // What's still to know though nothing is to do: an exam period ahead, an exam with no date.
      if (rest.length) lines.push(...todoCard(rest));
    } else
      for (const group of groups) {
        lines.push({
          type: "heading",
          key: `tasks-${group.group}`,
          title: t(group.title),
          count: todoCount(group.items) || undefined,
          first: lines.length === 0,
        });
        lines.push(...todoCard(group.items));
        if (group.group === "overdue" && putOff.length) lines.push({ type: "putOff", key: "putOff", putOff });
      }
    if (examsNoSix) lines.push({ type: "examsNoSix", key: "examsNoSix" });
  }

  const header = (
    <View style={{ paddingTop: space[4] }}>
      <PageHeader title={t("nav.tasks")} />
      <View style={{ marginTop: -space[2] }}>
        <Segmented
          testID="segment.show"
          label={t("tasks.show")}
          value={show}
          onChange={setShow}
          options={[
            { value: "open", label: t("tasks.filter.open"), count: todo ? todoCount(items) : undefined },
            { value: "done", label: t("tasks.filter.done"), count: todo ? doneCount : undefined },
          ]}
        />
      </View>
      {withItems.length > 1 && (
        <View style={{ marginTop: space[4] }} accessibilityRole="radiogroup" accessibilityLabel={t("tasks.filter.course")}>
          <ChipRow>
            <Chip testID="chip.course.all" selected={course === null} onPress={() => setCourse(null)}>
              {t("tasks.filter.all")}
            </Chip>
            {withItems.map((c) => (
              <Chip key={c.code} testID={`chip.course.${c.code}`} label={`${c.code} ${c.name}`} selected={course === c.code} onPress={() => setCourse(c.code)}>
                <CourseDot color={c.color} size={8} />
                <Text size="small" weight="medium" tone={course === c.code ? "fg" : "muted"}>
                  {c.code}
                </Text>
              </Chip>
            ))}
          </ChipRow>
        </View>
      )}
      <View style={{ height: space[6] }} />
    </View>
  );

  return (
    <View testID="screen.tasks" style={{ flex: 1, backgroundColor: theme.color.canvas }}>
      <TabHeader title={t("nav.tasks")} />
      <FlashList
        ref={list}
        data={lines}
        keyExtractor={(line) => line.key}
        getItemType={(line) => line.type}
        // What a row shows depends on more than its line (the clock, the course filter, what's put off).
        extraData={[now, course, putOffOpen]}
        renderItem={({ item: line }) => (
          <LineView line={line} putOffOpen={putOffOpen} onPutOff={() => setPutOffOpen(!putOffOpen)} onShowAll={() => setCourse(null)} />
        )}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: space[10] }}
        // Page's own spinner: the app's blue on a raised disc, not Android's white one on a dark page.
        refreshControl={
          <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} colors={[theme.color.accent]} progressBackgroundColor={theme.color.raised} />
        }
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

/** A row in its card: the card's sides, its corners on the first and last rows, a hairline between. */
export function CardRow({ first, last, children }: Place & { children: ReactNode }) {
  const theme = useTheme();
  const c = theme.color;
  return (
    <View
      style={{
        backgroundColor: c.surfaceContainerLow,
        overflow: "hidden",
        borderColor: c.edge,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: first ? c.edge : c.line,
        borderBottomWidth: last ? StyleSheet.hairlineWidth : 0,
        borderTopLeftRadius: first ? radius.xl : 0,
        borderTopRightRadius: first ? radius.xl : 0,
        borderBottomLeftRadius: last ? radius.xl : 0,
        borderBottomRightRadius: last ? radius.xl : 0,
      }}
    >
      {children}
    </View>
  );
}

export function LineView({
  line,
  putOffOpen = false,
  onPutOff,
  onShowAll,
  inCourse = false,
}: {
  line: Line;
  putOffOpen?: boolean;
  onPutOff?: () => void;
  onShowAll?: () => void;
  inCourse?: boolean;
}) {
  const t = useT();
  const now = useNow();
  const theme = useTheme();
  switch (line.type) {
    case "heading":
      return (
        <View style={{ marginTop: line.first ? 0 : space[8], marginBottom: space[3] }}>
          <Text size="title" weight="semibold" accessibilityRole="header">
            {line.title}
            {line.count !== undefined && (
              <Text size="title" weight="medium" tone="faint" tabular>
                {`  ${line.count}`}
              </Text>
            )}
          </Text>
        </View>
      );
    case "todo":
      return (
        <CardRow first={line.first} last={line.last}>
          <TodoRow item={line.item} inCourse={inCourse} />
        </CardRow>
      );
    case "done":
      return (
        <CardRow first={line.first} last={line.last}>
          <TaskRow task={line.task} status={taskStatus(line.task, now)} meta={inCourse ? "module" : "course"} exam={line.exam} />
        </CardRow>
      );
    case "past":
      return (
        <CardRow first={line.first} last={line.last}>
          <PastExamRow past={line.past} inCourse={inCourse} />
        </CardRow>
      );
    case "putOff":
      return <PutOff putOff={line.putOff} open={putOffOpen} onToggle={() => onPutOff?.()} />;
    case "gap":
      return <View style={{ height: space[8] }} />;
    case "empty":
      return (
        <EmptyState icon={<Icons.CheckCircle size={20} color={theme.color.muted} />} title={line.title} description={line.description}>
          {line.showAll && (
            <Button size="sm" onPress={onShowAll}>
              {t("tasks.showAll")}
            </Button>
          )}
        </EmptyState>
      );
    case "loading":
      return <NoTasksYet />;
    case "examsNoSix":
      return <ExamsNoSix />;
  }
}

/** At the end of the list, without SIX: SIX's exam timetable is missing, and the one way to get it. */
function ExamsNoSix() {
  const t = useT();
  const { signIn, busy } = useSignIn();
  return (
    <View style={{ marginTop: space[8], gap: space[2], alignItems: "flex-start" }}>
      <Text size="small" tone="muted">
        {t("tasks.examsNoSix")}
      </Text>
      <Button busy={busy} onPress={() => void signIn("six")} testID="action.signInSix">
        {t("action.signInTo", { source: "SIX" })}
      </Button>
    </View>
  );
}

/** Before the first Task list has arrived: placeholders while it's on its way, else why it isn't. */
export function NoTasksYet() {
  const t = useT();
  const theme = useTheme();
  const status = useStatus("edunex");
  const { refresh, busy } = useRefresh();
  if (status.state === "connecting" || status.state === "live")
    return (
      <View
        accessibilityState={{ busy: true }}
        style={{ borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.edge, overflow: "hidden" }}
      >
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              { flexDirection: "row", alignItems: "center", gap: space[4], padding: space[4] },
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.line },
            ]}
          >
            <View style={{ flex: 1, gap: space[2] }}>
              <Skeleton width="60%" />
              <Skeleton width="40%" height={12} />
            </View>
            <Skeleton width={72} height={28} />
          </View>
        ))}
      </View>
    );
  return (
    <EmptyState icon={<Icons.ListChecks size={20} color={theme.color.muted} />} title={t("tasks.unavailable")}>
      {status.state !== "expired" && status.state !== "signed-out" && (
        <Button size="sm" busy={busy} onPress={() => void refresh("edunex")}>
          {t("action.tryAgain")}
        </Button>
      )}
    </EmptyState>
  );
}
