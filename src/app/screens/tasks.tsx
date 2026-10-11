// Tugas & Ujian: every Task of the term with its true status (#72), and the
// Task page with handing in (#73). A Task's status is worked out from EduNex's
// own facts at this moment (a deadline passing changes it), never from a
// draft's timestamps. Handing in writes only on the Student's clicks.
import { type DragEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { MAX_UPLOAD_BYTES, type HandInResult, type PickedFile } from "../../core/actions/tasks";
import { attendanceWindow } from "../../core/attendance";
import type { Task, TaskFile, TaskModule, TaskStatus } from "../../core/models";
import type { StringKey } from "../../core/strings";
import {
  type DueGroup,
  byDeadline,
  dueGroup,
  edunexTaskUrl,
  editedAfterSubmit,
  isOpenStatus,
  moduleName,
  notOpenYet,
  shortWindow,
  submittedAt,
  taskHistory,
  takesAnswers,
  taskStatus,
} from "../../core/tasks";
import { ActionError } from "../bridge";
import { useCourseColors, useOpenExternal } from "../hooks";
import { type Translate, useFormat, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { SourceNotice, useRefresh, useSignIn } from "../shell/source-status";
import { useBridge, useDataset, useStatus } from "../store";
import { Button, IconButton, Segmented } from "../ui/controls";
import { Bar, Card, CourseDot, EmptyState, SectionTitle, Skeleton, SourceTag, StatusChip, StatusGlyph } from "../ui/display";
import { cx } from "../ui/cx";
import { Icons } from "../ui/icons";
import { ConfirmDialog, toast } from "../ui/overlays";
import { RichText, plainText } from "../ui/rich-text";
import { ready as courseReady } from "./course";
import { ExamList } from "./exam";

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

// ---------------------------------------------------------------- Tugas & Ujian

const GROUPS: { group: DueGroup; title: StringKey }[] = [
  { group: "overdue", title: "tasks.group.overdue" },
  { group: "thisWeek", title: "tasks.group.thisWeek" },
  { group: "nextWeek", title: "tasks.group.nextWeek" },
  { group: "later", title: "tasks.group.later" },
];

export function TasksScreen() {
  const t = useT();
  const now = useNow();
  const rows = useRows();
  const [show, setShow] = useState<"open" | "done">("open");
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

  const sections =
    show === "open"
      ? GROUPS.map(({ group, title }) => ({ title, rows: lists.open.filter((row) => dueGroup(row.task, row.status, now) === group) }))
      : [
          { title: "tasks.group.submitted" as const, rows: lists.submitted },
          { title: "tasks.group.closed" as const, rows: lists.missed },
        ];
  const summary = [t("tasks.summary", { open: lists.open.length, done: lists.submitted.length })];
  if (lists.missed.length) summary.push(t("tasks.summaryMissed", { count: lists.missed.length }));

  return (
    <div className="mx-auto max-w-[920px] px-10 pt-7 pb-20">
      <header className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-display font-semibold tracking-[-0.02em]">{t("nav.tasks")}</h1>
          {rows && <p className="mt-1 text-body text-muted">{summary.join(" · ")}</p>}
        </div>
        <Segmented
          label={t("tasks.show")}
          value={show}
          onChange={setShow}
          options={[
            { value: "open", label: t("tasks.filter.open") },
            { value: "done", label: t("tasks.filter.done") },
          ]}
        />
      </header>

      <SourceNotice source="edunex" hasData={rows !== undefined} />

      <ExamList past={show === "done"} />

      <div className="mt-8 space-y-7">
        {!rows ? (
          <NoTasksYet />
        ) : sections.some((section) => section.rows.length > 0) ? (
          sections
            .filter((section) => section.rows.length > 0)
            .map((section) => (
              <section key={section.title} aria-label={t(section.title)}>
                <h2 className="mb-2 text-small font-semibold text-muted">
                  {t(section.title)} <span className="text-faint tabular-nums">{section.rows.length}</span>
                </h2>
                <TaskList rows={section.rows} />
              </section>
            ))
        ) : (
          <EmptyState
            icon={<Icons.CheckCircle className="size-5" />}
            title={rows.length === 0 ? t("tasks.none") : show === "open" ? t("tasks.allHandedIn") : t("tasks.noneDone")}
          />
        )}
      </div>
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
          <div key={i} className={cx("px-4 py-3.5", i > 0 && "border-t border-line")}>
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="mt-2 h-3 w-2/5" />
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

function TaskList({ rows }: { rows: Row[] }) {
  const colors = useCourseColors(useDataset("edunex.courses"));
  return (
    <Card>
      <ul>
        {rows.map((row, i) => (
          <TaskRow key={row.task.id} {...row} color={colors.get(row.task.courseCode) ?? "#888"} first={i === 0} last={i === rows.length - 1} />
        ))}
      </ul>
    </Card>
  );
}

function TaskRow({ task, status, color, first, last }: Row & { color: string; first: boolean; last: boolean }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const sentAt = submittedAt(task);
  return (
    <li className={cx(!first && "border-t border-line")}>
      <button
        type="button"
        onClick={() => go({ screen: "task", taskId: task.id })}
        className={cx(
          "focus-ring grid w-full grid-cols-[minmax(0,1fr)_auto_128px] items-center gap-4 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-hover",
          first && "rounded-t-xl",
          last && "rounded-b-xl",
        )}
      >
        <span className="min-w-0">
          <span className="block truncate text-lead font-medium">{task.title}</span>
          <Place task={task} color={color} className="mt-1" />
          <RowSignals task={task} status={status} />
        </span>
        <StatusChip status={status} />
        <span className="text-right text-caption whitespace-nowrap tabular-nums">
          {sentAt !== null ? (
            <>
              <span className="block font-medium">{task.score !== null ? t("task.scoreValue", { score: formatScore(task.score, f) }) : f.relativeDay(sentAt)}</span>
              <span className="block text-faint">{task.score !== null ? f.relativeDay(sentAt) : t("task.submittedOn")}</span>
            </>
          ) : task.dueAt !== null ? (
            <>
              <span className={cx("block font-medium", (status === "overdue" || status === "closed") && "text-danger-fg")}>{f.dueLabel(task.dueAt)}</span>
              <span className="block text-faint">{status === "closed" ? t("task.notHandedIn") : f.fromNow(task.dueAt)}</span>
            </>
          ) : (
            <span className="block text-faint">{t("task.noDeadline")}</span>
          )}
        </span>
      </button>
    </li>
  );
}

/** "PL3002 · Modul 4 · Production Process Innovation": the course and module, as EduNex lays the course out. */
function Place({ task, color, className }: { task: Task; color: string; className?: string }) {
  const t = useT();
  const courses = useDataset("edunex.courses");
  const where = moduleLabel(t, task.module) ?? courses?.find((course) => course.code === task.courseCode)?.name ?? null;
  return (
    <span className={cx("flex min-w-0 items-center gap-1.5 text-small text-muted", className)}>
      <CourseDot color={color} className="size-2" />
      <span className="shrink-0 font-semibold">{task.courseCode}</span>
      {where && <span className="truncate">· {where}</span>}
    </span>
  );
}

function moduleLabel(t: Translate, module: TaskModule | null): string | null {
  if (!module) return null;
  const name = moduleName(module);
  return name ? `${t("task.module", { n: module.index })} · ${name}` : t("task.module", { n: module.index });
}

/** What EduNex doesn't say in its list: a take-home UTS, attendance taken by handing in, an edit, a short window, the late rule. */
function RowSignals({ task, status }: Row) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const presence = useDataset("edunex.presence");
  const signals: ReactNode[] = [];
  if (task.kind === "uts") signals.push(<span className="text-danger-fg">{t("task.uts")}</span>);
  const window = isOpenStatus(status) ? attendanceWindow(task, presence, now) : null;
  if (window)
    signals.push(
      <span className="inline-flex items-center gap-1 text-info-fg">
        <Icons.Hand className="size-3" />
        {t("task.attendance", { date: f.relativeDay(window.opensAt), time: f.timeRange(window.opensAt, window.closesAt) })}
      </span>,
    );
  if (task.editedAt !== null) {
    const loud = editedAfterSubmit(task);
    signals.push(
      <span className={cx("inline-flex items-center gap-1", loud ? "text-warning-fg" : "text-muted")}>
        <Icons.PenLine className="size-3" />
        {t(loud ? "task.editedAfterSubmit" : "task.edited", { date: f.dayMonth(task.editedAt) })}
      </span>,
    );
  }
  if (shortWindow(task) !== null && task.opensAt !== null && task.dueAt !== null)
    signals.push(
      <span className="inline-flex items-center gap-1 text-muted">
        <Icons.Zap className="size-3" />
        {t("task.shortWindow")} · {f.timeRange(task.opensAt, task.dueAt)}
      </span>,
    );
  if (task.opensAt !== null && notOpenYet(task, now)) signals.push(<span className="text-muted">{t("task.opens", { when: f.dueLabel(task.opensAt) })}</span>);
  if (isOpenStatus(status) && task.lateAllowed)
    signals.push(
      <span className="inline-flex items-center gap-1 text-muted">
        <Icons.Clock className="size-3" />
        {t("handIn.lateAllowed")}
      </span>,
    );
  if (!signals.length) return null;
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption font-semibold">
      {signals.map((signal, i) => (
        <span key={i}>{signal}</span>
      ))}
    </span>
  );
}

function formatScore(score: number, f: ReturnType<typeof useFormat>): string {
  return Number.isInteger(score) ? String(score) : f.number(score, 2).replace(/[.,]?0+$/, "");
}

// ---------------------------------------------------------------- Home: due next

/** Home's "Due next": the soonest Tasks still to hand in. */
export function DueNext() {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const rows = useRows();
  const colors = useCourseColors(useDataset("edunex.courses"));
  if (!rows) return null;
  const due = rows.filter((row) => isOpenStatus(row.status)).sort((a, b) => byDeadline(a.task, b.task)).slice(0, 4);
  return (
    <section className="mt-9" aria-labelledby="home-due-next">
      <SectionTitle
        aside={
          <button type="button" onClick={() => go({ screen: "tasks" })} className="focus-ring rounded text-small font-medium text-accent-fg">
            {t("nav.tasks")}
          </button>
        }
      >
        <span id="home-due-next">{t("tasks.dueNext")}</span>
      </SectionTitle>
      {due.length ? (
        <ol className="-mx-2">
          {due.map(({ task, status }) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => go({ screen: "task", taskId: task.id })}
                className="focus-ring flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-hover"
              >
                <span className={cx("mt-0.5", status === "overdue" ? "text-danger-fg" : "text-faint")}>
                  <StatusGlyph status={status} className="size-4" />
                  <span className="sr-only">{t(`taskStatus.${status}`)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium">{task.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-caption text-muted">
                    <CourseDot color={colors.get(task.courseCode) ?? "#888"} className="size-2" />
                    {task.courseCode}
                    {task.kind === "uts" && <span className="font-semibold text-danger-fg">· {t("task.uts")}</span>}
                  </span>
                </span>
                {task.dueAt !== null && (
                  <span className="text-right text-caption whitespace-nowrap tabular-nums">
                    <span className={cx("block font-medium", status === "overdue" && "text-danger-fg")}>{f.dueLabel(task.dueAt)}</span>
                    <span className="block text-faint">{f.fromNow(task.dueAt)}</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-body text-muted">{rows.length ? t("tasks.allHandedIn") : t("tasks.none")}</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- the Task page

export function TaskScreen({ taskId }: { taskId: number }) {
  const t = useT();
  const { go } = useNav();
  const tasks = useDataset("edunex.tasks");
  const task = tasks?.find((item) => item.id === taskId);
  if (task) return <TaskPage task={task} />;
  return (
    <div className="mx-auto max-w-[1080px] px-10 pt-7 pb-20">
      {tasks ? (
        <EmptyState icon={<Icons.ListChecks className="size-5" />} title={t("task.notFound")}>
          <Button size="sm" onClick={() => go({ screen: "tasks" })}>
            {t("task.backToTasks")}
          </Button>
        </EmptyState>
      ) : (
        <NoTasksYet />
      )}
    </div>
  );
}

function TaskPage({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const open = useOpenExternal();
  const colors = useCourseColors(useDataset("edunex.courses"));
  const status = taskStatus(task, now);
  const late = status === "overdue" || status === "closed";
  const where = moduleLabel(t, task.module);
  const place = (
    <>
      <CourseDot color={colors.get(task.courseCode) ?? "#888"} className="size-2" />
      <span className="font-semibold">{task.courseCode}</span>
      {where && (
        <>
          <Icons.ChevronRight className="size-3" />
          <span className="truncate">{where}</span>
        </>
      )}
    </>
  );

  return (
    <div className="mx-auto grid max-w-[1080px] gap-10 px-10 pt-7 pb-20 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
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
        <h1 className="mt-2 text-display leading-tight font-semibold tracking-[-0.02em]">{task.title}</h1>
        <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-body">
          {task.dueAt !== null ? (
            <span className={cx("inline-flex items-center gap-1.5 font-medium", late && "text-danger-fg")}>
              <Icons.Clock className="size-3.5" />
              {t("task.due", { when: f.dueLabel(task.dueAt) })}
              <span className={cx("font-normal", !late && "text-muted")}>· {f.fromNow(task.dueAt)}</span>
            </span>
          ) : (
            <span className="text-muted">{t("task.noDeadline")}</span>
          )}
          {task.opensAt !== null &&
            (notOpenYet(task, now) ? (
              <span className="font-medium text-warning-fg">{t("task.opens", { when: f.dueLabel(task.opensAt) })}</span>
            ) : (
              <span className="text-faint">{t("task.opened", { date: f.dayMonth(task.opensAt) })}</span>
            ))}
          {task.kind === "uts" && <span className="font-semibold text-danger-fg">{t("task.uts")}</span>}
        </p>

        <Notes task={task} />

        <section className="mt-8" aria-labelledby="task-instructions">
          <h2 id="task-instructions" className="mb-2.5 text-small font-semibold text-muted">
            {t("task.instructions")}
          </h2>
          {plainText(task.instructions) ? (
            <RichText html={task.instructions} onOpenLink={open} className="text-lead leading-relaxed" />
          ) : (
            <p className="text-body text-muted">{t("task.noInstructions")}</p>
          )}
        </section>

        {task.files.length > 0 && (
          <section className="mt-8" aria-labelledby="task-files">
            <h2 id="task-files" className="mb-2.5 text-small font-semibold text-muted">
              {t("task.lecturerFiles")}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {task.files.map((file) => (
                <li key={file.url}>
                  <LecturerFile file={file} />
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
    </div>
  );
}

/** What EduNex doesn't say on its Task page: attendance taken by handing it in, an edit (loudly after the Student submitted), a short window. */
function Notes({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const presence = useDataset("edunex.presence");
  const notes: { tone: "warning" | "neutral"; icon: ReactNode; text: string }[] = [];
  const attendance = attendanceWindow(task, presence, now);
  if (attendance)
    notes.push({
      tone: "warning",
      icon: <Icons.Hand className="mt-0.5 size-4 shrink-0" />,
      text: t("task.note.attendance", { date: f.relativeDay(attendance.opensAt), time: f.timeRange(attendance.opensAt, attendance.closesAt) }),
    });
  const sentAt = submittedAt(task);
  if (task.editedAt !== null && sentAt !== null && editedAfterSubmit(task))
    notes.push({
      tone: "warning",
      icon: <Icons.PenLine className="mt-0.5 size-4 shrink-0" />,
      text: t("task.note.editedAfterSubmit", { edited: f.dayMonth(task.editedAt), sent: f.dayMonth(sentAt) }),
    });
  else if (task.editedAt !== null)
    notes.push({
      tone: "neutral",
      icon: <Icons.PenLine className="mt-0.5 size-4 shrink-0" />,
      text: t("task.note.edited", { when: `${f.dayMonth(task.editedAt)}, ${f.time(task.editedAt)}` }),
    });
  const window = shortWindow(task);
  if (window !== null && task.opensAt !== null && task.dueAt !== null)
    notes.push({
      tone: "neutral",
      icon: <Icons.Zap className="mt-0.5 size-4 shrink-0" />,
      text: t("task.note.shortWindow", {
        duration: window >= HOUR ? t("task.duration.hours", { count: Math.round(window / HOUR) }) : t("task.duration.minutes", { count: Math.round(window / MINUTE) }),
        range: f.timeRange(task.opensAt, task.dueAt),
      }),
    });
  if (!notes.length) return null;
  return (
    <ul className="mt-5 space-y-2">
      {notes.map((note) => (
        <li
          key={note.text}
          className={cx("flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-body", note.tone === "warning" ? "bg-warning-bg text-warning-fg" : "bg-fill text-muted")}
        >
          {note.icon}
          <span>{note.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Downloads a file from EduNex through the browser's download manager (Downloads, then it opens). */
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

function LecturerFile({ file }: { file: TaskFile }) {
  const t = useT();
  const { download, busy } = useDownload();
  return (
    <button
      type="button"
      aria-label={t("task.download", { name: file.name })}
      onClick={() => void download(file)}
      className="focus-ring flex w-full items-center gap-3 rounded-xl border border-edge bg-surface px-3 py-2.5 text-left transition-colors duration-150 hover:bg-hover"
    >
      <Icons.FileText className="size-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate text-body font-medium">{file.name}</span>
      {busy ? <Icons.Loader className="size-4 animate-spin text-faint" /> : <Icons.Download className="size-4 text-faint" />}
    </button>
  );
}

// ---------------------------------------------------------------- handing in

const HEADER: Record<TaskStatus, string> = {
  not_started: "bg-(--status-not-started-bg) [&_svg]:text-(--status-not-started-fg)",
  draft: "bg-(--status-draft-bg) [&_svg]:text-(--status-draft-fg)",
  submitted: "bg-(--status-submitted-bg) [&_svg]:text-(--status-submitted-fg)",
  overdue: "bg-(--status-overdue-bg) [&_svg]:text-(--status-overdue-fg)",
  closed: "bg-(--status-closed-bg) [&_svg]:text-(--status-closed-fg)",
  in_review: "bg-(--status-review-bg) [&_svg]:text-(--status-review-fg)",
};

/** A file the Student attached in this visit, before it's in EduNex's answer. */
interface Attached {
  /** The id main issued for it (or a local one for a file too big to send). */
  key: string;
  name: string;
  size: number;
  state: "waiting" | "uploading" | "uploaded" | "failed";
  file?: TaskFile;
  problem?: StringKey;
}

interface Notice {
  tone: "danger" | "warning" | "neutral";
  text: StringKey;
  action?: "signIn" | "edunex";
}

let localKeys = 0;

/** The submission card: status, the Student's answer, attaching files, Save draft and Submit. */
function HandIn({ task, status }: Row) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const bridge = useBridge();
  const open = useOpenExternal();
  const edunex = useStatus("edunex");
  const { signIn, busy: signingIn } = useSignIn();
  const { download, busy: downloading } = useDownload();
  const [attached, setAttached] = useState<Attached[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [dragging, setDragging] = useState(false);
  const uploads = useRef<Promise<void>>(Promise.resolve());

  // Signed in again after the session ended: the way is clear.
  useEffect(() => {
    if (edunex.state === "live") setNotice((current) => (current?.action === "signIn" ? null : current));
  }, [edunex.state]);

  const sent = status === "submitted" || status === "in_review";
  const editable = takesAnswers(task, now);
  const sentAt = submittedAt(task);
  const saved = (task.answer?.files ?? []).filter((file) => !removed.includes(file.url));
  const uploaded = attached.flatMap((item) => (item.state === "uploaded" && item.file ? [item.file] : []));
  const files = [...saved, ...uploaded];
  const uploading = attached.some((item) => item.state === "waiting" || item.state === "uploading");
  const failed = attached.some((item) => item.state === "failed");
  const idle = editable && !uploading && !failed && busy === null;
  const canSave = idle && (uploaded.length > 0 || removed.length > 0);
  const canSubmit = idle && (files.length > 0 || (!task.fileRequired && Boolean(task.answer?.text)));

  const change = (key: string, patch: Partial<Attached>) => setAttached((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  // One upload at a time, in the order the files were attached.
  const upload = (items: Attached[]) => {
    for (const item of items) {
      uploads.current = uploads.current.then(async () => {
        change(item.key, { state: "uploading", problem: undefined });
        try {
          const file = await bridge.invoke("tasks.upload", { fileId: item.key });
          change(item.key, { state: "uploaded", file: { name: file.name, url: file.url } });
        } catch (error) {
          change(item.key, { state: "failed", problem: uploadProblem(error) });
          if (error instanceof ActionError && error.kind === "Unauthorized") setNotice(noticeFor(error));
        }
      });
    }
  };

  const attach = (picked: PickedFile[]) => {
    const items: Attached[] = picked.map((file) =>
      file.size > MAX_UPLOAD_BYTES
        ? { key: file.id, name: file.name, size: file.size, state: "failed", problem: "handIn.tooBig" }
        : { key: file.id, name: file.name, size: file.size, state: "waiting" },
    );
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
      if (file.size > MAX_UPLOAD_BYTES) {
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
      const result = await bridge.invoke(kind === "draft" ? "tasks.saveDraft" : "tasks.submit", { taskId: task.id, files });
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
        toast(t("handIn.saved"));
        return;
      case "submitted": {
        setAttached([]);
        setRemoved([]);
        const at = result.task ? submittedAt(result.task) : null;
        if (kind === "submit" && at !== null) toast(t("handIn.submitted", { when: f.dueLabel(at) }));
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

  const subtitle =
    status === "not_started"
      ? task.opensAt !== null && notOpenYet(task, now)
        ? t("task.opens", { when: f.dueLabel(task.opensAt) })
        : task.dueAt !== null
          ? f.fromNow(task.dueAt)
          : ""
      : status === "draft"
        ? t("handIn.draftStatus")
        : status === "overdue"
          ? t("handIn.lateStill")
          : status === "closed"
            ? t("handIn.closedStatus")
            : sentAt !== null
              ? f.dueLabel(sentAt)
              : "";
  const submitLabel = status === "overdue" ? t("handIn.submitLate") : t("handIn.submit");
  const inFlight = attached.filter((item) => item.state !== "failed");
  const done = inFlight.filter((item) => item.state === "uploaded").length;

  return (
    <Card className="overflow-hidden">
      <div className={cx("flex items-center gap-3 px-4 py-3.5", HEADER[status])}>
        <StatusGlyph status={status} className="size-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-lead font-semibold">{t(`taskStatus.${status}`)}</p>
          {subtitle && <p className="text-caption text-muted">{subtitle}</p>}
        </div>
        {(task.score !== null || status === "in_review") && (
          <span className="ml-auto text-right text-caption text-muted">
            {t("task.score")}
            <span className="block text-title font-semibold text-fg tabular-nums">{task.score !== null ? formatScore(task.score, f) : "—"}</span>
          </span>
        )}
      </div>

      <div className="space-y-4 p-4">
        <div>
          <p className="mb-2 text-small font-semibold text-muted">{t("handIn.yourAnswer")}</p>
          {(saved.length > 0 || attached.length > 0) && (
            <ul className="mb-2 space-y-1.5">
              {saved.map((file) => (
                <FileRow
                  key={file.url}
                  name={file.name}
                  detail={null}
                  onRemove={editable ? () => removeSaved(file.url) : undefined}
                  onDownload={editable ? undefined : () => void download(file)}
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
                      <span className="text-danger-fg">{t(item.problem ?? "handIn.uploadFailed")}</span>
                    ) : item.state === "uploaded" ? (
                      `${t("handIn.notSaved")} · ${f.fileSize(item.size)}`
                    ) : item.state === "uploading" ? (
                      t("handIn.uploading")
                    ) : (
                      t("handIn.waiting")
                    )
                  }
                  onRetry={item.state === "failed" && item.problem !== "handIn.tooBig" ? () => retry(item) : undefined}
                  onRemove={editable ? () => removeAttached(item.key) : undefined}
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
                "focus-ring flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition-colors duration-150 [&>*]:pointer-events-none",
                dragging ? "border-accent bg-info-bg" : "border-track hover:border-accent",
              )}
            >
              <Icons.Upload className="size-4 text-muted" />
              <span className="text-small">
                <span className="font-semibold text-accent-fg">{t("handIn.attach")}</span>
                <span className="text-muted"> · {t("handIn.drop")}</span>
              </span>
            </button>
          )}
          {!editable && !sent && status !== "closed" && task.opensAt !== null && (
            <p className="rounded-lg bg-fill px-3 py-2.5 text-small text-muted">{t("handIn.notOpenYet", { when: f.dueLabel(task.opensAt) })}</p>
          )}
          {status === "closed" && (
            <p className="rounded-lg bg-fill px-3 py-2.5 text-small text-muted">{task.answer ? t("handIn.draftNeverSent") : t("handIn.nothingHandedIn")}</p>
          )}
        </div>

        {uploading && (
          <div className="space-y-1.5">
            <p className="text-caption text-muted">{t("handIn.progress", { done, count: inFlight.length })}</p>
            <Bar value={inFlight.length ? done / inFlight.length : 0} color="var(--accent)" label={t("handIn.progress", { done, count: inFlight.length })} />
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
              <Button className="h-9 flex-1" disabled={!canSave} busy={busy === "draft"} onClick={() => void run("draft")}>
                {t("handIn.saveDraft")}
              </Button>
              <Button variant="primary" className="h-9 flex-[1.4]" disabled={!canSubmit} busy={busy === "submit"} onClick={() => setConfirming(true)}>
                {submitLabel}
              </Button>
            </div>
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

        <ul className="space-y-1.5 border-t border-line pt-3.5 text-caption text-muted">
          {task.fileRequired && (
            <li className="flex items-center gap-2">
              <Icons.Paperclip className="size-3.5" />
              {t("handIn.fileRequired")}
            </li>
          )}
          <li className="flex items-center gap-2">
            <Icons.Clock className="size-3.5" />
            {task.lateAllowed ? t("handIn.lateAllowed") : t("handIn.lateNotAllowed")}
          </li>
        </ul>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("handIn.confirmTitle")}
        body={t("handIn.confirmBody", { files: files.length === 1 ? files[0].name : files.length ? t("handIn.fileCount", { count: files.length }) : t("handIn.yourAnswer") })}
        confirmLabel={submitLabel}
        busy={busy === "submit"}
        onConfirm={() => void run("submit")}
      />
    </Card>
  );
}

function FileRow({
  name,
  state,
  detail,
  onRemove,
  onRetry,
  onDownload,
  downloading = false,
}: {
  name: string;
  state?: Attached["state"];
  detail: ReactNode;
  onRemove?: () => void;
  onRetry?: () => void;
  onDownload?: () => void;
  downloading?: boolean;
}) {
  const t = useT();
  const ext = /\.([a-z0-9]{1,4})$/i.exec(name)?.[1]?.toUpperCase() ?? "";
  return (
    <li className="flex items-center gap-2.5 rounded-lg bg-fill px-2.5 py-2">
      <span
        aria-hidden
        className={cx(
          "grid size-7 shrink-0 place-items-center rounded-md text-micro font-bold",
          ext === "PDF" ? "bg-danger-bg text-danger-fg" : "bg-neutral-bg text-neutral-fg",
        )}
      >
        {state === "uploading" || state === "waiting" ? <Icons.Loader className={cx("size-3.5", state === "uploading" && "animate-spin")} /> : ext || <Icons.FileText className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium">{name}</span>
        {detail && <span className="block truncate text-caption text-muted">{detail}</span>}
      </span>
      {onRetry && (
        <IconButton label={t("handIn.retry", { name })} size="sm" onClick={onRetry}>
          <Icons.RefreshCw className="size-3.5" />
        </IconButton>
      )}
      {onRemove && (
        <IconButton label={t("handIn.remove", { name })} size="sm" onClick={onRemove}>
          <Icons.X className="size-3.5" />
        </IconButton>
      )}
      {onDownload && (
        <IconButton label={t("task.download", { name })} size="sm" onClick={onDownload}>
          {downloading ? <Icons.Loader className="size-3.5 animate-spin" /> : <Icons.Download className="size-3.5" />}
        </IconButton>
      )}
    </li>
  );
}

function uploadProblem(error: unknown): StringKey {
  if (error instanceof ActionError && error.kind === "Offline") return "handIn.uploadOffline";
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
  const steps = taskHistory(task);
  if (steps.length < 2) return null;
  return (
    <Card className="p-4">
      <p className="mb-3 flex items-center justify-between text-small font-semibold text-muted">
        {t("history.title")}
        <SourceTag source="edunex" />
      </p>
      <ol className="relative ml-1.5 space-y-3 border-l border-line pl-4">
        {steps.map((step) => (
          <li key={step.kind} className="relative text-small">
            <span
              aria-hidden
              className={cx(
                "absolute top-1 -left-[21px] size-[9px] rounded-full ring-[3px] ring-surface",
                step.kind === "submitted"
                  ? "bg-live"
                  : step.kind === "edited" && editedAfterSubmit(task)
                    ? "bg-warning-fg"
                    : step.at > now
                      ? "border border-faint bg-surface"
                      : "bg-faint/60",
              )}
            />
            <span className="block font-medium">{t(`history.${step.kind}`)}</span>
            <span className="block text-faint tabular-nums">
              {f.weekdayShort(step.at)} {f.dayMonth(step.at)}, {f.time(step.at)}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
