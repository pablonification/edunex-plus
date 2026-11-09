// Tugas on the phone (S2, round 2): src/app/screens/tasks.tsx's TasksScreen with the same data, the
// same groups in the same order and the same words, read the phone's way. Everything still ahead in
// one list, grouped by when it runs out (Terlambat, Minggu ini, Minggu depan, Nanti); an exam period
// going on sits on top; Selesai holds what's handed in, the exams behind the Student and what closed.
// Belum selesai / Selesai at the top with the course filter beside it (its courses in a sheet), then the groups as tonal lists
// (Android's grouped tiles), the whole list one FlashList drawn row by row. The rows read what they
// share once for the list (row-parts.tsx), and the lines are worked out only when the data, the
// filter or the minute changes.
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useScrollToTop } from "expo-router";
import { memo, type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
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
import { Button, Segmented } from "../../ui/controls";
import { EmptyState, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, GroupTile } from "../../ui/layout";
import { usePart } from "../../ui/parts";
import { ChoiceSheet } from "../../ui/settings-list";
import { SEGMENT_HEIGHT, slopY } from "../../ui/sizes";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { shortName } from "../home/parts";
import { PastExamRow } from "./exam-rows";
import { lineType } from "./line-type";
import { inWorld, RowProblemBanner, TaskRowWorld, useRowWorld } from "./row-parts";
import { PutOff, TaskRow, TodoRow } from "./rows";
import { momentsOf, useClockMoments } from "./task-clock";

/**
 * Lines on a first draw ahead (../../ui/parts.tsx): about a screenful (the controls, the big card, four rows), then the
 * whole list in the next part. Each part is one commit of its own instead of one block.
 */
const FIRST_LINES = 6;

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
        const others = group.items.filter((item) => item !== hero);
        // The gap under the big card only when its group goes on: the next group's title brings its own (one even gap).
        if (hero && group === heroGroup)
          lines.push({ type: "hero", key: `hero:${hero.key}`, item: hero }, ...(others.length ? [{ type: "gap", key: "gap-hero", size: 3 } as const] : []));
        lines.push(...todoCard(others));
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
  const listed = usePart(1);
  const whole = usePart(2);
  const lines = useMemo(() => (whole ? view.lines : view.lines.slice(0, FIRST_LINES)), [whole, view.lines]);

  const header = (
    <Header show={show} onShow={setShow} openCount={view.openCount} doneCount={view.doneCount} courses={view.withItems} course={course} onCourse={setCourse} />
  );
  const togglePutOff = useCallback(() => setPutOffOpen((open) => !open), []);
  const showAll = useCallback(() => setCourse(null), [setCourse]);
  const renderItem = useCallback(
    // Only the "ditunda" line hears of it opening: every other row stays as drawn.
    ({ item: line }: { item: Line }) => <LineView line={line} putOffOpen={line.type === "putOff" && putOffOpen} onPutOff={togglePutOff} onShowAll={showAll} />,
    [putOffOpen, togglePutOff, showAll],
  );

  return (
    <View testID="screen.tasks" style={{ flex: 1, backgroundColor: theme.v4.page }}>
      <TabHeader v4 title={t("nav.tasks")} />
      <TaskRowWorld>
        {listed && (
          <FlashList
            ref={list}
            data={lines}
            keyExtractor={(line) => line.key}
            getItemType={lineType}
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
        )}
      </TaskRowWorld>
    </View>
  );
}

/**
 * Belum selesai / Selesai with their counts and, beside them in the same row and the same pill shape, the course filter:
 * a funnel at rest, the picked course's tile on a tonal fill once one is picked; a tap opens the courses in a sheet
 * (round 3: two rows of controls in two shapes came before any Task). A row's problem goes over them when there is one.
 */
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Segmented
            testID="segment.show"
            label={t("tasks.show")}
            value={show}
            onChange={onShow}
            check={false}
            options={[
              { value: "open", label: t("tasks.filter.open"), count: openCount },
              { value: "done", label: t("tasks.filter.done"), count: doneCount },
            ]}
          />
        </View>
        {courses.length > 1 && <CourseFilter courses={courses} course={course} onCourse={onCourse} />}
      </View>
    </View>
  );
});

const ALL = "__all";

/** The course filter: one pill beside Belum selesai / Selesai, the courses in a sheet. */
function CourseFilter({ courses, course, onCourse }: { courses: readonly TermCourse[]; course: string | null; onCourse: (code: string | null) => void }) {
  const t = useT();
  const theme = useTheme();
  const c = theme.color;
  const [open, setOpen] = useState(false);
  const picked = course === null ? undefined : courses.find((item) => item.code === course);
  const choices = useMemo(
    () => [
      { value: ALL, label: t("tasks.filter.all") },
      // The course by a name a student says, short ("Ekonomi dan Inovasi"), its code as its second line.
      ...courses.map((item) => ({ value: item.code, label: shortName(item.name), hint: item.code })),
    ],
    [courses, t],
  );
  return (
    <>
      <Pressable
        testID="action.courseFilter"
        accessibilityRole="button"
        accessibilityLabel={factsLabel(t("tasks.filter.course"), picked ? `${picked.code} ${picked.name}` : t("tasks.filter.all"))}
        accessibilityState={{ selected: picked !== undefined }}
        onPress={() => setOpen(true)}
        hitSlop={slopY(SEGMENT_HEIGHT)}
        android_ripple={{ color: c.selected, borderless: false }}
        style={{
          height: SEGMENT_HEIGHT,
          minWidth: 56,
          paddingHorizontal: space[4],
          borderRadius: SEGMENT_HEIGHT / 2,
          borderWidth: 1,
          borderColor: picked ? c.secondaryContainer : c.outline,
          backgroundColor: picked ? c.secondaryContainer : undefined,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space[2],
          overflow: "hidden",
        }}
      >
        <Icons.Filter size={18} weight={picked ? "fill" : "regular"} color={picked ? c.onSecondaryContainer : c.onSurfaceVariant} />
        {picked && <CourseTile code={picked.code} name={picked.name} size={20} />}
      </Pressable>
      <ChoiceSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("tasks.filter.course")}
        value={course ?? ALL}
        choices={choices}
        onChange={(value) => {
          onCourse(value === ALL ? null : value);
          setOpen(false);
        }}
        testID="courseFilter"
      />
    </>
  );
}

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

/**
 * A line, drawn again only when it or what it's given changes: FlashList draws a cell again each time its place moves
 * (a row over it measured taller than guessed as it scrolls into view), and a row is a dozen parts.
 */
export const LineView = memo(function LineView({
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
});

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
        <View style={{ height: 104, borderRadius: 20, backgroundColor: theme.v4.card, marginBottom: space[3] }} />
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
