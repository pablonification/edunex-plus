// PROTOTYPE (#83) — throwaway. Variant C "Spaces" — the Tasks board and the
// Task sheet (an Arc-like peek that slides over the dimmed board). Task status
// only ever comes from the server; the composer changes with it.
import { useEffect, useState, type ReactNode } from "react";
import type { FileRef, Task, TaskStatus } from "./data";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import {
  CodeTag,
  DueChip,
  EDUNEX_URL,
  FOCUS,
  INK,
  LIFT,
  MUTED,
  StatusBadge,
  StatusIcon,
  WASH,
  WASH_STRONG,
  XIcons,
  cx,
  fileKind,
  withColor,
  type Model,
} from "./variant-c-ui";

/* ------------------------------------------------------------------ board */

interface Column {
  key: string;
  title: string;
  statuses: TaskStatus[];
  icon: TaskStatus;
  empty: string;
}

export function BoardScreen({ p, m, inert = false }: { p: VariantProps; m: Model; inert?: boolean }) {
  const { t, tr, data } = p;
  const [filter, setFilter] = useState<string | null>(null);
  const tasks = data.tasks.filter((task) => !filter || task.courseCode === filter);

  const columns: Column[] = [
    {
      key: "todo",
      title: tr({ en: "To do", id: "Belum dikerjakan" }),
      statuses: ["not_started"],
      icon: "not_started",
      empty: t("all_caught_up"),
    },
    { key: "draft", title: t("status_draft"), statuses: ["draft"], icon: "draft", empty: tr({ en: "No drafts", id: "Belum ada draf" }) },
    {
      key: "submitted",
      title: t("status_submitted"),
      statuses: ["submitted", "in_review"],
      icon: "submitted",
      empty: tr({ en: "Nothing submitted yet", id: "Belum ada yang terkumpul" }),
    },
    {
      key: "late",
      title: `${t("status_overdue")} · ${t("status_closed")}`,
      statuses: ["overdue", "closed"],
      icon: "overdue",
      empty: tr({ en: "Nothing late", id: "Tidak ada yang terlambat" }),
    },
  ];

  const counts = (statuses: TaskStatus[]) => data.tasks.filter((task) => statuses.includes(task.status)).length;
  const todo = counts(["not_started", "draft", "overdue"]);
  const done = counts(["submitted", "in_review"]);

  return (
    <div className="flex h-full flex-col" inert={inert} aria-hidden={inert || undefined}>
      <header className="flex shrink-0 items-end justify-between gap-6 px-7 pt-6 pb-4">
        <div className="min-w-0">
          <p className={cx("vc-num text-[12.5px] font-semibold", MUTED)}>
            {tr({ en: `${todo} to do · ${done} submitted`, id: `${todo} aktif · ${done} terkumpul` })}
          </p>
          <h1 className="vc-display mt-0.5 text-[28px] leading-tight font-semibold">{t("tasks")}</h1>
        </div>
        <div role="group" aria-label={t("courses")} className="flex flex-wrap justify-end gap-1.5">
          <FilterChip active={filter === null} onClick={() => setFilter(null)}>
            {tr({ en: "All", id: "Semua" })}
          </FilterChip>
          {m.courses.map((c) => (
            <FilterChip key={c.code} active={filter === c.code} color={c.color} onClick={() => setFilter(filter === c.code ? null : c.code)}>
              {c.code}
            </FilterChip>
          ))}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-4 gap-3 px-7 pb-6">
        {columns.map((col) => {
          const list = tasks
            .filter((task) => col.statuses.includes(task.status))
            .sort((a, b) =>
              col.key === "submitted"
                ? m.ms(b.submittedAt ?? b.dueAt ?? "1970-01-01") - m.ms(a.submittedAt ?? a.dueAt ?? "1970-01-01")
                : m.ms(a.dueAt ?? "2999-01-01") - m.ms(b.dueAt ?? "2999-01-01"),
            );
          return (
            <section
              key={col.key}
              aria-label={col.title}
              className="flex min-h-0 flex-col rounded-[20px] bg-zinc-900/[0.028] p-1.5 ring-1 ring-zinc-900/[0.03] ring-inset dark:bg-white/[0.022] dark:ring-white/[0.03]"
            >
              <header className="flex items-center gap-2 px-2.5 pt-2 pb-2.5">
                <ColumnIcon status={col.icon} />
                <h2 className="truncate text-[13px] font-semibold">{col.title}</h2>
                <span className={cx("vc-num ml-auto text-[12px] font-semibold", MUTED)}>{list.length}</span>
              </header>
              <div className="vc-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-0.5 pt-0.5 pb-1">
                {list.length === 0 ? (
                  <div className="grid h-[104px] place-items-center rounded-[16px] border-[1.5px] border-dashed border-zinc-900/[0.09] dark:border-white/[0.09]">
                    <span className={cx("flex flex-col items-center gap-1.5 text-[12.5px] font-medium", MUTED)}>
                      <StatusIcon status={col.icon} className="size-[18px] opacity-70" />
                      {col.empty}
                    </span>
                  </div>
                ) : (
                  list.map((task) => <TaskCard key={task.id} task={task} p={p} m={m} />)
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ColumnIcon({ status }: { status: TaskStatus }) {
  const tone: Record<TaskStatus, string> = {
    not_started: "bg-zinc-900/[0.07] text-zinc-600 dark:bg-white/[0.09] dark:text-zinc-300",
    draft: "bg-[#FFB020]/[0.18] text-[#8A5300] dark:text-[#FFCF70]",
    submitted: "bg-[#22A45D]/[0.14] text-[#146C3B] dark:text-[#7EE2A0]",
    in_review: "bg-[#5856D6]/[0.14] text-[#3F3BB5] dark:text-[#B4B2FF]",
    overdue: "bg-[#FF3B30]/[0.13] text-[#B42318] dark:text-[#FF9C94]",
    closed: "bg-zinc-900/[0.07] text-zinc-600 dark:bg-white/[0.09] dark:text-zinc-300",
  };
  return (
    <span className={cx("grid size-6 shrink-0 place-items-center rounded-full", tone[status])}>
      <StatusIcon status={status} className="size-3.5" />
    </span>
  );
}

function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={color ? withColor(color) : undefined}
      className={cx(
        "vc-num inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold transition duration-150 ease-out",
        active
          ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
          : "bg-white/70 text-zinc-600 ring-1 ring-zinc-900/[0.07] hover:bg-white hover:text-zinc-900 dark:bg-white/[0.05] dark:text-zinc-300 dark:ring-white/[0.07] dark:hover:bg-white/[0.09] dark:hover:text-white",
        FOCUS,
      )}
    >
      {color && <span className="size-2 rounded-full bg-(--c)" aria-hidden />}
      {children}
    </button>
  );
}

function TaskCard({ task, p, m }: { task: Task; p: VariantProps; m: Model }) {
  const { t, tr, f, go } = p;
  const done = task.status === "submitted" || task.status === "in_review";
  const files = done ? task.answerFiles.length : task.files.length;
  return (
    <button
      type="button"
      onClick={() => go("task", { task: task.id })}
      style={withColor(m.color(task.courseCode))}
      className={cx(
        "group relative block w-full overflow-hidden rounded-[16px] bg-white py-2.5 pr-3 pl-[18px] text-left shadow-[0_1px_2px_rgba(15,20,35,0.05),0_6px_16px_-10px_rgba(15,20,35,0.14)] ring-1 ring-zinc-900/[0.05] dark:bg-[#1A1C22] dark:ring-white/[0.07] dark:shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_10px_24px_-14px_rgba(0,0,0,0.8)]",
        LIFT,
        FOCUS,
      )}
    >
      <span className="absolute inset-y-0 left-0 w-[5px] bg-(--c)" aria-hidden />
      <span className="flex items-center justify-between gap-2">
        <span className={cx("vc-num text-[11px] font-bold tracking-[0.02em]", INK)}>{task.courseCode}</span>
        <span className="flex items-center gap-2">
          {files > 0 && (
            <span
              className={cx("vc-num inline-flex items-center gap-0.5 text-[11.5px] font-semibold", MUTED)}
              title={done ? t("your_answer") : t("lecturer_files")}
            >
              <Icons.Paperclip className="size-3.5" strokeWidth={2} />
              {files}
            </span>
          )}
          {task.status === "in_review" && <StatusBadge status="in_review" t={t} size="sm" />}
        </span>
      </span>
      <span className="mt-1 line-clamp-2 text-[13.5px] leading-snug font-semibold text-zinc-900 dark:text-zinc-50">
        {task.title}
      </span>
      <span className={cx("mt-0.5 block truncate text-[11.5px]", MUTED)}>{m.courseName(task.courseCode, task.courseName)}</span>
      <span className="mt-2 flex">
        {done && task.submittedAt ? (
          <span className="vc-num inline-flex h-6 min-w-0 items-center gap-1 rounded-full bg-[#22A45D]/[0.12] px-2 text-[11.5px] font-semibold text-[#146C3B] dark:bg-[#30D158]/[0.14] dark:text-[#7EE2A0]">
            <Icons.Check className="size-3.5 shrink-0" strokeWidth={2.4} />
            <span className="truncate">
              {t("submitted_on")} {f.relativeDay(task.submittedAt)}
            </span>
          </span>
        ) : (
          <DueChip task={task} m={m} f={f} t={t} tr={tr} />
        )}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------- task sheet */

export function TaskSheet({ p, m }: { p: VariantProps; m: Model }) {
  const { t, tr, f, go, task } = p;
  const color = m.color(task.courseCode);
  const close = () => go("tasks");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") go("tasks");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <>
      <div
        className="absolute inset-0 z-30 bg-zinc-900/[0.18] backdrop-blur-[1px] motion-safe:animate-[vc-fade-in_200ms_ease-out] dark:bg-black/50"
        onClick={close}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="vc-task-title"
        style={withColor(color)}
        className="absolute top-2 right-2 bottom-2 z-40 flex w-[min(620px,58%)] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_2px_6px_rgba(15,20,35,0.06),0_30px_70px_-20px_rgba(15,20,35,0.4)] ring-1 ring-zinc-900/[0.07] motion-safe:animate-[vc-sheet-in_280ms_cubic-bezier(0.2,0.8,0.2,1)] dark:bg-[#16181D] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] dark:ring-white/[0.09]"
      >
        <header className="relative isolate shrink-0 px-6 pt-4 pb-5">
          <div className={cx("absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black_15%,transparent)]", WASH_STRONG)} aria-hidden />
          <div
            className="pointer-events-none absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-(--c) opacity-[0.22] blur-[60px] dark:opacity-[0.3]"
            aria-hidden
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => go("course", { course: task.courseCode })}
              className={cx("group flex min-w-0 items-center gap-2 rounded-full py-1 pr-2.5 pl-1 transition hover:bg-white/60 dark:hover:bg-white/[0.06]", FOCUS)}
            >
              <CodeTag code={task.courseCode} color={color} className="bg-white/80 dark:bg-white/10" />
              <span className="truncate text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-200">
                {m.courseName(task.courseCode, task.courseName)}
              </span>
              <Icons.ChevronRight className="size-3.5 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5" strokeWidth={2.2} />
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={EDUNEX_URL}
                target="_blank"
                rel="noreferrer"
                aria-label={t("open_in_edunex")}
                title={t("open_in_edunex")}
                className={cx("grid size-8 place-items-center rounded-full text-zinc-600 transition hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white", FOCUS)}
              >
                <Icons.ArrowUpRight className="size-[17px]" strokeWidth={2} />
              </a>
              <button
                type="button"
                onClick={close}
                aria-label={tr({ en: "Close", id: "Tutup" })}
                className={cx("grid size-8 place-items-center rounded-full bg-white/70 text-zinc-600 ring-1 ring-zinc-900/[0.06] transition hover:bg-white hover:text-zinc-900 dark:bg-white/[0.08] dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-white/[0.14] dark:hover:text-white", FOCUS)}
              >
                <Icons.X className="size-4" strokeWidth={2.2} />
              </button>
            </div>
          </div>
          <h1 id="vc-task-title" className="vc-display mt-3 text-[24px] leading-[1.18] font-semibold text-balance">
            {task.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} t={t} />
            <DueChip task={task} m={m} f={f} t={t} tr={tr} />
          </div>
          <div className={cx("mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-medium", MUTED)}>
            {task.fileRequired && (
              <span className="inline-flex items-center gap-1.5">
                <Icons.Paperclip className="size-3.5" strokeWidth={2} />
                {t("file_required")}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              {task.lateAllowed ? <XIcons.CalendarClock className="size-3.5" strokeWidth={2} /> : <Icons.Lock className="size-3.5" strokeWidth={2} />}
              {task.lateAllowed ? t("late_allowed") : t("late_not_allowed")}
            </span>
            {task.score !== null && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-100">
                <Icons.Star className="size-3.5" strokeWidth={2} />
                {t("score")} {task.score}
              </span>
            )}
          </div>
        </header>

        <div className="vc-scroll min-h-0 flex-1 overflow-y-auto border-t border-zinc-900/[0.06] px-6 pt-5 pb-6 dark:border-white/[0.06]">
          <SectionLabel>{t("instructions")}</SectionLabel>
          {/* PRODUCTION: sanitize instructionsHtml (e.g. DOMPurify) before rendering — it is
              lecturer-authored HTML from EduNex and must never be injected as-is. */}
          <div
            className="vc-prose mt-2 text-zinc-700 dark:text-zinc-300"
            dangerouslySetInnerHTML={{ __html: task.instructionsHtml }}
          />
          {task.files.length > 0 && (
            <div className="mt-6">
              <SectionLabel>{t("lecturer_files")}</SectionLabel>
              <div className="mt-2.5 grid gap-2">
                {task.files.map((file) => (
                  <FileRow key={file.name} file={file} action="download" label={tr({ en: "Download", id: "Unduh" })} />
                ))}
              </div>
            </div>
          )}
        </div>

        <Composer p={p} m={m} />
      </aside>
    </>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-[11px] font-bold tracking-[0.08em] text-zinc-500 uppercase dark:text-zinc-400">{children}</h2>;
}

function FileRow({
  file,
  action,
  label,
  onAction,
  meta,
}: {
  file: FileRef;
  action: "download" | "remove";
  label: string;
  onAction?: () => void;
  meta?: string;
}) {
  const kind = fileKind(file.name);
  return (
    <div className="group flex items-center gap-3 rounded-[14px] bg-white p-2 pr-2.5 ring-1 ring-zinc-900/[0.07] transition duration-150 ease-out hover:ring-zinc-900/[0.12] dark:bg-white/[0.04] dark:ring-white/[0.08] dark:hover:ring-white/[0.14]">
      <span className={cx("grid h-10 w-9 shrink-0 place-items-center rounded-[9px] text-[9.5px] font-bold tracking-[0.03em]", kind.tone)}>
        {kind.ext}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">{file.name}</span>
        {meta && <span className={cx("block truncate text-[11.5px]", MUTED)}>{meta}</span>}
      </span>
      <button
        type="button"
        onClick={onAction}
        aria-label={`${label} ${file.name}`}
        title={label}
        className={cx(
          "grid size-8 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-900/[0.06] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-white",
          FOCUS,
        )}
      >
        {action === "download" ? <Icons.Download className="size-4" strokeWidth={2} /> : <Icons.X className="size-4" strokeWidth={2.2} />}
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- composer */

function Composer({ p, m }: { p: VariantProps; m: Model }) {
  const { t, tr, f, task, data } = p;
  const [files, setFiles] = useState<FileRef[]>(task.answerFiles);
  const attach = () =>
    setFiles((list) => [...list, { name: `${data.student.nim}_${task.courseCode}${list.length ? `_${list.length + 1}` : ""}.pdf` }]);
  const remove = (name: string) => setFiles((list) => list.filter((x) => x.name !== name));
  // Every Task requires a file: Submit stays the primary action and, if
  // nothing is attached yet, points at the dropzone instead of failing.
  const [nudge, setNudge] = useState(false);
  const act = () => {
    if (task.fileRequired && !files.length) setNudge(true);
  };

  const shell = "shrink-0 border-t border-zinc-900/[0.07] bg-zinc-50/90 px-6 pt-4 pb-5 dark:border-white/[0.07] dark:bg-white/[0.025]";

  if (task.status === "submitted" || task.status === "in_review") {
    const review = task.status === "in_review";
    const onTime = task.submittedAt && task.dueAt ? m.ms(task.submittedAt) <= m.ms(task.dueAt) : null;
    return (
      <footer className={shell}>
        <div
          className={cx(
            "rounded-[18px] p-4 ring-1",
            review
              ? "bg-[#5856D6]/[0.07] ring-[#5856D6]/[0.16] dark:bg-[#7D7AFF]/[0.1] dark:ring-[#7D7AFF]/20"
              : "bg-[#22A45D]/[0.07] ring-[#22A45D]/[0.18] dark:bg-[#30D158]/[0.08] dark:ring-[#30D158]/20",
          )}
        >
          <div className="flex items-center gap-3">
            <span
              className={cx(
                "grid size-10 shrink-0 place-items-center rounded-full text-white shadow-sm",
                review ? "bg-[#5856D6] dark:bg-[#6E6BF0]" : "bg-[#22A45D] dark:bg-[#2DBE60]",
              )}
            >
              {review ? <XIcons.Hourglass className="size-[18px]" strokeWidth={2.2} /> : <Icons.Check className="size-5" strokeWidth={2.6} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">
                {review ? t("status_in_review") : t("status_submitted")}
              </p>
              <p className={cx("vc-num truncate text-[12px]", MUTED)}>
                {task.submittedAt && `${t("submitted_on")} ${f.dueLabel(task.submittedAt)} · ${f.fromNow(task.submittedAt)}`}
              </p>
            </div>
            {review ? (
              <span className="shrink-0 text-right">
                <span className={cx("block text-[10.5px] font-bold tracking-[0.08em] uppercase", MUTED)}>{t("score")}</span>
                <span className="vc-num block text-[13px] font-semibold text-[#3F3BB5] dark:text-[#B4B2FF]">
                  {tr({ en: "Pending", id: "Menunggu" })}
                </span>
              </span>
            ) : (
              onTime !== null && (
                <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[11.5px] font-semibold text-[#146C3B] ring-1 ring-[#22A45D]/20 dark:bg-white/[0.06] dark:text-[#7EE2A0]">
                  {onTime ? tr({ en: "On time", id: "Tepat waktu" }) : tr({ en: "Late", id: "Terlambat" })}
                </span>
              )
            )}
          </div>
          <div className="mt-3 grid gap-2">
            {task.answerFiles.map((file) => (
              <FileRow key={file.name} file={file} action="download" label={tr({ en: "Download", id: "Unduh" })} />
            ))}
          </div>
        </div>
      </footer>
    );
  }

  if (task.status === "closed") {
    return (
      <footer className={shell}>
        <div className="flex items-center gap-3 rounded-[18px] bg-zinc-900/[0.045] p-4 ring-1 ring-zinc-900/[0.06] dark:bg-white/[0.04] dark:ring-white/[0.07]">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900">
            <Icons.Lock className="size-[18px]" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">{tr({ en: "Submissions are closed", id: "Pengumpulan sudah ditutup" })}</p>
            <p className={cx("vc-num text-[12px]", MUTED)}>
              {task.dueAt && `${t("due")} ${f.dueLabel(task.dueAt)}`} · {t("late_not_allowed")}
            </p>
          </div>
        </div>
      </footer>
    );
  }

  // not_started · draft · overdue (late allowed): attach, save a draft, submit.
  const overdue = task.status === "overdue";
  const draft = task.status === "draft";
  return (
    <footer className={shell}>
      {overdue && task.dueAt && (
        <div className="mb-3 flex items-center gap-2.5 rounded-[14px] bg-[#FF3B30]/[0.08] px-3 py-2.5 text-[12.5px] ring-1 ring-[#FF3B30]/[0.16] dark:bg-[#FF453A]/[0.1] dark:ring-[#FF453A]/20">
          <Icons.AlertTriangle className="size-4 shrink-0 text-[#B42318] dark:text-[#FF9C94]" strokeWidth={2.2} />
          <span className="min-w-0 flex-1 font-semibold text-[#B42318] dark:text-[#FF9C94]">
            {t("status_overdue")} · {tr({ en: "was due", id: "tenggat" })} {f.dueLabel(task.dueAt)}
          </span>
          <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[11.5px] font-semibold text-zinc-700 ring-1 ring-zinc-900/[0.06] dark:bg-white/[0.08] dark:text-zinc-200">
            {t("late_allowed")}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <SectionLabel>{t("your_answer")}</SectionLabel>
        {draft && (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#8A5300] dark:text-[#FFCF70]">
            <span className="size-1.5 rounded-full bg-current" />
            {tr({ en: "Draft saved · only you can see it", id: "Draf tersimpan · hanya kamu yang bisa lihat" })}
          </span>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-2.5 grid gap-2">
          {files.map((file) => (
            <FileRow
              key={file.name}
              file={file}
              action="remove"
              label={tr({ en: "Remove", id: "Hapus" })}
              onAction={() => remove(file.name)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          attach();
          setNudge(false);
        }}
        className={cx(
          "group mt-2.5 flex w-full items-center gap-3 rounded-[16px] border-[1.5px] border-dashed text-left transition duration-150 ease-out",
          nudge && "border-[#FF3B30]/60! ring-4 ring-[#FF3B30]/10 dark:border-[#FF453A]/60!",
          files.length
            ? "border-zinc-900/[0.12] px-3 py-2 hover:border-[color-mix(in_oklab,var(--c)_60%,transparent)] hover:bg-white dark:border-white/[0.12] dark:hover:bg-white/[0.03]"
            : "border-[color-mix(in_oklab,var(--c)_38%,transparent)] bg-white px-4 py-3.5 hover:border-[color-mix(in_oklab,var(--c)_70%,transparent)] hover:bg-[color-mix(in_oklab,var(--c)_5%,white)] dark:bg-white/[0.02] dark:hover:bg-[color-mix(in_oklab,var(--c)_8%,transparent)]",
          FOCUS,
        )}
      >
        <span className={cx("grid shrink-0 place-items-center rounded-[11px] transition", files.length ? "size-8" : "size-10", WASH, INK)}>
          {files.length ? <XIcons.Plus className="size-4" strokeWidth={2.2} /> : <Icons.Upload className="size-[18px]" strokeWidth={2} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-100">
            {files.length ? t("attach_files") : t("drop_files")}
          </span>
          {!files.length &&
            (nudge ? (
              <span className="block text-[12px] font-semibold text-[#B42318] dark:text-[#FF9C94]">
                {tr({ en: "Attach your file first", id: "Lampirkan berkasmu dulu" })}
              </span>
            ) : (
              <span className={cx("block text-[12px]", MUTED)}>
                {tr({ en: "or", id: "atau" })} <span className={cx("font-semibold", INK)}>{t("attach_files").toLowerCase()}</span>
                {task.fileRequired && ` · ${t("file_required")}`}
              </span>
            ))}
        </span>
      </button>

      <div className="mt-3.5 flex items-center justify-between gap-4">
        <p className={cx("flex min-w-0 items-start gap-1.5 text-[12px] leading-snug", MUTED)}>
          <XIcons.EyeOff className="mt-px size-3.5 shrink-0" strokeWidth={2} />
          <span>{t("draft_vs_submit")}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={act}
            className={cx(
              "h-9 rounded-full px-3.5 text-[13px] font-semibold text-zinc-600 transition duration-150 ease-out hover:bg-zinc-900/[0.06] hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.08] dark:hover:text-white",
              FOCUS,
            )}
          >
            {t("save_draft")}
          </button>
          <button
            type="button"
            onClick={act}
            className={cx(
              "vc-solid inline-flex h-9 items-center gap-1.5 rounded-full px-[18px] text-[13px] font-semibold shadow-[0_6px_16px_-8px_var(--c)] transition duration-150 ease-out motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0",
              FOCUS,
            )}
          >
            {overdue ? tr({ en: "Submit late", id: "Kumpulkan terlambat" }) : t("submit")}
            <XIcons.ArrowRight className="size-3.5" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </footer>
  );
}

