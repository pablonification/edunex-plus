// Jadwal's week: a real timetable. A time axis (07:00–18:00, wider when
// something falls outside), a block per class as tall as it lasts, classes
// that share time side by side with the shared minutes marked red, a red
// "now" line across today, today's column tinted, empty days narrow so busy
// days keep room for every room name, weekends always there. Above the days,
// ITB's periods ("Masa UTS · 12–16 Okt"); under them, what isn't a place to
// be (deadlines, Presence by handing in a Task). Each block opens its
// details in a popover.
import { useMemo } from "react";
import { wibDay } from "../../../core/course-meetings";
import type { CalendarEvent, Task } from "../../../core/models";
import {
  clockOf,
  dayStart,
  type EdunexMeeting,
  isEmptyDay,
  minuteOfDay,
  type OutsideMeeting,
  SCHEDULE_EVENT_KINDS,
  type ScheduleDay,
  type ScheduledClass,
  scheduleDays,
  sideBySide,
  type TaskWindow,
  timeAxis,
} from "../../../core/schedule";
import { taskStatus } from "../../../core/tasks";
import { useOpenExternal } from "../../hooks";
import { type Format, useFormat, useT } from "../../i18n";
import type { ScheduleData } from "../../schedule-data";
import { cx } from "../../ui/cx";
import { LiveDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Meta } from "../../ui/layout";
import { Popover } from "../../ui/overlays";
import { GridBlock, type GridDay, TimeGrid } from "../../ui/time-grid";
import { ClassDetails, DueDetails, handInLabel, MeetingDetails, periodName, timeRange, useWorld, WindowDetails } from "./details";

const HOUR_HEIGHT = 46;
/** Minutes a line of block text needs (caption on a 15 px line). */
const LINE = (15 * 60) / HOUR_HEIGHT;
const NO_LECTURES = new Set(["uts", "uas", "holiday"]);

export function WeekView({ days, input }: { days: readonly string[]; input: ScheduleData }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const plan = useMemo(() => scheduleDays(days, input), [days, input]);
  const covered = useMemo(() => new Set(input.months), [input.months]);
  const today = wibDay(world.now);
  const hours = timeAxis(plan.flatMap((day) => [...day.classes.map((c) => c.session), ...day.outside, ...day.edunex]));
  const events = input.events.filter((e) => SCHEDULE_EVENT_KINDS.has(e.kind) && e.firstDay <= days[6] && e.lastDay >= days[0]);

  // Busy days share the width, each with room for its blocks side by side (`lanes`); empty ones shrink.
  // A single-day mark (the last lecture day) needs room for its name.
  const busy = plan.map((day) => !isEmptyDay(day) || events.some((e) => e.firstDay === day.day && e.lastDay === day.day));
  // A week with nothing on it keeps its weekdays wide: there's nothing to give the room to.
  const anyBusy = busy.some(Boolean);
  const grid: GridDay[] = plan.map((day, i) => {
    const at = dayStart(day.day);
    const size = busy[i] || (!anyBusy && i < 5) ? "wide" : i >= 5 ? "slim" : "narrow";
    const lane = [
      ...day.windows.map((w) => <WindowChip key={`w${w.presence.id}`} window={w} />),
      ...day.due.map((task) => <DueChip key={`t${task.id}`} task={task} />),
    ];
    return {
      key: day.day,
      label: f.dateLong(at),
      head: <DayHead at={at} today={day.day === today} size={size} />,
      size,
      lanes: lanesOf(day),
      tone: day.day === today ? "today" : day.events.some((e) => NO_LECTURES.has(e.kind)) ? "off" : null,
      lane: lane.length ? lane : undefined,
      children: <DayBlocks day={day} notInSix={input.six} />,
      note: input.six && isEmptyDay(day) && !day.holiday && covered.has(day.day.slice(0, 7)) && i < 5 ? t("schedule.free") : undefined,
      now: day.day === today ? minuteOfDay(world.now) : null,
    };
  });

  const bands = events.map((e) => {
    const from = Math.max(0, days.indexOf(e.firstDay) < 0 ? 0 : days.indexOf(e.firstDay));
    const to = days.indexOf(e.lastDay) < 0 ? 6 : days.indexOf(e.lastDay);
    // Over empty days only, the band is narrow: its name alone (the dates are on hover).
    const short = grid.slice(from, to + 1).every((d) => d.size !== "wide") && grid.slice(from, to + 1).length < 4;
    return {
      key: e.id,
      from,
      to,
      label: <BandLabel event={e} f={f} short={short} uncertain={plan.some((day) => day.classes.some((c) => c.uncertain?.id === e.id))} />,
    };
  });

  return <TimeGrid className="mt-2" days={grid} hours={hours} bands={bands} laneLabel={t("schedule.lane")} hourLabel={clockOf} hourHeight={HOUR_HEIGHT} />;
}

function BandLabel({ event, f, uncertain, short }: { event: CalendarEvent; f: Format; uncertain: boolean; short: boolean }) {
  const t = useT();
  const span = f.dayRange(event.firstDay, event.lastDay);
  return (
    <>
      <Icons.Flag className="size-3 shrink-0" weight="bold" />
      <span className="min-w-0 flex-1" title={factsLabel(event.title, span)}>
        <Meta truncate>
          {periodName(t, event)}
          {short ? null : span}
          {uncertain ? <span className="font-normal">{t("schedule.band.uncertain")}</span> : null}
        </Meta>
      </span>
    </>
  );
}

/** "12–16 Okt", "26 Okt – 1 Nov". */
function DayHead({ at, today, size }: { at: number; today: boolean; size: GridDay["size"] }) {
  const f = useFormat();
  const noon = at + 12 * 3_600_000;
  return (
    <div className={cx("flex flex-col", size === "wide" ? "items-start" : "items-center")}>
      <span className={cx("text-caption font-medium", today ? "text-accent-fg" : "text-muted")}>{f.weekdayShort(noon)}</span>
      <span
        className={cx(
          "mt-0.5 grid h-7 min-w-7 place-items-center rounded-full text-title font-semibold tabular-nums",
          today ? "bg-accent px-1.5 text-on-accent" : size === "wide" ? "-ml-px" : "text-muted",
        )}
      >
        {Number(f.dayMonth(noon).split(" ")[0])}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- blocks

type Item =
  | { kind: "class"; start: number; end: number; item: ScheduledClass }
  | { kind: "meeting"; start: number; end: number; meeting: OutsideMeeting | EdunexMeeting };

/** Minutes after midnight, the end drawn to the next 5 minutes (SIX's "12:59" fills to 13:00). */
const span = (start: number, end: number) => {
  const from = minuteOfDay(start);
  const to = Math.min(24 * 60, from + Math.round((end - start) / 60_000));
  return { from, to: Math.ceil(to / 5) * 5 };
};

/** A day's blocks: its classes and the meetings outside SIX. */
const dayItems = (day: ScheduleDay): Item[] => [
  ...day.classes.map((item) => ({ kind: "class" as const, start: item.session.start, end: item.session.end, item })),
  ...day.outside.map((meeting) => ({ kind: "meeting" as const, start: meeting.start, end: meeting.end, meeting })),
  ...day.edunex.map((meeting) => ({ kind: "meeting" as const, start: meeting.start, end: meeting.end, meeting })),
];

/** The most blocks a day has side by side: its column keeps room for each (TimeGrid). */
const lanesOf = (day: ScheduleDay) => Math.max(1, ...sideBySide(dayItems(day)).map((p) => p.columns));

function DayBlocks({ day, notInSix }: { day: ScheduleDay; notInSix: boolean }) {
  const placed = sideBySide(dayItems(day));
  return (
    <>
      {placed.map((p) => {
        const { from, to } = span(p.item.start, p.item.end);
        const key = p.item.kind === "class" ? p.item.item.session.id : `${p.item.meeting.code}-${p.item.start}`;
        return (
          <GridBlock key={key} start={from} end={to} column={p.column} columns={p.columns}>
            {p.item.kind === "class" ? (
              <ClassBlock item={p.item.item} minutes={to - from} narrow={p.columns > 1} />
            ) : (
              <MeetingBlock meeting={p.item.meeting} minutes={to - from} notInSix={notInSix} />
            )}
          </GridBlock>
        );
      })}
    </>
  );
}

/** How many lines of text a block of that length holds. */
const linesFor = (minutes: number) => Math.max(1, Math.floor((minutes - 8 * (60 / HOUR_HEIGHT)) / LINE));

const BLOCK =
  "focus-ring relative flex h-full w-full flex-col overflow-hidden rounded-md text-left text-caption leading-[15px] transition-[box-shadow,border-color] duration-150 [&>*]:shrink-0";

function ClassBlock({ item, minutes, narrow }: { item: ScheduledClass; minutes: number; narrow: boolean }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const { session, exam, moved, extra, overlaps, uncertain } = item;
  const code = session.courseCode;
  const live = session.start <= world.now && world.now < session.end;
  const past = session.end <= world.now;
  const time = timeRange(f, session.start, session.end);
  const lines = linesFor(minutes);
  const room = session.room ?? t("schedule.room.none");
  const marks = [
    uncertain ? t("schedule.uncertain.short") : null,
    moved ? (moved.kinds.includes("room") && moved.kinds.length === 1 ? t("schedule.mark.room") : t("schedule.mark.moved")) : null,
    extra ? t("schedule.mark.extra") : null,
    ...overlaps.map((o) => t("schedule.mark.overlap", { code: o.code })),
  ].filter((m): m is string => m !== null);
  const label = factsLabel(exam ? `${session.activity} ${code}` : code, time, room, ...marks);
  const clashLine = narrow && overlaps.length > 0;
  const roomLine = clashLine ? 4 : 3;

  const trigger = exam ? (
    <button
      type="button"
      aria-label={label}
      // Past, quieter in token greys that still read at 4.5:1 (as Beranda's rows); never faded with opacity.
      className={cx(
        BLOCK,
        "border border-edge bg-raised py-1 pr-1.5 pl-2.5 text-fg shadow-raised hover:border-track hover:shadow-lift",
        past && "bg-sunken text-muted shadow-card",
      )}
    >
      <Stripe color={world.color(code)} />
      <Meta truncate className="font-bold">
        {session.activity}
        {code}
      </Meta>
      {lines >= 2 && <span className="text-title leading-[18px] font-semibold break-words">{room}</span>}
      {lines >= 3 && <span className="text-muted tabular-nums">{time}</span>}
    </button>
  ) : (
    <button
      type="button"
      aria-label={label}
      className={cx(
        BLOCK,
        "border py-1 pr-1.5 pl-2.5 shadow-card hover:border-track hover:shadow-lift",
        uncertain ? "border-dashed border-track bg-sunken text-muted" : "border-edge bg-surface",
        live && "ring-2 ring-live/50",
        past && "bg-sunken text-muted",
      )}
      style={uncertain ? { backgroundImage: "repeating-linear-gradient(135deg, transparent 0 6px, var(--fill) 6px 12px)" } : undefined}
    >
      <Stripe color={world.color(code)} faded={uncertain !== null} />
      <ClashTint item={item} />
      <span className={cx(FITS, "font-semibold tabular-nums", !uncertain && !past && "text-fg")}>
        <span className="min-w-0 truncate">{time}</span>
        {live && <LiveDot className="ml-auto shrink-0" />}
        {uncertain && !narrow && <Uncertain />}
        {!live && !narrow && lines < 4 && <MarkIcons item={item} />}
      </span>
      {lines >= 2 &&
        (narrow ? (
          // Beside another class the time fills the line; the course line holds only the code, so the word goes there.
          <span className={FITS}>
            <span className={cx("min-w-0 truncate font-semibold tabular-nums", !uncertain && !past && "text-fg")}>{code}</span>
            {uncertain && <Uncertain />}
          </span>
        ) : (
          <span className="relative truncate">
            <span className={cx("font-semibold tabular-nums", !uncertain && !past && "text-fg")}>{code}</span>
            <span className="text-muted"> {world.name(code, session.courseName)}</span>
          </span>
        ))}
      {/* A narrow block has no room for "Bentrok PL3032": the icon and the other course's code say which class clashes, before the room. */}
      {clashLine && lines >= 3 && (
        <span className="relative flex min-w-0 items-center gap-1 font-semibold text-warning-fg tabular-nums">
          <Icons.Overlap className="size-3 shrink-0" weight="bold" />
          <span className="truncate">{overlaps.map((o) => o.code).join(", ")}</span>
        </span>
      )}
      {lines >= roomLine && (
        <span className="relative flex min-w-0 items-start gap-1 text-muted">
          <Icons.MapPin className="mt-0.5 size-3 shrink-0" />
          <span className={cx("min-w-0 break-words", !session.room && "italic")}>{room}</span>
        </span>
      )}
      {lines > roomLine && <MarkWords item={item} max={lines - roomLine} narrow={narrow} />}
    </button>
  );
  return (
    <Popover trigger={trigger} align="start" label={label} className="w-[340px] p-4">
      <ClassDetails item={item} />
    </Popover>
  );
}

/** A line whose first fact always wins: what doesn't fit beside it wraps onto a second line, out of sight, never cut to "Bel…". */
const FITS = "relative flex max-h-3.75 flex-wrap items-center gap-x-1 overflow-hidden";

/** A lecture that may not run in an exam week or a holiday: said once, quietly (the hatch, the band and its details say why). */
function Uncertain() {
  const t = useT();
  return <span className="ml-auto shrink-0 text-micro font-medium whitespace-nowrap text-muted">{t("schedule.uncertain.short")}</span>;
}

/** The minutes a class shares with another, tinted amber behind its text (a choice to make, nothing lost yet). */
function ClashTint({ item }: { item: ScheduledClass }) {
  const { session } = item;
  const length = session.end - session.start;
  return (
    <>
      {item.overlaps.map((o) => (
        <span
          key={o.code}
          aria-hidden
          className="absolute inset-x-0 bg-warning-bg"
          style={{ top: `${((o.from - session.start) / length) * 100}%`, height: `${((o.to - o.from) / length) * 100}%` }}
        />
      ))}
    </>
  );
}

function Stripe({ color, faded = false }: { color: string; faded?: boolean }) {
  return <span aria-hidden className={cx("absolute inset-y-0 left-0 w-[3px]", faded && "opacity-50")} style={{ background: color }} />;
}

/** What's unusual about a class, in words (as many as fit). */
function MarkWords({ item, max, narrow }: { item: ScheduledClass; max: number; narrow: boolean }) {
  const t = useT();
  const words: { text: string; tone: string }[] = [];
  if (item.moved?.kinds.some((k) => k !== "room")) {
    const usual = `${clockOf(item.moved.usual.start)}–${clockOf(item.moved.usual.end)}`;
    words.push({ text: t(narrow ? "schedule.moved.short" : "schedule.moved.time", { usual }), tone: "text-warning-fg" });
  } else if (item.moved) words.push({ text: t("schedule.mark.room"), tone: "text-warning-fg" });
  if (item.extra) words.push({ text: t("schedule.mark.extra"), tone: "text-warning-fg" });
  // A narrow block names the clash beside the course code.
  if (!narrow) for (const o of item.overlaps) words.push({ text: t("schedule.mark.overlap", { code: o.code }), tone: "text-warning-fg" });
  return (
    <>
      {words.slice(0, max).map((w) => (
        <span key={w.text} className={cx("relative truncate font-semibold", w.tone)}>
          {w.text}
        </span>
      ))}
    </>
  );
}

/** What's unusual about a class, as icons when the block is short (the words are in its name and its details). */
function MarkIcons({ item }: { item: ScheduledClass }) {
  return (
    <span aria-hidden className={cx("flex shrink-0 items-center gap-0.5", !item.uncertain && "ml-auto")}>
      {item.moved && <Icons.History className="size-3 text-warning-fg" weight="bold" />}
      {item.extra && <Icons.Plus className="size-3 text-warning-fg" weight="bold" />}
      {item.overlaps.length > 0 && <Icons.Overlap className="size-3 text-warning-fg" weight="bold" />}
    </span>
  );
}

function MeetingBlock({ meeting, minutes, notInSix }: { meeting: OutsideMeeting | EdunexMeeting; minutes: number; notInSix: boolean }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const open = useOpenExternal();
  const time = timeRange(f, meeting.start, meeting.end);
  const lines = linesFor(minutes);
  // "Pertemuan" alone says nothing: a meeting Edunex didn't number names its course, like a class from SIX.
  const what = meeting.number !== null ? t("schedule.meeting", { n: meeting.number }) : world.name(meeting.code);
  const label = factsLabel(
    meeting.code,
    what,
    time,
    meeting.online ? t("schedule.online") : null,
    notInSix ? t("schedule.notInSix") : t("schedule.fromEdunex"),
  );
  const past = meeting.end <= world.now;
  // The Gabung button says it's online; the line it would cover goes to it.
  const joinable = Boolean(meeting.link) && lines >= 2;
  const where = meeting.online && !joinable ? t("schedule.online") : null;
  const trigger = (
    <button
      type="button"
      aria-label={label}
      className={cx(
        BLOCK,
        "border border-dashed border-faint/70 bg-surface py-1 pr-1.5 pl-2 hover:border-faint hover:shadow-lift",
        past && "bg-sunken text-muted",
      )}
    >
      <span className={cx("flex items-center gap-1 font-semibold tabular-nums", !past && "text-fg")}>
        <span className="truncate">{time}</span>
        {meeting.online && !joinable && <Icons.Video className="ml-auto size-3.5 shrink-0 text-muted" />}
      </span>
      {lines >= 2 && (
        <span className="truncate">
          <span className={cx("font-semibold tabular-nums", !past && "text-fg")}>{meeting.code}</span>
          <span className="text-muted"> {what}</span>
        </span>
      )}
      {lines >= 3 && where && <span className="truncate text-muted">{where}</span>}
      {/* Not on SIX's timetable: easy to miss, so amber, as on Beranda and the course page. Without SIX everything is from Edunex: its name and details say so. */}
      {notInSix && lines >= (where ? 4 : 3) && <span className="truncate font-semibold text-warning-fg">{t("schedule.notInSix")}</span>}
    </button>
  );
  return (
    <div className="relative h-full">
      <Popover trigger={trigger} align="start" label={label} className="w-[340px] p-4">
        <MeetingDetails meeting={meeting} notInSix={notInSix} />
      </Popover>
      {joinable && (
        <button
          type="button"
          onClick={() => open(meeting.link!)}
          className="focus-ring absolute right-1 bottom-1 z-10 inline-flex h-6 items-center gap-1 rounded-md bg-accent px-2 text-micro font-semibold text-on-accent shadow-button hover:bg-accent-hover"
        >
          <Icons.Video className="size-3" weight="bold" />
          {t("schedule.join")}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the lane: deadlines and hand-in windows

function WindowChip({ window }: { window: TaskWindow }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const done = window.presence.recorded?.present || (window.task !== null && taskStatus(window.task, world.now) === "submitted");
  const text = done ? t("schedule.window.done", { task: window.task?.title ?? window.code }) : handInLabel(t, f, window);
  const trigger = (
    <button
      type="button"
      aria-label={factsLabel(window.code, text)}
      className={cx(
        "focus-ring flex w-full items-start gap-1.5 rounded-md border border-dashed px-1.5 py-1 text-left text-caption transition-colors duration-150 hover:bg-hover",
        done ? "border-success-fg/40 text-success-fg" : "border-accent-fg/50 bg-surface",
      )}
    >
      {done ? (
        <Icons.CheckCircle className="mt-0.5 size-3 shrink-0" weight="bold" />
      ) : (
        <Icons.Upload className="mt-0.5 size-3 shrink-0 text-accent-fg" weight="bold" />
      )}
      <span className="line-clamp-3 min-w-0">
        <span className="font-semibold tabular-nums">{window.code}</span> {text}
      </span>
    </button>
  );
  return (
    <Popover trigger={trigger} align="start" label={text} className="w-[340px] p-4">
      <WindowDetails window={window} />
    </Popover>
  );
}

function DueChip({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const time = f.time(task.dueAt!);
  const trigger = (
    <button
      type="button"
      aria-label={t("schedule.due", { time, title: task.title })}
      className="focus-ring flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-caption transition-colors duration-150 hover:bg-hover"
    >
      <Icons.Clock className="mt-0.5 size-3 shrink-0 text-muted" weight="bold" />
      <span className="line-clamp-2 min-w-0">
        <span className="font-semibold tabular-nums">{time}</span>{" "}
        <span aria-hidden className="mb-px inline-block size-1.5 rounded-full align-middle" style={{ background: world.color(task.courseCode) }} />{" "}
        <span className="font-semibold tabular-nums">{task.courseCode}</span> {task.title}
      </span>
    </button>
  );
  return (
    <Popover trigger={trigger} align="start" label={task.title} className="w-[340px] p-4">
      <DueDetails task={task} />
    </Popover>
  );
}
