// PROTOTYPE (#83) — throwaway. Variant A "Calendar": Today — a day timeline
// (SIX classes by course colour, EduNex deadlines at their due time, a live
// "now" line) and a right rail with what matters right now.
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ClassSession, PresenceWindow, Task } from "./data";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import type { DayNav } from "./variant-a-sidebar";
import {
  accentText,
  addDays,
  byDue,
  card,
  clamp01,
  clock,
  courseColor,
  courseMap,
  courseName,
  DAY,
  Ex,
  focusRing,
  hairline,
  IconButton,
  ink,
  isDone,
  keyIso,
  keyOf,
  LiveDot,
  PrimaryButton,
  SectionLabel,
  STATUS_INK,
  STATUS_LABEL,
  StatusGlyph,
  Swatch,
  tone,
  wibMinutes,
} from "./variant-a-kit";

const vars = (v: Record<string, string>) => v as CSSProperties;

export function TodayScreen(props: VariantProps & DayNav) {
  return (
    <div className="flex h-full min-h-0">
      <DayView {...props} />
      <NowRail {...props} />
    </div>
  );
}

// ================================================================ timeline

interface Segment {
  start: number;
  end: number;
}
const GUTTER = 58; // px, hour labels
const FOLD = 26; // minutes of height given to a collapsed stretch of hours
const MIN_PX_PER_MIN = 0.7;

/** Hours to draw: a working-day core plus short stretches around anything outside it. */
function buildSegments(intervals: [number, number][], points: number[]): Segment[] {
  let start = 7 * 60;
  let end = 18 * 60;
  for (const [a, b] of intervals) {
    start = Math.min(start, Math.floor(a / 60) * 60);
    end = Math.max(end, Math.ceil(b / 60) * 60);
  }
  const segs: Segment[] = [{ start, end }];
  for (const p of points) {
    if (p >= start && p <= end) continue;
    const h = Math.floor(p / 60) * 60;
    segs.push({ start: h, end: Math.min(h + 60, 24 * 60) });
  }
  segs.sort((a, b) => a.start - b.start);
  const merged: Segment[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && s.start - last.end <= 60) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}

function makeScale(segs: Segment[]) {
  const offsets: number[] = [];
  let total = 0;
  segs.forEach((s, i) => {
    offsets.push(total);
    total += s.end - s.start + (i < segs.length - 1 ? FOLD : 0);
  });
  const y = (m: number) => {
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (m <= s.end || i === segs.length - 1) return offsets[i] + Math.max(0, Math.min(m, s.end) - s.start);
      if (m < segs[i + 1].start) return offsets[i] + (s.end - s.start) + FOLD / 2;
    }
    return total;
  };
  return { total, y, offsets };
}

interface Placed<T> {
  item: T;
  s: number;
  e: number;
  col: number;
  cols: number;
}
/** Side-by-side columns for overlapping events (calendar style). */
function placeColumns<T>(items: { item: T; s: number; e: number }[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.s - b.s || b.e - a.e);
  const out: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(...cluster.map((c) => c.col)) + 1;
    for (const c of cluster) out.push({ ...c, cols });
    cluster = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.s >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const used = new Set(cluster.filter((c) => c.e > it.s).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...it, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return out;
}

function DayView(props: VariantProps & DayNav) {
  const { data, now, f, t, tr, dark, day, onDay } = props;
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const todayKey = keyOf(nowMs);
  const isToday = day === todayKey;
  const isPast = day < todayKey;
  const nowMin = wibMinutes(nowIso);
  const courses = useMemo(() => courseMap(data), [data]);

  const sessions = data.sessions.filter((s) => f.dayKey(s.start) === day);
  const deadlines = data.tasks.filter((task) => task.dueAt && f.dayKey(task.dueAt) === day).sort(byDue);
  const presence = data.presence.filter((p) => f.dayKey(p.opensAt) === day);

  const events = sessions.map((s) => {
    const start = wibMinutes(s.start);
    const end = f.dayKey(s.end) === day ? wibMinutes(s.end) : 24 * 60;
    return { item: s, s: start, e: Math.max(start + 20, end) };
  });
  const points = deadlines.map((task) => wibMinutes(task.dueAt as string));
  if (isToday) points.push(nowMin);
  const segs = buildSegments(
    events.map((e) => [e.s, e.e]),
    points,
  );
  const scale = makeScale(segs);
  const placed = placeColumns(events);

  // Fill the available height (scroll only when the window gets small).
  const scroller = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    setAvail(el.clientHeight);
    const ro = new ResizeObserver(() => setAvail(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const PAD_T = 12;
  const PAD_B = 22;
  const gridH = Math.max(avail - PAD_T - PAD_B, scale.total * MIN_PX_PER_MIN);
  const k = gridH / scale.total;
  const Y = (m: number) => scale.y(m) * k;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && isToday && el.scrollHeight > el.clientHeight) el.scrollTop = Math.max(0, Y(nowMin) - 140);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, avail > 0]);

  const hours: number[] = [];
  for (const s of segs) for (let h = s.start; h <= s.end; h += 60) hours.push(h);

  const relative = (() => {
    const off = f.dayOffset(keyIso(day));
    if (Math.abs(off) <= 1) return f.relativeDay(keyIso(day));
    return f.fromNow(keyIso(day, clock(nowMin)));
  })();

  return (
    <section className="flex min-w-0 flex-1 flex-col" aria-label={f.dateLong(keyIso(day))}>
      <header className="flex h-[52px] shrink-0 items-center gap-3 pl-6 pr-4 [-webkit-app-region:drag]">
        <h1 className="text-[15px] font-semibold tracking-[-0.012em]">{f.dateLong(keyIso(day))}</h1>
        {!isToday && <span className={`text-[13px] ${ink[3]}`}>{relative}</span>}
        <div className="ml-auto flex items-center gap-0.5 [-webkit-app-region:no-drag]">
          <IconButton label={tr({ en: "Previous day", id: "Hari sebelumnya" })} onClick={() => onDay(addDays(day, -1))}>
            <Icons.ChevronLeft className="size-4" strokeWidth={2} />
          </IconButton>
          <button
            type="button"
            onClick={() => onDay(todayKey)}
            disabled={isToday}
            className={`h-7 rounded-[7px] px-2.5 text-[12.5px] font-medium shadow-[0_0_0_1px_rgb(0_0_0/0.1)] transition-colors duration-150 enabled:hover:bg-black/[0.04] disabled:text-[#8A8A90] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.12)] dark:enabled:hover:bg-white/[0.06] dark:disabled:text-[#6E6E76] ${focusRing}`}
          >
            {t("today")}
          </button>
          <IconButton label={tr({ en: "Next day", id: "Hari berikutnya" })} onClick={() => onDay(addDays(day, 1))}>
            <Icons.ChevronRight className="size-4" strokeWidth={2} />
          </IconButton>
        </div>
      </header>

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        {avail > 0 && (
          <div className="relative mr-5 ml-2" style={{ height: gridH, marginTop: PAD_T, marginBottom: PAD_B }}>
            {/* Hour lines + labels */}
            {hours.map((h) => {
              const hideLabel = h >= 24 * 60 || (isToday && Math.abs(h - nowMin) < 17);
              return (
                <div key={h} className="pointer-events-none absolute inset-x-0" style={{ top: Y(h) }} aria-hidden>
                  <div className={`absolute right-0 border-t ${hairline}`} style={{ left: GUTTER }} />
                  {!hideLabel && (
                    <span
                      className={`absolute -translate-y-1/2 pr-2.5 text-right text-[10.5px] font-medium tabular-nums ${ink[3]}`}
                      style={{ width: GUTTER, left: 0 }}
                    >
                      {clock(h)}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Collapsed stretches of empty hours */}
            {segs.slice(0, -1).map((s, i) => (
              <div
                key={`fold-${s.end}`}
                aria-hidden
                className="absolute right-0 rounded-[4px] opacity-70 dark:opacity-60"
                style={{
                  left: GUTTER,
                  top: Y(s.end) + 3,
                  height: Math.max(0, Y(segs[i + 1].start) - Y(s.end) - 6),
                  backgroundImage: `repeating-linear-gradient(135deg, ${dark ? "rgb(255 255 255 / 0.06)" : "rgb(0 0 0 / 0.045)"} 0 1px, transparent 1px 7px)`,
                }}
              />
            ))}

            {/* Classes */}
            <div className="absolute inset-y-0 right-0 z-10" style={{ left: GUTTER + 6 }}>
              {placed.map(({ item: s, s: start, e: end, col, cols }) => (
                <ClassBlock
                  key={s.id}
                  {...props}
                  session={s}
                  name={courseName(courses, s.courseCode, s.courseName)}
                  color={courseColor(courses, s.courseCode)}
                  top={Y(start) + 1}
                  height={Math.max(20, Y(end) - Y(start) - 2)}
                  col={col}
                  cols={cols}
                  past={isPast || (isToday && end <= nowMin)}
                  current={isToday && start <= nowMin && nowMin < end}
                  presence={presence.find((p) => p.courseCode === s.courseCode) ?? null}
                />
              ))}
            </div>

            {/* Deadlines at their due time */}
            {deadlines.map((task) => (
              <DeadlineMarker
                key={task.id}
                {...props}
                task={task}
                top={Y(wibMinutes(task.dueAt as string))}
                color={courseColor(courses, task.courseCode)}
              />
            ))}

            {/* Now: the line runs under the class blocks so it never strikes text */}
            {isToday && (
              <div
                aria-hidden
                className="pointer-events-none absolute right-0 z-[5] h-[1.5px] -translate-y-1/2 bg-[#D92D33] dark:bg-[#F0565B]"
                style={{ top: Y(nowMin), left: GUTTER }}
              />
            )}
            {isToday && (
              <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: Y(nowMin) }} aria-hidden>
                <div
                  className="absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D92D33] ring-2 ring-white dark:bg-[#F0565B] dark:ring-[#141416]"
                  style={{ left: GUTTER }}
                />
                <div className="absolute -translate-y-1/2 pr-1.5 text-right" style={{ left: 0, width: GUTTER }}>
                  <span className="rounded-[5px] bg-[#D92D33] px-[5px] py-[2px] text-[10.5px] font-semibold tabular-nums text-white">
                    {f.time(nowIso)}
                  </span>
                </div>
              </div>
            )}

            {sessions.length === 0 && deadlines.length === 0 && (
              <p className={`absolute inset-x-0 top-[38%] text-center text-[13px] ${ink[3]}`} style={{ paddingLeft: GUTTER }}>
                {isToday ? t("no_classes_today") : tr({ en: "No classes", id: "Tidak ada kuliah" })}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ClassBlock({
  session,
  name,
  color,
  top,
  height,
  col,
  cols,
  past,
  current,
  presence,
  now,
  f,
  t,
  go,
  dark,
}: VariantProps & {
  session: ClassSession;
  name: string;
  color: string;
  top: number;
  height: number;
  col: number;
  cols: number;
  past: boolean;
  current: boolean;
  presence: PresenceWindow | null;
}) {
  const tn = tone(color, dark);
  const nowMs = now.getTime();
  const open = presence && Date.parse(presence.opensAt) <= nowMs && nowMs < Date.parse(presence.closesAt);
  const attended = presence?.myStatus === "attended";
  const compact = height < 34;
  const exam = session.activity && session.activity.toLowerCase() !== "kuliah" ? session.activity : null;
  const gap = cols > 1 ? 2 : 0;
  return (
    <button
      type="button"
      onClick={() => go("course", { course: session.courseCode })}
      title={`${name}\n${f.timeRange(session.start, session.end)}${session.room ? ` · ${session.room}` : ""}`}
      className={`group absolute overflow-hidden rounded-[7px] bg-(--bg) text-left text-(--fg) transition-[background-color,box-shadow,opacity] duration-150 ease-out hover:bg-(--bg-h) ${
        current ? "shadow-[0_0_0_1.5px_var(--ring),0_4px_14px_-6px_var(--ring)]" : ""
      } ${past ? "opacity-[0.62] hover:opacity-100" : ""} ${focusRing}`}
      style={{
        top,
        height,
        left: `calc(${(col / cols) * 100}% + ${col ? gap : 0}px)`,
        width: `calc(${100 / cols}% - ${gap * (cols > 1 ? 1 : 0)}px)`,
        ...vars({ "--bg": tn.soft, "--bg-h": tn.softHover, "--fg": tn.text, "--ring": tn.ring }),
      }}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} aria-hidden />
      {compact ? (
        <span className="flex h-full items-center gap-1.5 pr-2 pl-[11px] text-[11.5px] leading-none">
          <span className="truncate font-semibold">{name}</span>
          <span className="shrink-0 tabular-nums">{f.time(session.start)}</span>
        </span>
      ) : (
        <span className="flex h-full flex-col pt-[6px] pr-2 pb-1.5 pl-[11px]">
          <span className="flex items-start gap-2">
            <span className={`min-w-0 flex-1 text-[12.5px] leading-[16px] font-semibold ${height >= 78 ? "line-clamp-2" : "truncate"}`}>
              {name}
            </span>
            {exam && (
              <span className="shrink-0 rounded-[4px] bg-(--fg) px-1 py-px text-[10px] leading-[13px] font-bold tracking-[0.02em] text-white dark:text-[#141416]">
                {exam}
              </span>
            )}
          </span>
          {height >= 40 && (
            <span className="mt-[3px] flex min-w-0 items-center gap-1.5 text-[11.5px] leading-[15px] tabular-nums">
              <span className="shrink-0">{f.timeRange(session.start, session.end)}</span>
              {session.room && (
                <span className="flex min-w-0 items-center gap-1">
                  <Icons.MapPin className="size-3 shrink-0" strokeWidth={2} />
                  <span className="truncate">{session.room}</span>
                </span>
              )}
            </span>
          )}
          {open && height >= 66 && (
            <span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-white/80 py-[3px] pr-2 pl-1.5 text-[11px] leading-none font-semibold text-[#15803D] shadow-[0_0_0_1px_rgb(0_0_0/0.05)] dark:bg-black/30 dark:text-[#4ADE80] dark:shadow-none">
              <LiveDot />
              {t("presence_open")}
            </span>
          )}
          {!open && attended && height >= 58 && (
            <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium">
              <Icons.Check className="size-3" strokeWidth={2.5} />
              {t("attended")}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

function DeadlineMarker({ task, top, color, f, t, go }: VariantProps & { task: Task; top: number; color: string }) {
  const done = isDone(task.status);
  const late = task.status === "overdue" || task.status === "closed";
  return (
    <div className="absolute inset-x-0 z-20" style={{ top }}>
      <div
        aria-hidden
        className={`absolute right-0 border-t border-dashed ${
          done ? "border-black/25 dark:border-white/25" : "border-[#D92D33]/70 dark:border-[#FF6369]/70"
        }`}
        style={{ left: GUTTER }}
      />
      <span
        aria-hidden
        className={`absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1.5px] ${
          done ? "bg-[#9A9AA0] dark:bg-[#77777D]" : "bg-[#D92D33] dark:bg-[#FF6369]"
        }`}
        style={{ left: GUTTER }}
      />
      <button
        type="button"
        onClick={() => go("task", { task: task.id })}
        className={`absolute right-2 flex h-[26px] max-w-[min(78%,520px)] -translate-y-1/2 items-center gap-2 rounded-full bg-white pr-2.5 pl-2 text-[12px] shadow-[0_1px_3px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.09)] transition-shadow duration-150 hover:shadow-[0_2px_8px_rgb(0_0_0/0.1),0_0_0_1px_rgb(0_0_0/0.12)] dark:bg-[#232327] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.1)] dark:hover:bg-[#2A2A2F] ${focusRing}`}
      >
        {done ? (
          <StatusGlyph status={task.status} className="size-3.5" />
        ) : (
          <Ex.Flag className={`size-3.5 shrink-0 ${late ? STATUS_INK.overdue : "text-[#D92D33] dark:text-[#FF7A7F]"}`} strokeWidth={2} />
        )}
        <span className={`shrink-0 font-semibold tabular-nums ${done ? ink[2] : ink[1]}`}>
          {t("due")} {f.time(task.dueAt as string)}
        </span>
        <Swatch color={color} className="size-2" />
        <span className={`min-w-0 truncate ${done ? ink[2] : ink[1]}`}>{task.title}</span>
        {done && <span className={`shrink-0 font-medium ${STATUS_INK[task.status]}`}>{t(STATUS_LABEL[task.status])}</span>}
      </button>
    </div>
  );
}

// ================================================================ now rail

function NowRail(props: VariantProps) {
  const { data, now, f, t, tr, go } = props;
  const nowMs = now.getTime();
  const courses = useMemo(() => courseMap(data), [data]);

  const openPresence =
    data.presence.find((p) => Date.parse(p.opensAt) <= nowMs && nowMs < Date.parse(p.closesAt)) ?? null;
  const current = data.sessions.find((s) => Date.parse(s.start) <= nowMs && nowMs < Date.parse(s.end)) ?? null;
  const next = data.sessions.find((s) => Date.parse(s.start) > nowMs) ?? null;

  const horizon = nowMs + 7 * DAY;
  const open = (task: Task) => !isDone(task.status) && task.status !== "closed";
  const week = data.tasks
    .filter((task) => task.dueAt && (task.status === "overdue" || (Date.parse(task.dueAt) >= nowMs && Date.parse(task.dueAt) <= horizon)))
    .sort((a, b) => Number(!open(a)) - Number(!open(b)) || byDue(a, b));
  const weekOpen = week.filter(open).length;
  const later = data.tasks
    .filter((task) => open(task) && task.dueAt && Date.parse(task.dueAt) > horizon)
    .sort(byDue)
    .slice(0, Math.max(0, 3 - weekOpen));

  const sessionFor = (p: PresenceWindow) =>
    data.sessions.find((s) => s.courseCode === p.courseCode && f.dayKey(s.start) === f.dayKey(p.opensAt)) ?? null;

  return (
    <aside className={`flex w-[320px] shrink-0 flex-col border-l ${hairline}`} aria-label={t("now")}>
      <header className="flex h-[52px] shrink-0 items-center justify-between px-5 [-webkit-app-region:drag]">
        <h2 className="text-[13px] font-semibold">{t("now")}</h2>
        <span className={`text-[12px] font-medium tabular-nums ${ink[3]}`}>{f.time(now.toISOString())} WIB</span>
      </header>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pt-1 pb-6">
        {openPresence && <PresenceCard {...props} presence={openPresence} session={sessionFor(openPresence)} />}

        {current && current.courseCode !== openPresence?.courseCode && (
          <SessionCard
            {...props}
            label={t("in_progress")}
            session={current}
            trailing={`${tr({ en: "until", id: "sampai" })} ${f.time(current.end)}`}
          />
        )}

        {next && (
          <SessionCard
            {...props}
            label={t("next_class")}
            session={next}
            trailing={
              f.dayOffset(next.start) === 0
                ? `${tr({ en: "in", id: "dalam" })} ${f.countdown(next.start)}`
                : f.relativeDay(next.start)
            }
          />
        )}

        <section>
          <div className="flex items-baseline justify-between px-1">
            <SectionLabel>{t("upcoming_deadlines")}</SectionLabel>
            <button
              type="button"
              onClick={() => go("tasks")}
              className={`rounded-[5px] text-[12px] font-medium ${accentText} hover:underline ${focusRing}`}
            >
              {t("view_all")}
            </button>
          </div>
          <ul className="mt-1.5 space-y-px">
            {week.map((task) => (
              <DeadlineRow key={task.id} {...props} task={task} color={courseColor(courses, task.courseCode)} />
            ))}
            {week.length === 0 && (
              <li className={`flex items-center gap-2 px-2 py-2 text-[12.5px] ${ink[3]}`}>
                <Icons.CheckCircle className="size-4" />
                {t("all_caught_up")}
              </li>
            )}
          </ul>
          {later.length > 0 && (
            <>
              <p className={`mt-3 mb-1 flex items-center gap-2 px-1 text-[11px] font-medium ${ink[3]}`}>
                {t("later")}
                <span className={`h-px flex-1 border-t ${hairline}`} />
              </p>
              <ul className="space-y-px">
                {later.map((task) => (
                  <DeadlineRow key={task.id} {...props} task={task} color={courseColor(courses, task.courseCode)} />
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </aside>
  );
}

function PresenceCard({
  presence,
  session,
  data,
  now,
  f,
  t,
  dark,
}: VariantProps & { presence: PresenceWindow; session: ClassSession | null }) {
  const courses = courseMap(data);
  const color = courseColor(courses, presence.courseCode);
  const tn = tone(color, dark);
  const opens = Date.parse(presence.opensAt);
  const closes = Date.parse(presence.closesAt);
  const progress = clamp01((now.getTime() - opens) / (closes - opens));
  return (
    <section
      aria-label={t("presence_open")}
      className="rounded-[14px] p-4"
      style={{ background: tn.wash, boxShadow: `0 0 0 1px ${tn.ring}` }}
    >
      <div className="flex items-center gap-2">
        <LiveDot />
        <span className="text-[12px] font-semibold text-[#15803D] dark:text-[#4ADE80]">{t("presence_open")}</span>
      </div>
      <p className="mt-3 text-[15px] leading-[20px] font-semibold tracking-[-0.01em]">
        {courseName(courses, presence.courseCode, presence.courseName)}
      </p>
      {presence.topic && <p className={`mt-0.5 text-[12.5px] ${ink[2]}`}>{presence.topic}</p>}
      <p className={`mt-1.5 flex items-center gap-1.5 text-[12px] ${ink[2]}`}>
        <Swatch color={color} className="size-2" />
        <span className="font-medium tabular-nums">{presence.courseCode}</span>
        {session?.room && (
          <>
            <span aria-hidden>·</span>
            <Icons.MapPin className="size-3" strokeWidth={2} />
            <span className="truncate">{session.room}</span>
          </>
        )}
      </p>

      <p className={`mt-4 text-[11.5px] font-medium ${ink[2]}`}>{t("closes_in")}</p>
      <p className="mt-0.5 text-[26px] leading-[30px] font-semibold tracking-[-0.02em] tabular-nums">{f.countdown(presence.closesAt)}</p>
      <div
        className="mt-3 h-[5px] overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.1]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label={t("closes_in")}
      >
        <div className="h-full rounded-full" style={{ width: `${Math.max(4, progress * 100)}%`, background: color }} />
      </div>
      <div className={`mt-1.5 flex justify-between text-[11px] font-medium tabular-nums ${ink[2]}`} aria-hidden>
        <span>{f.time(presence.opensAt)}</span>
        <span>{f.time(presence.closesAt)}</span>
      </div>

      <PrimaryButton className="mt-4 w-full">
        {t("open_in_edunex")}
        <Icons.ArrowUpRight className="size-3.5" strokeWidth={2.25} />
      </PrimaryButton>
    </section>
  );
}

function SessionCard({
  label,
  session,
  trailing,
  data,
  f,
  go,
  dark,
}: VariantProps & { label: string; session: ClassSession; trailing: string }) {
  const courses = courseMap(data);
  const color = courseColor(courses, session.courseCode);
  const tn = tone(color, dark);
  return (
    <section>
      <div className="flex items-center justify-between gap-3 px-1">
        <SectionLabel>{label}</SectionLabel>
        <span
          className="shrink-0 rounded-full px-2 py-[2px] text-[11.5px] leading-[15px] font-semibold tabular-nums"
          style={{ background: tn.soft, color: tn.text }}
        >
          {trailing}
        </span>
      </div>
      <button
        type="button"
        onClick={() => go("course", { course: session.courseCode })}
        className={`mt-2 flex w-full items-stretch gap-3 px-3 py-3 text-left transition-shadow duration-150 hover:shadow-[0_2px_10px_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.1)] ${card} ${focusRing}`}
      >
        <span className="w-[3px] shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] leading-[18px] font-semibold">
            {courseName(courses, session.courseCode, session.courseName)}
          </span>
          <span className={`mt-1 flex items-center gap-1.5 text-[12px] tabular-nums ${ink[2]}`}>
            <span className="shrink-0">{f.timeRange(session.start, session.end)}</span>
            {session.room && (
              <>
                <Icons.MapPin className="ml-1 size-3 shrink-0" strokeWidth={2} />
                <span className="truncate">{session.room}</span>
              </>
            )}
          </span>
        </span>
      </button>
    </section>
  );
}

function DeadlineRow({ task, color, f, t, go }: VariantProps & { task: Task; color: string }) {
  const done = isDone(task.status);
  const due = task.dueAt as string;
  return (
    <li>
      <button
        type="button"
        onClick={() => go("task", { task: task.id })}
        className={`flex w-full items-start gap-2.5 rounded-[8px] px-2 py-[7px] text-left transition-colors duration-150 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] ${focusRing}`}
      >
        <StatusGlyph status={task.status} className="mt-[1.5px] size-[15px]" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={`min-w-0 flex-1 truncate text-[13px] leading-[18px] ${done ? ink[2] : ink[1]}`}>{task.title}</span>
            <span
              className={`shrink-0 text-[11.5px] font-medium tabular-nums ${
                done ? STATUS_INK[task.status] : task.status === "overdue" ? STATUS_INK.overdue : ink[2]
              }`}
            >
              {done ? t(STATUS_LABEL[task.status]) : f.fromNow(due)}
            </span>
          </span>
          <span className={`mt-px flex items-center gap-1.5 text-[11.5px] leading-[15px] tabular-nums ${ink[3]}`}>
            <Swatch color={color} className="size-2" />
            <span className="shrink-0">{task.courseCode}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{f.dueLabel(due)}</span>
          </span>
        </span>
      </button>
    </li>
  );
}
