// Jadwal's month: what's unusual, not the routine. Exams, deadlines, Presence
// by handing in a Task, moved, extra and clashing classes and meetings only
// Edunex announced each get a line with its own icon (the words in its
// name); the routine collapses to a quiet count ("4 kuliah"). ITB's periods
// (UTS, UAS, holidays) tint their days, named on their first day. A day
// opens its details in a popover, with the way to its week.
import { type ReactNode, useMemo } from "react";
import { wibDay } from "../../../core/course-meetings";
import type { CalendarEvent } from "../../../core/models";
import { dayStart, type MonthGrid, type ScheduleDay, scheduleDays } from "../../../core/schedule";
import { taskStatus } from "../../../core/tasks";
import { type Format, type Translate, useFormat, useT } from "../../i18n";
import type { ScheduleData } from "../../schedule-data";
import { Button } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { CourseDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Popover } from "../../ui/overlays";
import { handInLabel, periodName, timeRange, useWorld } from "./details";

/** Exception lines a day cell shows before "+N". */
const LINES = 3;
/** Weekends hold little: they give their width to the weekdays. */
const COLUMNS = "repeat(5, minmax(0, 1fr)) repeat(2, minmax(0, 0.7fr))";
/** ITB's periods tinted behind their days; single days (the term's first and last lecture day) get a line instead. */
const TINTED = new Set(["uts", "uas", "holiday", "drs", "urs"]);
const MARKED = new Set(["lecture-start", "lecture-end"]);

interface Line {
  key: string;
  icon: ReactNode;
  text: string;
  /** Said in full to screen readers and on hover. */
  full: string;
  tone?: string;
}

export function MonthView({ month, input, onShowWeek }: { month: MonthGrid; input: ScheduleData; onShowWeek: (day: string) => void }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const days = useMemo(() => month.weeks.flat(), [month]);
  const plan = useMemo(() => scheduleDays(days, input), [days, input]);
  const today = wibDay(world.now);
  const periods = input.events.filter((e) => TINTED.has(e.kind));
  const noon = (day: string) => dayStart(day) + 12 * 3_600_000;

  return (
    <div className="mt-2">
      <div className="grid gap-1.5 pb-1.5" style={{ gridTemplateColumns: COLUMNS }} aria-hidden>
        {days.slice(0, 7).map((day) => (
          <span key={day} className="px-2 text-caption font-semibold text-muted">
            {f.weekdayShort(noon(day))}
          </span>
        ))}
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: COLUMNS }}>
        {plan.map((day, i) => {
          const inMonth = day.day.startsWith(month.month);
          const period = periods.find((e) => e.firstDay <= day.day && day.day <= e.lastDay) ?? null;
          // A period is named on its first day, and again on each Monday it runs into.
          const named = period && (period.firstDay === day.day || i % 7 === 0 || (i === 0 && period.firstDay < day.day)) ? period : null;
          const lines = inMonth ? monthLines(day, t, f, world) : [];
          const routine = inMonth ? routineCount(day, t) : null;
          const clashes = inMonth ? clashesOf(day, t, f) : [];
          const summary = [...lines.map((l) => l.full), ...clashes.map((c) => c.full), routine, period ? periodName(t, period) : null].filter(Boolean).join(", ");
          const label = summary ? `${f.dateLong(noon(day.day))}: ${summary}` : f.dateLong(noon(day.day));
          const cell = (
            <button
              type="button"
              aria-label={label}
              className={cx(
                "focus-ring flex min-h-[104px] min-w-0 flex-col items-stretch gap-[3px] rounded-lg border p-1.5 text-left transition-colors duration-150",
                period ? "border-transparent bg-(--source-itb-bg)/70 hover:bg-(--source-itb-bg)" : inMonth ? "border-edge bg-surface hover:bg-hover" : "border-transparent bg-sunken",
                !inMonth && "opacity-60",
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cx(
                    "grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-1 text-caption font-semibold tabular-nums",
                    day.day === today ? "bg-accent text-on-accent" : inMonth ? "text-fg" : "text-faint",
                  )}
                >
                  {Number(day.day.slice(8))}
                </span>
                {named && <span className="truncate text-micro font-semibold text-(--source-itb-fg)">{periodName(t, named)}</span>}
              </span>
              {lines.slice(0, LINES).map((line) => (
                <span key={line.key} title={line.full} className={cx("flex min-w-0 items-start gap-1 text-micro leading-[15px]", line.tone)}>
                  <span className="flex h-[15px] shrink-0 items-center">{line.icon}</span>
                  <span className="line-clamp-2 min-w-0 break-words">{line.text}</span>
                </span>
              ))}
              {lines.length > LINES && <span className="text-micro text-faint">{t("schedule.more", { count: lines.length - LINES })}</span>}
              {(routine || clashes.length > 0) && (
                // The day's classes first, then the clash among them with its time ("Bentrok 16:00"), so it never reads as all of them clashing.
                <span className="mt-auto flex min-w-0 flex-col gap-[3px] text-micro leading-[15px]">
                  {routine && <span className="line-clamp-2 text-faint">{routine}</span>}
                  {clashes.length > 0 && (
                    <span title={clashes.map((c) => c.full).join(", ")} className="flex min-w-0 items-center gap-1 font-semibold text-warning-fg">
                      <Icons.Overlap className="size-3 shrink-0" weight="bold" />
                      <span className="truncate">{clashes.length === 1 ? t("schedule.month.clashAt", { time: clashes[0]!.from }) : t("schedule.month.clashes", { count: clashes.length })}</span>
                    </span>
                  )}
                </span>
              )}
            </button>
          );
          return (
            <Popover key={day.day} trigger={cell} align="start" label={f.dateLong(noon(day.day))} className="w-[340px] p-4">
              <DayDetails day={day} period={period} onShowWeek={() => onShowWeek(day.day)} />
            </Popover>
          );
        })}
      </div>
    </div>
  );
}

/** What's unusual that day, one line each, worst first: exams, clashes, hand-in windows, deadlines, moves, meetings only Edunex announced. */
function monthLines(day: ScheduleDay, t: Translate, f: Format, world: ReturnType<typeof useWorld>): Line[] {
  const lines: Line[] = [];
  const time = (ms: number) => f.time(ms);
  for (const event of day.events.filter((e) => MARKED.has(e.kind))) {
    lines.push({ key: `c${event.id}`, icon: <Icons.Flag className="size-3 shrink-0" weight="bold" />, text: periodName(t, event), full: event.title, tone: "font-semibold text-(--source-itb-fg)" });
  }
  for (const { session, exam } of day.classes) {
    if (!exam) continue;
    lines.push({
      key: `e${session.id}`,
      icon: <span className="shrink-0 rounded-[3px] bg-fg px-1 text-[10px] leading-[14px] font-bold text-canvas">{session.activity}</span>,
      text: session.courseCode,
      full: t("schedule.month.exam", { activity: session.activity, code: session.courseCode, time: time(session.start), room: session.room ?? "" }),
      tone: "font-semibold",
    });
  }
  for (const window of day.windows) {
    const done = window.presence.recorded?.present || (window.task !== null && taskStatus(window.task, world.now) === "submitted");
    lines.push({
      key: `w${window.presence.id}`,
      icon: done ? <Icons.CheckCircle className="size-3 shrink-0" weight="bold" /> : <Icons.Upload className="size-3 shrink-0" weight="bold" />,
      text: window.task?.title ?? window.code,
      full: `${window.code} · ${done ? t("schedule.window.done", { task: window.task?.title ?? window.code }) : t("schedule.handIn", { task: window.task?.title ?? window.code, time: time(window.presence.closesAt) })}`,
      tone: done ? "text-success-fg" : "font-semibold text-accent-fg",
    });
  }
  for (const task of day.due) {
    lines.push({
      key: `t${task.id}`,
      icon: <Icons.Clock className="size-3 shrink-0" weight="bold" />,
      text: task.title,
      full: t("schedule.month.due", { code: task.courseCode, title: task.title, time: time(task.dueAt!) }),
    });
  }
  for (const { session, moved, extra } of day.classes) {
    if (moved)
      lines.push({
        key: `m${session.id}`,
        icon: <Icons.History className="size-3 shrink-0" weight="bold" />,
        text: session.courseCode,
        full: t("schedule.month.moved", { code: session.courseCode, time: time(session.start) }),
        tone: "font-semibold text-warning-fg",
      });
    if (extra)
      lines.push({
        key: `x${session.id}`,
        icon: <Icons.Plus className="size-3 shrink-0" weight="bold" />,
        text: session.courseCode,
        full: t("schedule.month.extra", { code: session.courseCode, time: time(session.start) }),
        tone: "font-semibold text-warning-fg",
      });
  }
  for (const meeting of day.outside) {
    lines.push({
      key: `a${meeting.code}${meeting.start}`,
      icon: meeting.online ? <Icons.Video className="size-3 shrink-0" weight="bold" /> : <span aria-hidden className="size-2 shrink-0 rounded-full border border-dashed border-current" />,
      text: `${meeting.code} ${time(meeting.start)}`,
      full: t("schedule.month.outside", { code: meeting.code, time: time(meeting.start) }),
      tone: "font-semibold text-warning-fg",
    });
  }
  return lines;
}

/** Classes that share time, once per pair: "Bentrok KU5014 · PL3032 · 16:00–16:30", and when it starts. */
function clashesOf(day: ScheduleDay, t: Translate, f: Format): { full: string; from: string }[] {
  const seen = new Map<string, { full: string; from: string }>();
  for (const { session, overlaps } of day.classes) {
    for (const o of overlaps) {
      const pair = [session.courseCode, o.code].sort().join(" · ");
      if (!seen.has(pair)) seen.set(pair, { full: t("schedule.month.overlap", { pair, from: f.time(o.from), to: f.time(o.to) }), from: f.time(o.from) });
    }
  }
  return [...seen.values()];
}

/** The routine, quietly: "4 kuliah"; inside an exam week or a holiday, "3 kuliah belum pasti"; without SIX, Edunex's meetings. */
function routineCount(day: ScheduleDay, t: Translate): string | null {
  const lectures = day.classes.filter((c) => !c.exam);
  if (lectures.length) return t(lectures.some((c) => c.uncertain) ? "schedule.month.uncertain" : "schedule.month.classes", { count: lectures.length });
  if (day.edunex.length) return t("schedule.month.meetings", { count: day.edunex.length });
  return null;
}

/** A day's details: everything on it in time order, and the way to its week. */
function DayDetails({ day, period, onShowWeek }: { day: ScheduleDay; period: CalendarEvent | null; onShowWeek: () => void }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const noon = dayStart(day.day) + 12 * 3_600_000;
  const timed = [
    ...day.classes.map((c) => ({ key: c.session.id, start: c.session.start, end: c.session.end, code: c.session.courseCode, title: c.exam ? `${c.session.activity} · ${world.name(c.session.courseCode, c.session.courseName)}` : world.name(c.session.courseCode, c.session.courseName), where: c.session.room, exam: c.exam, note: c.overlaps.length ? t("schedule.mark.overlap", { code: c.overlaps[0].code }) : c.moved ? t("schedule.mark.moved") : c.extra ? t("schedule.mark.extra") : null })),
    ...[...day.outside, ...day.edunex].map((m) => ({ key: `${m.code}${m.start}`, start: m.start, end: m.end, code: m.code, title: m.number !== null ? t("schedule.meeting", { n: m.number }) : t("schedule.meetingEdunex"), where: m.online ? t("schedule.online") : null, exam: false, note: null as string | null })),
  ].sort((a, b) => a.start - b.start);
  const empty = !timed.length && !day.windows.length && !day.due.length;
  return (
    <>
      <p className="text-title font-semibold">{f.dateLong(noon)}</p>
      {period && <p className="mt-0.5 text-small font-medium text-(--source-itb-fg)">{periodName(t, period)}</p>}
      {empty ? (
        <p className="mt-3 text-small text-muted">{t("schedule.month.nothing")}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-small">
          {timed.map((item) => (
            <li key={item.key} className="flex items-start gap-2.5">
              <span className="w-[86px] shrink-0 pt-px text-caption font-semibold tabular-nums">{timeRange(f, item.start, item.end)}</span>
              <span className="min-w-0 flex-1">
                <span className={cx("block", item.exam && "font-semibold")}>
                  <CourseDot color={world.color(item.code)} className="mr-1.5 mb-px size-2 align-middle" />
                  <span className="font-semibold tabular-nums">{item.code}</span> {item.title}
                </span>
                <span className="block text-caption text-muted">
                  {[item.where, item.note].filter(Boolean).join(" · ") || " "}
                </span>
              </span>
            </li>
          ))}
          {day.windows.map((w) => (
            <li key={`w${w.presence.id}`} className="flex items-start gap-2.5">
              <span className="w-[86px] shrink-0 pt-px text-caption font-semibold tabular-nums">{f.time(w.presence.closesAt)}</span>
              <span className="min-w-0 flex-1 text-accent-fg">
                <Icons.Upload className="mr-1 inline size-3.5 align-[-2px]" />
                {handInLabel(t, f, w)}
              </span>
            </li>
          ))}
          {day.due.map((task) => (
            <li key={`t${task.id}`} className="flex items-start gap-2.5">
              <span className="w-[86px] shrink-0 pt-px text-caption font-semibold tabular-nums">{f.time(task.dueAt!)}</span>
              <span className="min-w-0 flex-1">
                <Icons.Clock className="mr-1 inline size-3.5 align-[-2px] text-muted" />
                {t("schedule.due.short", { code: task.courseCode, title: task.title })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <Button size="sm" variant="primary" onClick={onShowWeek}>
          {t("schedule.month.showWeek")}
          <Icons.ArrowRight className="size-3.5" />
        </Button>
      </div>
    </>
  );
}

