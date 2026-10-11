// PROTOTYPE (#83) — throwaway. Variant B ("Lists"): the Task page, styled like
// a Things to-do opened up — a calm sheet with the title, the lecturer's notes,
// tag pills, the lecturer's files as a checklist-like list, "Your answer", and
// the actions bottom-right. Status always comes from the server; the local
// state below only fakes the round-trip so the prototype can be clicked through.
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import type { Task, TaskStatus } from "./data";
import { Icons } from "./icons";
import { useVB } from "./variant-b-context";
import { tidy } from "./variant-b-model";
import {
  Button,
  Dot,
  FileTile,
  More,
  Pill,
  STATUS_LABEL,
  STATUS_TONE,
  StatusCircle,
  cx,
  fileKind,
  focusRing,
  hairline,
  ink,
} from "./variant-b-ui";

interface LocalFile {
  name: string;
  size?: number;
}

export function TaskScreen() {
  const { p } = useVB();
  // Re-mount per Task and per previewed status so local state starts fresh.
  return <TaskSheet key={`${p.task.id}:${p.task.status}`} task={p.task} />;
}

function TaskSheet({ task }: { task: Task }) {
  const { p, m, nav } = useVB();
  const { t, tr, f, now } = p;
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [files, setFiles] = useState<LocalFile[]>(task.answerFiles.map((x) => ({ name: x.name })));
  const [submittedAt, setSubmittedAt] = useState<string | null>(task.submittedAt);
  const [busy, setBusy] = useState<null | "draft" | "submit">(null);
  const [needFile, setNeedFile] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const editable = status === "not_started" || status === "draft" || status === "overdue";
  const statusLabel = t(STATUS_LABEL[status]);

  const act = (kind: "draft" | "submit") => {
    if (task.fileRequired && files.length === 0) {
      setNeedFile(true);
      return;
    }
    setBusy(kind);
    timer.current = window.setTimeout(() => {
      setBusy(null);
      if (kind === "draft") {
        if (status === "not_started") setStatus("draft");
        setSavedAt(now.toISOString());
      } else {
        setStatus("submitted");
        setSubmittedAt(now.toISOString());
      }
    }, 650);
  };

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(list).map((x) => ({ name: x.name, size: x.size }))]);
    setNeedFile(false);
  };

  return (
    <div className="mx-auto w-full max-w-[800px] px-10 pb-24 pt-3">
      <article
        className={cx(
          "rounded-[16px] bg-white motion-safe:animate-[vb-pop_260ms_cubic-bezier(0.2,0.8,0.2,1)]",
          "shadow-[0_0_0_1px_rgba(0,0,0,0.055),0_2px_4px_rgba(0,0,0,0.03),0_12px_36px_-6px_rgba(0,0,0,0.12)]",
          "dark:bg-[#1F1F22] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.075),0_16px_40px_-8px_rgba(0,0,0,0.6)]",
        )}
        aria-labelledby="vb-task-title"
      >
        <div className="px-7 pb-7 pt-6">
          <header className="flex items-start gap-3.5">
            <span className="mt-[5px]">
              <StatusCircle status={status} label={statusLabel} size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h1
                id="vb-task-title"
                data-vb-title
                className="text-[22px] font-bold leading-[30px] tracking-[-0.018em]"
              >
                {tidy(task.title)}
              </h1>
              <DueLine task={task} status={status} />
            </div>
            <Pill tone={STATUS_TONE[status]} className="mt-[5px]">
              {statusLabel}
            </Pill>
          </header>

          <div className="pl-[36px]">
            {task.instructionsHtml.trim() && (
              <div
                className={cx("vb-prose mt-5 text-[14px] leading-[1.65]", ink.body)}
                // Prototype only: this is the lecturer's raw EduNex HTML. Production
                // must sanitize it (allow-list tags, strip inline styles/scripts)
                // before rendering.
                dangerouslySetInnerHTML={{ __html: task.instructionsHtml }}
              />
            )}

            <div className="mt-5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => nav.course(task.courseCode)}
                className={cx(
                  "inline-flex h-[24px] items-center gap-1.5 rounded-full bg-black/[0.055] px-2.5 text-[12px] font-medium",
                  "text-[#3A3A3C] transition-colors duration-150 ease-out hover:bg-black/[0.09]",
                  "dark:bg-white/[0.09] dark:text-[#D1D1D6] dark:hover:bg-white/[0.13]",
                  focusRing,
                )}
              >
                <Dot color={m.color(task.courseCode)} className="size-[7px]" />
                {m.courseName(task.courseCode, task.courseName)}
              </button>
              {task.fileRequired && (
                <Tag icon={<Icons.Paperclip className="size-3" />}>{t("file_required")}</Tag>
              )}
              <Tag
                icon={<Icons.Clock className="size-3" />}
                tone={status === "overdue" && task.lateAllowed ? "loud" : "quiet"}
              >
                {task.lateAllowed ? t("late_allowed") : t("late_not_allowed")}
              </Tag>
            </div>

            {task.files.length > 0 && (
              <SubHead title={t("lecturer_files")}>
                <ul className={cx("divide-y border-y", hairline, "divide-black/[0.06] dark:divide-white/[0.07]")}>
                  {task.files.map((file) => (
                    <li key={file.name}>
                      <button
                        type="button"
                        className={cx(
                          "group/file -mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-[8px] px-2 py-2 text-left",
                          "transition-colors duration-150 ease-out hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
                          focusRing,
                        )}
                      >
                        <FileTile kind={fileKind(file.name)} small />
                        <span className="min-w-0 flex-1 break-words text-[13.5px] leading-5">{file.name}</span>
                        <Icons.Download
                          className={cx(
                            "size-4 shrink-0 opacity-60 transition-opacity duration-150 group-hover/file:opacity-100",
                            ink.blue,
                          )}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </SubHead>
            )}

            <SubHead title={t("your_answer")}>
              {(status === "submitted" || status === "in_review") && (
                <Receipt status={status} files={files} submittedAt={submittedAt} score={task.score} />
              )}
              {status === "closed" && (
                <div
                  className={cx(
                    "flex items-center gap-2.5 rounded-[12px] bg-black/[0.035] px-3.5 py-3 text-[13.5px] dark:bg-white/[0.045]",
                    ink.secondary,
                  )}
                >
                  <Icons.Lock className="size-4 shrink-0" />
                  {tr({ en: "Nothing was submitted", id: "Tidak ada yang dikumpulkan" })}
                </div>
              )}
              {editable && (
                <AnswerEditor
                  files={files}
                  needFile={needFile}
                  onAdd={addFiles}
                  onRemove={(i) => setFiles((prev) => prev.filter((_, j) => j !== i))}
                />
              )}
            </SubHead>
          </div>
        </div>

        {editable && (
          <footer
            className={cx(
              "flex items-center gap-3 rounded-b-[16px] border-t px-7 py-3.5",
              hairline,
              "bg-[#FAFAFB] dark:bg-white/[0.02]",
            )}
          >
            <p className={cx("flex min-w-0 flex-1 items-start gap-2 text-[12.5px] leading-[18px]", ink.secondary)}>
              {savedAt && !busy ? (
                <>
                  <Icons.Check className={cx("mt-px size-[15px] shrink-0", ink.green)} strokeWidth={2.2} />
                  <span>
                    {tr({ en: "Draft saved", id: "Draf tersimpan" })} {f.time(savedAt)} — {t("draft_vs_submit")}
                  </span>
                </>
              ) : (
                <>
                  <More.Info className="mt-px size-[15px] shrink-0" />
                  <span>{t("draft_vs_submit")}</span>
                </>
              )}
            </p>
            <Button kind="quiet" onClick={() => act("draft")} disabled={busy !== null}>
              {busy === "draft" && <More.Spinner className="size-3.5 motion-safe:animate-spin" />}
              {t("save_draft")}
            </Button>
            <Button kind="primary" onClick={() => act("submit")} disabled={busy !== null} className="min-w-[92px]">
              {busy === "submit" && <More.Spinner className="size-3.5 motion-safe:animate-spin" />}
              {status === "overdue" ? tr({ en: "Submit late", id: "Kumpulkan terlambat" }) : t("submit")}
            </Button>
          </footer>
        )}
      </article>
    </div>
  );
}

/** Under the title: when it's due — or was due, or when it was handed in. */
function DueLine({ task, status }: { task: Task; status: TaskStatus }) {
  const { p, m } = useVB();
  const { t, tr, f, now } = p;
  if (!task.dueAt) return null;
  const due = task.dueAt;
  const hoursLeft = (new Date(due).getTime() - now.getTime()) / 3_600_000;
  const wasDue = tr({ en: "Was due", id: "Tenggat" });

  let icon: ReactNode = <More.Flag className="size-[14px]" />;
  let tone: string = ink.secondary;
  let text: ReactNode = (
    <>
      {t("due")} {m.when(due)}
    </>
  );
  if (status === "overdue") {
    tone = ink.red;
    text = (
      <>
        <span className="font-semibold">{t("status_overdue")}</span> · {wasDue} {m.when(due)}
      </>
    );
  } else if (status === "closed") {
    icon = <Icons.Lock className="size-[14px]" />;
    text = (
      <>
        {wasDue} {m.when(due)}
      </>
    );
  } else if (status === "submitted" || status === "in_review") {
    text = (
      <>
        {t("due")} {f.dueLabel(due)}
      </>
    );
  } else if (hoursLeft < 24) {
    tone = ink.red;
  }
  return <div className={cx("mt-1 flex items-center gap-1.5 text-[13px] leading-5", tone)}>{icon}<span>{text}</span></div>;
}

function Tag({ icon, children, tone = "quiet" }: { icon: ReactNode; children: ReactNode; tone?: "quiet" | "loud" }) {
  return (
    <span
      className={cx(
        "inline-flex h-[24px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium",
        tone === "loud"
          ? "bg-[#FF3B30]/[0.1] text-[#B8000F] dark:bg-[#FF453A]/[0.17] dark:text-[#FF7A72]"
          : "bg-black/[0.055] text-[#3A3A3C] dark:bg-white/[0.09] dark:text-[#D1D1D6]",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function SubHead({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className={cx("mb-2 text-[13px] font-semibold", ink.secondary)}>{title}</h2>
      {children}
    </section>
  );
}

/** Submitted / in review: a receipt — when, which files — and nothing to edit. */
function Receipt({
  status,
  files,
  submittedAt,
  score,
}: {
  status: "submitted" | "in_review";
  files: LocalFile[];
  submittedAt: string | null;
  score: number | null;
}) {
  const { p, m } = useVB();
  const { t, tr, f, now } = p;
  const justNow = submittedAt !== null && Math.abs(now.getTime() - new Date(submittedAt).getTime()) < 60_000;
  return (
    <div className={cx("overflow-hidden rounded-[12px] ring-1", "ring-black/[0.07] dark:ring-white/[0.08]")}>
      <div
        className={cx(
          "flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3.5 py-2.5",
          status === "submitted"
            ? "bg-[#2EA44F]/[0.07] dark:bg-[#30D158]/[0.08]"
            : "bg-[#5856D6]/[0.07] dark:bg-[#5E5CE6]/[0.12]",
        )}
      >
        <StatusCircle status={status} label={t(STATUS_LABEL[status])} size={16} />
        <span className="min-w-0 flex-1 text-[13px] leading-5">
          <span className="font-semibold">{t("submitted_on")}</span>{" "}
          {submittedAt &&
            (justNow ? (
              <>
                {f.dueLabel(submittedAt)}
                <span className={ink.secondary}> · {tr({ en: "just now", id: "baru saja" })}</span>
              </>
            ) : (
              m.when(submittedAt)
            ))}
        </span>
        {status === "in_review" && (
          <span className="text-[12.5px] font-medium text-[#4441B8] dark:text-[#ABA9FF]">
            {tr({ en: "Being graded", id: "Sedang dinilai" })}
          </span>
        )}
        {score !== null && (
          <span className="text-[13px] font-semibold tabular-nums">
            {t("score")} {score}
          </span>
        )}
      </div>
      <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.07]">
        {files.map((file) => (
          <li key={file.name} className="flex items-center gap-3 px-3.5 py-2.5">
            <FileTile kind={fileKind(file.name)} small />
            <span className="min-w-0 flex-1 break-words text-[13.5px] leading-5">{file.name}</span>
            {file.size !== undefined && (
              <span className={cx("shrink-0 text-[12px] tabular-nums", ink.secondary)}>{f.fileSize(file.size)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Not started / draft / overdue: attached files (removable) and a drop zone. */
function AnswerEditor({
  files,
  needFile,
  onAdd,
  onRemove,
}: {
  files: LocalFile[];
  needFile: boolean;
  onAdd: (list: FileList | null) => void;
  onRemove: (index: number) => void;
}) {
  const { p } = useVB();
  const { t, tr, f } = p;
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = () => input.current?.click();
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onAdd(e.dataTransfer.files);
  };
  const dragProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop,
  };

  return (
    <div>
      <input
        ref={input}
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(e) => {
          onAdd(e.target.files);
          e.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className={cx("mb-2 divide-y border-y", hairline, "divide-black/[0.06] dark:divide-white/[0.07]")}>
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="group/file flex items-center gap-3 py-2">
              <FileTile kind={fileKind(file.name)} small />
              <span className="min-w-0 flex-1 break-words text-[13.5px] leading-5">{file.name}</span>
              {file.size !== undefined && (
                <span className={cx("shrink-0 text-[12px] tabular-nums", ink.secondary)}>{f.fileSize(file.size)}</span>
              )}
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={tr({ en: `Remove ${file.name}`, id: `Hapus ${file.name}` })}
                className={cx(
                  "grid size-6 shrink-0 place-items-center rounded-full transition-[opacity,background-color] duration-150 ease-out",
                  "opacity-60 hover:bg-black/[0.06] group-hover/file:opacity-100 dark:hover:bg-white/[0.08]",
                  ink.secondary,
                  focusRing,
                )}
              >
                <Icons.X className="size-3.5" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 ? (
        <div {...dragProps} className={cx("flex items-center gap-2 rounded-[10px] py-1", over && "bg-[#007AFF]/[0.06]")}>
          <Button kind="quiet" size="sm" onClick={pick} className={cx("-ml-2.5", ink.blue)}>
            <Icons.Paperclip className="size-3.5" />
            {t("attach_files")}
          </Button>
        </div>
      ) : (
        <div
          {...dragProps}
          className={cx(
            "flex flex-col items-center justify-center gap-1.5 rounded-[12px] border-[1.5px] border-dashed px-4 py-6 text-center",
            "transition-colors duration-150 ease-out",
            over
              ? "border-[#007AFF] bg-[#007AFF]/[0.05] dark:border-[#0A84FF] dark:bg-[#0A84FF]/[0.08]"
              : needFile
                ? "border-[#FF3B30]/55 bg-[#FF3B30]/[0.035] dark:border-[#FF453A]/50 dark:bg-[#FF453A]/[0.06]"
                : "border-black/[0.13] dark:border-white/[0.14]",
          )}
        >
          <Icons.Upload className={cx("size-5", needFile ? ink.red : ink.secondary)} />
          <div className={cx("text-[13.5px] leading-5", ink.secondary)}>
            {t("drop_files")} ·{" "}
            <button
              type="button"
              onClick={pick}
              className={cx("rounded-[4px] font-medium hover:underline", ink.blue, focusRing)}
            >
              {t("attach_files")}
            </button>
          </div>
          {needFile && (
            <div role="alert" className={cx("text-[12.5px] font-medium", ink.red)}>
              {tr({ en: "Attach a file first", id: "Lampirkan berkas dulu" })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
