// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": the course page — the
// centre of the app. Same outline students know from EduNex (Pengantar +
// Module 1…n) merged with SIX meetings, rooms and attendance.
import { useState } from "react";
import type { Material, Task } from "./data";
import { Icons } from "./icons";
import { attendanceHealth, examsOf, offTimetable } from "./variant-d-insights";
import { GradeVisibility, StandingCard } from "./variant-d-standing";
import type { VariantProps } from "./variant-props";
import {
  BUDGET_TONE,
  SourceTag,
  budgetText,
  useDSettings,
  Bar,
  CourseDot,
  EmptyState,
  LiveDot,
  MaterialIcon,
  StatusChip,
  currentSession,
  cx,
  elapsed,
  isOpenTask,
  moduleNumber,
  modulesOf,
  nextSession,
  openPresence,
  providerName,
  dateRange,
  meetingsFor,
  stripHtml,
  type Meeting,
  tint,
  ui,
} from "./variant-d-ui";

type Tab = "modules" | "meetings" | "tasks" | "grades" | "announcements";

export function CoursePage(p: VariantProps) {
  const { data, course, t, tr } = p;
  // Prototype convenience: ?tab= opens a tab directly (for screenshots).
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(window.location.search).get("tab") as Tab | null) ?? "modules");
  const modules = modulesOf(data, course.code);
  const tasks = data.tasks.filter((x) => x.courseCode === course.code);
  const meetings = meetingsFor(data, p.now, p.f, course.code);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "modules", label: tr({ en: "Modules", id: "Modul" }), count: modules.length },
    { key: "meetings", label: tr({ en: "Meetings", id: "Pertemuan" }), count: meetings.length },
    { key: "tasks", label: t("tasks"), count: tasks.length },
    { key: "grades", label: t("grades") },
    { key: "announcements", label: t("announcements") },
  ];

  return (
    <div className="pb-20">
      <div className="px-10 pt-7">
        <CourseHeader {...p} />
        <MeetingStrip {...p} />
        <nav className={cx("mt-6 flex gap-6 border-b", ui.line)} role="tablist">
          {tabs.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={tab === x.key}
              onClick={() => setTab(x.key)}
              className={cx(
                "relative -mb-px flex h-10 items-center gap-1.5 border-b-2 text-[13.5px] font-medium transition-colors",
                tab === x.key ? "border-current" : cx("border-transparent hover:text-current", ui.muted),
                ui.focus,
              )}
            >
              {x.label}
              {x.count !== undefined && (
                <span className={cx("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", ui.fill, ui.muted)}>{x.count}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="px-10 pt-6">
        {tab === "modules" && <ModulesTab {...p} />}
        {tab === "meetings" && <MeetingsTab {...p} meetings={meetings} />}
        {tab === "tasks" && <TaskList {...p} tasks={tasks} />}
        {tab === "grades" && (
          <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-8">
            <StandingCard {...p} course={course} />
            <GradeVisibility {...p} />
          </div>
        )}
        {tab === "announcements" && (
          <EmptyState icon={<Icons.Megaphone className="size-6" />} title={tr({ en: "No announcements", id: "Belum ada pengumuman" })} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- header

function CourseHeader(p: VariantProps) {
  const { data, now, course, f, t, tr, go } = p;
  const { attendanceTarget } = useDSettings();
  const h = attendanceHealth(data, course.code, now, f, attendanceTarget);
  const budget = budgetText(tr, h, attendanceTarget);
  const exam = examsOf(data).find((e) => e.courseCode === course.code && e.start && new Date(e.start) > now);
  return (
    <div className="flex items-start justify-between gap-8">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[12.5px] font-semibold">
          <span className="grid size-5 place-items-center rounded-md" style={{ background: tint(course.color, 0.16) }}>
            <CourseDot color={course.color} className="size-2" />
          </span>
          {course.code}
        </p>
        <h1 className="mt-2 text-[26px] leading-[1.15] font-semibold tracking-[-0.02em]">{course.name}</h1>
        <p className={cx("mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]", ui.muted)}>
          <span>
            {t("class_no")} {course.classNo}
          </span>
          <span className={ui.faint}>·</span>
          <span>{course.sks} SKS</span>
          {course.lecturer && (
            <>
              <span className={ui.faint}>·</span>
              <span className="inline-flex items-center gap-1.5">
                <Icons.User className="size-3.5" />
                {course.lecturer}
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-start gap-5">
        {exam?.start && (
          <button
            onClick={() => go("exam", { course: course.code })}
            className={cx("rounded-lg px-3 py-2 text-left", "bg-[#fdeceb] dark:bg-[#3a1c19]", ui.focus)}
          >
            <span className="block text-[11.5px] font-bold text-[#c4321f] dark:text-[#ff9c8f]">{exam.kind}</span>
            <span className="block text-[13px] font-semibold">
              {f.weekdayShort(exam.start)} {f.dayMonth(exam.start)}, {f.time(exam.start)}
            </span>
          </button>
        )}
        {h.attended !== null && h.held !== null && (
          <div className="w-[190px]">
            <p className={cx("flex items-baseline justify-between text-[12px] font-medium", ui.muted)}>
              <span className="inline-flex items-center gap-1.5">
                {t("attendance")} <SourceTag source={h.source} />
              </span>
              <span className="text-[16px] font-semibold text-current tabular-nums">
                {h.attended}/{h.held}
              </span>
            </p>
            <Bar className="mt-1.5" value={h.attended / Math.max(1, h.held)} color={course.color} />
            <p className={cx("mt-1 text-[11.5px] font-semibold", BUDGET_TONE[budget.tone])}>{budget.label}</p>
          </div>
        )}
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className={cx("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium", ui.secondary, ui.focus)}
        >
          {tr({ en: "EduNex", id: "EduNex" })}
          <Icons.ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

function MeetingStrip(p: VariantProps) {
  const { data, now, course, f, t, tr } = p;
  const { attendanceTarget } = useDSettings();
  const source = attendanceHealth(data, course.code, now, f, attendanceTarget).source;
  const current = currentSession(data, now, course.code);
  const session = current ?? nextSession(data, now, course.code);
  if (!session) return null;
  const presence = current ? openPresence(data, now, course.code) : undefined;
  return (
    <div
      className={cx("mt-5 flex items-center gap-6 rounded-xl border px-5 py-3.5", ui.line)}
      style={{ background: tint(course.color, p.dark ? 0.12 : 0.06) }}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[12px] font-semibold">
          {current ? (
            <>
              <LiveDot />
              <span className="text-[#178a4a] dark:text-[#6fdc9c]">{t("in_progress")}</span>
            </>
          ) : (
            <span className={ui.muted}>{tr({ en: "Next meeting", id: "Pertemuan berikutnya" })}</span>
          )}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] font-medium">
          <span>
            {f.relativeDay(session.start)}, {f.timeRange(session.start, session.end)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icons.MapPin className="size-3.5" />
            {session.room}
          </span>
          <span className={ui.muted}>{session.activity}</span>
        </p>
      </div>
      {presence && (
        <div className="flex shrink-0 items-center gap-4">
          <div className="w-[190px]">
            <p className="flex items-baseline justify-between text-[12.5px]">
              <span className="font-semibold">{tr({ en: "EduNex Presence open", id: "Presensi EduNex dibuka" })}</span>
              <span className={cx("tabular-nums", ui.muted)}>{f.countdown(presence.closesAt)}</span>
            </p>
            <Bar className="mt-1.5" value={elapsed(presence.opensAt, presence.closesAt, now)} color={course.color} />
          </div>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className={cx("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold", ui.primary, ui.focus)}
          >
            {tr({ en: `Record in ${source}`, id: `Catat di ${source}` })}
            <Icons.ArrowUpRight className="size-3.5" strokeWidth={2.25} />
          </a>
        </div>
      )}
      {!presence && current && (
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className={cx("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold", ui.primary, ui.focus)}
        >
          {tr({ en: `Record in ${source}`, id: `Catat di ${source}` })}
          <Icons.ArrowUpRight className="size-3.5" strokeWidth={2.25} />
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- modules (EduNex outline)

const INTRO = "intro";

function ModulesTab(p: VariantProps) {
  const { data, now, course, f, tr } = p;
  const modules = modulesOf(data, course.code);
  const courseMaterials = data.materials.filter((m) => m.courseCode === course.code && !m.moduleId);
  const itemsIn = (id: string) => ({
    tasks: data.tasks.filter((t) => t.courseCode === course.code && t.moduleId === id),
    materials: data.materials.filter((m) => m.courseCode === course.code && m.moduleId === id),
  });
  // Open on the module that is running now, else the one holding the next open task.
  const running = modules.find((m) => m.opensAt && m.closesAt && new Date(m.opensAt) <= now && now < new Date(m.closesAt));
  const withOpenTask = modules.find((m) => itemsIn(m.id).tasks.some(isOpenTask));
  const [selected, setSelected] = useState<string>(running?.id ?? withOpenTask?.id ?? (courseMaterials.length ? INTRO : modules[0]?.id ?? INTRO));

  const entries: { id: string; label: string; title: string; meta: string }[] = [
    // Like EduNex, course-wide items sit in an Introduction entry — shown only when it has any.
    ...(courseMaterials.length
      ? [{ id: INTRO, label: "·", title: tr({ en: "Introduction", id: "Pengantar" }), meta: countLabel(p, 0, courseMaterials.length) }]
      : []),
    ...modules.map((m, i) => {
      const items = itemsIn(m.id);
      return {
        id: m.id,
        label: String(i + 1),
        title: m.title,
        meta: m.opensAt ? dateRange(f, m.opensAt, m.closesAt) : countLabel(p, items.tasks.length, items.materials.length),
      };
    }),
  ];

  const active = selected === INTRO ? null : modules.find((m) => m.id === selected) ?? null;
  const content = active ? itemsIn(active.id) : { tasks: [], materials: courseMaterials };

  return (
    <div className="grid grid-cols-[264px_minmax(0,1fr)] gap-8">
      <nav aria-label={tr({ en: "Table of contents", id: "Daftar isi" })} className="self-start">
        <p className={cx("mb-2 px-2 text-[11.5px] font-semibold tracking-[0.04em] uppercase", ui.faint)}>
          {tr({ en: "Table of contents", id: "Daftar isi" })}
        </p>
        <ol className="space-y-0.5">
          {entries.map((e) => {
            const isActive = e.id === selected;
            const items = e.id === INTRO ? null : itemsIn(e.id);
            const hasOpen = items?.tasks.some(isOpenTask);
            return (
              <li key={e.id}>
                <button
                  onClick={() => setSelected(e.id)}
                  className={cx(
                    "flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left",
                    isActive ? "bg-[#eef2fd] dark:bg-[#1e2638]" : ui.hover,
                    ui.focus,
                  )}
                >
                  <span
                    className={cx(
                      "mt-px grid size-5 shrink-0 place-items-center rounded-md text-[11px] font-semibold tabular-nums",
                      isActive ? "bg-[#2f6feb] text-white dark:bg-[#3a77f0]" : cx(ui.fill, ui.muted),
                    )}
                  >
                    {e.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx("line-clamp-2 text-[13px] leading-[1.35]", isActive ? "font-semibold" : "font-medium")}>
                      {e.title}
                    </span>
                    <span className={cx("mt-0.5 block text-[11.5px]", ui.faint)}>{e.meta}</span>
                  </span>
                  {hasOpen && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#e5484d]" aria-label="open task" />}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="min-w-0">
        <header className="mb-5">
          <p className={cx("text-[12px] font-semibold", ui.muted)}>
            {active ? `${tr({ en: "Module", id: "Modul" })} ${moduleNumber(data, active)}` : tr({ en: "Course-wide", id: "Seluruh mata kuliah" })}
            {active?.opensAt && <span className={ui.faint}> · {dateRange(f, active.opensAt, active.closesAt)}</span>}
          </p>
          <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.015em]">
            {active ? active.title : tr({ en: "Introduction", id: "Pengantar" })}
          </h2>
        </header>

        {content.tasks.length === 0 && content.materials.length === 0 ? (
          <EmptyState icon={<Icons.Inbox className="size-6" />} title={tr({ en: "Nothing here yet", id: "Belum ada isi" })} />
        ) : (
          <div className="space-y-6">
            {content.tasks.length > 0 && (
              <div>
                <p className={cx("mb-2 text-[12px] font-semibold", ui.muted)}>{p.t("tasks")}</p>
                <TaskList {...p} tasks={content.tasks} hideModule />
              </div>
            )}
            {content.materials.length > 0 && (
              <div>
                <p className={cx("mb-2 flex items-center justify-between text-[12px] font-semibold", ui.muted)}>
                  {p.t("materials")}
                  <span className={cx("inline-flex items-center gap-1 font-medium", ui.faint)}>
                    <Icons.CheckCircle className="size-3.5 text-[#22a35a]" />
                    {tr({ en: "Saved on this laptop", id: "Tersimpan di laptop ini" })}
                  </span>
                </p>
                <ul className={cx("overflow-hidden", ui.card)}>
                  {content.materials.map((m, i) => (
                    <MaterialRow key={m.id} material={m} first={i === 0} {...p} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function countLabel({ tr }: VariantProps, tasks: number, materials: number): string {
  const parts: string[] = [];
  if (tasks) parts.push(tr({ en: `${tasks} task${tasks > 1 ? "s" : ""}`, id: `${tasks} tugas` }));
  if (materials) parts.push(tr({ en: `${materials} item${materials > 1 ? "s" : ""}`, id: `${materials} materi` }));
  return parts.join(" · ") || tr({ en: "Empty", id: "Kosong" });
}

function MaterialRow({ material, first, ...p }: VariantProps & { material: Material; first: boolean }) {
  const { f, t, tr } = p;
  const meta =
    material.kind === "pdf"
      ? `PDF${material.sizeBytes ? ` · ${f.fileSize(material.sizeBytes)}` : ""}`
      : material.kind === "meeting"
        ? `${t("online_class")} · ${providerName(material.provider)}`
        : material.kind === "note"
          ? stripHtml(material.html ?? "").slice(0, 90)
          : "";
  const action =
    material.kind === "pdf"
      ? { label: tr({ en: "Download", id: "Unduh" }), icon: <Icons.Download className="size-3.5" /> }
      : material.kind === "meeting"
        ? { label: t("join"), icon: <Icons.ArrowUpRight className="size-3.5" /> }
        : { label: tr({ en: "Read", id: "Baca" }), icon: <Icons.ChevronRight className="size-3.5" /> };
  return (
    <li className={cx("flex items-center gap-3 px-4 py-3", !first && "border-t", ui.line)}>
      <MaterialIcon kind={material.kind} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">{material.title}</p>
        <p className={cx("mt-0.5 truncate text-[12px]", ui.muted)}>{meta}</p>
      </div>
      {material.updatedAt && <span className={cx("text-[12px] whitespace-nowrap", ui.faint)}>{f.fromNow(material.updatedAt)}</span>}
      <button className={cx("inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[12.5px] font-medium", ui.secondary, ui.focus)}>
        {action.label}
        {action.icon}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------- tasks

export function TaskList({ tasks, hideModule, ...p }: VariantProps & { tasks: Task[]; hideModule?: boolean }) {
  const { data, f, t, go, tr } = p;
  if (!tasks.length)
    return <EmptyState icon={<Icons.ListChecks className="size-6" />} title={tr({ en: "No tasks", id: "Tidak ada tugas" })} />;
  const sorted = [...tasks].sort((a, b) => Number(!isOpenTask(a)) - Number(!isOpenTask(b)) || (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  return (
    <ul className={cx("overflow-hidden", ui.card)}>
      {sorted.map((task, i) => {
        const mod = data.modules.find((m) => m.id === task.moduleId);
        return (
          <li key={task.id} className={cx(i > 0 && "border-t", ui.line)}>
            <button
              onClick={() => go("task", { task: task.id })}
              className={cx("grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-3 text-left", ui.hover, ui.focus)}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium">{task.title}</span>
                {!hideModule && mod && (
                  <span className={cx("mt-0.5 block truncate text-[12px]", ui.muted)}>
                    {tr({ en: "Module", id: "Modul" })} {moduleNumber(data, mod)} · {mod.title}
                  </span>
                )}
              </span>
              <StatusChip status={task.status} t={t} />
              <span className="w-[120px] text-right text-[12px] whitespace-nowrap tabular-nums">
                {task.dueAt && (
                  <>
                    <span className="block font-medium">{f.dueLabel(task.dueAt)}</span>
                    <span className={cx("block", ui.faint)}>{f.fromNow(task.dueAt)}</span>
                  </>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- meetings (SIX + EduNex Presence)

function MeetingsTab({ meetings, ...p }: VariantProps & { meetings: Meeting[] }) {
  const { data, now, course, f, t, tr } = p;
  const { attendanceTarget } = useDSettings();
  const h = attendanceHealth(data, course.code, now, f, attendanceTarget);
  const extra = offTimetable(data, f).filter((m) => m.courseCode === course.code);
  const stateChip: Record<Meeting["state"], { label: string; cls: string }> = {
    attended: { label: t("attended"), cls: "bg-[#dcf4e5] text-[#166240] dark:bg-[#12301f] dark:text-[#80e0a9]" },
    unmarked: {
      label: h.source === "SIX" ? tr({ en: "Counted in SIX", id: "Dihitung di SIX" }) : tr({ en: "Not marked in EduNex", id: "Tidak tercatat di EduNex" }),
      cls: cx(ui.fill, ui.muted),
    },
    open: { label: t("presence_open"), cls: "bg-[#fff1d6] text-[#8a5300] dark:bg-[#3a2c10] dark:text-[#f5c46a]" },
    upcoming: { label: tr({ en: "Upcoming", id: "Akan datang" }), cls: cx(ui.fill, ui.muted) },
    recorded_in_six: { label: tr({ en: "In SIX", id: "Tercatat di SIX" }), cls: cx(ui.fill, ui.muted) },
  };
  return (
    <div>
      <div className={cx("mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]", ui.muted)}>
        {h.attended !== null && (
          <span className="inline-flex items-center gap-1.5">
            <SourceTag source="SIX" />
            {tr({ en: `Attended ${h.attended} of ${h.held} so far`, id: `Hadir ${h.attended} dari ${h.held} sejauh ini` })}
            <span className={cx("font-semibold", BUDGET_TONE[budgetText(tr, h, attendanceTarget).tone])}>· {budgetText(tr, h, attendanceTarget).label}</span>
          </span>
        )}
        {h.edunexMisleading && (
          <span className="inline-flex items-center gap-1.5">
            <SourceTag source="EduNex" />
            {tr({
              en: `marks only ${h.edunexMarked} of ${h.edunexPast}; it isn't what counts here`,
              id: `hanya menandai ${h.edunexMarked} dari ${h.edunexPast}; bukan yang dihitung di sini`,
            })}
          </span>
        )}
      </div>
      {extra.length > 0 && (
        <ul className="mb-4 space-y-2">
          {extra.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg bg-[#fdf6e3] px-3.5 py-2.5 text-[13px] text-[#5c3d00] dark:bg-[#2e2510] dark:text-[#f2d79a]">
              <Icons.CalendarClock className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                {tr({
                  en: `Meeting ${m.number}: ${f.weekday(m.start)}, ${f.dayMonth(m.start)}, ${f.timeRange(m.start, m.end)}${m.online ? ", online" : ""}. Announced only in the EduNex parent class; SIX doesn't list it.`,
                  id: `Pertemuan ${m.number}: ${f.weekday(m.start)}, ${f.dayMonth(m.start)}, ${f.timeRange(m.start, m.end)}${m.online ? ", daring" : ""}. Hanya diumumkan di kelas induk EduNex; tidak ada di SIX.`,
                })}
              </span>
              {m.link && (
                <a href="#" onClick={(e) => e.preventDefault()} className={cx("inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2.5 text-[12px] font-semibold", ui.secondary, ui.focus)}>
                  Teams <Icons.ArrowUpRight className="size-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {meetings.length === 0 ? (
        <EmptyState icon={<Icons.Calendar className="size-6" />} title={tr({ en: "No meetings yet", id: "Belum ada pertemuan" })} />
      ) : (
        <ol className={cx("overflow-hidden", ui.card)}>
          {meetings.map((m, i) => (
            <li
              key={m.key}
              className={cx("grid grid-cols-[44px_150px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3", i > 0 && "border-t", ui.line)}
            >
              <span className={cx("text-[12px] font-semibold tabular-nums", ui.faint)}>{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[13px] tabular-nums">
                <span className="block font-medium">
                  {f.weekdayShort(m.start)}, {f.dayMonth(m.start)}
                </span>
                <span className={cx("block text-[12px]", ui.muted)}>{f.timeRange(m.start, m.end)}</span>
              </span>
              <span className="min-w-0 text-[13px]">
                <span className="block truncate font-medium">{m.topic ?? m.activity ?? "—"}</span>
                {m.room && (
                  <span className={cx("mt-0.5 flex items-center gap-1 text-[12px]", ui.muted)}>
                    <Icons.MapPin className="size-3" />
                    {m.room}
                  </span>
                )}
              </span>
              <span className={cx("inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[11.5px] font-semibold whitespace-nowrap", stateChip[m.state].cls)}>
                {m.state === "open" && <LiveDot className="scale-75" />}
                {stateChip[m.state].label}
                {m.state === "open" && m.closesAt && <span className="font-medium opacity-80">· {f.countdown(m.closesAt)}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

