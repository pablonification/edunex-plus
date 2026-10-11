// PROTOTYPE (#83) — throwaway. Variant C "Spaces" — a course as a space:
// full-bleed course-color header, a segmented control, and overview cards.
import { useState, type ReactNode } from "react";
import type { Material, PresenceWindow, Task } from "./data";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import {
  CARD,
  DueChip,
  EDUNEX_URL,
  FOCUS,
  INK,
  LIFT,
  MUTED,
  ROW_HOVER,
  Ring,
  SourceTag,
  StatusBadge,
  StatusIcon,
  TileTitle,
  WASH,
  cx,
  heroGradient,
  materialKind,
  withColor,
  type Model,
} from "./variant-c-ui";

type Tab = "overview" | "tasks" | "materials" | "presence";

export function CourseScreen({ p, m }: { p: VariantProps; m: Model }) {
  const { t, f, course, data } = p;
  const [tab, setTab] = useState<Tab>("overview");
  const tasks = sortTasks(data.tasks.filter((task) => task.courseCode === course.code), m);
  const materials = m.materialsOf(course.code);
  const presence = data.presence.filter((x) => x.courseCode === course.code);
  const live = m.openPresence?.courseCode === course.code ? m.openPresence : undefined;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: t("overview") },
    { key: "tasks", label: t("tasks"), count: tasks.length },
    { key: "materials", label: t("materials"), count: materials.length },
    { key: "presence", label: t("presence"), count: presence.length },
  ];

  return (
    <div className="vc-scroll h-full overflow-y-auto" style={withColor(course.color)}>
      <header
        className="relative isolate overflow-hidden px-8 pt-6 pb-6 text-white"
        style={{ backgroundImage: heroGradient(112, "92% 135%") }}
      >
        <svg aria-hidden className="pointer-events-none absolute -top-40 right-[-60px] -z-10 size-[460px] text-white/[0.08]" viewBox="0 0 460 460" fill="none">
          <circle cx="230" cy="230" r="228" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="230" cy="230" r="178" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="230" cy="230" r="128" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="230" cy="230" r="78" fill="currentColor" />
        </svg>
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <p className="vc-display vc-num text-[42px] leading-none font-bold tracking-[-0.02em]">{course.code}</p>
            <h1 className="vc-display mt-1.5 text-[21px] leading-tight font-semibold text-white/95 text-balance">{course.name}</h1>
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <HeaderChip>
                {t("class_no")} {course.classNo}
              </HeaderChip>
              {course.sks !== null && (
                <HeaderChip>
                  {course.sks} {t("sks")}
                </HeaderChip>
              )}
              {course.lecturer && (
                <HeaderChip icon={<Icons.User className="size-3.5" strokeWidth={2} />}>{course.lecturer}</HeaderChip>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2.5 pt-1">
            {live && (
              <span className="vc-num inline-flex h-7 items-center gap-2 rounded-full bg-black/[0.16] px-2.5 text-[12px] font-semibold ring-1 ring-white/20 ring-inset backdrop-blur-sm">
                <span className="relative grid size-2 place-items-center" aria-hidden>
                  <span className="absolute inset-0 rounded-full bg-white motion-safe:animate-[vc-breathe_2.4s_ease-out_infinite]" />
                  <span className="relative size-2 rounded-full bg-white" />
                </span>
                {t("presence_open")} · {f.countdown(live.closesAt)}
              </span>
            )}
            <a
              href={EDUNEX_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 vc-ink-deep text-[13px] font-semibold shadow-[0_6px_16px_-6px_rgba(0,0,0,0.35)] transition duration-150 ease-out hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-safe:hover:-translate-y-px"
            >
              {t("open_in_edunex")}
              <Icons.ArrowUpRight className="size-4" strokeWidth={2.2} />
            </a>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-10 bg-[color-mix(in_oklab,var(--space)_3%,#F6F6F8)]/85 px-8 pt-3.5 pb-3 backdrop-blur-md dark:bg-[color-mix(in_oklab,var(--space)_4%,#111317)]/85">
        <div role="tablist" aria-label={course.code} className="inline-flex rounded-full bg-zinc-900/[0.055] p-1 dark:bg-white/[0.06]">
          {tabs.map((x) => {
            const selected = tab === x.key;
            return (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(x.key)}
                className={cx(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition duration-200 ease-out",
                  selected
                    ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(15,20,35,0.08),0_4px_10px_-4px_rgba(15,20,35,0.18)] dark:bg-white/[0.14] dark:text-white"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
                  FOCUS,
                )}
              >
                {x.label}
                {x.count !== undefined && (
                  <span
                    className={cx(
                      "vc-num rounded-full px-1.5 text-[11px] font-bold",
                      selected ? cx(WASH, INK) : "bg-zinc-900/[0.06] text-zinc-500 dark:bg-white/[0.08] dark:text-zinc-400",
                    )}
                  >
                    {x.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-8 pt-2 pb-8">
        {tab === "overview" && <Overview p={p} m={m} tasks={tasks} materials={materials} />}
        {tab === "tasks" && <TaskList p={p} m={m} tasks={tasks} />}
        {tab === "materials" && <MaterialGrid p={p} materials={materials} />}
        {tab === "presence" && <PresenceList p={p} m={m} list={presence} />}
      </div>
    </div>
  );
}

function HeaderChip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="vc-num inline-flex h-7 max-w-[360px] items-center gap-1.5 rounded-full bg-white/[0.16] px-2.5 text-[12.5px] font-semibold text-white ring-1 ring-white/[0.18] ring-inset backdrop-blur-sm">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

function sortTasks(list: Task[], m: Model): Task[] {
  const rank = (task: Task) =>
    task.status === "overdue" ? 0 : task.status === "draft" ? 1 : task.status === "not_started" ? 2 : task.status === "in_review" ? 3 : task.status === "submitted" ? 4 : 5;
  return [...list].sort((a, b) => rank(a) - rank(b) || m.ms(a.dueAt ?? "2999-01-01") - m.ms(b.dueAt ?? "2999-01-01"));
}

/* ---------------------------------------------------------------- overview */

function Overview({ p, m, tasks, materials }: { p: VariantProps; m: Model; tasks: Task[]; materials: Material[] }) {
  const { t, tr, f, course, go } = p;
  const sessions = m.sessionsOf(course.code);
  const now = sessions.find((s) => m.ms(s.start) <= m.now && m.now < m.ms(s.end));
  const next = sessions.find((s) => m.ms(s.start) > m.now);
  const notices = m.notices.filter((n) => m.noticeCourse(n)?.code === course.code).slice(0, 3);
  const pct = course.attendancePct;

  return (
    <div className="grid grid-cols-12 gap-3.5">
      {/* Sessions */}
      <section className={cx(CARD, "col-span-5 flex flex-col p-5")}>
        <TileTitle aside={<SourceTag>SIX</SourceTag>}>{t("schedule")}</TileTitle>
        <div className="mt-3 space-y-2">
          {now && (
            <div className={cx("rounded-[14px] p-3", WASH)}>
              <div className="flex items-center justify-between gap-2">
                <span className={cx("text-[11px] font-bold tracking-[0.08em] uppercase", INK)}>{t("in_progress")}</span>
                <span className={cx("vc-num text-[12px] font-semibold", MUTED)}>
                  {tr({ en: `ends ${f.time(now.end)}`, id: `selesai ${f.time(now.end)}` })}
                </span>
              </div>
              <p className="vc-display vc-num mt-1 text-[22px] leading-none font-semibold">{f.timeRange(now.start, now.end)}</p>
              <p className={cx("mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium", MUTED)}>
                <Icons.MapPin className="size-3.5" strokeWidth={2} />
                {now.room || t("online_class")}
              </p>
              <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--c)_18%,transparent)]">
                <div
                  className="h-full rounded-full bg-(--c)"
                  style={{ width: `${Math.min(100, ((m.now - m.ms(now.start)) / (m.ms(now.end) - m.ms(now.start))) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {next && (
            <div className="flex items-center gap-3 rounded-[14px] bg-zinc-900/[0.03] p-3 dark:bg-white/[0.035]">
              <span className="grid w-12 shrink-0 place-items-center rounded-[10px] bg-white py-1.5 text-center ring-1 ring-zinc-900/[0.06] dark:bg-white/[0.06] dark:ring-white/[0.08]">
                <span className={cx("text-[10px] font-bold uppercase", INK)}>{f.weekdayShort(next.start)}</span>
                <span className="vc-display vc-num text-[18px] leading-none font-semibold">{f.dayMonth(next.start).split(" ")[0]}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx("block text-[11px] font-bold tracking-[0.08em] uppercase", MUTED)}>
                  {tr({ en: "Next session", id: "Pertemuan berikutnya" })}
                </span>
                <span className="vc-num mt-0.5 block text-[14px] font-semibold">
                  {f.relativeDay(next.start)} · {f.timeRange(next.start, next.end)}
                </span>
                <span className={cx("mt-0.5 flex items-center gap-1.5 text-[12px]", MUTED)}>
                  <Icons.MapPin className="size-3.5 shrink-0" strokeWidth={2} />
                  <span className="truncate">{next.room || t("online_class")}</span>
                  {next.activity && next.activity !== "Kuliah" && (
                    <span className="shrink-0 rounded-full bg-[#FF3B30]/[0.1] px-1.5 text-[10.5px] font-bold text-[#B42318] dark:text-[#FF9C94]">
                      {next.activity}
                    </span>
                  )}
                </span>
              </span>
            </div>
          )}
          {!now && !next && <p className={cx("text-[13px]", MUTED)}>{t("no_classes_today")}</p>}
        </div>
      </section>

      {/* Attendance */}
      <section className={cx(CARD, "col-span-3 flex flex-col p-5")}>
        <TileTitle aside={<SourceTag>SIX</SourceTag>}>{t("attendance")}</TileTitle>
        <div className="grid flex-1 place-items-center pt-3">
          <Ring value={pct ?? 0} size={124} stroke={11} color={course.color}>
            <span className="flex flex-col items-center">
              <span className="vc-display vc-num text-[30px] leading-none font-semibold">
                {pct === null ? "—" : Math.round(pct)}
                <span className="text-[15px] opacity-60">%</span>
              </span>
            </span>
          </Ring>
        </div>
      </section>

      {/* Tasks */}
      <section className={cx(CARD, "col-span-4 flex flex-col p-5")}>
        <TileTitle aside={<SourceTag>EduNex</SourceTag>}>{t("tasks")}</TileTitle>
        {tasks.length === 0 ? (
          <p className={cx("mt-auto text-[13px]", MUTED)}>{tr({ en: "No tasks", id: "Tidak ada tugas" })}</p>
        ) : (
          <ul className="mt-2.5 -mx-2 space-y-0.5">
            {tasks.slice(0, 3).map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => go("task", { task: task.id })}
                  className={cx("flex w-full items-start gap-2.5 rounded-[12px] px-2 py-2 text-left", ROW_HOVER, FOCUS)}
                >
                  <span className={cx("mt-[1px] shrink-0", task.status === "submitted" ? "text-[#22A45D] dark:text-[#30D158]" : "text-zinc-400 dark:text-zinc-500")}>
                    <StatusIcon status={task.status} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[13px] leading-snug font-semibold">{task.title}</span>
                    <span className="mt-1 block">
                      {task.status === "submitted" || task.status === "in_review" ? (
                        <span className="vc-num text-[11.5px] font-medium text-[#146C3B] dark:text-[#7EE2A0]">
                          {t("status_submitted")} · {task.submittedAt && f.relativeDay(task.submittedAt)}
                        </span>
                      ) : (
                        <DueChip task={task} m={m} f={f} t={t} tr={tr} compact />
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Materials */}
      <section className={cx(CARD, "col-span-7 flex flex-col p-5")}>
        <TileTitle aside={<SourceTag>EduNex</SourceTag>}>{t("materials")}</TileTitle>
        {materials.length === 0 ? (
          <EmptyMaterials p={p} />
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {materials.slice(0, 4).map((mat) => (
              <MaterialCard key={mat.id} mat={mat} p={p} />
            ))}
          </div>
        )}
      </section>

      {/* Recent from EduNex */}
      <section className={cx(CARD, "col-span-5 flex flex-col p-5")}>
        <TileTitle>{tr({ en: "Recent in EduNex", id: "Terbaru di EduNex" })}</TileTitle>
        {notices.length === 0 ? (
          <p className={cx("mt-auto text-[13px]", MUTED)}>{t("all_caught_up")}</p>
        ) : (
          <ul className="mt-2.5 -mx-2 space-y-0.5">
            {notices.map((n) => {
              const task = m.noticeTask(n);
              const isTask = n.type === "ASSIGNMENT";
              const Icon = isTask ? Icons.ListChecks : n.type === "CONTENT" ? Icons.BookOpen : Icons.Megaphone;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => (task ? go("task", { task: task.id }) : undefined)}
                    className={cx("flex w-full items-center gap-3 rounded-[12px] px-2 py-[7px] text-left", ROW_HOVER, FOCUS)}
                  >
                    <span className={cx("grid size-8 shrink-0 place-items-center rounded-[10px]", WASH, INK)}>
                      <Icon className="size-4" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13px] font-semibold">{n.title.trim()}</span>
                      <span className={cx("mt-[3px] block text-[11.5px]", MUTED)}>
                        {isTask ? tr({ en: "New task", id: "Tugas baru" }) : tr({ en: "New material", id: "Materi baru" })} · {f.fromNow(n.date)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyMaterials({ p }: { p: VariantProps }) {
  const { t, tr } = p;
  return (
    <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-1.5 rounded-[16px] border-[1.5px] border-dashed border-zinc-900/[0.09] py-5 text-center dark:border-white/[0.09]">
      <span className={cx("grid size-10 place-items-center rounded-[12px]", WASH, INK)}>
        <Icons.BookOpen className="size-[18px]" strokeWidth={2} />
      </span>
      <p className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-200">{tr({ en: "No materials yet", id: "Belum ada materi" })}</p>
      <a
        href={EDUNEX_URL}
        target="_blank"
        rel="noreferrer"
        className={cx("inline-flex items-center gap-1 text-[12px] font-semibold", INK, "hover:underline", FOCUS)}
      >
        {t("open_in_edunex")}
        <Icons.ArrowUpRight className="size-3.5" strokeWidth={2.2} />
      </a>
    </div>
  );
}

function MaterialCard({ mat, p }: { mat: Material; p: VariantProps }) {
  const { t, tr, f } = p;
  const kind = materialKind(mat.kind, t, tr);
  const meta = [
    mat.kind === "meeting" && mat.provider === "ms-teams" ? "Microsoft Teams" : kind.label,
    mat.sizeBytes ? f.fileSize(mat.sizeBytes) : null,
    mat.updatedAt ? f.relativeDay(mat.updatedAt) : null,
  ].filter(Boolean);
  const action = mat.kind === "meeting" ? t("join") : mat.kind === "pdf" ? tr({ en: "Download", id: "Unduh" }) : tr({ en: "Read", id: "Baca" });
  return (
    <a
      href={mat.url ?? EDUNEX_URL}
      target="_blank"
      rel="noreferrer"
      className={cx(
        "group flex items-center gap-3 rounded-[16px] bg-white p-3 ring-1 ring-zinc-900/[0.07] dark:bg-white/[0.035] dark:ring-white/[0.08]",
        LIFT,
        FOCUS,
      )}
    >
      <span className={cx("relative grid h-12 w-11 shrink-0 place-items-center rounded-[11px]", kind.tone)}>
        <kind.Icon className="size-5" strokeWidth={1.9} />
        {mat.kind === "pdf" && (
          <span className="absolute -bottom-1 rounded-[4px] bg-[#E5352B] px-1 text-[8.5px] leading-[13px] font-bold text-white">PDF</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] leading-snug font-semibold">{mat.title.trim()}</span>
        <span className={cx("vc-num mt-0.5 block truncate text-[11.5px]", MUTED)}>{meta.join(" · ")}</span>
      </span>
      <span
        className={cx(
          "inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold transition",
          mat.kind === "meeting" ? "vc-solid" : "bg-zinc-900/[0.05] text-zinc-700 group-hover:bg-zinc-900/[0.08] dark:bg-white/[0.07] dark:text-zinc-200",
        )}
      >
        {mat.kind === "meeting" ? <Icons.Video className="size-3.5" strokeWidth={2.2} /> : mat.kind === "pdf" ? <Icons.Download className="size-3.5" strokeWidth={2.2} /> : null}
        {action}
      </span>
    </a>
  );
}

/* ------------------------------------------------------------ other tabs */

function TaskList({ p, m, tasks }: { p: VariantProps; m: Model; tasks: Task[] }) {
  const { t, tr, f, go } = p;
  if (!tasks.length) return <p className={cx("py-10 text-center text-[13px]", MUTED)}>{tr({ en: "No tasks", id: "Tidak ada tugas" })}</p>;
  return (
    <ul className={cx(CARD, "divide-y divide-zinc-900/[0.06] overflow-hidden dark:divide-white/[0.06]")}>
      {tasks.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            onClick={() => go("task", { task: task.id })}
            className={cx("flex w-full items-center gap-4 px-5 py-3.5 text-left", ROW_HOVER, FOCUS)}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">{task.title}</span>
              <span className={cx("vc-num mt-0.5 block truncate text-[12px]", MUTED)}>
                {task.submittedAt
                  ? `${t("submitted_on")} ${f.dueLabel(task.submittedAt)}`
                  : task.dueAt
                    ? `${t("due")} ${f.dueLabel(task.dueAt)}`
                    : ""}
              </span>
            </span>
            {task.status === "submitted" || task.status === "in_review" ? null : <DueChip task={task} m={m} f={f} t={t} tr={tr} compact />}
            <StatusBadge status={task.status} t={t} size="sm" />
            <Icons.ChevronRight className="size-4 shrink-0 text-zinc-400" strokeWidth={2} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function MaterialGrid({ p, materials }: { p: VariantProps; materials: Material[] }) {
  if (!materials.length) {
    return (
      <div className={cx(CARD, "flex min-h-[220px] flex-col p-5")}>
        <EmptyMaterials p={p} />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {materials.map((mat) => (
        <MaterialCard key={mat.id} mat={mat} p={p} />
      ))}
    </div>
  );
}

function PresenceList({ p, m, list }: { p: VariantProps; m: Model; list: PresenceWindow[] }) {
  const { t, tr, f } = p;
  if (!list.length) {
    return <p className={cx("py-10 text-center text-[13px]", MUTED)}>{tr({ en: "No Presence windows", id: "Belum ada presensi" })}</p>;
  }
  const sorted = [...list].sort((a, b) => m.ms(b.opensAt) - m.ms(a.opensAt));
  return (
    <ul className={cx(CARD, "divide-y divide-zinc-900/[0.06] overflow-hidden dark:divide-white/[0.06]")}>
      {sorted.map((x) => {
        const open = m.ms(x.opensAt) <= m.now && m.now < m.ms(x.closesAt);
        const future = m.ms(x.opensAt) > m.now;
        const status = open ? "open" : x.myStatus === "attended" ? "attended" : future ? "upcoming" : "none";
        return (
          <li key={x.id} className={cx("flex items-center gap-4 px-5 py-3", open && WASH)}>
            <span className="grid w-12 shrink-0 place-items-center text-center">
              <span className={cx("text-[10px] font-bold uppercase", INK)}>{f.weekdayShort(x.opensAt)}</span>
              <span className="vc-display vc-num text-[18px] leading-none font-semibold">{f.dayMonth(x.opensAt).split(" ")[0]}</span>
              <span className={cx("text-[10px] font-semibold uppercase", MUTED)}>{f.dayMonth(x.opensAt).split(" ")[1]}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">{x.topic || tr({ en: "Class meeting", id: "Pertemuan kelas" })}</span>
              <span className={cx("vc-num mt-0.5 block text-[12px]", MUTED)}>
                {t("presence")} {f.timeRange(x.opensAt, x.closesAt)}
              </span>
            </span>
            {status === "open" && (
              <>
                <span className={cx("vc-num text-[12px] font-semibold", INK)}>
                  {t("closes_in")} {f.countdown(x.closesAt)}
                </span>
                <a
                  href={EDUNEX_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={cx("vc-solid inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold", FOCUS)}
                >
                  {t("open_in_edunex")}
                  <Icons.ArrowUpRight className="size-3.5" strokeWidth={2.2} />
                </a>
              </>
            )}
            {status === "attended" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#22A45D]/[0.12] px-2 py-0.5 text-[11.5px] font-semibold text-[#146C3B] dark:text-[#7EE2A0]">
                <Icons.Check className="size-3.5" strokeWidth={2.4} />
                {t("attended")}
              </span>
            )}
            {status === "none" && (
              <span className="rounded-full bg-zinc-900/[0.05] px-2 py-0.5 text-[11.5px] font-semibold text-zinc-500 dark:bg-white/[0.07] dark:text-zinc-400">
                {tr({ en: "No record", id: "Tidak tercatat" })}
              </span>
            )}
            {status === "upcoming" && (
              <span className={cx("vc-num text-[12px] font-medium", MUTED)}>{f.fromNow(x.opensAt)}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
