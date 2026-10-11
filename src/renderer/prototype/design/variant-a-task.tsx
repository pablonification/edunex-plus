// PROTOTYPE (#83) — throwaway. Variant A "Calendar": the Task page — content
// on the left (with the Task's time window drawn as a track), a sticky
// submission panel on the right whose header follows the server status.
import { useRef, useState, type DragEvent } from "react";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import {
  accentText,
  card,
  clamp01,
  courseColor,
  courseMap,
  courseName,
  Ex,
  fileExt,
  focusRing,
  hairline,
  IconButton,
  ink,
  PrimaryButton,
  QuietButton,
  SectionLabel,
  STATUS_INK,
  STATUS_LABEL,
  STATUS_SOFT,
  StatusGlyph,
  Swatch,
} from "./variant-a-kit";

export function TaskScreen(props: VariantProps) {
  const { data, task, f, t, go } = props;
  const courses = courseMap(data);
  const name = courseName(courses, task.courseCode, task.courseName);
  const color = courseColor(courses, task.courseCode);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-1.5 pr-4 pl-3 [-webkit-app-region:drag]">
        <div className="flex min-w-0 items-center gap-1.5 [-webkit-app-region:no-drag]">
          <IconButton label={t("back")} onClick={() => go("tasks")}>
            <Icons.ChevronLeft className="size-4" strokeWidth={2} />
          </IconButton>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px]">
            <button
              type="button"
              onClick={() => go("course", { course: task.courseCode })}
              className={`flex min-w-0 items-center gap-1.5 rounded-[6px] px-1.5 py-1 ${ink[2]} transition-colors duration-150 hover:bg-black/[0.04] hover:text-[#1D1D1F] dark:hover:bg-white/[0.06] dark:hover:text-white ${focusRing}`}
            >
              <Swatch color={color} className="size-2.5" />
              <span className="shrink-0 font-medium tabular-nums">{task.courseCode}</span>
              <span className="max-w-[240px] truncate">{name}</span>
            </button>
            <Icons.ChevronRight className={`size-3.5 shrink-0 ${ink[3]}`} strokeWidth={2} />
            <span className="max-w-[300px] truncate px-1 font-medium" aria-current="page">
              {task.title}
            </span>
          </nav>
        </div>
        <QuietButton className="ml-auto shrink-0 [-webkit-app-region:no-drag]">
          {t("open_in_edunex")}
          <Icons.ArrowUpRight className="size-3.5" strokeWidth={2} />
        </QuietButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1010px] items-start gap-9 px-9 pt-3 pb-16">
          <article className="min-w-0 flex-1">
            <h1 className="mt-1 text-[24px] leading-[30px] font-semibold tracking-[-0.02em] text-balance">{task.title}</h1>
            <DueLine {...props} />
            <TimeTrack {...props} color={color} />

            <section className="mt-8">
              <SectionLabel>{t("instructions")}</SectionLabel>
              {task.instructionsHtml.trim() ? (
                <div
                  className="va-prose mt-2.5 max-w-[62ch]"
                  // PRODUCTION: this HTML comes from EduNex — sanitize it (e.g. DOMPurify,
                  // allow-list of tags/attributes, no inline styles/scripts) before rendering.
                  dangerouslySetInnerHTML={{ __html: task.instructionsHtml }}
                />
              ) : (
                <p className={`mt-2.5 text-[13.5px] ${ink[3]}`}>—</p>
              )}
            </section>

            {task.files.length > 0 && (
              <section className="mt-8">
                <SectionLabel>{t("lecturer_files")}</SectionLabel>
                <ul className="mt-2.5 grid max-w-[560px] gap-2">
                  {task.files.map((file) => (
                    <li key={file.name}>
                      <button
                        type="button"
                        className={`group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-shadow duration-150 hover:shadow-[0_2px_10px_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.1)] ${card} ${focusRing}`}
                      >
                        <FileBadge name={file.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{file.name}</span>
                          <span className={`text-[11.5px] ${ink[3]}`}>{fileExt(file.name) || f.dayMonth(task.opensAt ?? "")}</span>
                        </span>
                        <Icons.Download className={`size-4 shrink-0 ${ink[3]} transition-colors group-hover:text-[#2468E0] dark:group-hover:text-[#6AA6FF]`} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>

          <SubmissionPanel {...props} />
        </div>
      </div>
    </div>
  );
}

/** "in 8 days" / "9 hours ago" — skipped when it would only repeat "Yesterday"/"Tomorrow". */
function relativeSuffix(iso: string, now: Date, f: VariantProps["f"]): string | null {
  const away = Math.abs(Date.parse(iso) - now.getTime());
  if (Math.abs(f.dayOffset(iso)) === 1 && away >= 86_400_000) return null;
  return f.fromNow(iso);
}

function DueLine(props: VariantProps) {
  const { task, f, t } = props;
  if (!task.dueAt) return null;
  const due = task.dueAt;
  const late = task.status === "overdue" || task.status === "closed";
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
      <Icons.Clock className={`size-4 ${late ? STATUS_INK.overdue : ink[3]}`} />
      <span className={late ? `font-medium ${STATUS_INK.overdue}` : "font-medium"}>
        {t("due")} {f.dueLabel(due)}
      </span>
      {relativeSuffix(due, props.now, f) && <span className={late ? STATUS_INK.overdue : ink[3]}>· {relativeSuffix(due, props.now, f)}</span>}
    </p>
  );
}

/** The Task's window on a line: opened → now → due (or when it was handed in). */
function TimeTrack({ task, now, f, t, tr, color }: VariantProps & { color: string }) {
  if (!task.opensAt || !task.dueAt) return null;
  const opens = Date.parse(task.opensAt);
  const due = Date.parse(task.dueAt);
  const nowMs = now.getTime();
  const sent = task.submittedAt ? Date.parse(task.submittedAt) : null;
  const end = sent !== null ? due : Math.max(due, nowMs);
  const span = Math.max(1, end - opens);
  const at = (ms: number) => clamp01((ms - opens) / span) * 100;
  const pastDue = sent === null && nowMs > due;
  const fillTo = sent ?? Math.min(nowMs, due);
  const marker = sent ?? nowMs;
  const markerAt = at(marker);
  // Keep the floating label inside the track's width.
  const anchor = markerAt < 12 ? "translate-x-0" : markerAt > 88 ? "-translate-x-full" : "-translate-x-1/2";
  return (
    <div className="mt-5 max-w-[560px]" aria-hidden>
      <div className="relative h-4">
        <span
          className={`absolute top-0 text-[11.5px] leading-4 font-semibold whitespace-nowrap tabular-nums ${anchor} ${
            sent !== null ? "text-[#15803D] dark:text-[#4ADE80]" : "text-[#D92D33] dark:text-[#FF7A7F]"
          }`}
          style={{ left: `${markerAt}%` }}
        >
          {sent !== null ? `${t("submitted_on")} ${f.dayMonth(task.submittedAt as string)}` : t("today")}
        </span>
      </div>
      <div className="relative mt-1 h-[16px]">
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-black/[0.07] dark:bg-white/[0.09]" />
        <div className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full" style={{ width: `${at(fillTo)}%`, background: color }} />
        {pastDue && (
          <div
            className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#D92D33] dark:bg-[#FF6369]"
            style={{ left: `${at(due)}%`, width: `${at(nowMs) - at(due)}%` }}
          />
        )}
        <span className="absolute top-1/2 left-0 size-[9px] -translate-y-1/2 rounded-full border-2 bg-white dark:bg-[#141416]" style={{ borderColor: color }} />
        <span
          className={`absolute top-1/2 size-[10px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] ${
            pastDue ? "bg-[#D92D33] dark:bg-[#FF6369]" : "bg-[#1D1D1F] dark:bg-[#F2F2F3]"
          }`}
          style={{ left: `${at(due)}%` }}
        />
        {sent !== null ? (
          <span
            className="absolute top-1/2 grid size-[15px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#15803D] ring-2 ring-white dark:bg-[#22A55B] dark:ring-[#141416]"
            style={{ left: `${markerAt}%` }}
          >
            <Icons.Check className="size-2.5 text-white" strokeWidth={3.5} />
          </span>
        ) : (
          <span
            className="absolute top-1/2 h-[15px] w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D92D33] dark:bg-[#FF6369]"
            style={{ left: `${markerAt}%` }}
          />
        )}
      </div>
      <div className={`mt-1.5 flex justify-between text-[11.5px] tabular-nums ${ink[3]}`}>
        <span>
          {tr({ en: "Opened", id: "Dibuka" })} {f.dayMonth(task.opensAt)}
        </span>
        <span className={pastDue ? `font-medium ${STATUS_INK.overdue}` : ink[2]}>
          {t("due")} {f.dayMonth(task.dueAt)}
        </span>
      </div>
    </div>
  );
}

// ================================================================ submission

interface Attached {
  name: string;
  size: number | null;
}

function SubmissionPanel(props: VariantProps) {
  const { task, f, t, tr } = props;
  const status = task.status;
  const editable = status === "not_started" || status === "draft" || status === "overdue";
  const [files, setFiles] = useState<Attached[]>(() =>
    status === "draft" ? task.answerFiles.map((a) => ({ name: a.name, size: null })) : [],
  );
  const [dragging, setDragging] = useState(false);
  const [needFile, setNeedFile] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list).map((file) => ({ name: file.name, size: file.size }))]);
    setNeedFile(false);
  };
  const attempt = () => {
    if (task.fileRequired && files.length === 0) setNeedFile(true);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    add(e.dataTransfer.files);
  };

  const header = (() => {
    const due = task.dueAt;
    switch (status) {
      case "not_started":
        return due ? `${t("due")} ${f.fromNow(due)}` : "";
      case "draft":
        return tr({ en: "Not handed in yet", id: "Belum diserahkan" });
      case "submitted":
        return task.submittedAt ? f.fromNow(task.submittedAt) : "";
      case "in_review":
        return task.submittedAt ? `${t("submitted_on")} ${f.fromNow(task.submittedAt)}` : "";
      case "overdue":
        return due ? `${t("due")} ${f.fromNow(due)}` : "";
      case "closed":
        return due ? f.dueLabel(due) : "";
    }
  })();

  return (
    <aside className="sticky top-3 w-[332px] shrink-0" aria-label={t("your_answer")}>
      <div className={`overflow-hidden ${card}`}>
        <div className={`flex items-center gap-2.5 px-4 py-3 ${STATUS_SOFT[status]}`}>
          <StatusGlyph status={status} className="size-[18px]" />
          <div className="min-w-0 flex-1">
            <p className={`text-[13.5px] leading-[18px] font-semibold ${STATUS_INK[status]}`}>{t(STATUS_LABEL[status])}</p>
            {header && <p className={`truncate text-[12px] leading-[16px] tabular-nums ${ink[2]}`}>{header}</p>}
          </div>
          {status === "in_review" && <Ex.Hourglass className={`size-4 ${STATUS_INK.in_review}`} />}
        </div>

        <div className="space-y-4 p-4">
          {editable && (
            <>
              {status === "overdue" && task.lateAllowed && (
                <p className="flex items-start gap-2 rounded-[9px] bg-[#FDECEC] px-3 py-2.5 text-[12.5px] leading-[17px] font-medium text-[#B4232A] dark:bg-[#FF7A7F]/[0.1] dark:text-[#FF9A9E]">
                  <Icons.AlertTriangle className="mt-px size-4 shrink-0" />
                  {t("late_allowed")}
                </p>
              )}
              <div>
                <p className={`text-[11.5px] font-semibold ${ink[3]}`}>{t("your_answer")}</p>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {files.map((file, i) => (
                      <AnswerFile
                        key={`${file.name}-${i}`}
                        {...props}
                        name={file.name}
                        meta={[fileExt(file.name), file.size !== null ? f.fileSize(file.size) : t("status_draft")].filter(Boolean).join(" · ")}
                        onRemove={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      />
                    ))}
                  </ul>
                )}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`mt-2 rounded-[10px] border border-dashed text-center transition-colors duration-150 ${
                    dragging
                      ? "border-[#2F7CF6] bg-[#2F7CF6]/[0.07]"
                      : needFile
                        ? "border-[#D92D33]/60 bg-[#D92D33]/[0.04] dark:border-[#FF7A7F]/60"
                        : "border-black/[0.16] dark:border-white/[0.16]"
                  } ${files.length ? "px-3 py-2.5" : "px-4 py-5"}`}
                >
                  {files.length === 0 && (
                    <>
                      <Icons.Upload className={`mx-auto size-5 ${needFile ? STATUS_INK.overdue : ink[3]}`} />
                      <p className={`mt-2 text-[12.5px] ${needFile ? STATUS_INK.overdue : ink[2]}`}>
                        {needFile ? t("file_required") : t("drop_files")}
                      </p>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => input.current?.click()}
                    className={`inline-flex items-center gap-1 rounded-[6px] px-1 text-[12.5px] font-semibold ${accentText} hover:underline ${focusRing} ${
                      files.length ? "" : "mt-1"
                    }`}
                  >
                    <Ex.Plus className="size-3.5" strokeWidth={2.25} />
                    {t("attach_files")}
                  </button>
                  <input ref={input} type="file" multiple hidden onChange={(e) => add(e.currentTarget.files)} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <QuietButton onClick={attempt} className="shrink-0">
                  {t("save_draft")}
                </QuietButton>
                <PrimaryButton onClick={attempt} className="flex-1">
                  {status === "overdue" ? tr({ en: "Submit late", id: "Kumpulkan terlambat" }) : t("submit")}
                </PrimaryButton>
              </div>
              <p className={`flex items-start gap-2 text-[11.5px] leading-[16px] ${ink[3]}`}>
                <Ex.Info className="mt-px size-3.5 shrink-0" />
                {t("draft_vs_submit")}
              </p>
            </>
          )}

          {(status === "submitted" || status === "in_review") && (
            <>
              <div>
                <p className={`text-[11.5px] font-semibold ${ink[3]}`}>{t("your_answer")}</p>
                <ul className="mt-2 space-y-1.5">
                  {task.answerFiles.map((file) => (
                    <AnswerFile key={file.name} {...props} name={file.name} meta={fileExt(file.name)} />
                  ))}
                </ul>
              </div>
              <dl className={`space-y-2 border-t pt-3.5 text-[12.5px] ${hairline}`}>
                <div className="flex items-center justify-between gap-3">
                  <dt className={ink[2]}>{t("submitted_on")}</dt>
                  <dd className="font-medium tabular-nums">
                    {task.submittedAt ? `${f.weekdayShort(task.submittedAt)} ${f.dayMonth(task.submittedAt)}, ${f.time(task.submittedAt)}` : "—"}
                  </dd>
                </div>
                {task.dueAt && task.submittedAt && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className={ink[2]}>{t("due")}</dt>
                    <dd className={`tabular-nums ${ink[2]}`}>
                      {f.weekdayShort(task.dueAt)} {f.dayMonth(task.dueAt)}, {f.time(task.dueAt)}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className={ink[2]}>{t("score")}</dt>
                  <dd
                    className={`font-medium tabular-nums ${
                      task.score !== null ? "" : status === "in_review" ? STATUS_INK.in_review : ink[3]
                    }`}
                  >
                    {task.score ?? (status === "in_review" ? tr({ en: "Awaiting grade", id: "Menunggu nilai" }) : "—")}
                  </dd>
                </div>
              </dl>
            </>
          )}

          {status === "closed" && (
            <div className={`flex items-center gap-2.5 rounded-[9px] bg-black/[0.035] px-3 py-3 text-[12.5px] dark:bg-white/[0.04] ${ink[2]}`}>
              <Icons.Inbox className="size-4 shrink-0" />
              {tr({ en: "Nothing was submitted", id: "Tidak ada yang dikumpulkan" })}
            </div>
          )}
        </div>

        <footer className={`space-y-1.5 border-t px-4 py-3 text-[12px] ${hairline} ${ink[2]}`}>
          {task.fileRequired && (
            <p className="flex items-center gap-2">
              <Icons.Paperclip className={`size-3.5 ${ink[3]}`} />
              {t("file_required")}
            </p>
          )}
          {!(status === "overdue" && task.lateAllowed) && (
            <p className="flex items-center gap-2">
              <Ex.Timer className={`size-3.5 ${ink[3]}`} />
              {task.lateAllowed ? t("late_allowed") : t("late_not_allowed")}
            </p>
          )}
        </footer>
      </div>
    </aside>
  );
}

function AnswerFile({ name, meta, onRemove, tr }: VariantProps & { name: string; meta: string; onRemove?: () => void }) {
  return (
    <li className="flex items-center gap-2.5 rounded-[9px] bg-black/[0.035] py-2 pr-1.5 pl-2 dark:bg-white/[0.045]">
      <FileBadge name={name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] leading-[16px] font-medium" title={name}>
          {name}
        </span>
        {meta && <span className={`text-[11px] leading-[14px] ${ink[3]}`}>{meta}</span>}
      </span>
      {onRemove && (
        <IconButton label={tr({ en: "Remove", id: "Hapus" })} onClick={onRemove} className="size-6">
          <Icons.X className="size-3.5" strokeWidth={2} />
        </IconButton>
      )}
    </li>
  );
}

const BADGE: Record<string, string> = {
  PDF: "bg-[#FDECEC] text-[#C2262E] dark:bg-[#FF6369]/[0.14] dark:text-[#FF8A8E]",
  JPG: "bg-[#E8F1FE] text-[#1F5FCC] dark:bg-[#5B9BFF]/[0.14] dark:text-[#8DB9FF]",
  JPEG: "bg-[#E8F1FE] text-[#1F5FCC] dark:bg-[#5B9BFF]/[0.14] dark:text-[#8DB9FF]",
  PNG: "bg-[#E8F1FE] text-[#1F5FCC] dark:bg-[#5B9BFF]/[0.14] dark:text-[#8DB9FF]",
  DOCX: "bg-[#E8F0FB] text-[#2A5BB0] dark:bg-[#5B9BFF]/[0.14] dark:text-[#8DB9FF]",
  ZIP: "bg-[#FEF4DF] text-[#9A5B06] dark:bg-[#F5B547]/[0.14] dark:text-[#F5C46F]",
};

export function FileBadge({ name }: { name: string }) {
  const ext = fileExt(name);
  return (
    <span
      aria-hidden
      className={`grid h-8 w-7 shrink-0 place-items-center rounded-[6px] text-[8.5px] font-bold tracking-[0.02em] ${
        BADGE[ext] ?? "bg-black/[0.06] text-[#5F5F66] dark:bg-white/[0.08] dark:text-[#A1A1A6]"
      }`}
    >
      {ext.slice(0, 4) || <Ex.File className="size-3.5" />}
    </span>
  );
}

