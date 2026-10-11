// PROTOTYPE (#83) — throwaway. Variant C "Spaces" — Home: a bento of what
// matters now. Order of importance: the open Presence, the next class,
// today's classes and the nearest deadlines, then EduNex news and SIX standing.
import type { ReactNode } from "react";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import {
  CARD,
  CodeTag,
  DueChip,
  EDUNEX_URL,
  FOCUS,
  INK,
  LIFT,
  MUTED,
  NEUTRAL,
  ROW_HOVER,
  Ring,
  SourceTag,
  TileTitle,
  WASH,
  cx,
  heroGradient,
  withColor,
  type Model,
} from "./variant-c-ui";

export function TodayScreen({ p, m }: { p: VariantProps; m: Model }) {
  const { tr, f, data, now } = p;
  const classes = m.todaySessions.length;
  const open = m.openTasks.length;
  return (
    <div className="vc-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-[1240px] px-6 pt-5 pb-6">
        <header className="mb-4 flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="vc-display truncate text-[26px] leading-tight font-semibold">
              {f.greeting()}, {data.student.firstName}
            </h1>
            <p className={cx("shrink-0 text-[14px] font-medium", MUTED)}>{f.dateLong(now.toISOString())}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SummaryPill icon={<Icons.Calendar className="size-3.5" strokeWidth={2} />}>
              {tr({ en: `${classes} ${classes === 1 ? "class" : "classes"}`, id: `${classes} kuliah` })}
            </SummaryPill>
            <SummaryPill icon={<Icons.ListChecks className="size-3.5" strokeWidth={2} />}>
              {tr({ en: `${open} to do`, id: `${open} tugas aktif` })}
            </SummaryPill>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-3.5">
          <HappeningNow p={p} m={m} className="col-span-8" />
          <NextUp p={p} m={m} className="col-span-4" />
          <TodayClasses p={p} m={m} className="col-span-4" />
          <Deadlines p={p} m={m} className="col-span-5" />
          <Ipk p={p} className="col-span-3" />
          <FromEduNex p={p} m={m} className="col-span-7" />
          <Attendance p={p} m={m} className="col-span-5" />
        </div>
      </div>
    </div>
  );
}

function SummaryPill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/75 px-2.5 text-[12px] font-semibold text-zinc-600 ring-1 ring-zinc-900/[0.06] dark:bg-white/[0.05] dark:text-zinc-300 dark:ring-white/[0.07]">
      {icon}
      {children}
    </span>
  );
}

/* ---------------------------------------------------------- happening now */

export function LivePill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "vc-num inline-flex h-7 items-center gap-2 rounded-full bg-white/[0.16] px-2.5 text-[12px] font-semibold tracking-[0.01em] text-white ring-1 ring-white/20 backdrop-blur-sm ring-inset",
        className,
      )}
    >
      <span className="relative grid size-2 place-items-center" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-white motion-safe:animate-[vc-breathe_2.4s_ease-out_infinite]" />
        <span className="relative size-2 rounded-full bg-white" />
      </span>
      {children}
    </span>
  );
}

export function HeroDecor({ className = "-top-24 -right-16 size-[340px]" }: { className?: string }) {
  return (
    <svg aria-hidden className={cx("pointer-events-none absolute -z-10 text-white/[0.09]", className)} viewBox="0 0 340 340" fill="none">
      <circle cx="170" cy="170" r="168" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="170" cy="170" r="128" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="170" cy="170" r="88" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="170" cy="170" r="48" fill="currentColor" />
    </svg>
  );
}

function HappeningNow({ p, m, className }: { p: VariantProps; m: Model; className?: string }) {
  const { t, tr, f, go } = p;
  const pres = m.openPresence;

  if (pres) {
    const course = m.course(pres.courseCode);
    const session =
      m.currentSession?.courseCode === pres.courseCode
        ? m.currentSession
        : m.todaySessions.find((s) => s.courseCode === pres.courseCode);
    const total = m.ms(pres.closesAt) - m.ms(pres.opensAt);
    const pct = Math.min(100, Math.max(0, ((m.now - m.ms(pres.opensAt)) / total) * 100));
    return (
      <section
        aria-label={t("presence_open")}
        style={withColor(m.color(pres.courseCode), { backgroundImage: heroGradient() })}
        className={cx(
          "relative isolate flex min-h-[214px] flex-col overflow-hidden rounded-[22px] px-6 pt-5 pb-6 text-white shadow-[0_22px_44px_-26px_var(--c),0_2px_6px_-2px_rgba(0,0,0,0.12)]",
          className,
        )}
      >
        <HeroDecor />
        <div className="flex items-center gap-2">
          <LivePill>{t("presence_open")}</LivePill>
          <button
            type="button"
            onClick={() => go("course", { course: pres.courseCode })}
            className={cx(
              "vc-num inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-bold tracking-[0.03em] text-white/90 transition duration-150 ease-out hover:bg-white/[0.12] hover:text-white",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
            )}
          >
            {pres.courseCode}
            <Icons.ChevronRight className="size-3.5" strokeWidth={2.4} />
          </button>
        </div>

        <h2 className="vc-display mt-3 max-w-[560px] text-[23px] leading-[1.15] font-semibold text-balance">
          {course?.name ?? pres.courseName}
        </h2>
        {pres.topic && <p className="mt-1 max-w-[560px] truncate text-[13px] text-white/85">{pres.topic}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] font-medium text-white/90">
          {session?.room && (
            <span className="inline-flex items-center gap-1.5">
              <Icons.MapPin className="size-3.5" strokeWidth={2} />
              {session.room}
            </span>
          )}
          {session && (
            <span className="vc-num inline-flex items-center gap-1.5">
              <Icons.Clock className="size-3.5" strokeWidth={2} />
              {f.timeRange(session.start, session.end)}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-6 pt-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.09em] text-white/80 uppercase">{t("closes_in")}</p>
            <p className="mt-1 flex items-baseline gap-2.5">
              <span className="vc-display vc-num text-[46px] leading-none font-semibold tracking-tight">{f.countdown(pres.closesAt)}</span>
              <span className="vc-num text-[13px] font-semibold text-white/80">{f.time(pres.closesAt)}</span>
            </p>
          </div>
          <a
            href={EDUNEX_URL}
            target="_blank"
            rel="noreferrer"
            className={cx(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[13.5px] font-semibold shadow-[0_6px_16px_-6px_rgba(0,0,0,0.35)] transition duration-150 ease-out hover:bg-white/90 motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0",
              "vc-ink-deep",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
            )}
          >
            {t("open_in_edunex")}
            <Icons.ArrowUpRight className="size-4" strokeWidth={2.2} />
          </a>
        </div>

        {/* The Presence window, opens → closes, as a hairline along the bottom edge. */}
        <div
          className="absolute inset-x-0 bottom-0 h-[4px] bg-black/[0.14]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label={`${t("presence")} ${f.timeRange(pres.opensAt, pres.closesAt)}`}
        >
          <div className="h-full rounded-r-full bg-white/85" style={{ width: `${pct}%` }} />
        </div>
      </section>
    );
  }

  // No Presence open: the class in progress, else a calm "nothing right now".
  const s = m.currentSession;
  if (s) {
    return (
      <section
        style={withColor(m.color(s.courseCode), { backgroundImage: heroGradient() })}
        className={cx("relative isolate flex min-h-[214px] flex-col overflow-hidden rounded-[22px] p-6 text-white", className)}
      >
        <HeroDecor />
        <LivePill>{t("in_progress")}</LivePill>
        <h2 className="vc-display mt-3 text-[23px] leading-tight font-semibold">{m.courseName(s.courseCode, s.courseName)}</h2>
        <p className="vc-num mt-auto text-[13px] font-medium text-white/90">
          {f.timeRange(s.start, s.end)} · {s.room || t("online_class")}
        </p>
      </section>
    );
  }
  return (
    <section className={cx(CARD, "flex min-h-[214px] flex-col items-start justify-end p-6", className)}>
      <span className="grid size-10 place-items-center rounded-full bg-[#22A45D]/[0.12] text-[#146C3B] dark:text-[#7EE2A0]">
        <Icons.Check className="size-5" strokeWidth={2.4} />
      </span>
      <h2 className="vc-display mt-3 text-[22px] font-semibold">{t("all_caught_up")}</h2>
      <p className={cx("mt-1 text-[13px]", MUTED)}>{tr({ en: "Nothing needs you right now", id: "Tidak ada yang mendesak" })}</p>
    </section>
  );
}

/* ---------------------------------------------------------------- next up */

function NextUp({ p, m, className }: { p: VariantProps; m: Model; className?: string }) {
  const { t, tr, f, go } = p;
  const s = m.nextSession;
  if (!s) {
    return (
      <section className={cx(CARD, "flex flex-col p-[18px]", className)}>
        <TileTitle>{t("next_class")}</TileTitle>
        <p className={cx("mt-auto text-[13px]", MUTED)}>{t("no_classes_today")}</p>
      </section>
    );
  }
  const color = m.color(s.courseCode);
  const sameDay = f.dayOffset(s.start) === 0;
  const after = m.todaySessions.find((x) => m.ms(x.start) > m.ms(s.start));
  return (
    <section style={withColor(color)} className={cx(CARD, "relative isolate flex flex-col overflow-hidden p-[18px]", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 -z-10 size-60 rounded-full bg-(--c) opacity-[0.16] blur-[48px] dark:opacity-[0.24]"
      />
      <TileTitle aside={<SourceTag>SIX</SourceTag>}>{t("next_class")}</TileTitle>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="vc-display vc-num text-[38px] leading-none font-semibold tracking-tight">{f.time(s.start)}</span>
        <span className={cx("vc-num text-[14px] font-medium", MUTED)}>– {f.time(s.end)}</span>
        <span className={cx("vc-num ml-auto shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold", WASH, INK)}>
          {sameDay ? "" : `${f.relativeDay(s.start)} · `}
          {tr({ en: `in ${f.countdown(s.start)}`, id: `dalam ${f.countdown(s.start)}` })}
        </span>
      </div>

      <button
        type="button"
        onClick={() => go("course", { course: s.courseCode })}
        className={cx("group -mx-2 mt-auto rounded-[14px] px-2 py-1.5 text-left", ROW_HOVER, FOCUS)}
      >
        <span className="block truncate text-[15px] leading-snug font-semibold">{m.courseName(s.courseCode, s.courseName)}</span>
        <span className="mt-1.5 flex items-center gap-2">
          <CodeTag code={s.courseCode} color={color} />
          <span className={cx("inline-flex min-w-0 items-center gap-1 text-[12.5px] font-medium", MUTED)}>
            <Icons.MapPin className="size-3.5 shrink-0" strokeWidth={2} />
            <span className="truncate">{s.room || t("online_class")}</span>
          </span>
        </span>
      </button>
      {after && sameDay && (
        <p className={cx("vc-num mt-2 flex items-center gap-1.5 border-t border-zinc-900/[0.06] pt-2.5 text-[12px] dark:border-white/[0.07]", MUTED)}>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{tr({ en: "Then", id: "Lalu" })}</span>
          <span className="font-semibold">{f.time(after.start)}</span>
          <span className="size-[3px] shrink-0 rounded-full bg-current opacity-60" />
          <span className="truncate">
            {after.courseCode} · {after.room || t("online_class")}
          </span>
        </p>
      )}
    </section>
  );
}

/* ---------------------------------------------------------- today classes */

function TodayClasses({ p, m, className }: { p: VariantProps; m: Model; className?: string }) {
  const { t, tr, f, go } = p;
  return (
    <section className={cx(CARD, "flex flex-col p-[18px]", className)}>
      <TileTitle aside={<SourceTag>SIX</SourceTag>}>{t("classes_today")}</TileTitle>
      {m.todaySessions.length === 0 ? (
        <p className={cx("mt-auto text-[13px]", MUTED)}>{t("no_classes_today")}</p>
      ) : (
        <ol className="mt-2 -mx-2 space-y-px">
          {m.todaySessions.map((s) => {
            const start = m.ms(s.start);
            const end = m.ms(s.end);
            const state = m.now >= end ? "past" : m.now >= start ? "now" : "next";
            const clash = m.overlapsWith.get(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go("course", { course: s.courseCode })}
                  style={withColor(m.color(s.courseCode))}
                  className={cx(
                    "flex w-full items-stretch gap-3 rounded-[12px] px-2 py-[5px] text-left",
                    state === "now" ? WASH : ROW_HOVER,
                    state === "past" && "opacity-55",
                    FOCUS,
                  )}
                >
                  <span className="vc-num w-[38px] shrink-0 text-right leading-tight">
                    <span className="block text-[12.5px] font-semibold">{f.time(s.start)}</span>
                    <span className={cx("block text-[11px]", MUTED)}>{f.time(s.end)}</span>
                  </span>
                  <span className="w-[3px] shrink-0 rounded-full bg-(--c)" aria-hidden />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[13px] font-semibold">{m.courseName(s.courseCode, s.courseName)}</span>
                    <span className={cx("mt-[3px] flex items-center gap-1.5 text-[11.5px]", MUTED)}>
                      <span className={cx("vc-num font-bold", INK)}>{s.courseCode}</span>
                      <span className="truncate">{s.room || t("online_class")}</span>
                      {state === "now" && (
                        <span className="vc-solid ml-auto shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold uppercase">{t("now")}</span>
                      )}
                      {clash && state !== "now" && (
                        <span
                          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFB020]/[0.16] px-1.5 py-px text-[10.5px] font-semibold text-[#8A5300] dark:text-[#FFCF70]"
                          title={`${clash.courseCode} ${f.timeRange(clash.start, clash.end)}`}
                        >
                          <Icons.AlertTriangle className="size-3" strokeWidth={2.2} />
                          {tr({ en: "Overlaps", id: "Bentrok" })}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- deadlines */

function Deadlines({ p, m, className }: { p: VariantProps; m: Model; className?: string }) {
  const { t, tr, f, go } = p;
  const next = m.openTasks.slice(0, 3);
  return (
    <section className={cx(CARD, "flex flex-col p-[18px]", className)}>
      <TileTitle
        aside={
          <button
            type="button"
            onClick={() => go("tasks")}
            className={cx(
              "-my-1 inline-flex items-center gap-0.5 rounded-full py-1 pr-1.5 pl-2.5 text-[12px] font-semibold text-zinc-500 transition hover:bg-zinc-900/[0.05] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white",
              FOCUS,
            )}
          >
            {t("view_all")}
            <Icons.ChevronRight className="size-3.5" strokeWidth={2.2} />
          </button>
        }
      >
        {t("upcoming_deadlines")}
      </TileTitle>
      {next.length === 0 ? (
        <p className={cx("mt-auto text-[13px]", MUTED)}>{t("all_caught_up")}</p>
      ) : (
        <ul className="mt-2.5 space-y-1.5">
          {next.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => go("task", { task: task.id })}
                style={withColor(m.color(task.courseCode))}
                className={cx(
                  "relative flex w-full items-center gap-3 overflow-hidden rounded-[14px] bg-zinc-900/[0.028] py-2 pr-3 pl-4 text-left ring-1 ring-zinc-900/[0.04] dark:bg-white/[0.035] dark:ring-white/[0.05]",
                  LIFT,
                  "hover:bg-white dark:hover:bg-white/[0.06]",
                  FOCUS,
                )}
              >
                <span className="absolute inset-y-0 left-0 w-[4px] bg-(--c)" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{task.title}</span>
                  <span className={cx("mt-0.5 flex items-center gap-1.5 text-[11.5px]", MUTED)}>
                    <span className={cx("vc-num font-bold", INK)}>{task.courseCode}</span>
                    <span className="vc-num truncate">{task.dueAt ? f.fromNow(task.dueAt) : ""}</span>
                  </span>
                </span>
                <DueChip task={task} m={m} f={f} t={t} tr={tr} compact />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------------------------------------------------- IPK */

function Ipk({ p, className }: { p: VariantProps; className?: string }) {
  const { t, tr, data } = p;
  const points = data.grades.semesters.filter((s): s is { label: string; sks: number; ip: number } => s.ip !== null);
  const last = points[points.length - 1];
  const W = 220;
  const H = 64;
  const lo = Math.min(...points.map((x) => x.ip)) - 0.2;
  const hi = Math.max(...points.map((x) => x.ip)) + 0.1;
  const xy = points.map((pt, i) => [
    points.length === 1 ? W / 2 : 5 + (i / (points.length - 1)) * (W - 10),
    H - 5 - ((pt.ip - lo) / (hi - lo)) * (H - 10),
  ]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = xy.length ? `${line} L${xy[xy.length - 1][0].toFixed(1)} ${H} L${xy[0][0].toFixed(1)} ${H} Z` : "";
  const end = xy[xy.length - 1];
  return (
    <section className={cx(CARD, "flex flex-col p-[18px]", className)}>
      <TileTitle aside={<SourceTag>SIX</SourceTag>}>{t("ipk")}</TileTitle>
      <p className="mt-2.5 flex items-baseline gap-2">
        <span className="vc-display vc-num text-[42px] leading-none font-semibold tracking-tight">
          {data.grades.ipk?.toFixed(2) ?? "—"}
        </span>
        <span className={cx("vc-num text-[12px] font-semibold", MUTED)}>
          {data.grades.sksPassed} {t("sks")}
        </span>
      </p>
      {points.length > 1 && end && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-auto w-full overflow-visible text-[#5B6CFF] dark:text-[#8C98FF]"
          role="img"
          aria-label={`${tr({ en: "IP per semester", id: "IP per semester" })}: ${points.map((x) => x.ip.toFixed(2)).join(", ")}`}
        >
          <defs>
            <linearGradient id="vc-ipk-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#vc-ipk-fill)" />
          <path d={line} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={end[0]} cy={end[1]} r="4.5" fill="currentColor" className="stroke-white dark:stroke-[#181A20]" strokeWidth="2.5" />
        </svg>
      )}
      {last && (
        <p className={cx("vc-num mt-2 flex items-center justify-between gap-2 text-[12px]", MUTED)}>
          <span className="truncate">{tr({ en: "Last semester", id: "Semester lalu" })}</span>
          <span className="shrink-0 font-semibold text-zinc-700 dark:text-zinc-200">IP {last.ip.toFixed(2)}</span>
        </p>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- from EduNex */

function FromEduNex({ p, m, className }: { p: VariantProps; m: Model; className?: string }) {
  const { t, tr, f, go } = p;
  const items = m.notices.slice(0, 3);
  return (
    <section className={cx(CARD, "flex flex-col p-[18px]", className)}>
      <TileTitle
        aside={
          <span className="flex items-center gap-2">
            {m.unreadCount > 0 && (
              <span className={cx("vc-num text-[12px] font-semibold", MUTED)}>
                {tr({ en: `${m.unreadCount} unread`, id: `${m.unreadCount} belum dibaca` })}
              </span>
            )}
            <SourceTag>EduNex</SourceTag>
          </span>
        }
      >
        {tr({ en: "From EduNex", id: "Dari EduNex" })}
      </TileTitle>
      <ul className="mt-2 -mx-2 space-y-px">
        {items.map((n) => {
          const course = m.noticeCourse(n);
          const task = m.noticeTask(n);
          const isTask = n.type === "ASSIGNMENT";
          const kind = isTask
            ? tr({ en: "New task", id: "Tugas baru" })
            : n.type === "CONTENT"
              ? tr({ en: "New material", id: "Materi baru" })
              : t("announcements");
          const Icon = isTask ? Icons.ListChecks : n.type === "CONTENT" ? Icons.BookOpen : Icons.Megaphone;
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => (task ? go("task", { task: task.id }) : course ? go("course", { course: course.code }) : undefined)}
                style={withColor(course?.color ?? NEUTRAL)}
                className={cx("flex w-full items-center gap-3 rounded-[12px] px-2 py-[5px] text-left", ROW_HOVER, FOCUS)}
              >
                <span className={cx("grid size-[30px] shrink-0 place-items-center rounded-[9px]", WASH, INK)}>
                  <Icon className="size-[15px]" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{n.title.trim()}</span>
                <span className={cx("hidden shrink-0 items-center gap-1.5 text-[11.5px] min-[1100px]:flex", MUTED)}>
                  {kind}
                  {course && <span className={cx("vc-num font-bold", INK)}>{course.code}</span>}
                </span>
                <span className={cx("vc-num w-[92px] shrink-0 text-right text-[11.5px]", MUTED)}>{f.fromNow(n.date)}</span>
                <span
                  className={cx("size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-[#2F6BF0] dark:bg-[#5B8CFF]")}
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------- attendance */

function Attendance({ p, m, className }: { p: VariantProps; m: Model; className?: string }) {
  const { t, go } = p;
  return (
    <section className={cx(CARD, "flex flex-col p-[18px]", className)}>
      <TileTitle aside={<SourceTag>SIX</SourceTag>}>{t("attendance")}</TileTitle>
      <ul className="mt-auto grid grid-cols-5 gap-1 pt-2">
        {m.courses.map((c) => {
          const pct = c.attendancePct;
          return (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => go("course", { course: c.code })}
                style={withColor(c.color)}
                aria-label={`${c.code} ${t("attendance")} ${pct === null ? "—" : `${Math.round(pct)}%`}`}
                className={cx("flex w-full flex-col items-center gap-1.5 rounded-[14px] py-1", ROW_HOVER, FOCUS)}
              >
                <Ring value={pct ?? 0} size={58} stroke={6} color={c.color}>
                  <span className="vc-display vc-num text-[14px] font-semibold">
                    {pct === null ? "—" : Math.round(pct)}
                    <span className="text-[9.5px] font-semibold opacity-60">%</span>
                  </span>
                </Ring>
                <span className={cx("vc-num text-[10.5px] font-bold", INK)}>{c.code}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
