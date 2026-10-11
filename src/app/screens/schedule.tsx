// Jadwal (#77): SIX's timetable by week (the default) and by month, laid out
// like SIX's own weekly grid. Each class shows its time, course, activity and
// room, with marks for a class moved off its usual slot, overlapping classes
// and exam sessions; meetings announced only in EduNex text, Task deadlines
// and ITB's calendar (UTS week, holidays, the last lecture day) join in. The
// phone calendar export lives here too.
import { type ReactNode, useMemo, useState } from "react";
import { wibDay } from "../../core/course-meetings";
import type { CalendarEvent } from "../../core/models";
import {
  clockOf,
  dayStart,
  isEmptyDay,
  monthGrid,
  type Moved,
  type OutsideMeeting,
  type ScheduledClass,
  type ScheduleDay,
  scheduleDays,
  SCHEDULE_EVENT_KINDS,
  weekDays,
  weekOffset,
} from "../../core/schedule";
import type { Task } from "../../core/models";
import { ActionError } from "../bridge";
import { useTermCourses } from "../courses";
import { type Format, type Translate, useFormat, useLang, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { useExamIds, useScheduleInput } from "../schedule-data";
import { SourceNotice, useSignIn } from "../shell/source-status";
import { useBridge, useStatus } from "../store";
import { Button, IconButton, Segmented } from "../ui/controls";
import { cx } from "../ui/cx";
import { CourseCode, CourseDot, EmptyState, LiveDot, Skeleton, SourceTag } from "../ui/display";
import { Icons } from "../ui/icons";
import { toast } from "../ui/overlays";

export const ready = true;

/** The count shown next to this screen in the sidebar, if any. */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  return null;
}

type View = "week" | "month";

export function ScheduleScreen() {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const now = useNow();
  const input = useScheduleInput();
  const courses = useTermCourses();
  const [view, setView] = useState<View>("week");
  const [week, setWeek] = useState(0);
  const [month, setMonth] = useState(0);

  const days = useMemo(() => (view === "week" ? weekDays(now, week) : monthGrid(now, month).weeks.flat()), [view, now, week, month]);
  const plan = useMemo(() => (input ? scheduleDays(days, input) : undefined), [input, days]);
  const grid = view === "month" ? monthGrid(now, month) : null;
  // Only a month whose own SIX page was read can say a day is free: the edges of another month's grid don't.
  const covered = useMemo(() => new Set(input?.months ?? []), [input]);
  const colors = useMemo(() => new Map((courses ?? []).map((c) => [c.code, c.color])), [courses]);

  const step = (by: number) => (view === "week" ? setWeek((w) => w + by) : setMonth((m) => m + by));
  const subtitle =
    view === "week"
      ? `${f.dayMonth(dayStart(days[0]))} – ${f.dayMonth(dayStart(days[6]))}`
      : new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { month: "long", year: "numeric" }).format(dayStart(`${grid!.month}-15`));
  const visible = view === "week" ? days : days.filter((day) => day.startsWith(grid!.month));
  const unpublished = input !== undefined && !visible.some((day) => covered.has(day.slice(0, 7)));

  return (
    <div className="px-10 pt-7 pb-20">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-display font-semibold tracking-[-0.02em]">{t("nav.schedule")}</h1>
          <p className="mt-1 text-body text-muted">
            {subtitle} · {t("source.six")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label={t("schedule.view")}
            value={view}
            onChange={setView}
            options={[
              { value: "week", label: t("schedule.view.week") },
              { value: "month", label: t("schedule.view.month") },
            ]}
          />
          <div className="flex items-center gap-1">
            <IconButton label={t(view === "week" ? "schedule.prevWeek" : "schedule.prevMonth")} onClick={() => step(-1)}>
              <Icons.ChevronLeft className="size-4" />
            </IconButton>
            <Button onClick={() => (view === "week" ? setWeek(0) : setMonth(0))}>{t(view === "week" ? "schedule.thisWeek" : "schedule.thisMonth")}</Button>
            <IconButton label={t(view === "week" ? "schedule.nextWeek" : "schedule.nextMonth")} onClick={() => step(1)}>
              <Icons.ChevronRight className="size-4" />
            </IconButton>
          </div>
          <ExportButton />
        </div>
      </header>

      <SourceNotice source="six" hasData={input !== undefined} />

      {!plan ? (
        <NoTimetable />
      ) : (
        <>
          <CalendarEvents events={input!.events} days={visible} />
          {unpublished && <p className="mt-4 text-small text-muted">{t("schedule.notCovered")}</p>}
          {view === "week" ? (
            <WeekGrid days={plan} colors={colors} covered={covered} />
          ) : (
            <MonthGrid
              days={plan}
              month={grid!.month}
              colors={colors}
              onOpen={(day) => {
                setWeek(weekOffset(now, day));
                setView("week");
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Before SIX's timetable has been read: placeholders while it's on its way, else where it comes from. */
function NoTimetable() {
  const t = useT();
  const status = useStatus("six");
  const { signIn, busy } = useSignIn();
  if (status.state === "connecting" || status.state === "live")
    return (
      <div className="mt-6 grid grid-cols-5 gap-3" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  return (
    <div className="mt-6">
      <EmptyState icon={<Icons.Calendar className="size-5" />} title={t("schedule.noSix")}>
        {status.state === "signed-out" && (
          <Button size="sm" variant="primary" busy={busy} onClick={() => void signIn("six")}>
            {t("action.signIn")}
          </Button>
        )}
      </EmptyState>
    </div>
  );
}

/** "Masa UTS · 12 Okt–16 Okt": ITB's events that touch the days shown. */
function CalendarEvents({ events, days }: { events: readonly CalendarEvent[]; days: readonly string[] }) {
  const t = useT();
  const f = useFormat();
  const first = days[0];
  const last = days.at(-1)!;
  const shown = events.filter((e) => SCHEDULE_EVENT_KINDS.has(e.kind) && e.firstDay <= last && e.lastDay >= first);
  if (!shown.length) return null;
  return (
    <ul className="mt-5 flex flex-wrap gap-2" aria-label={t("source.itb")}>
      {shown.map((e) => (
        <li key={e.id} className="inline-flex items-center gap-2 rounded-lg bg-fill px-3 py-1.5 text-small font-medium">
          <SourceTag source="itb" />
          {eventLabel(t, e)} · {f.dayMonth(dayStart(e.firstDay))}
          {e.lastDay !== e.firstDay && `–${f.dayMonth(dayStart(e.lastDay))}`}
        </li>
      ))}
    </ul>
  );
}

function eventLabel(t: Translate, event: CalendarEvent): string {
  switch (event.kind) {
    case "uts":
    case "uas":
    case "lecture-start":
    case "lecture-end":
      return t(`calendar.kind.${event.kind}`);
    default:
      return event.title;
  }
}

// ---------------------------------------------------------------- week

function WeekGrid({ days, colors, covered }: { days: ScheduleDay[]; colors: Map<string, string>; covered: Set<string> }) {
  const f = useFormat();
  const now = useNow();
  const examIds = useExamIds();
  const today = wibDay(now);
  // Weekends show only when something is on.
  const shown = days.filter((day, i) => i < 5 || !isEmptyDay(day));
  return (
    <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
      {shown.map((day) => {
        const isToday = day.day === today;
        const at = dayStart(day.day);
        return (
          <section key={day.day} className="min-w-0" aria-label={f.dateLong(at)}>
            <h2 className={cx("mb-2 px-1 text-body", isToday ? "font-semibold" : "text-muted")}>
              <span className={cx(isToday && "rounded-md bg-accent px-1.5 py-0.5 text-on-accent")}>
                {f.weekdayShort(at)} {f.dayMonth(at)}
              </span>
            </h2>
            <div className={cx("min-h-[420px] space-y-2 rounded-xl p-2", isToday ? "bg-info-bg" : "bg-sidebar")}>
              {day.holiday && (
                <p className="flex items-start gap-1.5 rounded-lg bg-surface px-2.5 py-2 text-small font-medium">
                  <SourceTag source="itb" className="shrink-0" />
                  <span className="min-w-0">{day.holiday.title}</span>
                </p>
              )}
              {day.classes.map((item) => (
                <ClassCard key={item.session.id} item={item} color={colors.get(item.session.courseCode) ?? "#888"} examId={examIds.get(item.session.id)} />
              ))}
              {day.outside.map((meeting) => (
                <OutsideCard key={`${meeting.code}-${meeting.start}`} meeting={meeting} color={colors.get(meeting.code) ?? "#888"} />
              ))}
              {day.due.map((task) => (
                <DueRow key={task.id} task={task} />
              ))}
              {isEmptyDay(day) && !day.holiday && covered.has(day.day.slice(0, 7)) && <EmptyDay />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EmptyDay() {
  const t = useT();
  return <p className="px-1 pt-2 text-small text-faint">{t("schedule.noClasses")}</p>;
}

/** `examId`: the exam an exam session belongs to, whose page it opens. */
function ClassCard({ item, color, examId }: { item: ScheduledClass; color: string; examId: string | undefined }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const { session, exam, moved, extra, overlaps } = item;
  const live = session.start <= now && now < session.end;
  const past = session.end <= now;
  const open = () =>
    exam && examId ? go({ screen: "exam", examId }) : go({ screen: "course", code: session.courseCode });
  return (
    <button
      type="button"
      onClick={open}
      className={cx(
        "focus-ring block w-full rounded-lg border border-l-[3px] border-edge bg-surface px-3 py-2.5 text-left transition-colors duration-150 hover:bg-hover",
        past && "opacity-60",
      )}
      style={{ borderLeftColor: color }}
    >
      <span className="flex items-center justify-between text-caption font-semibold tabular-nums">
        {f.timeRange(session.start, session.end)}
        {live && <LiveDot />}
      </span>
      <span className="mt-1 line-clamp-2 block text-body leading-snug font-medium">{session.courseName}</span>
      <span className="mt-1.5 flex items-center justify-between gap-2 text-caption text-muted">
        <CourseCode code={session.courseCode} color={color} />
        <span className="inline-flex min-w-0 items-center gap-1">
          <Icons.MapPin className="size-3 shrink-0" />
          <span className="truncate">{session.room || "—"}</span>
        </span>
      </span>
      {(exam || moved || extra || overlaps.length > 0) && (
        <span className="mt-1.5 block space-y-0.5 text-caption leading-snug font-semibold">
          {exam && <span className="block text-danger-fg">{session.activity}</span>}
          {moved && <MovedNote moved={moved} />}
          {extra && <span className="block text-warning-fg">{t("schedule.extra")}</span>}
          {overlaps.map((o) => (
            <span key={o.code} className="block text-danger-fg">
              {t("schedule.overlap", { code: o.code, from: f.time(o.from), to: f.time(o.to) })}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

function MovedNote({ moved }: { moved: Moved }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const usual = `${clockOf(moved.usual.start)}–${clockOf(moved.usual.end)}`;
  return (
    <>
      {moved.kinds.includes("time") && <span className="block text-warning-fg">{t("schedule.moved.time", { usual })}</span>}
      {moved.kinds.includes("day") && (
        <span className="block text-warning-fg">{t("schedule.moved.day", { day: f.weekday(dayStart(weekDays(now)[moved.usual.weekday])), usual })}</span>
      )}
      {moved.kinds.includes("room") && moved.usual.room && <span className="block text-warning-fg">{t("schedule.moved.room", { room: moved.usual.room })}</span>}
    </>
  );
}

function OutsideCard({ meeting, color }: { meeting: OutsideMeeting; color: string }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  return (
    <button
      type="button"
      onClick={() => go({ screen: "course", code: meeting.code, tab: "meetings" })}
      className="focus-ring block w-full rounded-lg border border-dashed bg-surface px-3 py-2.5 text-left transition-colors duration-150 hover:bg-hover"
      style={{ borderColor: color }}
    >
      <span className="block text-caption font-semibold tabular-nums">{f.timeRange(meeting.start, meeting.end)}</span>
      <span className="mt-1 block text-body leading-snug font-medium">
        {t("schedule.meeting", { n: meeting.number })}
        {meeting.online && ` · ${t("schedule.online")}`}
      </span>
      <span className="mt-1.5 flex items-center justify-between gap-2 text-caption text-muted">
        <CourseCode code={meeting.code} color={color} />
        <SourceTag source="edunex" />
      </span>
      <span className="mt-1 block text-caption font-semibold text-warning-fg">{t("schedule.notInSix")}</span>
    </button>
  );
}

function DueRow({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const time = f.time(task.dueAt!);
  return (
    <button
      type="button"
      onClick={() => go({ screen: "task", taskId: task.id })}
      aria-label={t("schedule.due", { time, title: task.title })}
      className="focus-ring flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-caption transition-colors duration-150 hover:bg-hover"
    >
      <Icons.Clock className="size-3 shrink-0 text-faint" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold tabular-nums">{time}</span> {task.courseCode} · {task.title}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- month

const MONTH_ITEMS = 3;

function MonthGrid({ days, month, colors, onOpen }: { days: ScheduleDay[]; month: string; colors: Map<string, string>; onOpen: (day: string) => void }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const today = wibDay(now);
  return (
    <div className="mt-5">
      <div className="grid grid-cols-7 gap-1.5 pb-1.5" aria-hidden>
        {days.slice(0, 7).map((day) => (
          <span key={day.day} className="px-2 text-caption font-semibold text-muted">
            {f.weekdayShort(dayStart(day.day))}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const inMonth = day.day.startsWith(month);
          const lines = monthLines(day, t, f);
          return (
            <button
              key={day.day}
              type="button"
              onClick={() => onOpen(day.day)}
              aria-label={`${t("schedule.openDay", { date: f.dateLong(dayStart(day.day)) })}${lines.length ? `: ${lines.map((l) => l.text).join(", ")}` : ""}`}
              className={cx(
                "focus-ring flex min-h-[104px] flex-col items-stretch gap-0.5 rounded-lg border border-edge p-1.5 text-left transition-colors duration-150 hover:bg-hover",
                inMonth ? "bg-surface" : "bg-sidebar text-faint",
              )}
            >
              <span className={cx("mb-0.5 self-start rounded-md px-1 text-caption font-semibold tabular-nums", day.day === today && "bg-accent text-on-accent")}>
                {Number(day.day.slice(8))}
              </span>
              {inMonth && (
                <>
                  {lines.slice(0, MONTH_ITEMS).map((line, i) => (
                    <span key={i} className={cx("flex min-w-0 items-center gap-1 text-micro", line.tone)}>
                      {line.code ? <CourseDot color={colors.get(line.code) ?? "#888"} className="size-1.5" /> : line.icon}
                      <span className="truncate">{line.text}</span>
                    </span>
                  ))}
                  {lines.length > MONTH_ITEMS && <span className="text-micro text-faint">{t("schedule.more", { count: lines.length - MONTH_ITEMS })}</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface MonthLine {
  text: string;
  code?: string;
  icon?: ReactNode;
  tone?: string;
}

/** A day's items as short lines: "08:00 PL3002 · Berubah", "UTS DK4073", "23:59 Tugas 02". */
function monthLines(day: ScheduleDay, t: Translate, f: Format): MonthLine[] {
  const lines: MonthLine[] = [];
  if (day.holiday) lines.push({ text: day.holiday.title, icon: <Icons.Flag className="size-2.5 shrink-0" />, tone: "text-(--source-itb-fg)" });
  for (const item of day.classes) {
    const { session } = item;
    const marks = [
      item.exam ? session.activity : null,
      item.moved ? t("schedule.mark.moved") : null,
      item.extra ? t("schedule.mark.extra") : null,
      ...item.overlaps.map((o) => t("schedule.mark.overlap", { code: o.code })),
    ].filter(Boolean);
    lines.push({
      text: [`${f.time(session.start)} ${session.courseCode}`, ...marks].join(" · "),
      code: session.courseCode,
      tone: item.exam || item.overlaps.length ? "text-danger-fg font-semibold" : item.moved || item.extra ? "text-warning-fg font-semibold" : undefined,
    });
  }
  for (const meeting of day.outside) {
    lines.push({ text: `${f.time(meeting.start)} ${meeting.code} · ${t("source.edunex")}`, code: meeting.code, tone: "text-warning-fg font-semibold" });
  }
  for (const task of day.due) lines.push({ text: `${f.time(task.dueAt!)} ${task.title}`, icon: <Icons.Clock className="size-2.5 shrink-0" /> });
  return lines;
}

// ---------------------------------------------------------------- the phone calendar

/** Saves the phone calendar file: classes with rooms, exams and deadlines. */
export function ExportButton({ className }: { className?: string }) {
  const t = useT();
  const bridge = useBridge();
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const { file, events } = await bridge.invoke("schedule.export", {});
      if (file) toast(t("schedule.exported", { count: events }));
    } catch (error) {
      toast(error instanceof ActionError && error.kind !== "Failed" ? t("error.action", { message: error.message }) : t("schedule.exportFailed"), "danger");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button busy={busy} icon={<Icons.Smartphone className="size-3.5" />} onClick={() => void save()} className={className}>
      {t("schedule.export")}
    </Button>
  );
}

