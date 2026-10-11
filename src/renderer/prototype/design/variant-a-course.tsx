// PROTOTYPE (#83) — throwaway. Variant A "Calendar": a course — colour-washed
// header with SIX facts and attendance, upcoming sessions as calendar cards,
// Tasks + Materials side by side, and EduNex Presence history as a strip.
import type { Material, PresenceWindow, Task } from "./data";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import {
  alpha,
  byDue,
  card,
  focusRing,
  hairline,
  ink,
  isDone,
  LiveDot,
  PrimaryButton,
  providerName,
  QuietButton,
  SectionLabel,
  STATUS_INK,
  STATUS_LABEL,
  STATUS_SOFT,
  StatusGlyph,
  Swatch,
  tone,
} from "./variant-a-kit";

export function CourseScreen(props: VariantProps) {
  const { data, course, now, f, t, tr, dark } = props;
  const nowMs = now.getTime();
  const tn = tone(course.color, dark);

  const sessions = data.sessions.filter((s) => s.courseCode === course.code && Date.parse(s.end) > nowMs).slice(0, 5);
  const tasks = data.tasks
    .filter((task) => task.courseCode === course.code)
    .sort((a, b) => Number(isDone(a.status)) - Number(isDone(b.status)) || byDue(a, b));
  const materials = data.materials.filter((m) => m.courseCode === course.code);
  const presence = data.presence.filter((p) => p.courseCode === course.code);
  const openPresence = presence.find((p) => Date.parse(p.opensAt) <= nowMs && nowMs < Date.parse(p.closesAt)) ?? null;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[280px]"
        style={{ background: `linear-gradient(180deg, ${alpha(course.color, dark ? 0.17 : 0.11)} 0%, ${alpha(course.color, 0)} 100%)` }}
      />
      <header className="relative flex h-[52px] shrink-0 items-center justify-end px-4 [-webkit-app-region:drag]">
        <QuietButton className="[-webkit-app-region:no-drag]">
          {t("open_in_edunex")}
          <Icons.ArrowUpRight className="size-3.5" strokeWidth={2} />
        </QuietButton>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[960px] px-9 pb-14">
          {/* Header */}
          <div className="flex items-start gap-8">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[12.5px] font-semibold tabular-nums" style={{ color: tn.text }}>
                <Swatch color={course.color} className="size-3" />
                {course.code}
              </p>
              <h1 className="mt-1.5 text-[27px] leading-[33px] font-semibold tracking-[-0.022em] text-balance">{course.name}</h1>
              <p className={`mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] ${ink[2]}`}>
                <span className="flex items-center gap-1.5">
                  <Icons.Hand className={`size-3.5 ${ink[3]}`} />
                  {t("class_no")} {course.classNo}
                </span>
                {course.sks !== null && (
                  <span className="flex items-center gap-1.5 tabular-nums">
                    <Icons.BookOpen className={`size-3.5 ${ink[3]}`} />
                    {course.sks} {t("sks")}
                  </span>
                )}
                {course.lecturer && (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Icons.User className={`size-3.5 ${ink[3]}`} />
                    <span className="truncate">{course.lecturer}</span>
                  </span>
                )}
              </p>
            </div>
            <AttendanceRing pct={course.attendancePct} color={course.color} label={t("attendance")} />
          </div>

          {openPresence && (
            <div
              className="mt-6 flex items-center gap-3 rounded-[12px] py-2.5 pr-2.5 pl-4"
              style={{ background: tn.wash, boxShadow: `0 0 0 1px ${tn.ring}` }}
            >
              <LiveDot />
              <span className="text-[13px] font-semibold text-[#15803D] dark:text-[#4ADE80]">{t("presence_open")}</span>
              <span className={`text-[13px] ${ink[2]}`}>
                {t("closes_in")} <span className="font-semibold text-[#1D1D1F] tabular-nums dark:text-white">{f.countdown(openPresence.closesAt)}</span>
                <span className="tabular-nums"> · {f.time(openPresence.closesAt)}</span>
              </span>
              <PrimaryButton className="ml-auto">
                {t("open_in_edunex")}
                <Icons.ArrowUpRight className="size-3.5" strokeWidth={2.25} />
              </PrimaryButton>
            </div>
          )}

          {/* Upcoming sessions */}
          <section className="mt-8">
            <Heading title={t("schedule")} source="SIX" />
            {sessions.length ? (
              <ol className="mt-3 grid grid-cols-5 gap-2.5">
                {sessions.map((s) => {
                  const live = Date.parse(s.start) <= nowMs && nowMs < Date.parse(s.end);
                  const offset = f.dayOffset(s.start);
                  const exam = s.activity && s.activity.toLowerCase() !== "kuliah" ? s.activity : null;
                  return (
                    <li key={s.id} className={`relative overflow-hidden px-3 pt-3.5 pb-3 ${card}`} style={live ? { boxShadow: `0 0 0 1.5px ${course.color}` } : undefined}>
                      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: course.color }} aria-hidden />
                      <p className="flex items-center justify-between gap-2 text-[11.5px] font-semibold" style={{ color: tn.text }}>
                        <span className="truncate">{offset === 0 ? t("today") : offset === 1 ? t("tomorrow") : f.weekdayShort(s.start)}</span>
                        {live && (
                          <span className="flex shrink-0 items-center gap-1 text-[10.5px] text-[#D92D33] dark:text-[#FF7A7F]">
                            <span className="size-1.5 rounded-full bg-current" />
                            {t("now")}
                          </span>
                        )}
                        {!live && exam && (
                          <span className="shrink-0 rounded-[4px] bg-[#D92D33] px-1 text-[10px] leading-[15px] font-bold text-white">{exam}</span>
                        )}
                      </p>
                      <p className="mt-0.5 flex items-baseline gap-1.5">
                        <span className="text-[22px] leading-[26px] font-semibold tracking-[-0.02em] tabular-nums">{Number(f.dayKey(s.start).slice(8))}</span>
                        <span className={`text-[12px] ${ink[3]}`}>{f.dayMonth(s.start).replace(/^\d+\s*/, "")}</span>
                      </p>
                      <p className={`mt-1.5 text-[12px] font-medium tabular-nums ${ink[2]}`}>{f.timeRange(s.start, s.end)}</p>
                      {s.room && (
                        <p className={`mt-0.5 flex min-w-0 items-center gap-1 text-[11.5px] ${ink[3]}`}>
                          <Icons.MapPin className="size-3 shrink-0" strokeWidth={2} />
                          <span className="truncate">{s.room}</span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <Empty>{tr({ en: "No upcoming classes", id: "Tidak ada kuliah mendatang" })}</Empty>
            )}
          </section>

          {/* Tasks + Materials */}
          <div className="mt-8 grid grid-cols-2 gap-8">
            <section>
              <Heading title={t("tasks")} count={tasks.length} />
              {tasks.length ? (
                <ul className="mt-2 space-y-px">
                  {tasks.map((task) => (
                    <CourseTask key={task.id} {...props} task={task} />
                  ))}
                </ul>
              ) : (
                <Empty>{tr({ en: "No tasks yet", id: "Belum ada tugas" })}</Empty>
              )}
            </section>
            <section>
              <Heading title={t("materials")} count={materials.length} />
              {materials.length ? (
                <ul className="mt-2 space-y-px">
                  {materials.map((m) => (
                    <MaterialRow key={m.id} {...props} material={m} />
                  ))}
                </ul>
              ) : (
                <Empty>{tr({ en: "No materials yet", id: "Belum ada materi" })}</Empty>
              )}
            </section>
          </div>

          {/* Presence history */}
          {presence.length > 0 && <PresenceStrip {...props} windows={presence} />}
        </div>
      </div>
    </div>
  );
}

function Heading({ title, count, source }: { title: string; count?: number; source?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <SectionLabel>{title}</SectionLabel>
      {count !== undefined && <span className={`text-[11.5px] tabular-nums ${ink[3]}`}>{count}</span>}
      {source && (
        <span className={`ml-auto rounded-[4px] px-1 text-[10px] leading-[15px] font-semibold tracking-[0.03em] ${ink[3]} shadow-[0_0_0_1px_rgb(0_0_0/0.1)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.12)]`}>
          {source}
        </span>
      )}
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <p className={`mt-2 rounded-[10px] border border-dashed px-3 py-4 text-center text-[12.5px] ${hairline} ${ink[3]}`}>{children}</p>
  );
}

function AttendanceRing({ pct, color, label }: { pct: number | null; color: string; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="flex shrink-0 items-center gap-3 pt-1" role="img" aria-label={`${label} ${pct === null ? "—" : `${Math.round(v)}%`}`}>
      <div className="relative size-[64px]">
        <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-black/[0.07] dark:stroke-white/[0.1]" />
          {pct !== null && (
            <circle
              cx="32"
              cy="32"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - v / 100)}
            />
          )}
        </svg>
        <span className="absolute inset-0 grid place-items-center text-[14px] font-semibold tracking-[-0.01em] tabular-nums">
          {pct === null ? "—" : `${Math.round(v)}%`}
        </span>
      </div>
      <div className="leading-tight">
        <p className="text-[12.5px] font-semibold">{label}</p>
        <p className={`mt-0.5 text-[11px] font-medium ${ink[3]}`}>SIX</p>
      </div>
    </div>
  );
}

function CourseTask({ task, f, t, go }: VariantProps & { task: Task }) {
  const done = isDone(task.status);
  const flagged = task.status === "draft" || task.status === "overdue" || task.status === "closed";
  return (
    <li>
      <button
        type="button"
        onClick={() => go("task", { task: task.id })}
        className={`flex w-full items-start gap-2.5 rounded-[9px] px-2 py-2 text-left transition-colors duration-150 hover:bg-black/[0.035] dark:hover:bg-white/[0.045] ${focusRing}`}
      >
        <StatusGlyph status={task.status} className="mt-px size-4" />
        <span className="min-w-0 flex-1">
          <span className={`line-clamp-2 text-[13px] leading-[18px] ${done ? ink[2] : ink[1]}`}>{task.title}</span>
          <span className={`mt-0.5 flex items-center gap-1.5 text-[11.5px] tabular-nums ${ink[3]}`}>
            {task.dueAt && (
              <span>
                {t("due")} {f.dueLabel(task.dueAt)}
              </span>
            )}
            {flagged && (
              <span className={`rounded-full px-1.5 text-[10.5px] leading-[15px] font-semibold ${STATUS_SOFT[task.status]} ${STATUS_INK[task.status]}`}>
                {t(STATUS_LABEL[task.status])}
              </span>
            )}
          </span>
        </span>
        <span className={`shrink-0 pt-px text-[11.5px] font-medium tabular-nums ${done ? STATUS_INK[task.status] : ink[2]}`}>
          {done ? t(STATUS_LABEL[task.status]) : task.dueAt ? f.fromNow(task.dueAt) : ""}
        </span>
      </button>
    </li>
  );
}

const KIND = {
  pdf: { tile: "bg-[#FDECEC] text-[#C2262E] dark:bg-[#FF6369]/[0.14] dark:text-[#FF8A8E]", Icon: Icons.FileText },
  meeting: { tile: "bg-[#E8F1FE] text-[#1F5FCC] dark:bg-[#5B9BFF]/[0.14] dark:text-[#8DB9FF]", Icon: Icons.Video },
  note: { tile: "bg-[#FEF4DF] text-[#9A5B06] dark:bg-[#F5B547]/[0.14] dark:text-[#F5C46F]", Icon: Icons.StickyNote },
  other: { tile: "bg-black/[0.06] text-[#5F5F66] dark:bg-white/[0.08] dark:text-[#A1A1A6]", Icon: Icons.Link },
} as const;

function MaterialRow({ material, f, t, tr }: VariantProps & { material: Material }) {
  const kind = KIND[material.kind];
  const meta = (() => {
    switch (material.kind) {
      case "pdf":
        return ["PDF", material.sizeBytes ? f.fileSize(material.sizeBytes) : null].filter(Boolean).join(" · ");
      case "meeting":
        return providerName(material.provider) ?? t("online_class");
      case "note":
        return tr({ en: "Note", id: "Catatan" });
      default:
        return tr({ en: "Link", id: "Tautan" });
    }
  })();
  const updated = material.updatedAt ? f.dayMonth(material.updatedAt) : null;
  return (
    <li>
      <div className="group flex items-center gap-3 rounded-[9px] px-2 py-2 transition-colors duration-150 hover:bg-black/[0.035] dark:hover:bg-white/[0.045]">
        <span className={`grid size-8 shrink-0 place-items-center rounded-[8px] ${kind.tile}`} aria-hidden>
          <kind.Icon className="size-4" />
        </span>
        <button type="button" className={`min-w-0 flex-1 rounded-[4px] text-left ${focusRing}`}>
          <span className="block truncate text-[13px] leading-[18px]" title={material.title}>
            {material.title}
          </span>
          <span className={`text-[11.5px] tabular-nums ${ink[3]}`}>
            {meta}
            {updated && ` · ${updated}`}
          </span>
        </button>
        {material.kind === "meeting" ? (
          <QuietButton className="h-7 shrink-0 px-2.5 text-[12px] shadow-[0_0_0_1px_rgb(0_0_0/0.1)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.12)]">
            <Icons.Video className="size-3.5" />
            {t("join")}
          </QuietButton>
        ) : material.kind === "pdf" ? (
          <Icons.Download className={`size-4 shrink-0 ${ink[3]}`} />
        ) : (
          <Icons.ChevronRight className={`size-4 shrink-0 ${ink[3]}`} />
        )}
      </div>
    </li>
  );
}

type Mark = "attended" | "missed" | "open" | "upcoming";

function PresenceStrip({ windows, course, now, f, t, tr }: VariantProps & { windows: PresenceWindow[] }) {
  const nowMs = now.getTime();
  const state = (p: PresenceWindow): Mark => {
    if (p.myStatus === "attended") return "attended";
    if (Date.parse(p.opensAt) <= nowMs && nowMs < Date.parse(p.closesAt)) return "open";
    if (Date.parse(p.closesAt) <= nowMs) return "missed";
    return "upcoming";
  };
  const marks = windows.map((p) => ({ p, s: state(p) }));
  const count = (s: Mark) => marks.filter((m) => m.s === s).length;
  const LABEL: Record<Mark, string> = {
    attended: t("attended"),
    missed: tr({ en: "Not marked", id: "Tidak presensi" }),
    open: tr({ en: "Open now", id: "Dibuka sekarang" }),
    upcoming: tr({ en: "Upcoming", id: "Akan datang" }),
  };
  return (
    <section className="mt-8">
      <div className="flex items-baseline gap-2">
        <SectionLabel>{t("presence")}</SectionLabel>
        <div className={`ml-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px] ${ink[2]}`}>
          {(["attended", "missed", "upcoming"] as const).map((s) =>
            count(s) ? (
              <span key={s} className="flex items-center gap-1.5 tabular-nums">
                <Dot state={s} color={course.color} small />
                {count(s)} {LABEL[s].toLowerCase()}
              </span>
            ) : null,
          )}
        </div>
        <span
          className={`ml-auto rounded-[4px] px-1 text-[10px] leading-[15px] font-semibold tracking-[0.03em] ${ink[3]} shadow-[0_0_0_1px_rgb(0_0_0/0.1)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.12)]`}
        >
          EduNex
        </span>
      </div>
      <ol className={`mt-3 flex flex-wrap gap-y-3 rounded-[12px] border px-3 py-3 ${hairline}`}>
        {marks.map(({ p, s }) => (
          <li
            key={p.id}
            className="flex w-[52px] flex-col items-center gap-1.5"
            title={`${f.dateLong(p.opensAt)} · ${f.timeRange(p.opensAt, p.closesAt)}${p.topic ? ` · ${p.topic}` : ""} — ${LABEL[s]}`}
          >
            <Dot state={s} color={course.color} />
            <span className={`text-[10.5px] tabular-nums ${s === "open" ? "font-semibold text-[#1D1D1F] dark:text-white" : ink[3]}`}>
              {f.dayMonth(p.opensAt)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Dot({ state, color, small = false }: { state: Mark; color: string; small?: boolean }) {
  const size = small ? "size-2.5" : "size-[22px]";
  switch (state) {
    case "attended":
      return (
        <span className={`grid ${size} place-items-center rounded-full`} style={{ background: color }} aria-hidden>
          {!small && <Icons.Check className="size-3 text-white" strokeWidth={3} />}
        </span>
      );
    case "open":
      return (
        <span className={`relative grid ${size} place-items-center rounded-full`} style={{ boxShadow: `inset 0 0 0 2px ${color}` }} aria-hidden>
          <span className="absolute inset-0 rounded-full opacity-30 motion-safe:animate-ping" style={{ background: color }} />
          <span className="size-2 rounded-full" style={{ background: color }} />
        </span>
      );
    case "missed":
      return (
        <span
          className={`grid ${size} place-items-center rounded-full bg-black/[0.03] shadow-[inset_0_0_0_1.5px_rgb(0_0_0/0.22)] dark:bg-white/[0.03] dark:shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.26)]`}
          aria-hidden
        >
          {!small && <span className="h-[1.5px] w-2 rounded-full bg-black/35 dark:bg-white/40" />}
        </span>
      );
    case "upcoming":
      return <span className={`${size} rounded-full border-[1.5px] border-dashed border-black/25 dark:border-white/25`} aria-hidden />;
  }
}
