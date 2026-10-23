// Tugas & Ujian: every Task of the term with its true status (#72), and the
// Task page with handing in (#73). A Task's status is worked out from Edunex's
// own facts at this moment (a deadline passing changes it), never from a
// draft's timestamps. Handing in writes only on the Student's clicks, and
// before it the page checks what it could cost: the attendance window the
// hand-in counts for, the deadline, the connection, the file asked for.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type DragEvent, lazy, type ReactNode, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { answerFileProblem, type HandInResult, type PickedFile } from "../../core/actions/tasks";
import { attendanceWindow, type CountedIn, presenceOptional } from "../../core/attendance";
import { introModule } from "../../core/course-materials";
import { activeDone, taskDoneKey, taskPutAway } from "../../core/done";
import type { Exam } from "../../core/exams";
import type { DoneHow, Task, TaskFile, TaskModule, TaskStatus } from "../../core/models";
import type { StringKey } from "../../core/strings";
import {
  attendanceResult,
  attendanceSession,
  editedAfterSubmit,
  edunexTaskUrl,
  type HandInCheck,
  handInChecks,
  isOpenStatus,
  matchesNaming,
  moduleName,
  namingPattern,
  notOpenYet,
  requiredFileType,
  shortWindow,
  submittedAt,
  takesAnswers,
  taskHistory,
  taskStatus,
} from "../../core/tasks";
import { lateSnoozable, type TodoGroup, type TodoItem, todoCount, todoCounted, todoForCourse, todoGroup } from "../../core/todo";
import { answerShape, editableInApp } from "../answer-html";
import { useAttendance } from "../attendance";
import { ActionError, errorKey } from "../bridge";
import { type TermCourse, useCourseColor, useTermCourses } from "../courses";
import { useOpenExternal } from "../hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../i18n";
import { LecturerHtml } from "../lecturer-html";
import { type Route, useNav } from "../nav";
import { OpenFile, useDownloadedToast, useLocalCopy } from "../open-file";
import { canView, isPdfName, useAnswerAttach, usePdfViewer } from "../pdf";
import { type Todo, useExams, useTodo } from "../schedule-data";
import { isBuilt } from "../shell/built";
import { useRefresh, useSignIn } from "../shell/source-status";
import { canSnooze, refocus, SnoozeMenu } from "../snooze-menu";
import { useDone, useSnoozes } from "../snoozes";
import { useBridge, useDataset, useStatus } from "../store";
import { Button, Segmented, useRadioKeys } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card, CourseDot, EmptyState, ProgressBar, Skeleton, StatusChip, StatusGlyph, Tag } from "../ui/display";
import { Icons } from "../ui/icons";
import { factsLabel, List, Row as ListRow, Meta, Page, PageHeader, Section } from "../ui/layout";
import { Menu } from "../ui/menu";
import { PresenceList } from "../ui/motion/presence-list";
import { ignoreClosingClick, PANEL_MOTION_CLASS, SCRIM_CLASS, toast, useReturnFocus } from "../ui/overlays";
import type { RichEditorHandle } from "../ui/rich-editor";
import { plainText } from "../ui/rich-text";
import { ExamPartRow, PastExamRow, PeriodRow, takeHomeWhy } from "./exam";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface Row {
  task: Task;
  status: TaskStatus;
}

/** A course's name and color, for a row's "course · module" line. */
function useCourse(code: string): TermCourse | undefined {
  return useTermCourses()?.find((course) => course.code === code);
}

/** Where a course's attendance counts: where SIX counts, a Task's attendance window is optional. */
function useCountedIn(code: string): CountedIn | undefined {
  return useAttendance()?.courses.find((entry) => entry.course.code === code)?.health.countedIn;
}

// ---------------------------------------------------------------- Tugas & Ujian

const GROUPS: { group: TodoGroup; title: StringKey }[] = [
  { group: "overdue", title: "tasks.group.overdue" },
  { group: "thisWeek", title: "tasks.group.thisWeek" },
  { group: "nextWeek", title: "tasks.group.nextWeek" },
  { group: "later", title: "tasks.group.later" },
  { group: "undated", title: "tasks.group.undated" },
];

// The course filter the Student last chose, kept while the app runs (per window).
const lastCourse = new WeakMap<object, string | null>();

/**
 * Everything still ahead in one list, ordered by the moment each runs out
 * (a Task's deadline, a sitting's start, an Edunex window's close), with no
 * section of exams pulled out of order; an exam period whose exams have no
 * day yet is one quiet line where it falls, on top while it's on. Done holds
 * what's handed in, the exams behind the Student and what closed.
 *
 * `show`: "done" while Selesai is picked, kept in its place in history (nav.replace), so Back comes back to it.
 */
export function TasksScreen({ show: shown }: { show?: "done" }) {
  const t = useT();
  const todo = useTodo();
  const courses = useTermCourses();
  const bridge = useBridge();
  const { replace } = useNav();
  const show = shown ?? "open";
  const setShow = (next: "open" | "done") => replace(next === "done" ? { screen: "tasks", show: "done" } : { screen: "tasks" });
  const [course, setCourseState] = useState<string | null>(lastCourse.get(bridge) ?? null);
  const setCourse = (value: string | null) => {
    lastCourse.set(bridge, value);
    setCourseState(value);
  };

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
  // An exam period going on sits on top: everything this week happens inside it.
  const during = items.filter((item) => item.kind === "period" && item.state === "during");
  const rest = items.filter((item) => !during.includes(item));
  // Late rows put off ("Ingatkan nanti") are out of the list and its counts; Terlambat says how many, and shows them.
  const putOff = (todo?.putOff ?? []).filter(({ item }) => mine(item.course ?? ""));
  const groups = GROUPS.map(({ group, title }) => ({ group, title, items: rest.filter((item) => todoGroup(item, now) === group) })).filter(
    (group) => group.items.length > 0 || (group.group === "overdue" && putOff.length > 0),
  );
  // Never "nothing to do" while something is only put off.
  const nothingToDo = !rest.some(todoCounted) && putOff.length === 0;
  // Signed out of SIX, only Edunex's exams are known: said once, at the end of the list, with the way to SIX's timetable.
  const examsNoSix = useStatus("six").state === "signed-out" && show === "open" && course === null;
  // Courses with something in either segment, for the filter.
  const codes = new Set([
    ...(todo?.items ?? []).map((item) => item.course),
    ...(todo?.exams ?? []).map((exam) => exam.courseCode),
    ...[...(todo?.done.handedIn ?? []), ...(todo?.done.closed ?? []), ...(todo?.done.notHandingIn ?? [])].map((task) => task.courseCode),
  ]);
  const withItems = (courses ?? []).filter((c) => codes.has(c.code));
  // One radio group: "Semua" (null) first, then each course; arrows move the pick, a second click keeps it.
  const radio = useRadioKeys([null, ...withItems.map((c) => c.code)], course, setCourse);

  return (
    <Page>
      <PageHeader
        title={t("nav.tasks")}
        actions={
          <Segmented
            label={t("tasks.show")}
            value={show}
            onChange={setShow}
            options={[
              { value: "open", label: todo ? `${t("tasks.filter.open")} ${todoCount(items)}` : t("tasks.filter.open") },
              { value: "done", label: todo ? `${t("tasks.filter.done")} ${doneCount}` : t("tasks.filter.done") },
            ]}
          />
        }
        className="mb-5"
      />

      {withItems.length > 1 && (
        <div role="radiogroup" aria-label={t("tasks.filter.course")} className="mb-8 flex flex-wrap gap-1.5">
          <FilterChip radio={radio(0)}>{t("tasks.filter.all")}</FilterChip>
          {withItems.map((c, i) => (
            <FilterChip key={c.code} radio={radio(i + 1)}>
              <CourseDot color={c.color} className="size-2" />
              {c.code}
            </FilterChip>
          ))}
        </div>
      )}

      {!todo ? (
        <NoTasksYet />
      ) : show === "done" ? (
        doneCount === 0 ? (
          <EmptyState icon={<Icons.CheckCircle className="size-5" />} title={t("tasks.noneDone")} />
        ) : (
          <DoneGroups done={done} exams={todo.exams} />
        )
      ) : (
        <>
          {during.length > 0 && (
            <List label={t("exams.title")} className="mb-10">
              {during.map((item) => (
                <TodoRow key={item.key} item={item} />
              ))}
            </List>
          )}
          {nothingToDo ? (
            <>
              <EmptyState
                icon={<Icons.CheckCircle className="size-5" />}
                title={course !== null ? t("tasks.noneForCourse", { code: course }) : t("tasks.empty.title")}
                description={course === null ? t("tasks.empty.hint") : undefined}
              >
                {course !== null && (
                  <Button size="sm" onClick={() => setCourse(null)}>
                    {t("tasks.showAll")}
                  </Button>
                )}
              </EmptyState>
              {/* What's still to know though nothing is to do: an exam period ahead, an exam with no date. */}
              {rest.length > 0 && (
                <List label={t("exams.title")} className="mt-6">
                  {rest.map((item) => (
                    <TodoRow key={item.key} item={item} />
                  ))}
                </List>
              )}
            </>
          ) : (
            groups.map((group) => (
              <Section key={group.group} id={`tasks-${group.group}`} title={t(group.title)} count={todoCount(group.items) || undefined}>
                {group.items.length > 0 && (
                  <List label={t(group.title)}>
                    {/* A row put off fades out, and focus moves on to the next (or to "ditunda" under them). */}
                    <PresenceList>
                      {group.items.map((item) => (
                        <TodoRow key={item.key} item={item} />
                      ))}
                    </PresenceList>
                  </List>
                )}
                {group.group === "overdue" && <PutOff putOff={putOff} />}
              </Section>
            ))
          )}
          {examsNoSix && <ExamsNoSix />}
        </>
      )}
    </Page>
  );
}

/** A row's id, so focus can come back to it (a late Task brought back from what's put off). */
const todoRowId = (key: string) => `todo-${key}`;

/** The Task a late row is about, for its name: a Task, or an exam's take-home. */
const lateTitle = (item: TodoItem) =>
  item.kind === "task" ? item.task.title : item.kind === "exam" && item.part?.kind === "takehome" ? item.part.task.title : "";

/**
 * A row of the one list, whatever it is: a Task, an exam's part, an exam
 * period. A late one can be put off ("Ingatkan nanti") as on Beranda, the
 * same snooze for the same Task.
 */
export function TodoRow({ item, inCourse = false }: { item: TodoItem; inCourse?: boolean }) {
  const now = useNow();
  const late = lateSnoozable(item, now);
  const snooze = late && canSnooze(late, now) ? <SnoozeMenu item={late} name={lateTitle(item)} /> : undefined;
  const id = todoRowId(item.key);
  if (item.kind === "task")
    return <TaskRow task={item.task} status={item.status} meta={inCourse ? "module" : "course"} late={item.late} id={id} actions={snooze} />;
  if (item.kind === "period") return <PeriodRow item={item} inCourse={inCourse} />;
  return <ExamPartRow item={item} inCourse={inCourse} id={id} actions={snooze} />;
}

/** "1 ditunda · Tampilkan" under the late rows, as on Beranda: quiet, opening what's put off, each with Ingatkan sekarang. */
export function PutOff({ putOff }: { putOff: Todo["putOff"] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // Closed once nothing is put off, so the next snooze doesn't find the list open.
  if (open && !putOff.length) setOpen(false);
  if (!putOff.length) return null;
  return (
    <>
      <div className="mt-2.5 px-1">
        <Meta className="text-small text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Icons.Snooze className="size-3.5 shrink-0 text-faint" />
            {t("snooze.count", { count: putOff.length })}
          </span>
          <button
            type="button"
            data-snoozed=""
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="focus-ring rounded font-medium text-accent-fg hover:underline"
          >
            {open ? t("snooze.hideList") : t("snooze.showList")}
          </button>
        </Meta>
      </div>
      {open && (
        <List label={t("snooze.list")} className="mt-2.5">
          {putOff.map(({ item, entry }) => (
            <PutOffRow key={item.key} item={item} entry={entry} />
          ))}
        </List>
      )}
    </>
  );
}

/** A late Task put off: what it is, when it's back, and the way to bring it back now. */
function PutOffRow({ item, entry }: Todo["putOff"][number]) {
  const t = useT();
  const f = useFormat();
  const { wake } = useSnoozes();
  const title = lateTitle(item);
  const when = f.dueLabel(entry.until);
  const wakeNow = (button: HTMLElement) => {
    const row = button.closest("li");
    const sibling = (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLElement>("button");
    void wake(entry.id).catch((error: unknown) => toast(t(errorKey(error)), "danger"));
    // Its row leaves with the button: on to the next thing put off, else to the Task, back in the list.
    refocus(() => sibling ?? document.getElementById(todoRowId(item.key)));
  };
  return (
    <ListRow
      title={title}
      meta={
        <Meta>
          {item.course ?? ""}
          {entry.reason === "change" ? t("snooze.untilChange", { when }) : t("snooze.until", { when })}
        </Meta>
      }
      trailing={
        <Button size="sm" variant="ghost" aria-label={t("snooze.wakeFor", { title })} onClick={(event) => wakeNow(event.currentTarget)}>
          {t("snooze.wake")}
        </Button>
      }
    />
  );
}

/** Done: handed in, past exams, closed; each newest first. A take-home keeps its exam's look. */
export function DoneGroups({ done, exams, inCourse = false }: { done: Todo["done"]; exams: readonly Exam[]; inCourse?: boolean }) {
  const t = useT();
  const now = useNow();
  const examOf = (task: Task) => exams.find((exam) => exam.tasks.some((item) => item.id === task.id));
  const meta = inCourse ? "module" : "course";
  const sections = [
    { id: "submitted", title: "tasks.group.submitted" as const, count: done.handedIn.length },
    // The Student said they won't hand it in (on its page): no longer to do, though Edunex still takes it.
    { id: "notHandingIn", title: "tasks.group.notHandingIn" as const, count: done.notHandingIn.length },
    { id: "pastExams", title: "tasks.group.pastExams" as const, count: done.pastExams.length },
    { id: "closed", title: "tasks.group.closed" as const, count: done.closed.length },
  ].filter((section) => section.count > 0);
  return (
    <>
      {sections.map((section) => (
        <Section key={section.id} id={`${inCourse ? "course" : "tasks"}-${section.id}`} title={t(section.title)} count={section.count}>
          <List label={t(section.title)}>
            <PresenceList>
              {section.id === "pastExams"
                ? done.pastExams.map((past) => <PastExamRow key={past.exam.id} past={past} inCourse={inCourse} />)
                : (section.id === "submitted" ? done.handedIn : section.id === "notHandingIn" ? done.notHandingIn : done.closed).map((task) => (
                    <TaskRow key={task.id} task={task} status={taskStatus(task, now)} meta={meta} exam={examOf(task)} />
                  ))}
            </PresenceList>
          </List>
        </Section>
      ))}
    </>
  );
}

function FilterChip({ radio, children }: { radio: ReturnType<ReturnType<typeof useRadioKeys>>; children: ReactNode }) {
  return (
    <button
      type="button"
      {...radio}
      className={cx(
        "focus-ring inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-small font-medium transition-colors duration-150",
        radio["aria-checked"] ? "border-transparent bg-selected text-fg" : "border-edge text-muted hover:bg-hover hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

/** At the end of the list, without SIX: SIX's exam timetable is missing, and the one way to get it. */
function ExamsNoSix() {
  const t = useT();
  const { signIn, busy } = useSignIn();
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-small text-muted">{t("tasks.examsNoSix")}</p>
      <Button size="sm" busy={busy} onClick={() => void signIn("six")}>
        {t("action.signInTo", { source: "SIX" })}
      </Button>
    </div>
  );
}

/** Before the first Task list has arrived: placeholders while it's on its way, else why it isn't. */
function NoTasksYet() {
  const t = useT();
  const status = useStatus("edunex");
  const { refresh, busy } = useRefresh();
  if (status.state === "connecting" || status.state === "live")
    return (
      <Card aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cx("flex items-center gap-4 px-4 py-3.5", i > 0 && "border-t border-line")}>
            <div className="flex-1">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="mt-2 h-3 w-2/5" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </Card>
    );
  return (
    <EmptyState icon={<Icons.ListChecks className="size-5" />} title={t("tasks.unavailable")}>
      {status.state !== "expired" && status.state !== "signed-out" && (
        <Button size="sm" busy={busy} onClick={() => void refresh("edunex")}>
          {t("action.tryAgain")}
        </Button>
      )}
    </EmptyState>
  );
}

/** Statuses worth a chip in a list: the rest are said by the segment and the date. */
const LOUD: readonly TaskStatus[] = ["draft", "overdue", "in_review"];

/** Tasks as rows, each opening its page; on a course page the course itself goes without saying. */
export function TaskRows({ tasks, meta = "course", label }: { tasks: readonly Task[]; meta?: "course" | "module" | "none"; label?: string }) {
  const now = useNow();
  return (
    <List label={label}>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} status={taskStatus(task, now)} meta={meta} />
      ))}
    </List>
  );
}

/**
 * A Task as a row, opening its page. Under "Terlambat" the heading says it's
 * late (no chip on every row), and the row says it's still taken. A take-home
 * in Done keeps its exam's look: the tag, the course, "Take-home".
 */
function TaskRow({
  task,
  status,
  meta = "course",
  late = false,
  exam,
  id,
  actions,
}: Row & { meta?: "course" | "module" | "none"; late?: boolean; exam?: Exam; id?: string; actions?: ReactNode }) {
  const t = useT();
  const { go } = useNav();
  const course = useCourse(task.courseCode);
  const module = moduleLabel(t, task.module);
  const chip = LOUD.includes(status) && !(late && status === "overdue");
  return (
    <ListRow
      id={id}
      onClick={() => go({ screen: "task", taskId: task.id })}
      actions={actions}
      title={
        exam ? (
          <span className="flex min-w-0 items-center gap-2">
            <Tag>{t(`exam.kind.${exam.kind}`)}</Tag>
            <span className="truncate">{course?.name ?? exam.courseCode}</span>
          </span>
        ) : (
          task.title
        )
      }
      meta={
        exam ? (
          <Meta truncate>
            {meta === "course" ? <CourseCodeMark task={task} /> : ""}
            {t("exam.takeHome")}
            {task.title}
          </Meta>
        ) : meta === "course" ? (
          <Place task={task} />
        ) : meta === "module" && module ? (
          <Meta>{module}</Meta>
        ) : undefined
      }
      trailing={
        <span className="flex items-center gap-4">
          {chip && <StatusChip status={status} />}
          <TaskDate task={task} status={status} />
        </span>
      }
    >
      {late && <span className="mt-1 block text-small text-muted">{t("home.need.task.overdue")}</span>}
      <Signal task={task} status={status} />
      <span className="sr-only">{!chip && !late && t(`taskStatus.${status}`)}</span>
    </ListRow>
  );
}

/**
 * The list's one date column, for a deadline: its day and time over how
 * long until it (dropped when it only says the day again: "Besok"); amber
 * within a day, red once late.
 */
export function DueWhen({ at, late, under }: { at: number; late: boolean; under?: string }) {
  const f = useFormat();
  const now = useNow();
  const soon = !late && at > now && at - now < DAY;
  const repeats = under === undefined && Math.abs(f.dayOffset(at)) === 1 && Math.abs(at - now) >= DAY;
  return (
    <span className={cx("w-[136px] text-right text-small whitespace-nowrap tabular-nums", late ? "text-danger-fg" : soon && "text-warning-fg")}>
      <span className="block font-medium">{f.dueLabel(at)}</span>
      {!repeats && <span className={cx("block", !late && !soon && "text-faint")}>{under ?? f.fromNow(at)}</span>}
    </span>
  );
}

/** "Jum, 16 Okt, 23:59 / dalam 8 hari": amber within a day, red once late; "Dikumpulkan 24 Sep" once handed in. */
export function TaskDate({ task, status }: Row) {
  const t = useT();
  const f = useFormat();
  const sentAt = submittedAt(task);
  if (sentAt !== null)
    return (
      <span className="w-[136px] text-right text-small whitespace-nowrap tabular-nums">
        <span className="block font-medium">
          {task.score !== null ? t("task.scoreValue", { score: formatScore(task.score, f) }) : t("task.submittedOnDate", { date: f.dayMonth(sentAt) })}
        </span>
        {task.score !== null && <span className="block text-faint">{t("task.submittedOnDate", { date: f.dayMonth(sentAt) })}</span>}
      </span>
    );
  if (task.dueAt === null) return <span className="w-[136px] text-right text-small whitespace-nowrap text-faint">{t("task.noDeadline")}</span>;
  return <DueWhen at={task.dueAt} late={status === "overdue" || status === "closed"} under={status === "closed" ? t("task.notHandedIn") : undefined} />;
}

/** "● DK4073": the course's code with its dot. */
function CourseCodeMark({ task }: { task: Task }) {
  const color = useCourseColor()(task.courseCode);
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-fg/80">
      <CourseDot color={color} className="size-2" />
      {task.courseCode}
    </span>
  );
}

/** "● II4091 · Modul 5 · Tugas": the course and module, as Edunex lays the course out. */
function Place({ task }: { task: Task }) {
  const t = useT();
  const course = useCourse(task.courseCode);
  const color = useCourseColor()(task.courseCode);
  const where = moduleLabel(t, task.module) ?? course?.name ?? null;
  return (
    <Meta truncate>
      <span className="inline-flex items-center gap-1.5 font-medium text-fg/80">
        <CourseDot color={color} className="size-2" />
        {task.courseCode}
      </span>
      {where}
    </Meta>
  );
}

function moduleLabel(t: Translate, module: TaskModule | null): string | null {
  if (!module) return null;
  const name = moduleName(module);
  return factsLabel(t("task.module", { n: module.index }), name);
}

/**
 * At most one thing Edunex's list doesn't say, the one that changes what to
 * do: changed after the Student handed in, attendance taken by handing in, a
 * short window, not open yet.
 */
function Signal({ task, status }: Row) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const presence = useDataset("edunex.presence");
  const { entries: handled } = useDone();
  const optional = presenceOptional(useCountedIn(task.courseCode));
  let signal: ReactNode = null;
  const window = isOpenStatus(status) ? attendanceWindow(task, presence, now) : null;
  // What the Student marked on its page: Edunex still says it's to do, so the list says why it isn't.
  const marked = isOpenStatus(status) ? taskPutAway(task, handled) : undefined;
  if (marked)
    signal = (
      <span>
        <Icons.Check className="size-3.5 shrink-0" weight="bold" />
        {t(`task.marked.${marked.how as MarkedHow}`)}
      </span>
    );
  // Not once checked ("Sudah kucek" on Beranda).
  else if (editedAfterSubmit(task) && task.editedAt !== null && !activeDone(taskDoneKey(task, "edited"), handled))
    signal = (
      <span className="font-medium text-warning-fg">
        <Icons.PenLine className="size-3.5 shrink-0" />
        <Meta>{t("task.editedAfterSubmitLine", { date: f.dayMonth(task.editedAt) })}</Meta>
      </span>
    );
  else if (window)
    signal = (
      <span>
        <Icons.Hand className="size-3.5" />
        {t(optional ? "task.attendanceLineOptional" : "task.attendanceLine", {
          when: `${f.relativeDay(window.opensAt)} ${f.timeRange(window.opensAt, window.closesAt)}`,
        })}
      </span>
    );
  else if (task.opensAt !== null && notOpenYet(task, now)) signal = <span>{t("task.opens", { when: f.dueLabel(task.opensAt) })}</span>;
  else if (shortWindow(task) !== null && task.opensAt !== null && task.dueAt !== null)
    signal = (
      <span>
        <Icons.Zap className="size-3.5" />
        <Meta>
          {t("task.shortWindow")}
          {f.timeRange(task.opensAt, task.dueAt)}
        </Meta>
      </span>
    );
  if (!signal) return null;
  return <span className="mt-1 flex text-small text-muted [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5">{signal}</span>;
}

function formatScore(score: number, f: Format): string {
  return Number.isInteger(score) ? String(score) : f.number(score, 2).replace(/[.,]?0+$/, "");
}

// ---------------------------------------------------------------- the Task page

export function TaskScreen({ taskId }: { taskId: number }) {
  const t = useT();
  const { go } = useNav();
  const tasks = useDataset("edunex.tasks");
  const task = tasks?.find((item) => item.id === taskId);
  if (task) return <TaskPage task={task} />;
  return (
    <Page>
      {tasks ? (
        <EmptyState icon={<Icons.ListChecks className="size-5" />} title={t("task.notFound")}>
          <Button size="sm" onClick={() => go({ screen: "tasks" })}>
            {t("task.backToTasks")}
          </Button>
        </EmptyState>
      ) : (
        <NoTasksYet />
      )}
    </Page>
  );
}

function TaskPage({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const color = useCourseColor()(task.courseCode);
  const exam = useExams()?.find((e) => e.tasks.some((item) => item.id === task.id));
  const status = taskStatus(task, now);
  const late = status === "overdue" || status === "closed";
  const soon = !late && isOpenStatus(status) && task.dueAt !== null && task.dueAt - now < DAY;
  const where = moduleLabel(t, task.module);
  // The way up, part by part: the course opens as the sidebar opens it; its module opens on that module, the way a search for it does.
  const linked = isBuilt({ screen: "course", code: task.courseCode });
  const crumb = (route: Route, children: ReactNode, className?: string) =>
    linked ? (
      <button type="button" onClick={() => go(route)} className={cx("focus-ring flex items-center gap-1.5 rounded hover:text-fg", className)}>
        {children}
      </button>
    ) : (
      <span className={cx("flex items-center gap-1.5", className)}>{children}</span>
    );

  return (
    <Page width="wide" className="grid gap-10 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
      <article className="min-w-0">
        <p className="flex max-w-full items-center gap-1.5 text-small font-medium text-muted">
          {crumb(
            { screen: "course", code: task.courseCode },
            <>
              <CourseDot color={color} className="size-2" />
              <span className="font-semibold">{task.courseCode}</span>
            </>,
            "shrink-0",
          )}
          {where && (
            <>
              <Icons.ChevronRight className="size-3 shrink-0" />
              {crumb(
                { screen: "course", code: task.courseCode, tab: "modules", module: task.moduleId ?? introModule(task.courseId) },
                <Meta truncate>{where}</Meta>,
                "min-w-0",
              )}
            </>
          )}
        </p>
        <h1 className="mt-2 text-display leading-tight font-semibold tracking-[-0.02em] text-balance">{task.title}</h1>
        {/* One line of facts; once the Task is open, when it opened is history (Riwayat says it). */}
        <Meta className="mt-2.5 text-body text-muted">
          {task.dueAt !== null ? (
            // Red once late; amber while it's due within a day.
            <span className={cx("inline-flex items-center gap-1.5 font-medium", late ? "text-danger-fg" : soon ? "text-warning-fg" : "text-fg")}>
              <Icons.Clock className="size-3.5 shrink-0" />
              {t("task.due", { when: f.dueLabel(task.dueAt) })}
            </span>
          ) : (
            t("task.noDeadline")
          )}
          {task.dueAt !== null && <span className={cx(late ? "text-danger-fg" : soon && "text-warning-fg")}>{f.fromNow(task.dueAt)}</span>}
          {isOpenStatus(status) && task.dueAt !== null && (
            <span className={cx(!task.lateAllowed && soon && "text-warning-fg")}>
              {task.lateAllowed ? t("handIn.lateAllowed") : t("handIn.lateNotAllowed")}
            </span>
          )}
          {task.opensAt !== null && notOpenYet(task, now) && (
            <span className="font-medium text-warning-fg">{t("task.opens", { when: f.dueLabel(task.opensAt) })}</span>
          )}
        </Meta>
        {exam && (
          // The exam it's part of, and how the app knows: Edunex files it there, or its name says so.
          <Meta className="mt-3 text-small text-muted">
            <button
              type="button"
              onClick={() => go({ screen: "exam", examId: exam.id })}
              className="focus-ring inline-flex items-center gap-1.5 rounded-md font-medium text-accent-fg hover:underline"
            >
              <Icons.GraduationCap className="size-3.5" />
              {t("task.partOfExam", { kind: t(`exam.kind.${exam.kind}`), code: exam.courseCode })}
              <Icons.ChevronRight className="size-3.5" />
            </button>
            {takeHomeWhy(t, task) ?? ""}
          </Meta>
        )}

        <Notes task={task} />

        <section className="mt-8" aria-labelledby="task-instructions">
          <h2 id="task-instructions" className="mb-2.5 text-title font-semibold">
            {t("task.instructions")}
          </h2>
          {plainText(task.instructions) ? (
            <LecturerHtml html={task.instructions} className="text-lead leading-relaxed" />
          ) : (
            <p className="text-body text-muted">{t("task.noInstructions")}</p>
          )}
        </section>

        {task.files.length > 0 && (
          <section className="mt-8" aria-labelledby="task-files">
            <h2 id="task-files" className="mb-2.5 text-title font-semibold">
              {t("task.lecturerFiles")}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {task.files.map((file) => (
                <li key={file.url}>
                  <LecturerFile file={file} taskId={task.id} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <aside className="space-y-4 self-start min-[1100px]:sticky min-[1100px]:top-6">
        <HandIn key={task.id} task={task} status={status} />
        <History task={task} />
      </aside>
    </Page>
  );
}

/**
 * What Edunex doesn't say on its Task page: attendance taken by handing it in
 * (and, once handed in, whether it counted), a change after the Student
 * handed in (loud, with the way to check), a short window. An edit before the
 * Student handed in is only history. Where the course counts in SIX, the
 * attendance window is optional: said once, calmly, and nothing about it after.
 */
function Notes({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const open = useOpenExternal();
  const presence = useDataset("edunex.presence");
  const optional = presenceOptional(useCountedIn(task.courseCode));
  const sessions = presence?.[task.courseCode] ?? [];
  const notes: { tone: "warning" | "neutral" | "success" | "danger"; icon: ReactNode; text: string; action?: ReactNode }[] = [];
  const range = (opensAt: number, closesAt: number) => `${f.relativeDay(opensAt)}, ${f.timeRange(opensAt, closesAt)}`;
  const result = attendanceResult(task, sessions, now);
  const status = taskStatus(task, now);
  const session = isOpenStatus(status) ? attendanceSession(task, sessions, now) : null;
  if (optional) {
    if (session && session.closesAt > now)
      notes.push({
        tone: "neutral",
        icon: <Icons.Hand className="mt-0.5 size-4 shrink-0" />,
        text: t("task.note.attendanceOptional", {
          date: f.relativeDay(session.opensAt),
          time: f.timeRange(session.opensAt, session.closesAt),
          course: task.courseCode,
        }),
      });
  } else if (result)
    notes.push(
      result.outcome === "counted"
        ? {
            tone: "success",
            icon: <Icons.CheckCircle className="mt-0.5 size-4 shrink-0" />,
            text: t("task.note.attendanceCounted", { when: range(result.session.opensAt, result.session.closesAt) }),
          }
        : {
            tone: "danger",
            icon: <Icons.Hand className="mt-0.5 size-4 shrink-0" />,
            text: t("task.note.attendanceOutside", { when: range(result.session.opensAt, result.session.closesAt) }),
          },
    );
  else if (session && session.closesAt > now)
    notes.push({
      tone: "warning",
      icon: <Icons.Hand className="mt-0.5 size-4 shrink-0" />,
      text: t("task.note.attendance", { date: f.relativeDay(session.opensAt), time: f.timeRange(session.opensAt, session.closesAt) }),
    });
  else if (session && !session.recorded?.present)
    notes.push({
      tone: "neutral",
      icon: <Icons.Hand className="mt-0.5 size-4 shrink-0" />,
      text: t("task.note.attendanceMissed", { when: range(session.opensAt, session.closesAt) }),
    });
  const sentAt = submittedAt(task);
  if (task.editedAt !== null && sentAt !== null && editedAfterSubmit(task))
    notes.push({
      tone: "warning",
      icon: <Icons.PenLine className="mt-0.5 size-4 shrink-0" />,
      text: t("task.note.editedAfterSubmit", { edited: f.dayMonth(task.editedAt), sent: f.dayMonth(sentAt) }),
      action: (
        <Button size="sm" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(edunexTaskUrl(task.id))}>
          {t("action.openInEdunex")}
        </Button>
      ),
    });
  const window = shortWindow(task);
  if (window !== null && task.opensAt !== null && task.dueAt !== null)
    notes.push({
      tone: "neutral",
      icon: <Icons.Zap className="mt-0.5 size-4 shrink-0" />,
      text: t("task.note.shortWindow", {
        duration:
          window >= HOUR ? t("task.duration.hours", { count: Math.round(window / HOUR) }) : t("task.duration.minutes", { count: Math.round(window / MINUTE) }),
        range: f.timeRange(task.opensAt, task.dueAt),
      }),
    });
  if (!notes.length) return null;
  const TONE = {
    warning: "bg-warning-bg text-warning-fg",
    neutral: "bg-fill text-muted",
    success: "bg-success-bg text-success-fg",
    danger: "bg-danger-bg text-danger-fg",
  };
  return (
    <ul className="mt-5 space-y-2">
      {notes.map((note) => (
        <li key={note.text} className={cx("flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-body", TONE[note.tone])}>
          {note.icon}
          <span className="min-w-0 flex-1">{note.text}</span>
          {note.action && <span className="shrink-0 self-center">{note.action}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Downloads a file from Edunex through the browser's download manager, into Downloads; `done`: it's there now. */
function useDownload(done?: () => Promise<void>) {
  const bridge = useBridge();
  const t = useT();
  const downloaded = useDownloadedToast();
  const [busy, setBusy] = useState<string | null>(null);
  const download = async (file: TaskFile) => {
    setBusy(file.url);
    try {
      const { existing } = await bridge.invoke("files.download", { url: file.url, name: shortName(file.name) });
      downloaded(file.url, existing);
      await done?.();
    } catch {
      toast(t("file.downloadFailed", { name: file.name }), "danger");
    } finally {
      setBusy(null);
    }
  };
  return { download, busy };
}

/** A name the download accepts (200 characters at most), its extension kept. */
function shortName(name: string): string {
  if (name.length <= 200) return name;
  const ext = /\.[\w]{1,8}$/.exec(name)?.[0] ?? "";
  return name.slice(0, 200 - ext.length) + ext;
}

/** `taskId`: the Task it's on, whose page on Edunex is the way forward when the file's link stops working. */
export function LecturerFile({ file, taskId }: { file: TaskFile; taskId: number }) {
  const t = useT();
  const local = useLocalCopy(file.url);
  const { download, busy } = useDownload(local.refresh);
  const pdf = usePdfViewer();
  // A PDF, Word document, spreadsheet, slides, text or picture reads in the app (its viewer can download it too); other
  // files download. Once one is on this computer, it opens in an app or shows in its folder from beside it.
  const viewable = canView(file.name);
  const row = (
    <button
      type="button"
      aria-label={t(viewable ? "pdf.viewFile" : "task.download", { name: file.name })}
      onClick={() => (viewable ? pdf.open({ kind: "edunex", url: file.url, name: file.name, edunexUrl: edunexTaskUrl(taskId), taskId }) : void download(file))}
      className="focus-ring flex w-full items-center gap-3 rounded-xl border border-edge bg-surface px-3 py-2.5 text-left shadow-card transition-colors duration-150 hover:bg-hover"
    >
      <FileBadge name={file.name} />
      <span className="line-clamp-2 min-w-0 flex-1 text-body font-medium break-words" title={file.name}>
        {file.name}
      </span>
      {busy ? (
        <Icons.Loader className="size-4 animate-spin text-faint" />
      ) : viewable ? (
        <Icons.Eye className="size-4 text-faint" />
      ) : (
        <Icons.Download className="size-4 text-faint" />
      )}
    </button>
  );
  if (!local.copy) return row;
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">{row}</div>
      <OpenFile url={file.url} copy={local.copy} onChange={() => void local.refresh()} />
    </div>
  );
}

// ---------------------------------------------------------------- handing in

const GLYPH_TONE: Record<TaskStatus, string> = {
  not_started: "text-(--status-not-started-fg)",
  draft: "text-(--status-draft-fg)",
  submitted: "text-(--status-submitted-fg)",
  overdue: "text-(--status-overdue-fg)",
  closed: "text-(--status-closed-fg)",
  in_review: "text-(--status-review-fg)",
};

/** A file the Student attached in this visit, before it's in Edunex's answer. */
interface Attached {
  /** The id main issued for it (or a local one for a file too big to send). */
  key: string;
  name: string;
  size: number;
  state: "waiting" | "uploading" | "uploaded" | "failed";
  file?: TaskFile;
  problem?: StringKey;
}

/** A file Edunex wouldn't take (its kind or size): never sent, so there's nothing to try again, only to remove. */
const refused = (item: Attached) => item.problem === "handIn.tooBig" || item.problem === "handIn.wrongType";

interface Notice {
  tone: "danger" | "warning" | "neutral";
  text: StringKey;
  action?: "signIn" | "edunex";
}

let localKeys = 0;

// The writing box carries an editor the rest of the app never needs: it loads with the hand-in card.
const RichEditor = lazy(() => import("../ui/rich-editor"));

/** Answers the Student changed and hasn't saved, by Student and Task: kept while the app runs, so leaving the page loses nothing. */
const unsavedText = new Map<string, string>();

/**
 * The Student's written answer: what Edunex has (`base`), what's in the box
 * (`text`), and whether they differ. A change on Edunex replaces the box's
 * text only when the Student hasn't changed it; their own change is kept
 * (across leaving the page too) until they save it or discard it.
 */
function useAnswerText(task: Task) {
  const account = useDataset("edunex.account");
  const key = `${account?.nim ?? ""}:${task.id}`;
  const saved = task.answer?.text ?? "";
  const [base, setBase] = useState(saved);
  const [text, setText] = useState(() => unsavedText.get(key) ?? saved);
  // Bumped to load new text into the box (its content isn't controlled).
  const [version, setVersion] = useState(0);
  const textShape = useMemo(() => answerShape(text), [text]);
  const baseShape = useMemo(() => answerShape(base), [base]);
  const dirty = textShape !== baseShape;

  useEffect(() => {
    if (saved === base) return;
    const savedShape = answerShape(saved);
    if (dirty && textShape !== savedShape) return;
    setBase(saved);
    if (textShape !== savedShape) {
      setText(saved);
      setVersion((v) => v + 1);
    }
  }, [saved, base, dirty, textShape]);

  useEffect(() => {
    if (dirty) unsavedText.set(key, text);
    else unsavedText.delete(key);
  }, [dirty, key, text]);

  /** Back to Edunex's text: through the box when it's open, so the cursor stays in it and Undo brings the text back. */
  const discard = (box: RichEditorHandle | null) => {
    unsavedText.delete(key);
    if (box) box.reset(base);
    else setVersion((v) => v + 1);
    setText(base);
  };
  return { text, setText, saved, dirty, discard, version };
}

/** The submission card: status, the Student's answer, attaching files, Save draft and Submit. */
function HandIn({ task, status }: Row) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const bridge = useBridge();
  const open = useOpenExternal();
  const edunex = useStatus("edunex");
  const presence = useDataset("edunex.presence");
  const countedIn = useCountedIn(task.courseCode);
  const { signIn, busy: signingIn } = useSignIn();
  const { refresh, busy: refreshing } = useRefresh();
  const { download, busy: downloading } = useDownload();
  const pdf = usePdfViewer();
  const [attached, setAttached] = useState<Attached[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** Saved or handed in during this visit: the header says so with a little check. */
  const [justDone, setJustDone] = useState(false);
  const uploads = useRef<Promise<void>>(Promise.resolve());

  // Signed in again after the session ended: the way is clear.
  useEffect(() => {
    if (edunex.state === "live") setNotice((current) => (current?.action === "signIn" ? null : current));
  }, [edunex.state]);

  const sent = status === "submitted" || status === "in_review";
  // A group Task is handed in by the group on Edunex's own pages.
  const editable = !task.group && takesAnswers(task, now);
  const answer = useAnswerText(task);
  const box = useRef<RichEditorHandle>(null);
  // A draft written on Edunex with pictures, tables, formulas or text styling (colours, sizes, centring) stays as it is: the box would lose them.
  const textLocked = useMemo(() => Boolean(answer.saved) && !editableInApp(answer.saved), [answer.saved]);
  // Edunex's website takes any text it wrote itself (a picture alone included); what's typed here needs words.
  const hasText = textLocked ? Boolean(answer.saved.trim()) : Boolean(plainText(answer.text));
  const whyId = useId();
  const sentAt = submittedAt(task);
  const saved = (task.answer?.files ?? []).filter((file) => !removed.includes(file.url));
  const uploaded = attached.flatMap((item) => (item.state === "uploaded" && item.file ? [item.file] : []));
  const files = [...saved, ...uploaded];
  const uploading = attached.some((item) => item.state === "waiting" || item.state === "uploading");
  const failed = attached.some((item) => item.state === "failed");
  // As on Edunex's website: text always, and a file when the Task asks for one.
  const hasAnswer = hasText && (files.length > 0 || !task.fileRequired);
  const textChanged = !textLocked && answer.dirty;
  const changed = uploaded.length > 0 || removed.length > 0 || textChanged;
  const guard = handInChecks(task, { now, sessions: presence?.[task.courseCode] ?? [], edunex: edunex.state, files, countedIn });
  // Waiting for the attendance window is the default only once there is something to keep as a draft.
  const wait = guard.waitForWindow && hasAnswer;
  // The one primary button: Kumpulkan, or, when waiting is better, Simpan draf (once there is something new to save).
  const idle = editable && !uploading && !failed && busy === null;
  const canSave = idle && changed && hasAnswer && !guard.blocked;
  const canSubmit = idle && hasAnswer && !guard.blocked;
  const pattern = namingPattern(task.instructions);
  const type = requiredFileType(task.instructions);
  const early = guard.checks.find((check) => check.kind === "attendanceEarly");
  const whenWindow = early ? `${f.relativeDay(early.opensAt)}, ${f.timeRange(early.opensAt, early.closesAt)}` : "";

  const change = (key: string, patch: Partial<Attached>) => setAttached((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  // One upload at a time, in the order the files were attached.
  const upload = (items: Attached[]) => {
    for (const item of items) {
      uploads.current = uploads.current.then(async () => {
        change(item.key, { state: "uploading", problem: undefined });
        try {
          const file = await bridge.invoke("tasks.upload", { fileId: item.key, taskId: task.id });
          change(item.key, { state: "uploaded", file: { name: file.name, url: file.url } });
        } catch (error) {
          // The chip says why; an ended session also shows next to Kumpulkan, with "Masuk lagi".
          change(item.key, { state: "failed", problem: uploadProblem(error) });
        }
      });
    }
  };

  const attach = (picked: PickedFile[]) => {
    const items: Attached[] = picked.map((file) => {
      // What Edunex wouldn't take never goes up: said on its row, with no "try again".
      const problem = answerFileProblem(file.name, file.size);
      return problem
        ? { key: file.id, name: file.name, size: file.size, state: "failed", problem: problem === "size" ? "handIn.tooBig" : "handIn.wrongType" }
        : { key: file.id, name: file.name, size: file.size, state: "waiting" };
    });
    setAttached((list) => [...list, ...items]);
    upload(items.filter((item) => item.state === "waiting"));
  };

  const pick = async () => {
    try {
      attach((await bridge.invoke("tasks.pickFiles", {})).files);
    } catch (error) {
      setNotice(noticeFor(error));
    }
  };

  const drop = async (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!editable) return;
    for (const file of [...event.dataTransfer.files]) {
      if (answerFileProblem(file.name, file.size)) {
        attach([{ id: `local-${++localKeys}`, name: file.name, size: file.size, type: file.type }]);
        continue;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        attach((await bridge.invoke("tasks.dropFiles", { files: [{ name: file.name, type: file.type, bytes }] })).files);
      } catch (error) {
        setNotice(noticeFor(error));
      }
    }
  };

  // A file in the answer opens in the viewer: one on Edunex (saved, or uploaded a moment ago) by its link, with
  // the Task's page as the way out; a PDF still on its way up from its bytes, read by main by the id it gave.
  const preview = (file: TaskFile) => () => pdf.open({ kind: "edunex", url: file.url, name: file.name, edunexUrl: edunexTaskUrl(task.id), taskId: task.id });
  const previewPicked = (item: Attached) => () =>
    pdf.open({
      kind: "bytes",
      name: item.name,
      taskId: task.id,
      load: async () => {
        const read = await bridge.invoke("tasks.readPicked", { fileId: item.key });
        return "problem" in read ? read : read.bytes;
      },
    });

  // A PDF from this Task filled in in the viewer joins the answer as a file, just as one picked from the computer.
  useAnswerAttach(
    task.id,
    editable ? async ({ name, bytes }) => attach((await bridge.invoke("tasks.dropFiles", { files: [{ name, type: "application/pdf", bytes }] })).files) : null,
  );

  const removeSaved = (url: string) => setRemoved((list) => [...list, url]);
  const removeAttached = (key: string) => setAttached((list) => list.filter((item) => item.key !== key));

  const retry = (item: Attached) => {
    change(item.key, { state: "waiting", problem: undefined });
    upload([item]);
  };

  const run = async (kind: "draft" | "submit") => {
    setBusy(kind);
    setNotice(null);
    try {
      // The text goes only when the Student changed it; otherwise Edunex keeps its own, exactly.
      const input = { taskId: task.id, files, ...(textChanged ? { text: answer.text } : {}) };
      const result = await bridge.invoke(kind === "draft" ? "tasks.saveDraft" : "tasks.submit", input);
      settle(kind, result);
    } catch (error) {
      setNotice(noticeFor(error));
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  const settle = (kind: "draft" | "submit", result: HandInResult) => {
    switch (result.outcome) {
      case "saved":
        setAttached([]);
        setRemoved([]);
        setJustDone(true);
        return;
      case "submitted": {
        setAttached([]);
        setRemoved([]);
        const at = result.task ? submittedAt(result.task) : null;
        if (kind === "submit" && at !== null) setJustDone(true);
        else setNotice({ tone: "neutral", text: "handIn.alreadySubmitted" });
        return;
      }
      case "unconfirmed":
        setNotice({ tone: "warning", text: "handIn.unconfirmed", action: "edunex" });
        return;
      case "closed":
        setNotice({ tone: "danger", text: "handIn.closed" });
        return;
      case "not-open":
        setNotice({ tone: "warning", text: "handIn.notOpen" });
        return;
      case "gone":
        toast(t("handIn.gone"), "danger");
    }
  };

  const draftAt = task.answer?.updatedAt ?? task.answer?.createdAt ?? null;
  // Only what the page's header doesn't already say: not started has nothing to add (the deadline and the
  // opening are up there, and a Task not open yet says from when inside this card).
  const subtitle =
    status === "not_started"
      ? ""
      : status === "draft"
        ? draftAt !== null
          ? factsLabel(t("handIn.draftSaved", { when: f.dueLabel(draftAt) }), t("handIn.draftStatus").toLowerCase())
          : t("handIn.draftStatus")
        : status === "overdue"
          ? t("handIn.lateStill")
          : status === "closed"
            ? t("handIn.closedStatus")
            : sentAt !== null
              ? t("handIn.recorded", { when: f.dueLabel(sentAt) })
              : "";
  const submitLabel = status === "overdue" ? t("handIn.submitLate") : t("handIn.submit");
  const inFlight = attached.filter((item) => item.state !== "failed");
  const done = inFlight.filter((item) => item.state === "uploaded").length;

  // Why Kumpulkan can't be pressed, or what pressing it now would cost; with the fix next to it.
  const why: { tone: "warning" | "neutral" | "danger"; text: string; fix?: ReactNode } | null = !editable
    ? null
    : guard.blocked
      ? guard.checks[0].kind === "offline"
        ? {
            tone: "danger",
            text: t("handIn.why.offline"),
            fix: (
              <Button size="sm" busy={refreshing} onClick={() => void refresh("edunex")}>
                {t("action.tryAgain")}
              </Button>
            ),
          }
        : {
            tone: "warning",
            text: t("handIn.why.expired"),
            fix: (
              <Button size="sm" variant="primary" busy={signingIn} onClick={() => void signIn("edunex")}>
                {t("action.signInAgain")}
              </Button>
            ),
          }
      : failed
        ? attached.some((item) => item.state === "failed" && !refused(item))
          ? { tone: "danger", text: t("handIn.why.failed") }
          : { tone: "neutral", text: t("handIn.why.refused") }
        : uploading
          ? { tone: "neutral", text: t("handIn.why.uploading") }
          : !hasText
            ? { tone: "neutral", text: t("handIn.why.noText") }
            : !hasAnswer
              ? { tone: "neutral", text: t("handIn.why.noFile") }
              : early
                ? { tone: "warning", text: t(changed || status === "not_started" ? "handIn.why.early" : "handIn.why.earlySaved", { when: whenWindow }) }
                : null;

  const draftButton = (
    <Button
      variant={wait && canSave ? "primary" : "secondary"}
      className="h-9 flex-1"
      disabled={!canSave}
      busy={busy === "draft"}
      onClick={() => void run("draft")}
    >
      {t("handIn.saveDraft")}
    </Button>
  );
  const submitButton = (
    <Button
      variant={wait ? "secondary" : "primary"}
      className="h-9 flex-[1.4]"
      disabled={!canSubmit}
      busy={busy === "submit"}
      onClick={() => setConfirming(true)}
    >
      {submitLabel}
    </Button>
  );

  return (
    <Card>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <span key={`${status}-${justDone}`} className={cx("shrink-0", GLYPH_TONE[status], justDone && "motion-safe:animate-pop-in")}>
            <StatusGlyph status={status} className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-lead font-semibold">{t(`taskStatus.${status}`)}</p>
            {subtitle && <Meta className="text-small text-muted">{subtitle}</Meta>}
          </div>
          {(task.score !== null || status === "in_review") && (
            <span className="ml-auto text-right text-caption text-muted">
              {t("task.score")}
              <span className="block text-title font-semibold text-fg tabular-nums">{task.score !== null ? formatScore(task.score, f) : "—"}</span>
            </span>
          )}
        </div>

        <div>
          {/* A group's answer is written on Edunex: the label only heads the files already in it. */}
          {(!task.group || saved.length > 0) && <p className="mb-2 text-small font-semibold text-muted">{t("handIn.yourAnswer")}</p>}
          {editable && !textLocked ? (
            <div className="mb-3">
              <Suspense fallback={<Skeleton className="h-[170px] w-full rounded-lg" />}>
                <RichEditor
                  ref={box}
                  key={answer.version}
                  initial={answer.text}
                  onChange={answer.setText}
                  label={t("handIn.yourAnswer")}
                  placeholder={t("handIn.textPlaceholder")}
                  describedBy={whyId}
                />
              </Suspense>
              {textChanged && (
                <p className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 text-caption text-muted">
                  {t("handIn.textUnsaved")}
                  <button type="button" onClick={() => answer.discard(box.current)} className="focus-ring rounded font-medium text-accent-fg hover:underline">
                    {t("handIn.textDiscard")}
                  </button>
                </p>
              )}
            </div>
          ) : (
            !task.group &&
            (textLocked || plainText(answer.saved)) && (
              <div className="mb-3 space-y-2">
                <div className="rounded-lg bg-fill px-3 py-2.5">
                  <LecturerHtml html={answer.saved} pictureAlt={t("image.altYours")} />
                </div>
                {editable && textLocked && (
                  <div className="space-y-2">
                    <p className="text-caption text-muted">{t("handIn.textRich")}</p>
                    <Button size="sm" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(edunexTaskUrl(task.id))}>
                      {t("handIn.editOnEdunex")}
                    </Button>
                  </div>
                )}
              </div>
            )
          )}
          {(saved.length > 0 || attached.length > 0) && (
            <ul className="mb-2 space-y-1.5">
              {saved.map((file) => (
                <FileRow
                  key={file.url}
                  name={file.name}
                  hint={editable ? fileHint(t, file.name, pattern, type) : null}
                  onRemove={editable ? () => removeSaved(file.url) : undefined}
                  onDownload={editable ? undefined : () => void download(file)}
                  onPreview={canView(file.name) ? preview(file) : undefined}
                  downloading={downloading === file.url}
                />
              ))}
              {attached.map((item) => (
                <FileRow
                  key={item.key}
                  name={item.name}
                  state={item.state}
                  detail={
                    item.state === "failed" ? (
                      t(item.problem ?? "handIn.uploadFailed")
                    ) : item.state === "uploaded" || item.state === "uploading" ? (
                      <Meta>
                        {t(item.state === "uploaded" ? "handIn.notSaved" : "handIn.uploading")}
                        {f.fileSize(item.size)}
                      </Meta>
                    ) : (
                      t("handIn.waiting")
                    )
                  }
                  hint={item.state === "uploaded" ? fileHint(t, item.name, pattern, type) : null}
                  onRetry={item.state === "failed" && !refused(item) ? () => retry(item) : undefined}
                  onRemove={editable ? () => removeAttached(item.key) : undefined}
                  onPreview={!isPdfName(item.name) || refused(item) ? undefined : item.file ? preview(item.file) : previewPicked(item)}
                />
              ))}
            </ul>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => void pick()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => void drop(event)}
              className={cx(
                // Start-aligned, so its facts wrap without a dangling "·" (Meta can't do that centered).
                "focus-ring flex w-full items-center gap-3 rounded-lg border border-dashed px-3.5 py-3 text-left transition-colors duration-150 [&>*]:pointer-events-none",
                dragging ? "border-accent bg-info-bg" : "border-track hover:border-accent hover:bg-hover",
              )}
            >
              <Icons.Upload className="size-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <Meta className="text-small">
                  <span className="font-semibold text-accent-fg">{t("handIn.attach")}</span>
                  <span className="text-muted">{t("handIn.drop")}</span>
                </Meta>
                {(task.fileRequired || type) && (
                  <Meta className="mt-0.5 text-caption text-faint">
                    {task.fileRequired ? t("handIn.fileRequired") : null}
                    {type ? t("handIn.ruleType", { type: type.toUpperCase() }) : null}
                  </Meta>
                )}
              </span>
            </button>
          )}
          {task.group && !sent && status !== "closed" && (
            <div className="space-y-2">
              <p className="text-small text-muted">{t("handIn.group")}</p>
              <Button size="sm" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(edunexTaskUrl(task.id))}>
                {t("action.openInEdunex")}
              </Button>
              {isOpenStatus(status) && <MarkHandedIn task={task} />}
            </div>
          )}
          {!task.group && !editable && !sent && status !== "closed" && task.opensAt !== null && (
            <p className="rounded-lg bg-fill px-3 py-2.5 text-small text-muted">{t("handIn.notOpenYet", { when: f.dueLabel(task.opensAt) })}</p>
          )}
          {status === "closed" && (
            <p className="rounded-lg bg-fill px-3 py-2.5 text-small text-muted">{task.answer ? t("handIn.draftNeverSent") : t("handIn.nothingHandedIn")}</p>
          )}
        </div>

        {uploading && inFlight.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-caption text-muted">{t("handIn.progress", { done, count: inFlight.length })}</p>
            <ProgressBar value={done / inFlight.length} label={t("handIn.progress", { done, count: inFlight.length })} />
          </div>
        )}

        {notice && (
          <div
            role="alert"
            className={cx(
              "flex items-start gap-2 rounded-lg px-3 py-2.5 text-small",
              notice.tone === "danger" ? "bg-danger-bg text-danger-fg" : notice.tone === "warning" ? "bg-warning-bg text-warning-fg" : "bg-fill text-muted",
            )}
          >
            <Icons.AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p>{t(notice.text)}</p>
              {notice.action === "signIn" && (
                <Button size="sm" variant="primary" className="mt-2" busy={signingIn} onClick={() => void signIn("edunex")}>
                  {t("action.signInAgain")}
                </Button>
              )}
              {notice.action === "edunex" && (
                <Button size="sm" className="mt-2" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(edunexTaskUrl(task.id))}>
                  {t("action.openInEdunex")}
                </Button>
              )}
            </div>
          </div>
        )}

        {editable && (
          <>
            <div className="flex items-center gap-2">
              {draftButton}
              {submitButton}
            </div>
            {why && !(notice?.action === "signIn" && guard.blocked) && (
              <div
                id={whyId}
                role="status"
                className={cx(
                  "flex items-start gap-2 text-small",
                  why.tone === "danger" ? "text-danger-fg" : why.tone === "warning" ? "text-warning-fg" : "text-muted",
                )}
              >
                <Icons.Info className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">{why.text}</span>
                {why.fix && <span className="-my-0.5 shrink-0">{why.fix}</span>}
              </div>
            )}
            <p className="flex items-start gap-2 text-caption text-muted">
              <Icons.Lock className="mt-px size-3.5 shrink-0" />
              {t("handIn.explainer")}
            </p>
            <MarkHandedIn task={task} />
          </>
        )}
        {sent && (
          <p className="flex items-start gap-2 text-caption text-muted">
            <Icons.ShieldCheck className="mt-px size-3.5 shrink-0 text-success-fg" />
            {status === "in_review" ? t("handIn.inReview") : t("handIn.final")}
          </p>
        )}
      </div>

      <HandInDialog
        open={confirming}
        onOpenChange={setConfirming}
        files={files}
        checks={guard.checks}
        waitForWindow={guard.waitForWindow}
        canSave={changed}
        submitLabel={status === "overdue" ? submitLabel : t("handIn.submitNow")}
        busy={busy}
        onSubmit={() => void run("submit")}
        onSaveDraft={() => (changed ? void run("draft") : setConfirming(false))}
      />
    </Card>
  );
}

/** A soft hint under a file that isn't what the lecturer asked for (type, name). */
function fileHint(t: Translate, name: string, pattern: string | null, type: string | null): string | null {
  if (type && !name.toLowerCase().endsWith(`.${type}`)) return t("handIn.typeHint", { type: type.toUpperCase() });
  if (pattern && !matchesNaming(pattern, name)) return t("handIn.namingHint", { pattern });
  return null;
}

const CHECK_TONE: Record<HandInCheck["tone"], string> = { block: "text-danger-fg", warn: "text-warning-fg", ok: "text-success-fg" };

/**
 * Before the final hand-in: the files, then each thing that matters as one
 * honest sentence, and the right default. Outside the attendance window the
 * main button keeps the work as a draft; handing in anyway stays one click away.
 */
function HandInDialog({
  open,
  onOpenChange,
  files,
  checks,
  waitForWindow,
  canSave,
  submitLabel,
  busy,
  onSubmit,
  onSaveDraft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: TaskFile[];
  checks: HandInCheck[];
  waitForWindow: boolean;
  canSave: boolean;
  submitLabel: string;
  busy: "draft" | "submit" | null;
  onSubmit: () => void;
  onSaveDraft: () => void;
}) {
  const t = useT();
  const f = useFormat();
  const range = (opensAt: number, closesAt: number) => `${f.relativeDay(opensAt)}, ${f.timeRange(opensAt, closesAt)}`;
  const sentence = (check: HandInCheck): string => {
    switch (check.kind) {
      case "attendanceEarly":
        return t("handIn.check.attendanceEarly", { when: range(check.opensAt, check.closesAt) });
      case "attendanceMissed":
        return t("handIn.check.attendanceMissed", { when: range(check.opensAt, check.closesAt) });
      case "attendanceIn":
        return t("handIn.check.attendanceIn");
      case "late":
        return t("handIn.check.late", { when: f.dueLabel(check.dueAt) });
      case "fileType":
        return t("handIn.check.fileType", { type: check.type.toUpperCase(), files: f.list(check.files), count: check.files.length });
      case "naming":
        return t("handIn.check.naming", { pattern: check.pattern });
      case "offline":
        return t("handIn.why.offline");
      case "expired":
        return t("handIn.why.expired");
    }
  };
  const { onOpenAutoFocus, onCloseAutoFocus } = useReturnFocus();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={cx(SCRIM_CLASS, "z-(--z-confirm)")} />
        <DialogPrimitive.Content
          role="alertdialog"
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          // While it leaves, a second click on "Kumpulkan" (a double-click) must not hand in twice.
          onClickCapture={ignoreClosingClick}
          className={cx(
            "fixed top-1/2 left-1/2 z-(--z-confirm) w-[min(460px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-raised p-5 text-fg border border-transparent shadow-dialog ring-1 ring-black/10 focus:outline-none dark:ring-white/10",
            PANEL_MOTION_CLASS,
          )}
        >
          <DialogPrimitive.Title className="text-title font-semibold">{t("handIn.confirmTitle")}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1.5 text-body text-muted">
            {files.length
              ? t("handIn.confirmBody", { files: files.length === 1 ? files[0].name : t("handIn.fileCount", { count: files.length }) })
              : t("handIn.confirmBodyText")}
          </DialogPrimitive.Description>
          {checks.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-line pt-4">
              {checks.map((check) => (
                <li key={check.kind} className={cx("flex items-start gap-2.5 text-body", CHECK_TONE[check.tone])}>
                  {check.tone === "ok" ? <Icons.CheckCircle className="mt-0.5 size-4 shrink-0" /> : <Icons.AlertTriangle className="mt-0.5 size-4 shrink-0" />}
                  <span>{sentence(check)}</span>
                </li>
              ))}
            </ul>
          )}
          {/* Two real choices, one of them costly: stacked full width, the safe one first. */}
          <div className={cx("mt-5 gap-2", waitForWindow ? "grid" : "flex flex-wrap justify-end")}>
            {waitForWindow ? (
              <>
                <Button variant="primary" className="w-full" busy={busy === "draft"} disabled={busy === "submit"} onClick={onSaveDraft}>
                  {canSave ? t("handIn.saveInstead") : t("handIn.notNow")}
                </Button>
                <Button variant="secondary" className="w-full" busy={busy === "submit"} disabled={busy === "draft"} onClick={onSubmit}>
                  {t("handIn.submitAnyway")}
                </Button>
              </>
            ) : (
              <>
                <DialogPrimitive.Close asChild>
                  <Button variant="secondary">{t("action.cancel")}</Button>
                </DialogPrimitive.Close>
                <Button variant="primary" busy={busy === "submit"} onClick={onSubmit}>
                  {submitLabel}
                </Button>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function FileBadge({ name, state }: { name: string; state?: Attached["state"] }) {
  const ext = /\.([a-z0-9]{1,4})$/i.exec(name)?.[1]?.toUpperCase() ?? "";
  return (
    <span
      aria-hidden
      className={cx(
        "grid size-8 shrink-0 place-items-center rounded-md text-micro font-bold",
        // Red only for a file that failed: a PDF is no danger, so it is grey like any other kind.
        state === "failed" ? "bg-danger-bg text-danger-fg" : "bg-neutral-bg text-neutral-fg",
      )}
    >
      {state === "uploading" || state === "waiting" ? (
        <Icons.Loader className={cx("size-3.5", state === "uploading" && "animate-spin")} />
      ) : state === "failed" ? (
        <Icons.AlertTriangle className="size-3.5" />
      ) : (
        ext || <Icons.FileText className="size-3.5" />
      )}
    </span>
  );
}

/** One file of the answer; with `onPreview`, the row offers to look at it in the app. */
function FileRow({
  name,
  state,
  detail,
  hint,
  onRemove,
  onRetry,
  onDownload,
  onPreview,
  downloading = false,
}: {
  name: string;
  state?: Attached["state"];
  detail?: ReactNode;
  hint?: string | null;
  onRemove?: () => void;
  onRetry?: () => void;
  onDownload?: () => void;
  onPreview?: () => void;
  downloading?: boolean;
}) {
  const t = useT();
  const failed = state === "failed";
  return (
    <li className={cx("rounded-lg px-2.5 py-2", failed ? "bg-danger-bg/50 ring-1 ring-danger-fg/30 ring-inset" : "bg-fill")}>
      <div className="flex items-center gap-2.5">
        <FileBadge name={name} state={state} />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block text-body font-medium break-words" title={name}>
            {name}
          </span>
          {/* No check mark here: a file on its way or "Belum disimpan" isn't done until the answer is saved. */}
          {detail && !failed && <span className="flex items-center gap-1 text-caption text-muted">{detail}</span>}
        </span>
        {onPreview && !failed && (
          <button
            type="button"
            aria-label={t("handIn.preview", { name })}
            onClick={onPreview}
            className="focus-ring grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-hover hover:text-fg"
          >
            <Icons.Eye className="size-3.5" />
          </button>
        )}
        {onRemove && !failed && (
          <button
            type="button"
            aria-label={t("handIn.remove", { name })}
            onClick={onRemove}
            className="focus-ring grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-hover hover:text-fg"
          >
            <Icons.X className="size-3.5" />
          </button>
        )}
        {onDownload && (
          <button
            type="button"
            aria-label={t("task.download", { name })}
            onClick={onDownload}
            className="focus-ring grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-hover hover:text-fg"
          >
            {downloading ? <Icons.Loader className="size-3.5 animate-spin" /> : <Icons.Download className="size-3.5" />}
          </button>
        )}
      </div>
      {state === "uploading" && <ProgressBar value={0} indeterminate label={t("handIn.uploading")} />}
      {failed && (
        <div className="mt-1.5 pl-[42px]">
          <p className="text-small text-danger-fg">{detail}</p>
          <div className="mt-1.5 flex gap-1.5">
            {onRetry && (
              <Button size="sm" icon={<Icons.RefreshCw className="size-3.5" />} aria-label={t("handIn.retry", { name })} onClick={onRetry}>
                {t("handIn.retryShort")}
              </Button>
            )}
            {onRemove && (
              <Button size="sm" variant="ghost" aria-label={t("handIn.remove", { name })} onClick={onRemove}>
                {t("handIn.removeShort")}
              </Button>
            )}
          </div>
        </div>
      )}
      {hint && (
        <p className="mt-1 flex items-start gap-1.5 pl-[42px] text-caption text-warning-fg">
          <Icons.Info className="mt-px size-3 shrink-0" />
          {hint}
        </p>
      )}
    </li>
  );
}

function uploadProblem(error: unknown): StringKey {
  if (error instanceof ActionError && error.kind === "Offline") return "handIn.uploadOffline";
  if (error instanceof ActionError && error.kind === "Unauthorized") return "handIn.uploadExpired";
  if (error instanceof ActionError && error.kind === "Rejected") return "handIn.unreadable";
  return "handIn.uploadFailed";
}

function noticeFor(error: unknown): Notice {
  const kind = error instanceof ActionError ? error.kind : "Failed";
  switch (kind) {
    case "Offline":
      return { tone: "danger", text: "handIn.error.offline" };
    case "Unauthorized":
      return { tone: "warning", text: "handIn.error.expired", action: "signIn" };
    case "VendorChanged":
      return { tone: "danger", text: "handIn.error.changed", action: "edunex" };
    case "Rejected":
      return { tone: "danger", text: "handIn.error.rejected", action: "edunex" };
    default:
      return { tone: "danger", text: "handIn.error.failed" };
  }
}

// ---------------------------------------------------------------- handed in where Edunex can't see

type MarkedHow = Extract<DoneHow, "handedElsewhere" | "notHandingIn" | "groupDone">;

/**
 * For a Task Edunex won't see handed in: the Student's own word for it, kept
 * on this computer. A Task of their own: "Tidak mengumpulkan lewat Edunex?
 * Tandai" (handed in another way, or not at all); a group Task: "Kelompokku
 * sudah kumpul". Once marked, one quiet line says what was chosen, with Undo.
 * The status above stays Edunex's own: the app never claims Edunex has it.
 */
function MarkHandedIn({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const { done, mark, unmark } = useDone();
  const key = taskDoneKey(task, "due");
  const entry = done(key);
  const undo = useRef<HTMLButtonElement>(null);
  const again = useRef<HTMLParagraphElement & HTMLDivElement>(null);
  const [moved, setMoved] = useState<"marked" | "unmarked" | null>(null);
  // The menu or the button that was pressed has gone with the line: focus goes to its Undo, once the menu has closed;
  // after Undo, back to the way to mark it, never to the page.
  useEffect(() => {
    if (moved === null || (moved === "marked") !== (entry !== undefined)) return;
    setMoved(null);
    requestAnimationFrame(() => (moved === "marked" ? undo.current : again.current?.querySelector<HTMLElement>("button"))?.focus());
  }, [moved, entry]);
  const put = (how: MarkedHow) => {
    setMoved("marked");
    mark(key, how).catch((error: unknown) => toast(t(errorKey(error)), "danger"));
  };
  if (entry)
    return (
      // One line of facts beside the ✓, Undo last, wrapping under its words on a narrow card.
      <div className="flex items-start gap-1.5 text-caption text-muted">
        <Icons.Check className="mt-0.5 size-3.5 shrink-0 text-success-fg" weight="bold" />
        <Meta className="flex-1">
          {t(`task.marked.${entry.how as MarkedHow}`)}
          {f.dayTimeWord(entry.at)}
          <button
            ref={undo}
            type="button"
            // The answer box has an "Urungkan" of its own: this one says what it takes back.
            aria-label={t("done.undoFor", { what: t(`task.marked.${entry.how as MarkedHow}`) })}
            onClick={() => {
              setMoved("unmarked");
              void unmark(key.id).catch(() => undefined);
            }}
            className="focus-ring rounded font-medium text-accent-fg hover:underline"
          >
            {t("action.undo")}
          </button>
        </Meta>
      </div>
    );
  if (task.group)
    return (
      <p ref={again} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
        {t("done.groupAsk")}
        <button type="button" onClick={() => put("groupDone")} className="focus-ring rounded font-medium text-accent-fg hover:underline">
          {t("done.groupDone")}
        </button>
      </p>
    );
  return (
    <div ref={again} className="flex flex-wrap items-center gap-x-1 text-caption text-muted">
      {t("done.otherWay")}
      <Menu
        label={t("done.otherWay.menuFor")}
        trigger={{ icon: <Icons.ChevronDown className="size-3.5" />, text: t("done.otherWay.menu"), words: true, className: "h-6 px-1.5 text-caption" }}
        items={(["handedElsewhere", "notHandingIn"] as const).map((how) => ({
          label: t(`done.${how}`),
          hint: t(`done.${how}.hint`),
          onSelect: () => put(how),
        }))}
      />
    </div>
  );
}

// ---------------------------------------------------------------- history

function History({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const open = useOpenExternal();
  const steps = taskHistory(task);
  return (
    <div className="px-4">
      {steps.length >= 2 && (
        <>
          <p className="mb-3 text-small font-semibold text-muted">{t("history.title")}</p>
          <ol className="relative ml-1.5 space-y-3 border-l border-line pl-4">
            {steps.map((step) => (
              <li key={step.kind} className="relative text-small">
                <span
                  aria-hidden
                  className={cx(
                    "absolute top-1 -left-[21px] size-[9px] rounded-full ring-[3px] ring-canvas",
                    step.kind === "submitted"
                      ? "bg-live"
                      : step.kind === "edited" && editedAfterSubmit(task)
                        ? "bg-meter-warning"
                        : step.at > now && step.kind !== "draft"
                          ? "border border-faint bg-canvas"
                          : "bg-faint/60",
                  )}
                />
                <span className="block font-medium">{t(`history.${step.kind}`)}</span>
                <span className="block text-faint tabular-nums">{f.dueLabel(step.at)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      <button
        type="button"
        onClick={() => open(edunexTaskUrl(task.id))}
        className={cx("focus-ring inline-flex items-center gap-1 rounded text-small font-medium text-accent-fg hover:underline", steps.length >= 2 && "mt-4")}
      >
        {t("action.openInEdunex")}
        <Icons.ArrowUpRight className="size-3.5" />
      </button>
    </div>
  );
}
