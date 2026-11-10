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
import Animated from "react-native-reanimated";
import { type TermCourse, useTermCourses } from "../../../../src/app/courses";
import { type Translate, useT } from "../../../../src/app/i18n";
import { type Todo, useTodo } from "../../../../src/app/schedule-data";
import { useBridge, useDataset, useSourceState, useStatus } from "../../../../src/app/store";
import { wibDay } from "../../../../src/core/course-meetings";
import type { Exam } from "../../../../src/core/exams";
import type { Task } from "../../../../src/core/models";
import type { StringKey } from "../../../../src/core/strings";
import { taskStatus } from "../../../../src/core/tasks";
import { type PastExam, type TodoGroup, type TodoItem, todoCount, todoCounted, todoForCourse, todoGroup } from "../../../../src/core/todo";
import { useNav } from "../../nav";
import { BTabHeader } from "../../parts/b-header";
import { usePullToRefresh, useRefresh, useSignIn } from "../../shell/source-status";
import { useB } from "../../ui/b";
import { SectionTitle } from "../../ui/card-list";
import { Button } from "../../ui/controls";
import { EmptyState, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, GroupTile } from "../../ui/layout";
import { CrossFade, useSlidingMark } from "../../ui/moves";
import { useDrawAhead, useLinesShown, usePart } from "../../ui/parts";
import { iosPressed, PressScale } from "../../ui/press";
import { ChoiceSheet } from "../../ui/settings-list";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { shortName } from "../home/parts";
import { PastExamRow, PeriodExam, PeriodFold, PeriodHead } from "./exam-rows";
import { lineType } from "./line-type";
import { FlatSlice, inWorld, RowProblemBanner, TaskRowWorld, useRowWorld } from "./row-parts";
import { PutOff, TaskRow, TodoRow } from "./rows";
import { momentsOf, useClockMoments } from "./task-clock";

/**
 * Lines on a first draw ahead (../../ui/parts.tsx): Belum selesai / Selesai and the first three lines, then a screenful
 * (the big card, four rows), then the rest a few lines at a time (useLinesShown), and then it draws further ahead while
 * idle (useDrawAhead). Each part is one small commit of its own instead of one block (part 1 with all of a screenful
 * held a mid-range phone's JS thread 100–130 ms).
 */
const FIRST_LINES = [0, 3, 6] as const;

/** Tugas's groups: the week's, with what runs out today in a group of its own, first after what's late. */
type ShownGroup = TodoGroup | "today";

const GROUPS: { group: ShownGroup; title: StringKey }[] = [
  { group: "overdue", title: "tasks.group.overdue" },
  { group: "today", title: "mobile.tasks.today" },
  { group: "thisWeek", title: "tasks.group.thisWeek" },
  { group: "nextWeek", title: "tasks.group.nextWeek" },
  { group: "later", title: "tasks.group.later" },
  { group: "undated", title: "tasks.group.undated" },
];

// The course filter the Student last chose, kept while the app runs (per bridge), as on the desktop.
const lastCourse = new WeakMap<object, string | null>();

/** A row's group on Tugas: this week's, but today's on its own. */
function shownGroup(item: TodoItem, now: number): ShownGroup {
  const group = todoGroup(item, now);
  return group === "thisWeek" && item.kind !== "period" && item.at !== null && wibDay(item.at) === wibDay(now) ? "today" : group;
}

/** Inside a group: what has a day first (soonest first, as given: an exam period where it starts), then what has none yet. */
const undatedLast = (item: TodoItem) => (item.kind !== "period" && (item.at === null || (item.kind === "exam" && item.part === null)) ? 1 : 0);

type PeriodItem = Extract<TodoItem, { kind: "period" }>;
type ExamItem = Extract<TodoItem, { kind: "exam" }>;
/** A Task or an exam's part with a day: it sits in date order, and can lead the list. */
const dated = (item: TodoItem): item is Exclude<TodoItem, PeriodItem> & { at: number } => item.kind !== "period" && undatedLast(item) === 0;
/** Whether an exam with a day sits in an exam period of its kind: it's drawn inside the period's sub-heading. */
const inPeriod = (item: TodoItem, period: PeriodItem): item is ExamItem =>
  item.kind === "exam" &&
  item.at !== null &&
  item.part !== null &&
  item.exam.kind === period.examKind &&
  item.at >= period.week.start &&
  item.at < period.week.end;

/** Where a row sits in its group: the group's round ends are drawn row by row. */
interface Place {
  first: boolean;
  last: boolean;
}

/** One line of the list. */
export type Line =
  | { type: "heading"; key: string; title: string; count?: number; first: boolean }
  | ({ type: "todo"; key: string; item: TodoItem } & Place)
  | { type: "periodHead"; key: string; item: PeriodItem }
  | { type: "periodFold"; key: string; item: PeriodItem }
  | { type: "periodExam"; key: string; exam: Exam; first: boolean }
  | { type: "hero"; key: string; item: TodoItem }
  | ({ type: "done"; key: string; task: Task; exam?: Exam } & Place)
  | ({ type: "past"; key: string; past: PastExam } & Place)
  | { type: "putOff"; key: string; putOff: Todo["putOff"] }
  | { type: "gap"; key: string; size?: 3 | 6 }
  | { type: "today"; key: string; title: string }
  | { type: "empty"; key: string; title: string; description?: string; showAll: boolean; done: boolean }
  | { type: "loading"; key: string }
  | { type: "examsNoSix"; key: string };

function card<T>(items: readonly T[], line: (item: T, place: Place) => Line): Line[] {
  return items.map((item, i) => line(item, { first: i === 0, last: i === items.length - 1 }));
}

/** A line that's a flat row: the hairline is over every one but the first after something else. */
const isRow = (line: Line | undefined) => line?.type === "todo" || line?.type === "periodExam";

/**
 * A group's rows in date order, each a line of its own (FlashList draws and recycles them one by one). An exam period
 * is a sub-heading where its first exam falls; its exams with no day yet come after its dated ones (behind a fold while
 * it's far off). A period none of whose exams has a day comes after everything dated, and what has no day at all last:
 * nothing undated is ever above something dated.
 */
export function groupLines(items: readonly TodoItem[], hero?: TodoItem): Line[] {
  const periods = items.filter((item): item is PeriodItem => item.kind === "period");
  const rows = items.filter((item) => item.kind !== "period" && item !== hero);
  const out: Line[] = [];
  const row = (item: TodoItem) => out.push({ type: "todo", key: item.key, item, first: false, last: false });
  const head = (period: PeriodItem) => out.push({ type: "periodHead", key: period.key, item: period });
  const tail = (period: PeriodItem) => {
    if (!period.exams.length) return;
    if (period.state === "far") out.push({ type: "periodFold", key: `${period.key}:fold`, item: period });
    else for (const exam of period.exams) out.push({ type: "periodExam", key: `${period.key}:${exam.id}`, exam, first: false });
  };
  let open: PeriodItem | undefined;
  for (const item of rows.filter(dated)) {
    if (open && item.at >= open.week.end) {
      tail(open);
      open = undefined;
    }
    const next = open ? undefined : periods.find((period) => inPeriod(item, period));
    if (next) {
      periods.splice(periods.indexOf(next), 1);
      head(next);
      open = next;
    }
    row(item);
  }
  if (open) tail(open);
  // A period with nothing dated left under it (its one dated exam leads the list, or none has a day yet).
  for (const period of periods)
    if (period.exams.length) {
      head(period);
      tail(period);
    }
  for (const item of rows) if (!dated(item)) row(item);
  return out.map((line, i) => (isRow(line) ? { ...line, first: !isRow(out[i - 1]) } : line) as Line);
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
  const groups = GROUPS.map(({ group, title }) => ({
    group,
    title,
    items: rest.filter((item) => shownGroup(item, now) === group).sort((a, b) => undatedLast(a) - undatedLast(b)),
  })).filter((group) => group.items.length > 0 || (group.group === "overdue" && putOff.length > 0));
  const nothingToDo = todoCount(items) === 0 && putOff.length === 0;
  const examsNoSix = sixOut && show === "open" && course === null;
  const codes = new Set([
    ...(todo?.items ?? []).map((item) => item.course),
    ...(todo?.exams ?? []).map((exam) => exam.courseCode),
    ...[...(todo?.done.handedIn ?? []), ...(todo?.done.closed ?? []), ...(todo?.done.notHandingIn ?? [])].map((task) => task.courseCode),
  ]);
  const withItems = (courses ?? []).filter((c) => codes.has(c.code));

  const lines: Line[] = [];
  // The one thing to pick up: the soonest dated thing ahead of any kind, a Task or an exam (one in its exam period
  // too), in its course's colour at the top of its group, not listed again under it. The rest reads in date order.
  const heroGroup = show === "open" && !nothingToDo && groups[0] && groups[0].group !== "later" && groups[0].group !== "undated" ? groups[0] : undefined;
  const soonest = heroGroup?.items.find(dated);
  // A Task with a deadline, or an exam's part still ahead (one going on now is its row's "Sekarang", not a countdown).
  const hero =
    soonest?.kind === "task"
      ? soonest.task.dueAt !== null
        ? soonest
        : undefined
      : soonest?.kind === "exam" &&
          soonest.part &&
          soonest.part.kind !== "window" &&
          soonest.part.at !== null &&
          (soonest.late || soonest.part.at > now) &&
          !soonest.sittings
        ? soonest
        : undefined;
  if (!todo) lines.push({ type: "loading", key: "loading" });
  else if (show === "done") {
    if (doneCount === 0) lines.push({ type: "empty", key: "empty", title: t("tasks.noneDone"), showAll: false, done: true });
    else lines.push(...doneLines(done, todo.exams, t));
  } else {
    // The first words under the counts: nothing runs out today (when something does, its group "Hari ini" says so; with
    // something late, "Terlambat" leads and good news would ring false).
    const dueToday = groups.some((group) => group.group === "today" && group.items.some(todoCounted));
    if (!nothingToDo && !dueToday && groups[0]?.group !== "overdue") lines.push({ type: "today", key: "today", title: t("mobile.tasks.todayNone") });
    if (during.length) lines.push(...groupLines(during), { type: "gap", key: "gap-during" });
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
      if (rest.length) lines.push(...groupLines(rest));
    } else
      for (const group of groups) {
        lines.push({
          type: "heading",
          key: `tasks-${group.group}`,
          // No count beside a group: Belum selesai's says how many, and the rows are right under it.
          title: t(group.title),
          first: lines.length === 0,
        });
        const under = groupLines(group.items, group === heroGroup ? hero : undefined);
        // The gap under the big card only when its group goes on with a row: a sub-heading or the next group brings its own.
        if (hero && group === heroGroup)
          lines.push({ type: "hero", key: `hero:${hero.key}`, item: hero }, ...(isRow(under[0]) ? [{ type: "gap", key: "gap-hero", size: 3 } as const] : []));
        lines.push(...under);
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
  const sixOut = useSourceState("six") === "signed-out";
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
  const { page } = useB();
  const view = useMemo(() => tasksView(t, todo, courses, course, show, sixOut), [t, todo, courses, course, show, sixOut]);
  if (putOffOpen && !view.hasPutOff) setPutOffOpen(false);
  const listed = usePart(1);
  const chips = usePart(2);
  const ahead = useDrawAhead();
  const first = FIRST_LINES[chips ? 2 : 1];
  const count = useLinesShown(view.lines.length, first);
  const lines = useMemo(() => (count >= view.lines.length ? view.lines : view.lines.slice(0, count)), [count, view.lines]);

  const header = (
    <Header
      show={show}
      onShow={setShow}
      openCount={view.openCount}
      doneCount={view.doneCount}
      courses={chips ? view.withItems : NO_COURSES}
      course={course}
      onCourse={setCourse}
    />
  );
  const togglePutOff = useCallback(() => setPutOffOpen((open) => !open), []);
  const showAll = useCallback(() => setCourse(null), [setCourse]);
  const renderItem = useCallback(
    // Only the "ditunda" line hears of it opening: every other row stays as drawn.
    ({ item: line }: { item: Line }) => <LineView line={line} putOffOpen={line.type === "putOff" && putOffOpen} onPutOff={togglePutOff} onShowAll={showAll} />,
    [putOffOpen, togglePutOff, showAll],
  );

  return (
    <View testID="screen.tasks" style={{ flex: 1, backgroundColor: page }}>
      <BTabHeader title={t("nav.tasks")} />
      {listed && <View style={{ paddingHorizontal: space[4] }}>{header}</View>}
      <TaskRowWorld>
        {listed && (
          // One filter's list becoming the other's: the old goes, the new fades in (the counts over it stay put).
          <CrossFade id={show} style={{ flex: 1 }}>
            <FlashList
              ref={list}
              data={lines}
              keyExtractor={(line) => line.key}
              getItemType={lineType}
              extraData={putOffOpen}
              renderItem={renderItem}
              {...ahead}
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
          </CrossFade>
        )}
      </TaskRowWorld>
    </View>
  );
}

/** No chips yet (Tugas's first part). */
const NO_COURSES: readonly TermCourse[] = [];

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
    <View style={{ paddingTop: space[2], paddingBottom: space[4] }}>
      <RowProblemBanner />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <View style={{ flex: 1, minWidth: 0 }} accessibilityRole="tablist" accessibilityLabel={t("tasks.show")} testID="segment.show">
          <ShowCounts show={show} onShow={onShow} openCount={openCount} doneCount={doneCount} />
        </View>
        {courses.length > 1 && <CourseFilter courses={courses} course={course} onCourse={onCourse} />}
      </View>
    </View>
  );
});

/**
 * Belum selesai and Selesai as counts to tap (direction B, the official app's logbook numbers): the number big, what it
 * counts under it, the one shown in the app's blue with a bar under it.
 */
function ShowCounts({
  show,
  onShow,
  openCount,
  doneCount,
}: {
  show: "open" | "done";
  onShow: (show: "open" | "done") => void;
  openCount: number | undefined;
  doneCount: number | undefined;
}) {
  const t = useT();
  const b = useB();
  // The bar under the picked count slides to the other one: the Student sees where they went.
  const mark = useSlidingMark(show);
  const cells = [
    { value: "open" as const, label: t("tasks.filter.open"), count: openCount },
    { value: "done" as const, label: t("tasks.filter.done"), count: doneCount },
  ];
  return (
    <View style={{ flexDirection: "row", gap: space[6] }}>
      {cells.map((cell) => {
        const picked = cell.value === show;
        return (
          <View key={cell.value} onLayout={mark.measure(cell.value)}>
            <PressScale
              onPress={() => onShow(cell.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: picked }}
              accessibilityLabel={cell.count === undefined ? cell.label : `${cell.label}, ${cell.count}`}
              testID={`segment.show.${cell.value}`}
              style={{ minHeight: 48, justifyContent: "center", paddingBottom: 7 }}
            >
              {/* A tab and how many are in it: the word leads, the count quiet after it, one size (never a big figure that
                  reads as a countdown beside the lead card's date). */}
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text size="titleMedium" face="display" weight={picked ? "bold" : "medium"} style={{ color: picked ? b.fg : b.muted }}>
                  {cell.label}
                </Text>
                {cell.count !== undefined && (
                  <Text size="bodyLarge" weight="medium" tabular style={{ color: b.muted }}>
                    {String(cell.count)}
                  </Text>
                )}
              </View>
            </PressScale>
          </View>
        );
      })}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", bottom: 4, height: 3, borderRadius: 2, backgroundColor: b.brand }, mark.style]} />
    </View>
  );
}

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
        android_ripple={{ color: c.selected, borderless: false }}
        style={({ pressed }) => [
          {
            // An icon button, as the top bar's search and bell over it: no outline at rest; the picked course's tile on a
            // tonal fill once one is picked.
            height: 48,
            minWidth: 48,
            paddingHorizontal: picked ? space[3] : 0,
            borderRadius: 24,
            backgroundColor: picked ? c.secondaryContainer : undefined,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space[2],
            overflow: "hidden",
          },
          iosPressed(pressed),
        ]}
      >
        <Icons.Filter size={24} weight={picked ? "fill" : "regular"} color={picked ? c.onSecondaryContainer : c.onSurfaceVariant} />
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

/** On Tugas a row is flat on the page, a hairline between two (both themes alike); on a course's page, a tile of its tonal list. */
function Slice({ first, last, inCourse, children }: Place & { inCourse: boolean; children: ReactNode }) {
  return inCourse ? (
    <CardRow first={first} last={last}>
      {children}
    </CardRow>
  ) : (
    <FlatSlice first={first}>{children}</FlatSlice>
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
  const b = useB();
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
    case "periodHead":
      return <PeriodHead item={line.item} />;
    case "periodFold":
      return <PeriodFold item={line.item} />;
    case "periodExam":
      return (
        <FlatSlice first={line.first}>
          <PeriodExam exam={line.exam} />
        </FlatSlice>
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
    case "today":
      // Good news is a mark and a word: nothing runs out today.
      return (
        <View testID="tasks.today" style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginLeft: space[1], minHeight: 24 }}>
          <Icons.CheckCircle size={20} weight="fill" color={b.ok} />
          <Text size="bodyLarge" weight="medium" style={{ flexShrink: 1, color: b.fg }}>
            {line.title}
          </Text>
        </View>
      );
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
      // The list's own shape while it's on its way: a title, the nearest deadline's card, three flat rows led by their day.
      <View accessibilityState={{ busy: true }} accessibilityLabel={t("mobile.tasks.loading")}>
        <View style={{ paddingHorizontal: space[1], marginBottom: space[3] }}>
          <Skeleton width={120} height={20} />
        </View>
        <View style={{ height: 88, borderRadius: 20, backgroundColor: theme.v4.chip, marginBottom: space[3] }} />
        {[0, 1, 2].map((i) => (
          <FlatSlice key={i} first={i === 0}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[1], paddingVertical: space[3], minHeight: 68 }}>
              <View style={{ width: 40, alignItems: "center", gap: 4 }}>
                <Skeleton width={26} height={22} />
                <Skeleton width={22} height={10} />
              </View>
              <View style={{ flex: 1, gap: space[2] }}>
                <Skeleton width="70%" height={16} />
                <Skeleton width="45%" height={12} />
              </View>
            </View>
          </FlatSlice>
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
