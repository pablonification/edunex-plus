// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": Tugas & Ujian (all
// courses) and the Task page. Every Task keeps its LMS context: course and
// module, the way students find it in EduNex.
import { useState, type JSX } from "react";
import type { Task } from "./data";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import { ExamList } from "./variant-d-exams";
import { taskSignals } from "./variant-d-insights";
import {
  CourseDot,
  EmptyState,
  SourceTag,
  StatusChip,
  StatusGlyph,
  courseOf,
  cx,
  isOpenTask,
  moduleNumber,
  moduleOf,
  statusLabel,
  tint,
  ui,
} from "./variant-d-ui";

// ---------------------------------------------------------------- Tugas & Ujian

type Filter = "open" | "done";

export function TasksPage(p: VariantProps) {
  const { data, f, tr } = p;
  const [filter, setFilter] = useState<Filter>("open");
  const open = data.tasks.filter(isOpenTask).sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));
  const done = data.tasks.filter((x) => !isOpenTask(x)).sort((a, b) => (b.submittedAt ?? b.dueAt ?? "").localeCompare(a.submittedAt ?? a.dueAt ?? ""));

  const groups: { title: string; tasks: Task[] }[] =
    filter === "open"
      ? [
          { title: tr({ en: "Overdue", id: "Terlambat" }), tasks: open.filter((x) => x.status === "overdue") },
          { title: tr({ en: "This week", id: "Minggu ini" }), tasks: open.filter((x) => x.status !== "overdue" && x.dueAt && f.dayOffset(x.dueAt) <= 6) },
          { title: tr({ en: "Next week", id: "Minggu depan" }), tasks: open.filter((x) => x.dueAt && f.dayOffset(x.dueAt) >= 7 && f.dayOffset(x.dueAt) <= 13) },
          { title: tr({ en: "Later", id: "Nanti" }), tasks: open.filter((x) => !x.dueAt || f.dayOffset(x.dueAt) >= 14) },
        ]
      : [{ title: tr({ en: "Submitted", id: "Sudah dikumpulkan" }), tasks: done }];

  return (
    <div className="mx-auto max-w-[920px] px-10 pt-7 pb-20">
      <header className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{tr({ en: "Tasks & Exams", id: "Tugas & Ujian" })}</h1>
          <p className={cx("mt-1 text-[13px]", ui.muted)}>
            {tr({ en: `${open.length} to hand in · ${done.length} submitted`, id: `${open.length} perlu dikumpulkan · ${done.length} terkumpul` })}
          </p>
        </div>
        <div className={cx("flex rounded-lg p-0.5", ui.fill)} role="tablist">
          {(
            [
              ["open", tr({ en: "To hand in", id: "Perlu dikumpulkan" }), open.length],
              ["done", tr({ en: "Submitted", id: "Terkumpul" }), done.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={cx(
                "flex h-7 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition",
                filter === key ? "bg-white shadow-[0_1px_2px_rgba(16,24,40,0.12)] dark:bg-[#34343a]" : ui.muted,
                ui.focus,
              )}
            >
              {label}
              <span className={cx("text-[11px] tabular-nums", ui.faint)}>{count}</span>
            </button>
          ))}
        </div>
      </header>

      <section className="mt-7">
        <h2 className={cx("mb-2 flex items-center gap-2 text-[12.5px] font-semibold", ui.muted)}>
          {tr({ en: "Exams", id: "Ujian" })}
          <SourceTag source="SIX" />
          <SourceTag source="EduNex" />
          <SourceTag source="ITB" />
        </h2>
        <ExamList {...p} />
      </section>

      <div className="mt-8 space-y-7">
        {groups
          .filter((g) => g.tasks.length > 0)
          .map((g) => (
            <section key={g.title}>
              <h2 className={cx("mb-2 text-[12.5px] font-semibold", ui.muted)}>
                {g.title} <span className={ui.faint}>{g.tasks.length}</span>
              </h2>
              <ul className={cx("overflow-hidden", ui.card)}>
                {g.tasks.map((task, i) => (
                  <TaskRow key={task.id} {...p} task={task} first={i === 0} />
                ))}
              </ul>
            </section>
          ))}
        {groups.every((g) => g.tasks.length === 0) && (
          <EmptyState icon={<Icons.CheckCircle className="size-6" />} title={tr({ en: "All handed in", id: "Semua sudah dikumpulkan" })} />
        )}

      </div>
    </div>
  );
}

function TaskRow({ task, first, ...p }: VariantProps & { task: Task; first: boolean }) {
  const { data, f, t, tr, go } = p;
  const sig = taskSignals(data, task, p.now);
  const course = courseOf(data, task.courseCode);
  const mod = moduleOf(data, task.moduleId);
  const overdue = task.status === "overdue";
  return (
    <li className={cx(!first && "border-t", ui.line)}>
      <button
        onClick={() => go("task", { task: task.id })}
        className={cx("grid w-full grid-cols-[minmax(0,1fr)_auto_128px] items-center gap-4 px-4 py-3.5 text-left", ui.hover, ui.focus)}
      >
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium">{task.title}</span>
          <span className={cx("mt-1 flex min-w-0 items-center gap-1.5 text-[12px]", ui.muted)}>
            <CourseDot color={course?.color ?? "#999"} className="size-2" />
            <span className="shrink-0 font-semibold">{task.courseCode}</span>
            <span className="truncate">
              {mod ? `· ${tr({ en: "Module", id: "Modul" })} ${moduleNumber(data, mod)}: ${mod.title}` : `· ${task.courseName}`}
            </span>
          </span>
          {(sig.attendanceWindow || sig.editedAt || sig.shortNotice || task.domain === "uts") && (
            <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-semibold">
              {task.domain === "uts" && <span className="text-[#c4321f] dark:text-[#ff9c8f]">{tr({ en: "Take-home UTS", id: "UTS take-home" })}</span>}
              {sig.attendanceWindow && new Date(sig.attendanceWindow.closesAt) > p.now && (
                <span className="inline-flex items-center gap-1 text-[#9a5b00] dark:text-[#f5c46a]">
                  <Icons.Hand className="size-3" />
                  {tr({
                    en: `Counts as attendance if handed in ${f.weekdayShort(sig.attendanceWindow.opensAt)} ${f.dayMonth(sig.attendanceWindow.opensAt)}, ${f.timeRange(sig.attendanceWindow.opensAt, sig.attendanceWindow.closesAt)}`,
                    id: `Terhitung presensi jika dikumpulkan ${f.weekdayShort(sig.attendanceWindow.opensAt)} ${f.dayMonth(sig.attendanceWindow.opensAt)}, ${f.timeRange(sig.attendanceWindow.opensAt, sig.attendanceWindow.closesAt)}`,
                  })}
                </span>
              )}
              {sig.editedAt && (
                <span className={cx("inline-flex items-center gap-1", sig.editedAfterSubmit ? "text-[#9a5b00] dark:text-[#f5c46a]" : ui.muted)}>
                  <Icons.PenLine className="size-3" />
                  {sig.editedAfterSubmit
                    ? tr({ en: `Changed after you submitted (${f.dayMonth(sig.editedAt)})`, id: `Diubah setelah kamu kumpulkan (${f.dayMonth(sig.editedAt)})` })
                    : tr({ en: `Edited by lecturer ${f.dayMonth(sig.editedAt)}`, id: `Diubah dosen ${f.dayMonth(sig.editedAt)}` })}
                </span>
              )}
              {sig.shortNotice && (
                <span className={cx("inline-flex items-center gap-1", ui.muted)}>
                  <Icons.Zap className="size-3" />
                  {tr({ en: "Short window", id: "Waktu singkat" })}
                  {task.opensAt && task.dueAt ? ` · ${f.timeRange(task.opensAt, task.dueAt)}` : ""}
                </span>
              )}
            </span>
          )}
        </span>
        <StatusChip status={task.status} t={t} />
        <span className="text-right text-[12px] whitespace-nowrap tabular-nums">
          {task.status === "submitted" || task.status === "in_review" ? (
            task.submittedAt && (
              <>
                <span className="block font-medium">{f.relativeDay(task.submittedAt)}</span>
                <span className={cx("block", ui.faint)}>{t("submitted_on")}</span>
              </>
            )
          ) : (
            task.dueAt && (
              <>
                <span className={cx("block font-medium", overdue && "text-[#b42318] dark:text-[#ff9c94]")}>{f.dueLabel(task.dueAt)}</span>
                <span className={cx("block", ui.faint)}>{f.fromNow(task.dueAt)}</span>
              </>
            )
          )}
        </span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------- Task page

export function TaskPage(p: VariantProps) {
  const { data, task, f, t, tr, go } = p;
  const course = courseOf(data, task.courseCode);
  const mod = moduleOf(data, task.moduleId);
  const overdue = task.status === "overdue" || task.status === "closed";

  return (
    <div className="mx-auto grid max-w-[1080px] grid-cols-[minmax(0,1fr)_340px] gap-10 px-10 pt-7 pb-20">
      <article className="min-w-0">
        <button
          onClick={() => course && go("course", { course: course.code })}
          className={cx("flex items-center gap-1.5 rounded text-[12.5px] font-medium", ui.muted, "hover:text-current", ui.focus)}
        >
          <CourseDot color={course?.color ?? "#999"} className="size-2" />
          <span className="font-semibold">{task.courseCode}</span>
          {mod && (
            <>
              <Icons.ChevronRight className="size-3" />
              <span className="truncate">
                {tr({ en: "Module", id: "Modul" })} {moduleNumber(data, mod)} · {mod.title}
              </span>
            </>
          )}
        </button>
        <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.02em]">{task.title}</h1>
        {task.dueAt && (
          <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <span className={cx("inline-flex items-center gap-1.5 font-medium", overdue && "text-[#b42318] dark:text-[#ff9c94]")}>
              <Icons.Clock className="size-3.5" />
              {t("due")} {f.dueLabel(task.dueAt)}
              <span className={cx("font-normal", ui.muted)}>· {f.fromNow(task.dueAt)}</span>
            </span>
            {task.opensAt && (
              <span className={ui.faint}>
                {tr({ en: "Opened", id: "Dibuka" })} {f.dayMonth(task.opensAt)}
              </span>
            )}
          </p>
        )}

        <Signals {...p} />

        <section className="mt-8">
          <h2 className={cx("mb-2.5 text-[12.5px] font-semibold", ui.muted)}>{t("instructions")}</h2>
          {/* Prototype only: production must sanitize vendor HTML before rendering it. */}
          <div
            className={cx(
              "text-[14px] leading-[1.65] [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-2 [&_p:first-child]:mt-0 [&_ul]:list-disc [&_ul]:pl-5",
            )}
            dangerouslySetInnerHTML={{ __html: task.instructionsHtml || `<p>${tr({ en: "No instructions.", id: "Tidak ada instruksi." })}</p>` }}
          />
        </section>

        {task.files.length > 0 && (
          <section className="mt-8">
            <h2 className={cx("mb-2.5 text-[12.5px] font-semibold", ui.muted)}>{t("lecturer_files")}</h2>
            <ul className="grid grid-cols-2 gap-2">
              {task.files.map((file) => (
                <li key={file.name} className={cx("flex items-center gap-3 px-3 py-2.5", ui.card)}>
                  <Icons.FileText className={cx("size-4 shrink-0", ui.muted)} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{file.name}</span>
                  <Icons.Download className={cx("size-4", ui.faint)} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <aside className="space-y-4 self-start lg:sticky lg:top-6">
        <SubmissionCard {...p} />
        <History {...p} />
      </aside>
    </div>
  );
}

const HEADER_TONE: Record<Task["status"], string> = {
  not_started: "#8e8e95",
  draft: "#c58a00",
  submitted: "#1f9d55",
  overdue: "#d92d20",
  closed: "#6b6b73",
  in_review: "#6d46d9",
};

function SubmissionCard(p: VariantProps) {
  const { task, f, t, tr } = p;
  const tone = HEADER_TONE[task.status];
  const canEdit = task.status === "not_started" || task.status === "draft" || task.status === "overdue";
  const sent = task.status === "submitted" || task.status === "in_review";

  const subtitle =
    task.status === "not_started"
      ? task.dueAt && f.fromNow(task.dueAt)
      : task.status === "draft"
        ? tr({ en: "Not handed in yet", id: "Belum diserahkan" })
        : task.status === "overdue"
          ? task.lateAllowed
            ? tr({ en: "You can still hand it in late", id: "Masih bisa dikumpulkan terlambat" })
            : ""
          : task.status === "closed"
            ? tr({ en: "Submissions are closed", id: "Pengumpulan sudah ditutup" })
            : task.submittedAt
              ? `${f.relativeDay(task.submittedAt)}, ${f.time(task.submittedAt)}`
              : "";

  return (
    <div className={cx("overflow-hidden", ui.card)}>
      <div className="flex items-center gap-3 px-4 py-3.5" style={{ background: tint(tone, p.dark ? 0.16 : 0.09) }}>
        <span style={{ color: tone }}>
          <StatusGlyph status={task.status} className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">{statusLabel(t, task.status)}</p>
          {subtitle && <p className={cx("text-[12px]", ui.muted)}>{subtitle}</p>}
        </div>
        {task.status === "in_review" && (
          <span className={cx("ml-auto text-right text-[11.5px]", ui.muted)}>
            {t("score")}
            <span className="block font-semibold text-current">—</span>
          </span>
        )}
      </div>

      <div className="space-y-4 p-4">
        <div>
          <p className={cx("mb-2 text-[12px] font-semibold", ui.muted)}>{t("your_answer")}</p>
          {task.answerFiles.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {task.answerFiles.map((file) => (
                <li key={file.name} className={cx("flex items-center gap-2.5 rounded-lg px-2.5 py-2", ui.fill)}>
                  <span className="grid size-7 place-items-center rounded-md bg-[#fde8e6] text-[10px] font-bold text-[#c4321f] dark:bg-[#3a1c19] dark:text-[#ff9c8f]">
                    PDF
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{file.name}</span>
                  {canEdit ? (
                    <button aria-label={tr({ en: "Remove", id: "Hapus" })} className={cx("rounded p-1", ui.faint, ui.hover, ui.focus)}>
                      <Icons.X className="size-3.5" />
                    </button>
                  ) : (
                    <Icons.Download className={cx("size-4", ui.faint)} />
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <button
              className={cx(
                "flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition hover:border-[#2f6feb]/50",
                "border-[#d9d9de] dark:border-[#3a3a40]",
                ui.focus,
              )}
            >
              <Icons.Upload className={cx("size-4", ui.muted)} />
              <span className="text-[12.5px]">
                <span className={cx("font-semibold", ui.accentText)}>{t("attach_files")}</span>
                <span className={ui.muted}> · {t("drop_files")}</span>
              </span>
            </button>
          )}
          {task.status === "closed" && (
            <p className={cx("rounded-lg px-3 py-2.5 text-[12.5px]", ui.fill, ui.muted)}>
              {tr({ en: "Nothing was handed in.", id: "Tidak ada berkas yang dikumpulkan." })}
            </p>
          )}
        </div>

        {canEdit && (
          <>
            <div className="flex items-center gap-2">
              <button className={cx("h-9 flex-1 rounded-lg text-[13px] font-medium", ui.secondary, ui.focus)}>{t("save_draft")}</button>
              <button className={cx("h-9 flex-[1.4] rounded-lg text-[13px] font-semibold", ui.primary, ui.focus)}>
                {task.status === "overdue" ? tr({ en: "Submit late", id: "Kumpulkan terlambat" }) : t("submit")}
              </button>
            </div>
            <p className={cx("flex items-start gap-2 text-[12px] leading-snug", ui.muted)}>
              <Icons.Lock className="mt-px size-3.5 shrink-0" />
              {t("draft_vs_submit")}
            </p>
          </>
        )}
        {sent && (
          <p className={cx("flex items-start gap-2 text-[12px] leading-snug", ui.muted)}>
            <Icons.ShieldCheck className="mt-px size-3.5 shrink-0 text-[#1f9d55]" />
            {task.status === "in_review"
              ? tr({ en: "Your lecturer is grading this.", id: "Dosen sedang menilai tugas ini." })
              : tr({ en: "Handed in. Submissions are final.", id: "Sudah diserahkan. Pengumpulan bersifat final." })}
          </p>
        )}

        <ul className={cx("space-y-1.5 border-t pt-3.5 text-[12px]", ui.line, ui.muted)}>
          {task.fileRequired && (
            <li className="flex items-center gap-2">
              <Icons.Paperclip className="size-3.5" />
              {t("file_required")}
            </li>
          )}
          <li className="flex items-center gap-2">
            <Icons.Clock className="size-3.5" />
            {task.lateAllowed ? t("late_allowed") : t("late_not_allowed")}
          </li>
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- what EduNex doesn't say on this page

function Signals(p: VariantProps) {
  const { data, now, task, f, tr } = p;
  const sig = taskSignals(data, task, now);
  const window = sig.attendanceWindow;
  const notes: { tone: "warn" | "info"; Icon: (props: { className?: string }) => JSX.Element; text: string }[] = [];
  if (sig.editedAfterSubmit && sig.editedAt && task.submittedAt)
    notes.push({
      tone: "warn",
      Icon: Icons.PenLine,
      text: tr({
        en: `Your lecturer changed this task on ${f.dayMonth(sig.editedAt)}, after you submitted on ${f.dayMonth(task.submittedAt)}. EduNex didn't notify you. Check that your answer still fits the instructions.`,
        id: `Dosen mengubah tugas ini pada ${f.dayMonth(sig.editedAt)}, setelah kamu mengumpulkan pada ${f.dayMonth(task.submittedAt)}. EduNex tidak memberi tahu. Pastikan jawabanmu masih sesuai instruksi.`,
      }),
    });
  else if (sig.editedAt)
    notes.push({
      tone: "info",
      Icon: Icons.PenLine,
      text: tr({
        en: `Edited by the lecturer on ${f.dayMonth(sig.editedAt)}, ${f.time(sig.editedAt)}, after it was posted. EduNex sent no notification. From now on the app shows exactly what changed.`,
        id: `Diubah dosen pada ${f.dayMonth(sig.editedAt)}, ${f.time(sig.editedAt)}, setelah diunggah. EduNex tidak mengirim notifikasi. Mulai sekarang aplikasi menunjukkan apa persisnya yang berubah.`,
      }),
    });
  if (window && new Date(window.closesAt) > now)
    notes.push({
      tone: "warn",
      Icon: Icons.Hand,
      text: tr({
        en: `This task is also your ${task.courseCode} attendance: the lecturer set that EduNex Presence to "Answer Assignment". Hand it in on ${f.weekday(window.opensAt)}, ${f.dayMonth(window.opensAt)} between ${f.time(window.opensAt)} and ${f.time(window.closesAt)} to be counted present.`,
        id: `Tugas ini sekaligus presensi ${task.courseCode}: dosen mengatur Presensi EduNex itu ke "Answer Assignment". Kumpulkan pada ${f.weekday(window.opensAt)}, ${f.dayMonth(window.opensAt)} antara ${f.time(window.opensAt)} dan ${f.time(window.closesAt)} agar tercatat hadir.`,
      }),
    });
  if (sig.shortNotice && task.opensAt && task.dueAt)
    notes.push({
      tone: "info",
      Icon: Icons.Zap,
      text: tr({
        en: `Open for only ${Math.round((Date.parse(task.dueAt) - Date.parse(task.opensAt)) / 3_600_000)} hours (${f.timeRange(task.opensAt, task.dueAt)}). Tasks like this get an immediate alert.`,
        id: `Hanya dibuka ${Math.round((Date.parse(task.dueAt) - Date.parse(task.opensAt)) / 3_600_000)} jam (${f.timeRange(task.opensAt, task.dueAt)}). Tugas seperti ini langsung dinotifikasi.`,
      }),
    });
  if (task.domain === "uts") {
    const inClass = data.sessions.find((x) => x.courseCode === task.courseCode && /UTS/i.test(x.activity));
    if (inClass)
      notes.push({
        tone: "warn",
        Icon: Icons.GraduationCap,
        text: tr({
          en: `SIX also lists a UTS in class for ${task.courseCode} on ${f.weekday(inClass.start)}, ${f.dayMonth(inClass.start)} at ${f.time(inClass.start)} in ${inClass.room}. Ask your lecturer whether that's the same exam or a second part.`,
          id: `SIX juga mencantumkan UTS di kelas untuk ${task.courseCode} pada ${f.weekday(inClass.start)}, ${f.dayMonth(inClass.start)} pukul ${f.time(inClass.start)} di ${inClass.room}. Tanyakan ke dosen apakah itu ujian yang sama atau bagian kedua.`,
        }),
      });
  }
  if (!notes.length) return null;
  return (
    <ul className="mt-5 space-y-2">
      {notes.map((n, i) => (
        <li
          key={i}
          className={cx(
            "flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] leading-[1.5]",
            n.tone === "warn" ? "bg-[#fdf6e3] text-[#5c3d00] dark:bg-[#2e2510] dark:text-[#f2d79a]" : cx(ui.fill, ui.muted),
          )}
        >
          <n.Icon className="mt-0.5 size-4 shrink-0" />
          <span>{n.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** The task's own timeline, from EduNex timestamps — the receipt the website never shows. */
function History(p: VariantProps) {
  const { data, now, task, f, tr } = p;
  const sig = taskSignals(data, task, now);
  const steps = [
    task.createdAt && { at: task.createdAt, label: tr({ en: "Posted by lecturer", id: "Diunggah dosen" }), tone: "neutral" },
    task.opensAt && task.createdAt && Math.abs(Date.parse(task.opensAt) - Date.parse(task.createdAt)) > 3_600_000 && {
      at: task.opensAt,
      label: tr({ en: "Opens for answers", id: "Mulai bisa dijawab" }),
      tone: "neutral",
    },
    sig.editedAt && { at: sig.editedAt, label: tr({ en: "Edited by lecturer", id: "Diubah dosen" }), tone: sig.editedAfterSubmit ? "warn" : "neutral" },
    task.draftStartedAt && { at: task.draftStartedAt, label: tr({ en: "You saved a draft", id: "Kamu menyimpan draf" }), tone: "neutral" },
    task.submittedAt && {
      at: task.submittedAt,
      label:
        sig.draftDays && sig.draftDays >= 1
          ? tr({ en: `You submitted (draft for ${sig.draftDays} days)`, id: `Kamu mengumpulkan (draf ${sig.draftDays} hari)` })
          : tr({ en: "You submitted", id: "Kamu mengumpulkan" }),
      tone: "good",
    },
    task.dueAt && { at: task.dueAt, label: tr({ en: "Deadline", id: "Tenggat" }), tone: new Date(task.dueAt) < now ? "neutral" : "future" },
  ]
    .filter((x): x is { at: string; label: string; tone: string } => Boolean(x))
    .sort((a, b) => a.at.localeCompare(b.at));
  if (steps.length < 2) return null;
  return (
    <div className={cx("p-4", ui.card)}>
      <p className={cx("mb-3 flex items-center justify-between text-[12px] font-semibold", ui.muted)}>
        {tr({ en: "History", id: "Riwayat" })}
        <SourceTag source="EduNex" />
      </p>
      <ol className="relative ml-1.5 space-y-3 border-l border-[#dcdce1] pl-4 dark:border-[#34343a]">
        {steps.map((s, i) => (
          <li key={i} className="relative text-[12.5px]">
            <span
              className={cx(
                "absolute top-1 -left-[21px] size-[9px] rounded-full ring-[3px] ring-white dark:ring-[#1c1c1f]",
                s.tone === "good" ? "bg-[#22a35a]" : s.tone === "warn" ? "bg-[#f59e0b]" : s.tone === "future" ? "border border-[#b5b5bd] bg-white dark:bg-[#1c1c1f]" : "bg-[#b5b5bd] dark:bg-[#5a5a62]",
              )}
            />
            <span className="block font-medium">{s.label}</span>
            <span className={cx("block tabular-nums", ui.faint)}>
              {f.weekdayShort(s.at)} {f.dayMonth(s.at)}, {f.time(s.at)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
