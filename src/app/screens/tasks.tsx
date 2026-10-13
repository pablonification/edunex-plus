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
import { examPassed } from "../../core/exams";
import type { Task, TaskFile, TaskModule, TaskStatus } from "../../core/models";
import type { StringKey } from "../../core/strings";
import {
  attendanceResult,
  attendanceSession,
  byDeadline,
  type DueGroup,
  dueGroup,
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
import { answerShape, editableInApp } from "../answer-html";
import { useAttendance } from "../attendance";
import { ActionError } from "../bridge";
import { type TermCourse, useTermCourses } from "../courses";
import { useOpenExternal } from "../hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../i18n";
import { LecturerHtml } from "../lecturer-html";
import { useNav } from "../nav";
import { isPdfName, useAnswerAttach, usePdfViewer } from "../pdf";
import { useExams } from "../schedule-data";
import { useRefresh, useSignIn } from "../shell/source-status";
import { useBridge, useDataset, useStatus } from "../store";
import { Button, Segmented, useRadioKeys } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card, CourseDot, EmptyState, Skeleton, StatusChip, StatusGlyph } from "../ui/display";
import { Icons } from "../ui/icons";
import { factsLabel, List, Row as ListRow, Meta, Page, PageHeader, Section } from "../ui/layout";
import { ignoreClosingClick, PANEL_MOTION_CLASS, SCRIM_CLASS, toast, useReturnFocus } from "../ui/overlays";
import type { RichEditorHandle } from "../ui/rich-editor";
import { plainText } from "../ui/rich-text";
import { ready as courseReady } from "./course";
import { ExamRow, examWeekLabel, takeHomeWhy } from "./exam";

export const ready = true;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface Row {
  task: Task;
  status: TaskStatus;
}

/** Every Task with its status right now. */
function useRows(): Row[] | undefined {
  const tasks = useDataset("edunex.tasks");
  const now = useNow();
  return useMemo(() => tasks?.map((task) => ({ task, status: taskStatus(task, now) })), [tasks, now]);
}

/** The sidebar count: Tasks still to hand in; amber when one is late or due within a day. */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  const tasks = useDataset("edunex.tasks");
  const now = useNow();
  return useMemo(() => {
    if (!Array.isArray(tasks)) return null;
    let value = 0;
    let urgent = false;
    for (const task of tasks) {
      const status = taskStatus(task, now);
      if (!isOpenStatus(status)) continue;
      value += 1;
      if (status === "overdue" || (task.dueAt !== null && task.dueAt - now < DAY)) urgent = true;
    }
    return value ? { value, tone: urgent ? "warning" : "neutral" } : null;
  }, [tasks, now]);
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

const GROUPS: { group: DueGroup; title: StringKey }[] = [
  { group: "overdue", title: "tasks.group.overdue" },
  { group: "thisWeek", title: "tasks.group.thisWeek" },
  { group: "nextWeek", title: "tasks.group.nextWeek" },
  { group: "later", title: "tasks.group.later" },
];

// The course filter the Student last chose, kept while the app runs (per window).
const lastCourse = new WeakMap<object, string | null>();

export function TasksScreen() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const rows = useRows();
  const exams = useExams();
  const courses = useTermCourses();
  const bridge = useBridge();
  const [show, setShow] = useState<"open" | "done">("open");
  const [course, setCourseState] = useState<string | null>(lastCourse.get(bridge) ?? null);
  const setCourse = (value: string | null) => {
    lastCourse.set(bridge, value);
    setCourseState(value);
  };

  // A take-home exam is one thing with its exam: its Task shows inside the exam row.
  const folded = useMemo(() => new Set((exams ?? []).flatMap((exam) => exam.tasks.map((task) => task.id))), [exams]);
  const lists = useMemo(() => {
    const open: Row[] = [];
    const submitted: Row[] = [];
    const missed: Row[] = [];
    for (const row of rows ?? []) {
      if (isOpenStatus(row.status)) open.push(row);
      else if (row.status === "closed") missed.push(row);
      else submitted.push(row);
    }
    open.sort((a, b) => byDeadline(a.task, b.task));
    submitted.sort((a, b) => (submittedAt(b.task) ?? 0) - (submittedAt(a.task) ?? 0));
    missed.sort((a, b) => (b.task.dueAt ?? 0) - (a.task.dueAt ?? 0));
    return { open, submitted, missed };
  }, [rows]);

  const mine = (code: string) => course === null || code === course;
  const listed = (row: Row) => mine(row.task.courseCode) && !(show === "open" && folded.has(row.task.id));
  const sections =
    show === "open"
      ? GROUPS.map(({ group, title }) => ({ title, rows: lists.open.filter((row) => listed(row) && dueGroup(row.task, row.status, now) === group) }))
      : [
          { title: "tasks.group.submitted" as const, rows: lists.submitted.filter(listed) },
          { title: "tasks.group.closed" as const, rows: lists.missed.filter(listed) },
        ];
  const shownExams = (exams ?? []).filter((exam) => examPassed(exam, now) === (show === "done") && mine(exam.courseCode));
  const week =
    show === "open"
      ? ((exams ?? []).find((exam) => exam.week && exam.week.end > now && exam.kind === "UTS")?.week ??
        (exams ?? []).find((exam) => exam.week && exam.week.end > now)?.week)
      : undefined;
  const weekExam = week ? (exams ?? []).find((exam) => exam.week === week) : undefined;
  const nothing = shownExams.length === 0 && sections.every((section) => section.rows.length === 0);
  // Signed out of SIX, only Edunex's exams are known: said once, under them, with the way to SIX's timetable.
  const examsNoSix = useStatus("six").state === "signed-out" && show === "open" && course === null;
  // Courses with something in either segment, for the filter.
  const withItems = (courses ?? []).filter(
    (c) => (rows ?? []).some((row) => row.task.courseCode === c.code) || (exams ?? []).some((exam) => exam.courseCode === c.code),
  );
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
              { value: "open", label: rows ? `${t("tasks.filter.open")} ${lists.open.length}` : t("tasks.filter.open") },
              { value: "done", label: rows ? `${t("tasks.filter.done")} ${lists.submitted.length + lists.missed.length}` : t("tasks.filter.done") },
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

      {!rows ? (
        <NoTasksYet />
      ) : nothing ? (
        <EmptyState
          icon={<Icons.CheckCircle className="size-5" />}
          title={
            course !== null && show === "open"
              ? t("tasks.noneForCourse", { code: course })
              : rows.length === 0
                ? t("tasks.none")
                : show === "open"
                  ? t("tasks.allHandedIn")
                  : t("tasks.noneDone")
          }
        />
      ) : (
        <>
          {(shownExams.length > 0 || examsNoSix) && (
            <Section
              id="tasks-exams"
              title={t("exams.title")}
              count={shownExams.length || undefined}
              description={week && weekExam && (weekExam.kind === "UTS" || weekExam.kind === "UAS") ? examWeekLabel(t, f, weekExam.kind, week) : undefined}
            >
              {shownExams.length > 0 && (
                <List label={t("exams.title")}>
                  {shownExams.map((exam) => (
                    <ExamRow key={exam.id} exam={exam} />
                  ))}
                </List>
              )}
              {/* Under a take-home, how the app tells one from a Task: said once for the list. */}
              {shownExams.some((exam) => exam.tasks.length > 0) && <p className="mt-2.5 px-1 text-small text-muted">{t("exams.takeHomeRule")}</p>}
              {examsNoSix && <ExamsNoSix />}
            </Section>
          )}
          {sections
            .filter((section) => section.rows.length > 0)
            .map((section) => (
              <Section key={section.title} id={`tasks-${section.title}`} title={t(section.title)} count={section.rows.length}>
                <List label={t(section.title)}>
                  {section.rows.map((row) => (
                    <TaskRow key={row.task.id} {...row} />
                  ))}
                </List>
              </Section>
            ))}
        </>
      )}
    </Page>
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

/** Before the first Task list has arrived: placeholders while it's on its way, else why it isn't. */
/** Under the exams, without SIX: SIX's exam timetable is missing, and the one way to get it. */
function ExamsNoSix() {
  const t = useT();
  const { signIn, busy } = useSignIn();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-small text-muted">{t("tasks.examsNoSix")}</p>
      <Button size="sm" busy={busy} onClick={() => void signIn("six")}>
        {t("action.signInTo", { source: "SIX" })}
      </Button>
    </div>
  );
}

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

function TaskRow({ task, status, meta = "course" }: Row & { meta?: "course" | "module" | "none" }) {
  const t = useT();
  const { go } = useNav();
  const module = moduleLabel(t, task.module);
  return (
    <ListRow
      onClick={() => go({ screen: "task", taskId: task.id })}
      title={task.title}
      meta={meta === "course" ? <Place task={task} /> : meta === "module" && module ? <Meta>{module}</Meta> : undefined}
      trailing={
        <span className="flex items-center gap-4">
          {LOUD.includes(status) && <StatusChip status={status} />}
          <TaskDate task={task} status={status} />
        </span>
      }
    >
      <Signal task={task} status={status} />
      <span className="sr-only">{!LOUD.includes(status) && t(`taskStatus.${status}`)}</span>
    </ListRow>
  );
}

/** "Jum, 16 Okt, 23:59 / dalam 8 hari": red within a day or past it; "Dikumpulkan 24 Sep" once handed in. */
export function TaskDate({ task, status }: Row) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const sentAt = submittedAt(task);
  const soon = task.dueAt !== null && (status === "overdue" || status === "closed" || (isOpenStatus(status) && task.dueAt - now < DAY));
  return (
    <span className="w-[136px] text-right text-small whitespace-nowrap tabular-nums">
      {sentAt !== null ? (
        <>
          <span className="block font-medium">
            {task.score !== null ? t("task.scoreValue", { score: formatScore(task.score, f) }) : t("task.submittedOnDate", { date: f.dayMonth(sentAt) })}
          </span>
          {task.score !== null && <span className="block text-faint">{t("task.submittedOnDate", { date: f.dayMonth(sentAt) })}</span>}
        </>
      ) : task.dueAt !== null ? (
        <>
          <span className={cx("block font-medium", soon && "text-danger-fg")}>{f.dueLabel(task.dueAt)}</span>
          <span className={cx("block", soon ? "text-danger-fg" : "text-faint")}>{status === "closed" ? t("task.notHandedIn") : f.fromNow(task.dueAt)}</span>
        </>
      ) : (
        <span className="block text-faint">{t("task.noDeadline")}</span>
      )}
    </span>
  );
}

/** "● II4091 · Modul 5 · Tugas": the course and module, as Edunex lays the course out. */
function Place({ task }: { task: Task }) {
  const t = useT();
  const course = useCourse(task.courseCode);
  const where = moduleLabel(t, task.module) ?? course?.name ?? null;
  return (
    <Meta truncate>
      <span className="inline-flex items-center gap-1.5 font-medium text-fg/80">
        <CourseDot color={course?.color ?? "#888"} className="size-2" />
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
  const optional = presenceOptional(useCountedIn(task.courseCode));
  let signal: ReactNode = null;
  const window = isOpenStatus(status) ? attendanceWindow(task, presence, now) : null;
  if (editedAfterSubmit(task) && task.editedAt !== null)
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
  const course = useCourse(task.courseCode);
  const exam = useExams()?.find((e) => e.tasks.some((item) => item.id === task.id));
  const status = taskStatus(task, now);
  const late = status === "overdue" || status === "closed";
  const soon = !late && isOpenStatus(status) && task.dueAt !== null && task.dueAt - now < DAY;
  const where = moduleLabel(t, task.module);
  const place = (
    <>
      <CourseDot color={course?.color ?? "#888"} className="size-2" />
      <span className="font-semibold">{task.courseCode}</span>
      {where && (
        <>
          <Icons.ChevronRight className="size-3 shrink-0" />
          <Meta truncate>{where}</Meta>
        </>
      )}
    </>
  );

  return (
    <Page width="wide" className="grid gap-10 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
      <article className="min-w-0">
        {courseReady ? (
          <button
            type="button"
            onClick={() => go({ screen: "course", code: task.courseCode })}
            className="focus-ring flex max-w-full items-center gap-1.5 rounded text-small font-medium text-muted hover:text-fg"
          >
            {place}
          </button>
        ) : (
          <p className="flex max-w-full items-center gap-1.5 text-small font-medium text-muted">{place}</p>
        )}
        <h1 className="mt-2 text-display leading-tight font-semibold tracking-[-0.02em] text-balance">{task.title}</h1>
        {/* One line of facts; once the Task is open, when it opened is history (Riwayat says it). */}
        <Meta className="mt-2.5 text-body text-muted">
          {task.dueAt !== null ? (
            <span className={cx("inline-flex items-center gap-1.5 font-medium", late || soon ? "text-danger-fg" : "text-fg")}>
              <Icons.Clock className="size-3.5 shrink-0" />
              {t("task.due", { when: f.dueLabel(task.dueAt) })}
            </span>
          ) : (
            t("task.noDeadline")
          )}
          {task.dueAt !== null && <span className={cx((late || soon) && "text-danger-fg")}>{f.fromNow(task.dueAt)}</span>}
          {isOpenStatus(status) && task.dueAt !== null && (
            <span className={cx(!task.lateAllowed && soon && "text-danger-fg")}>{task.lateAllowed ? t("handIn.lateAllowed") : t("handIn.lateNotAllowed")}</span>
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
          {t("task.note.editedCheck")}
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

/** Downloads a file from Edunex through the browser's download manager (Downloads, then it opens). */
function useDownload() {
  const bridge = useBridge();
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const download = async (file: TaskFile) => {
    setBusy(file.url);
    try {
      await bridge.invoke("files.download", { url: file.url, name: shortName(file.name) });
    } catch {
      toast(t("task.downloadFailed", { name: file.name }), "danger");
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
  const { download, busy } = useDownload();
  const pdf = usePdfViewer();
  // A PDF reads in the app (its viewer can download it too); other files download and open.
  const viewable = isPdfName(file.name);
  return (
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

  // A PDF in the answer opens in the viewer: one on Edunex (saved, or uploaded a moment ago) by its link, with
  // the Task's page as the way out; one still on its way up from its bytes, read by main by the id it gave.
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
                  onPreview={isPdfName(file.name) ? preview(file) : undefined}
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
        return t("handIn.check.fileType", { type: check.type.toUpperCase(), files: check.files.join(", ") });
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
            "fixed top-1/2 left-1/2 z-(--z-confirm) w-[min(460px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-raised p-5 text-fg shadow-dialog ring-1 ring-black/10 focus:outline-none dark:ring-white/10",
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

function ProgressBar({ value, label, indeterminate = false }: { value: number; label: string; indeterminate?: boolean }) {
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(value * 100)}
      className="relative block h-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]"
    >
      <span
        className={cx(
          "absolute inset-y-0 left-0 rounded-full bg-accent motion-safe:transition-[width] motion-safe:duration-300",
          indeterminate && "w-1/3 motion-safe:animate-shimmer",
        )}
        style={indeterminate ? undefined : { width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </span>
  );
}

function FileBadge({ name, state }: { name: string; state?: Attached["state"] }) {
  const ext = /\.([a-z0-9]{1,4})$/i.exec(name)?.[1]?.toUpperCase() ?? "";
  return (
    <span
      aria-hidden
      className={cx(
        "grid size-8 shrink-0 place-items-center rounded-md text-micro font-bold",
        state === "failed" ? "bg-danger-bg text-danger-fg" : ext === "PDF" ? "bg-danger-bg/70 text-danger-fg" : "bg-neutral-bg text-neutral-fg",
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
      return { tone: "danger", text: "handIn.error.rejected" };
    default:
      return { tone: "danger", text: "handIn.error.failed" };
  }
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
                        ? "bg-warning-fg"
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
        {t("task.openInEdunex")}
        <Icons.ArrowUpRight className="size-3.5" />
      </button>
    </div>
  );
}
