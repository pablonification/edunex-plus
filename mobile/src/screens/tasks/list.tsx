// Tugas on the phone (S2, round 2): src/app/screens/tasks.tsx's TasksScreen with the same data, the
// same groups in the same order and the same words, read the phone's way. Everything still ahead in
// one list, grouped by when it runs out (Terlambat, Minggu ini, Minggu depan, Nanti); an exam period
// going on sits on top; Selesai holds what's handed in, the exams behind the Student and what closed.
// Belum selesai / Selesai at the top, the course chips under it, then the groups as tonal lists
// (Android's grouped tiles), the whole list one FlashList drawn row by row. The rows read what they
// share once for the list (row-parts.tsx), and the lines are worked out only when the data, the
// filter or the minute changes.
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useScrollToTop } from "expo-router";
import { memo, type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, View } from "react-native";
import { type TermCourse, useTermCourses } from "../../../../src/app/courses";
import { type Translate, useT } from "../../../../src/app/i18n";
import { type Todo, useTodo } from "../../../../src/app/schedule-data";
import { useBridge, useDataset, useStatus } from "../../../../src/app/store";
import type { Exam } from "../../../../src/core/exams";
import type { Task } from "../../../../src/core/models";
import type { StringKey } from "../../../../src/core/strings";
import { taskStatus } from "../../../../src/core/tasks";
import { type PastExam, type TodoGroup, type TodoItem, todoCount, todoCounted, todoForCourse, todoGroup } from "../../../../src/core/todo";
import { useNav } from "../../nav";
import { TabHeader, usePullToRefresh, useRefresh, useSignIn } from "../../shell/source-status";
import { CardSlice, SectionTitle } from "../../ui/card-list";
import { Button, Chip, ChipRow, Segmented } from "../../ui/controls";
import { CourseDot, EmptyState, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { GroupTile } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { PastExamRow } from "./exam-rows";
import { inWorld, RowProblemBanner, TaskRowWorld, useRowWorld } from "./row-parts";
import { PutOff, TaskRow, TodoRow } from "./rows";
import { momentsOf, useClockMoments } from "./task-clock";

const GROUPS: { group: TodoGroup; title: StringKey }[] = [
  { group: "overdue", title: "tasks.group.overdue" },
  { group: "thisWeek", title: "tasks.group.thisWeek" },
  { group: "nextWeek", title: "tasks.group.nextWeek" },
  { group: "later", title: "tasks.group.later" },
  { group: "undated", title: "tasks.group.undated" },
];

// The course filter the Student last chose, kept while the app runs (per bridge), as on the desktop.
const lastCourse = new WeakMap<object, string | null>();

/** Where a row sits in its group: the group's round ends are drawn row by row. */
interface Place {
  first: boolean;
  last: boolean;
}

/** One line of the list. */
export type Line =
  | { type: "heading"; key: string; title: string; count?: number; first: boolean }
  | ({ type: "todo"; key: string; item: TodoItem } & Place)
  | { type: "hero"; key: string; item: TodoItem }
  | ({ type: "done"; key: string; task: Task; exam?: Exam } & Place)
  | ({ type: "past"; key: string; past: PastExam } & Place)
  | { type: "putOff"; key: string; putOff: Todo["putOff"] }
  | { type: "gap"; key: string; size?: 3 | 6 }
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

/** What the list shows for one filter: its lines, the counts in the segments, and the courses worth a chip. */
function tasksView(
  t: Translate,
  todo: Todo | undefined,
  courses: readonly TermCourse[] | undefined,
  course: string | null,
  show: "open" | "done",
  sixOut: boolean,
) {
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
  const groups = GROUPS.map(({ group, title }) => ({ group, title, items: rest.filter((item) => todoGroup(item, now) === group) })).filter(
    (group) => group.items.length > 0 || (group.group === "overdue" && putOff.length > 0),
  );
  const nothingToDo = !rest.some(todoCounted) && putOff.length === 0;
  const examsNoSix = sixOut && show === "open" && course === null;
  const codes = new Set([
    ...(todo?.items ?? []).map((item) => item.course),
    ...(todo?.exams ?? []).map((exam) => exam.courseCode),
    ...[...(todo?.done.handedIn ?? []), ...(todo?.done.closed ?? []), ...(todo?.done.notHandingIn ?? [])].map((task) => task.courseCode),
  ]);
  const withItems = (courses ?? []).filter((c) => codes.has(c.code));

  const lines: Line[] = [];
  const todoCard = (list: readonly TodoItem[]) => card(list, (item, place): Line => ({ type: "todo", key: item.key, item, ...place }));
  // The one big card (v4): the nearest Task with a deadline, at the top of its group, out of the group's card.
  const heroGroup = show === "open" && !nothingToDo && groups[0] && groups[0].group !== "later" && groups[0].group !== "undated" ? groups[0] : undefined;
  const hero = heroGroup?.items.find((item) => item.kind === "task" && item.task.dueAt !== null);
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
          // No count beside a group: Belum selesai's says how many, and the rows are right under it.
          title: t(group.title),
          first: lines.length === 0,
        });
        if (hero && group === heroGroup) lines.push({ type: "hero", key: `hero:${hero.key}`, item: hero }, { type: "gap", key: "gap-hero", size: 6 });
        lines.push(...todoCard(group.items.filter((item) => item !== hero)));
        if (group.group === "overdue" && putOff.length) lines.push({ type: "putOff", key: "putOff", putOff });
      }
    if (examsNoSix) lines.push({ type: "examsNoSix", key: "examsNoSix" });
  }
  return { lines, openCount: todo ? todoCount(items) : undefined, doneCount: todo ? doneCount : undefined, withItems, hasPutOff: putOff.length > 0 };
}

/**
 * The screen. `show`: "done" while Selesai is picked, kept in the route (`?show=done`), so Back and
 * a link come back to it.
 */
export function TasksScreen({ show: shown }: { show?: "done" }) {
  const t = useT();
  const theme = useTheme();
  const todo = useTodo();
  // What the list shows things about, for its clock (./task-clock.tsx): a tick redraws it only when one is crossed.
  const presence = useDataset("edunex.presence");
  useClockMoments(useMemo(() => momentsOf([...(todo?.items ?? []), ...(Object.values(presence ?? {}).flat() as object[])]), [todo, presence]));
  const courses = useTermCourses();
  const bridge = useBridge();
  const pull = usePullToRefresh();
  // A tap on Tugas while it's open scrolls back to the top, as every tab built on Page does.
  const list = useRef<FlashListRef<Line>>(null);
  useScrollToTop(list);
  const { replace } = useNav();
  const sixOut = useStatus("six").state === "signed-out";
  const show = shown ?? "open";
  const setShow = useCallback((next: "open" | "done") => replace(next === "done" ? { screen: "tasks", show: "done" } : { screen: "tasks" }), [replace]);
  const [course, setCourseState] = useState<string | null>(lastCourse.get(bridge) ?? null);
  const setCourse = useCallback(
    (value: string | null) => {
      lastCourse.set(bridge, value);
      setCourseState(value);
    },
    [bridge],
  );
  const [putOffOpen, setPutOffOpen] = useState(false);
  const view = useMemo(() => tasksView(t, todo, courses, course, show, sixOut), [t, todo, courses, course, show, sixOut]);
  if (putOffOpen && !view.hasPutOff) setPutOffOpen(false);

  const header = (
    <Header show={show} onShow={setShow} openCount={view.openCount} doneCount={view.doneCount} courses={view.withItems} course={course} onCourse={setCourse} />
  );
  const togglePutOff = useCallback(() => setPutOffOpen((open) => !open), []);
  const showAll = useCallback(() => setCourse(null), [setCourse]);
  const renderItem = useCallback(
    ({ item: line }: { item: Line }) => <LineView line={line} putOffOpen={putOffOpen} onPutOff={togglePutOff} onShowAll={showAll} />,
    [putOffOpen, togglePutOff, showAll],
  );

  return (
    <View testID="screen.tasks" style={{ flex: 1, backgroundColor: theme.v4.page }}>
      <TabHeader v4 title={t("nav.tasks")} />
      <TaskRowWorld>
        <FlashList
          ref={list}
          data={view.lines}
          keyExtractor={(line) => line.key}
          getItemType={(line) => line.type}
          extraData={putOffOpen}
          renderItem={renderItem}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[10] }}
          // Page's own spinner: the app's blue on a raised disc, not Android's white one on a dark page.
          refreshControl={
            <RefreshControl
              refreshing={pull.refreshing}
              onRefresh={pull.onRefresh}
              colors={[theme.color.primary]}
              progressBackgroundColor={theme.color.surfaceContainerHigh}
            />
          }
          keyboardShouldPersistTaps="handled"
        />
      </TaskRowWorld>
    </View>
  );
}

/** Belum selesai / Selesai with their counts, the course chips under it, and a row's problem when there is one. */
const Header = memo(function Header({
  show,
  onShow,
  openCount,
  doneCount,
  courses,
  course,
  onCourse,
}: {
  show: "open" | "done";
  onShow: (show: "open" | "done") => void;
  openCount: number | undefined;
  doneCount: number | undefined;
  courses: readonly TermCourse[];
  course: string | null;
  onCourse: (code: string | null) => void;
}) {
  const t = useT();
  return (
    <View style={{ paddingTop: space[2], paddingBottom: space[6] }}>
      <RowProblemBanner />
      <Segmented
        testID="segment.show"
        label={t("tasks.show")}
        value={show}
        onChange={onShow}
        options={[
          { value: "open", label: t("tasks.filter.open"), count: openCount },
          { value: "done", label: t("tasks.filter.done"), count: doneCount },
        ]}
      />
      {courses.length > 1 && (
        <View style={{ marginTop: space[3] }} accessibilityRole="radiogroup" accessibilityLabel={t("tasks.filter.course")}>
          <ChipRow>
            <Chip testID="chip.course.all" selected={course === null} onPress={() => onCourse(null)}>
              {t("tasks.filter.all")}
            </Chip>
            {courses.map((c) => (
              <Chip key={c.code} testID={`chip.course.${c.code}`} label={`${c.code} ${c.name}`} selected={course === c.code} onPress={() => onCourse(c.code)}>
                <CourseDot color={c.color} size={8} />
                <Text size="labelLarge" tone={course === c.code ? "onSecondaryContainer" : "muted"}>
                  {c.code}
                </Text>
              </Chip>
            ))}
          </ChipRow>
        </View>
      )}
    </View>
  );
});

/** A row in its group's tonal tile (Android's grouped list, drawn row by row). Kept by this name for a course's page. */
export function CardRow({ first, last, children }: Place & { children: ReactNode }) {
  return (
    <GroupTile first={first} last={last}>
      {children}
    </GroupTile>
  );
}

/** On Tugas a row is a slice of its group's white card (v4); on a course's page, a tile of its tonal list. */
function Slice({ first, last, inCourse, children }: Place & { inCourse: boolean; children: ReactNode }) {
  return inCourse ? (
    <CardRow first={first} last={last}>
      {children}
    </CardRow>
  ) : (
    <CardSlice first={first} last={last}>
      {children}
    </CardSlice>
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
  const theme = useTheme();
  switch (line.type) {
    case "heading":
      return inCourse ? (
        <Heading title={line.title} count={line.count} first={line.first} />
      ) : (
        <SectionTitle title={line.title} count={line.count} first={line.first} />
      );
    case "todo":
      return (
        <Slice first={line.first} last={line.last} inCourse={inCourse}>
          <TodoRow item={line.item} inCourse={inCourse} />
        </Slice>
      );
    case "hero":
      return <TodoRow item={line.item} hero />;
    case "done":
      return (
        <Slice first={line.first} last={line.last} inCourse={inCourse}>
          <DoneTaskRow task={line.task} exam={line.exam} inCourse={inCourse} />
        </Slice>
      );
    case "past":
      return (
        <Slice first={line.first} last={line.last} inCourse={inCourse}>
          <PastExamRow past={line.past} inCourse={inCourse} />
        </Slice>
      );
    case "putOff":
      return <PutOff putOff={line.putOff} open={putOffOpen} onToggle={() => onPutOff?.()} inCourse={inCourse} />;
    case "gap":
      return <View style={{ height: space[line.size ?? 6] }} />;
    case "empty":
      return (
        <EmptyState icon={<Icons.CheckCircle size={24} color={theme.color.onSecondaryContainer} />} title={line.title} description={line.description}>
          {line.showAll && (
            <Button variant="tonal" onPress={onShowAll} testID="action.showAll">
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

/** A group's title and how many in it. */
function Heading({ title, count, first }: { title: string; count?: number; first: boolean }) {
  return (
    <View style={{ marginTop: first ? 0 : space[6], marginBottom: space[2], paddingHorizontal: space[1] }}>
      <Text size="titleMedium" weight="semibold" accessibilityRole="header">
        {title}
        {count !== undefined && (
          <Text size="titleMedium" tone="muted" tabular>
            {`  ${count}`}
          </Text>
        )}
      </Text>
    </View>
  );
}

/** A Task in Done, its status as of the list's minute. */
const DoneTaskRow = inWorld(function DoneTaskRow({ task, exam, inCourse }: { task: Task; exam?: Exam; inCourse: boolean }) {
  const { now } = useRowWorld();
  return <TaskRow task={task} status={taskStatus(task, now)} meta={inCourse ? "module" : "course"} exam={exam} />;
});

/** At the end of the list, without SIX: SIX's exam timetable is missing, and the one way to get it. */
function ExamsNoSix() {
  const t = useT();
  const { signIn, busy } = useSignIn();
  return (
    <View style={{ marginTop: space[8], gap: space[3], alignItems: "flex-start", paddingHorizontal: space[1] }}>
      <Text size="bodyMedium" tone="muted">
        {t("tasks.examsNoSix")}
      </Text>
      <Button variant="tonal" busy={busy} onPress={() => void signIn("six")} testID="action.signInSix">
        {t("action.signInTo", { source: "SIX" })}
      </Button>
    </View>
  );
}

/** Before the first Task list has arrived: a group's shape while it's on its way, else why it isn't. */
export function NoTasksYet() {
  const t = useT();
  const theme = useTheme();
  const status = useStatus("edunex");
  const { refresh, busy } = useRefresh();
  if (status.state === "connecting" || status.state === "live")
    return (
      <View accessibilityState={{ busy: true }} accessibilityLabel={t("mobile.tasks.loading")}>
        <View style={{ paddingHorizontal: space[1], marginBottom: space[3] }}>
          <Skeleton width={120} height={20} />
        </View>
        <View style={{ height: 156, borderRadius: 24, backgroundColor: theme.v4.card, marginBottom: space[3] }} />
        {[0, 1, 2].map((i) => (
          <CardSlice key={i} first={i === 0} last={i === 2}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: 14, paddingVertical: space[3], minHeight: 68 }}>
              <Skeleton width={44} height={44} style={{ borderRadius: 14 }} />
              <View style={{ flex: 1, gap: space[2] }}>
                <Skeleton width="70%" height={16} />
                <Skeleton width="45%" height={12} />
              </View>
              <Skeleton width={56} height={24} style={{ borderRadius: 12 }} />
            </View>
          </CardSlice>
        ))}
      </View>
    );
  return (
    <EmptyState icon={<Icons.ListChecks size={24} color={theme.color.onSecondaryContainer} />} title={t("tasks.unavailable")}>
      {status.state !== "expired" && status.state !== "signed-out" && (
        <Button variant="tonal" busy={busy} onPress={() => void refresh("edunex")} testID="action.tryAgain">
          {t("action.tryAgain")}
        </Button>
      )}
    </EmptyState>
  );
}
