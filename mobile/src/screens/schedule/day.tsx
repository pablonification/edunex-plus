// One day of Jadwal as v4 draws it (mobile/design/r2-directions/v4, "v4-jadwal"): the hours down the left, each class a
// block in its course's tint at its time and length (its glyph, a short name, the room), two that overlap side by side,
// the part of a class already gone a shade deeper, and today's now-line in the brand's blue. Above the hours, only when there's
// something: ITB's period ("Masa UTS · 12–16 Okt"), a class SIX shows that the app couldn't read, and the day's hand-ins
// and deadlines, a line each. A block shows at most one status, as an icon (a clash, a new time, not in SIX); the
// absences, the words, the code, the times and the rest are on its sheet (Beranda's class sheet). The minute's tick
// moves only the now-line and the block on now (./clock.ts).
import { memo, type ReactNode } from "react";
import { View } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { useT } from "../../../../src/app/i18n";
import type { CalendarEvent, Task } from "../../../../src/core/models";
import {
  type EdunexMeeting,
  minuteOfDay,
  type OutsideMeeting,
  SCHEDULE_EVENT_KINDS,
  type ScheduleDay,
  type ScheduledClass,
  type TaskWindow,
} from "../../../../src/core/schedule";
import { taskStatus } from "../../../../src/core/tasks";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { NOW } from "../../ui/palette";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, TOUCH, useTheme } from "../../ui/theme";
import { CourseGlyph, useCourseTile } from "../../ui/tile";
import { shortName } from "../home/parts";
import { useClockSelect, useDayFormat, usePhase, useToday } from "./clock";
import type { Picked } from "./details";
import { periodName, timeRange } from "./world";

/** One hour's height (v4: 66). */
export const HOUR = 66;
/** Where the hours' lines start (the labels sit left of it) and where blocks start. */
const LINES_LEFT = 58;
const BLOCK_LEFT = 66;
const BLOCK_RIGHT = 14;
/** Room above the first hour's line, for its label. */
const TOP = 20;

/** A row's key, as the inventory names a class: "pl3002-08-00" (its code and WIB start), unique within a day. */
export const rowKey = (code: string, start: number) => {
  const minute = minuteOfDay(start);
  return `${code.toLowerCase()}-${String(Math.floor(minute / 60)).padStart(2, "0")}-${String(minute % 60).padStart(2, "0")}`;
};

type Item =
  | { kind: "class"; key: string; start: number; end: number; code: string; item: ScheduledClass }
  | { kind: "meeting"; key: string; start: number; end: number; code: string; meeting: OutsideMeeting | EdunexMeeting; notInSix: boolean };

/** Each item's column and how many share its stretch of time (two classes that overlap sit side by side). */
function columns(items: readonly Item[]): Map<string, { column: number; of: number }> {
  const placed = new Map<string, { column: number; of: number }>();
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster: { item: Item; column: number }[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    const of = Math.max(1, ...cluster.map((c) => c.column + 1));
    for (const c of cluster) placed.set(c.item.key, { column: c.column, of });
    cluster = [];
  };
  for (const item of sorted) {
    if (item.start >= clusterEnd) {
      close();
      clusterEnd = -Infinity;
    }
    const taken = new Set(cluster.filter((c) => c.item.end > item.start).map((c) => c.column));
    let column = 0;
    while (taken.has(column)) column++;
    cluster.push({ item, column });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  close();
  return placed;
}

/** The hours the day shows: 08:00–17:00 at least, widened to whole hours around anything earlier or later. */
export function hoursOf(day: ScheduleDay): { from: number; to: number } {
  const spans = [...day.classes.map((c) => c.session), ...day.outside, ...day.edunex].map((s) => [
    minuteOfDay(s.start),
    minuteOfDay(s.start) + (s.end - s.start) / 60_000,
  ]);
  const from = Math.min(8, ...spans.map(([start]) => Math.floor(start! / 60)));
  const to = Math.max(17, ...spans.map(([, end]) => Math.ceil(end! / 60)));
  return { from, to: Math.min(24, to) };
}

/** Where on the day a moment falls, in dp from the first hour's line. */
const yOf = (minute: number, from: number) => TOP + ((minute - from * 60) / 60) * HOUR;

export const DayView = memo(function DayView({
  day,
  courses,
  six,
  free,
  onPick,
}: {
  day: ScheduleDay;
  courses: readonly TermCourse[];
  six: boolean;
  /** SIX's timetable for the day was read and it holds nothing. */
  free: boolean;
  onPick: (picked: Picked) => void;
}) {
  const t = useT();
  const v = useTheme().v4;
  const today = useToday();
  const { from, to } = hoursOf(day);
  const items: Item[] = [
    ...day.classes.map(
      (item): Item => ({
        kind: "class",
        key: item.session.id,
        start: item.session.start,
        end: item.session.end,
        code: item.session.courseCode,
        item,
      }),
    ),
    ...[...day.outside, ...day.edunex].map(
      (meeting): Item => ({
        kind: "meeting",
        key: `${meeting.code}-${meeting.start}`,
        start: meeting.start,
        end: meeting.end,
        code: meeting.code,
        meeting,
        notInSix: six && !("maybeInSix" in meeting && meeting.maybeInSix),
      }),
    ),
  ];
  const placed = columns(items);
  const nameOf = (code: string, fallback?: string) => courses.find((c) => c.code === code)?.name ?? fallback ?? code;
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const empty = items.length === 0;
  return (
    <View testID={`agenda.${day.day}`} style={{ backgroundColor: v.card, flexGrow: 1 }}>
      <Lane day={day} onPick={onPick} />
      <View style={{ height: TOP + (to - from) * HOUR + space[6] }}>
        {hours.map((hour) => (
          <HourLine key={hour} hour={hour} from={from} hideLabel={day.day === today} />
        ))}
        {/* The blocks' frame, beside the hours: a block's column is a share of its width. */}
        <View pointerEvents="box-none" style={{ position: "absolute", top: 0, bottom: 0, left: BLOCK_LEFT, right: BLOCK_RIGHT }}>
          {items.map((entry) => {
            const at = placed.get(entry.key) ?? { column: 0, of: 1 };
            return (
              <Block
                key={entry.key}
                entry={entry}
                name={entry.kind === "class" ? nameOf(entry.code, entry.item.session.courseName) : nameOf(entry.code)}
                from={from}
                column={at.column}
                of={at.of}
                onPick={onPick}
              />
            );
          })}
        </View>
        {day.day === today && <NowLine from={from} to={to} />}
        {empty && !day.holiday && (
          <View pointerEvents="none" style={{ position: "absolute", top: TOP + HOUR, left: BLOCK_LEFT, right: BLOCK_RIGHT, alignItems: "center" }}>
            <Icons.Sun size={32} color={v.muted} />
            <Text size="bodyLarge" style={{ color: v.muted, marginTop: space[2] }}>
              {free ? t("schedule.free") : t("mobile.schedule.noClasses")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

/** An hour's line and its label; on today the label near the now-line's own time gives way to it. */
function HourLine({ hour, from, hideLabel }: { hour: number; from: number; hideLabel: boolean }) {
  const v = useTheme().v4;
  const near = useClockSelect((now) => {
    if (!hideLabel) return false;
    const minute = minuteOfDay(now);
    return Math.abs(minute - hour * 60) < 14;
  });
  const label = `${String(hour).padStart(2, "0")}:00`;
  return (
    <View style={{ position: "absolute", top: yOf(hour * 60, from), left: LINES_LEFT, right: 0, height: 1, backgroundColor: v.line }}>
      <Text
        size="bodySmall"
        tabular
        importantForAccessibility="no"
        style={{ position: "absolute", left: -48, top: -8, color: v.muted, opacity: near ? 0 : 1, fontSize: 12, lineHeight: 16 }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Today's now-line: the brand's blue, with its time where the hour labels are; moves once a minute. */
function NowLine({ from, to }: { from: number; to: number }) {
  const t = useTheme();
  const f = useDayFormat();
  const minute = useClockSelect((now) => minuteOfDay(now));
  const at = useClockSelect((now) => Math.floor(now / 60_000) * 60_000);
  if (minute < from * 60 || minute > to * 60) return null;
  const now = nowColour(t.scheme);
  const y = yOf(minute, from);
  return (
    <>
      <View pointerEvents="none" style={{ position: "absolute", top: y, left: LINES_LEFT - 4, right: 0, height: 2, backgroundColor: now, zIndex: 2 }}>
        <View style={{ position: "absolute", left: -5, top: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: now }} />
      </View>
      <Text
        size="labelSmall"
        weight="bold"
        tabular
        testID="schedule.nowTime"
        style={{
          position: "absolute",
          top: y - 8,
          left: 6,
          paddingHorizontal: 2,
          color: now,
          backgroundColor: t.v4.card,
          zIndex: 2,
          fontSize: 11,
          lineHeight: 16,
        }}
      >
        {f.time(at)}
      </Text>
    </>
  );
}

/** Today's colour (the brand's blue): the today mark and the now-line, its one meaning. */
export const nowColour = (scheme: "light" | "dark") => NOW[scheme].now;
/** What reads on today's circle. */
export const onNowColour = (scheme: "light" | "dark") => NOW[scheme].on;

type Status = { icon: (typeof Icons)[keyof typeof Icons]; tone: "amber" | "quiet"; words: string };

/**
 * A block's one status, the most pressing: a clash, a new time or room, extra, may not run, not in SIX. No absences: a
 * block stays calm, and the class's sheet has them in the app's absence colours.
 */
function statusOf(t: ReturnType<typeof useT>, entry: Item): Status | null {
  if (entry.kind === "meeting") return entry.notInSix ? { icon: Icons.Info, tone: "amber", words: t("home.today.notInSix") } : null;
  const { item } = entry;
  if (item.exam) return null;
  if (item.overlaps.length) return { icon: Icons.Overlap, tone: "amber", words: t("mobile.home.chip.clash") };
  if (item.moved)
    return {
      icon: Icons.History,
      tone: "amber",
      words: t(item.moved.kinds.includes("room") && item.moved.kinds.length === 1 ? "mobile.home.roomMoved" : "mobile.home.timeMoved"),
    };
  if (item.extra) return { icon: Icons.Plus, tone: "amber", words: t("schedule.mark.extra") };
  if (item.uncertain) return { icon: Icons.Info, tone: "quiet", words: t("schedule.uncertain.short") };
  return null;
}

const Block = memo(function Block({
  entry,
  name,
  from,
  column,
  of,
  onPick,
}: {
  entry: Item;
  name: string;
  from: number;
  column: number;
  of: number;
  onPick: (picked: Picked) => void;
}) {
  const t = useT();
  const f = useDayFormat();
  const theme = useTheme();
  const v = theme.v4;
  const tile = useCourseTile()(entry.code);
  const phase = usePhase(entry.start, entry.end);
  // How much of the class has gone, while it's on (a deeper shade, as v4's): moves once a minute, on this block only.
  const gone = useClockSelect((now) =>
    now <= entry.start ? 0 : now >= entry.end ? 1 : Math.round(((now - entry.start) / (entry.end - entry.start)) * 100) / 100,
  );
  const status = statusOf(t, entry);
  const top = yOf(minuteOfDay(entry.start), from) + 2;
  const height = Math.max(TOUCH, ((entry.end - entry.start) / 3_600_000) * HOUR - 4);
  const session = entry.kind === "class" ? entry.item.session : null;
  const room = session ? session.room : entry.kind === "meeting" && entry.meeting.online ? t("schedule.online") : null;
  const exam = entry.kind === "class" && entry.item.exam ? entry.item.session.activity : null;
  const title = exam ? `${exam} ${shortName(name)}` : shortName(name);
  const label = factsLabel(
    exam ? `${exam} ${entry.code}` : entry.code,
    name,
    timeRange(f, entry.start, entry.end),
    room,
    phase === "live" ? t("schedule.live") : null,
    status?.words,
  );
  const tone = status?.tone === "amber" ? v.ambFg : v.muted;
  return (
    <PressScale
      testID={`row.class.${rowKey(entry.code, entry.start)}`}
      accessibilityLabel={label}
      onPress={() =>
        onPick(entry.kind === "class" ? { kind: "class", item: entry.item } : { kind: "meeting", meeting: entry.meeting, notInSix: entry.notInSix })
      }
      style={{
        position: "absolute",
        top,
        height,
        // Side by side with what overlaps it, 4 dp apart.
        left: `${(column / of) * 100}%`,
        width: `${100 / of}%`,
        paddingRight: column < of - 1 ? 4 : 0,
      }}
    >
      <View style={{ flex: 1, borderRadius: 14, overflow: "hidden", backgroundColor: tile.tint }}>
        {gone > 0 && (
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: 0, right: 0, top: 0, height: `${gone * 100}%`, backgroundColor: tile.ink, opacity: 0.14 }}
          />
        )}
        {entry.kind === "meeting" && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              right: 0,
              borderRadius: 14,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: tile.ink,
              opacity: 0.6,
            }}
          />
        )}
        <View style={{ flexDirection: "row", gap: of > 1 ? 6 : 10, paddingHorizontal: of > 1 ? 10 : 12, paddingVertical: height < 56 ? 6 : 10 }}>
          {/* Sharing its hours with another class, the block gives its glyph's room to the name. */}
          {of === 1 && (
            <View style={{ paddingTop: 1 }}>
              <CourseGlyph code={entry.code} name={name} size={22} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              size="bodyLarge"
              weight="semibold"
              numberOfLines={height < 90 ? (of > 1 ? 2 : 1) : of > 1 ? 3 : 2}
              style={{ color: v.fg, fontSize: 15, lineHeight: 19 }}
            >
              {title}
            </Text>
            {room && height >= 56 && (
              <Text size="bodyMedium" numberOfLines={1} style={{ color: v.fg2, fontSize: 13, lineHeight: 17, marginTop: 3 }}>
                {room}
              </Text>
            )}
          </View>
          {status && (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 1 }}>
              <status.icon size={18} color={tone} weight="bold" />
            </View>
          )}
        </View>
      </View>
    </PressScale>
  );
});

/** What sits above the hours, only when there's something: the period, a class the app couldn't read, hand-ins, deadlines. */
function Lane({ day, onPick }: { day: ScheduleDay; onPick: (picked: Picked) => void }) {
  const lines: ReactNode[] = [];
  const period = day.events.find((e) => SCHEDULE_EVENT_KINDS.has(e.kind) && e.kind !== "lecture-start" && e.kind !== "lecture-end") ?? null;
  if (period) lines.push(<PeriodLine key="period" event={period} />);
  if (day.unread.length) lines.push(<UnreadLine key="unread" day={day} onPick={onPick} />);
  for (const window of day.windows) lines.push(<WindowLine key={`w${window.presence.id}`} window={window} onPick={onPick} />);
  for (const task of day.due) lines.push(<DueLine key={`t${task.id}`} task={task} onPick={onPick} />);
  if (!lines.length) return null;
  return <View style={{ paddingHorizontal: space[4], paddingTop: space[3], gap: space[2] }}>{lines}</View>;
}

/** "Masa UTS · 12–16 Okt": ITB's period the day is in, as a quiet band. */
function PeriodLine({ event }: { event: CalendarEvent }) {
  const t = useT();
  const f = useDayFormat();
  const theme = useTheme();
  const c = theme.color;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[2],
        borderRadius: 12,
        backgroundColor: c.tertiaryContainer,
        paddingHorizontal: space[3],
        minHeight: 36,
      }}
    >
      <Icons.Flag size={16} color={c.onTertiaryContainer} weight="bold" />
      <Text size="bodyMedium" weight="medium" style={{ color: c.onTertiaryContainer, flex: 1 }} numberOfLines={1}>
        {`${periodName(t, event)} · ${f.dayRange(event.firstDay, event.lastDay)}`}
      </Text>
    </View>
  );
}

/** A line above the hours: an icon, a title, one short meta line; one target, its sheet. */
function LaneRow({
  icon,
  title,
  meta,
  onPress,
  testID,
  done = false,
}: {
  icon: ReactNode;
  title: string;
  meta: string;
  onPress: () => void;
  testID: string;
  done?: boolean;
}) {
  const v = useTheme().v4;
  return (
    <PressScale
      onPress={onPress}
      testID={testID}
      accessibilityLabel={factsLabel(title, meta)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        borderRadius: 14,
        backgroundColor: v.page,
        paddingHorizontal: space[3],
        minHeight: 52,
      }}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="bodyLarge" weight="medium" numberOfLines={1} style={{ color: done ? v.muted : v.fg, fontSize: 15, lineHeight: 19 }}>
          {title}
        </Text>
        <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: v.muted, fontSize: 13, lineHeight: 17 }}>
          {meta}
        </Text>
      </View>
    </PressScale>
  );
}

/** Presence by handing in a Task that day: the Task, then "II4091 · sebelum 23:59". */
function WindowLine({ window, onPick }: { window: TaskWindow; onPick: (picked: Picked) => void }) {
  const t = useT();
  const f = useDayFormat();
  const v = useTheme().v4;
  const handedIn = useClockSelect((now) => window.task !== null && taskStatus(window.task, now) === "submitted");
  const done = Boolean(window.presence.recorded?.present) || handedIn;
  return (
    <LaneRow
      testID={`row.window.${window.presence.id}`}
      done={done}
      icon={done ? <Icons.CheckCircle size={22} color={v.okFg} weight="bold" /> : <Icons.Upload size={22} color={v.brandInk} weight="bold" />}
      title={window.task?.title ?? t("schedule.window.kind")}
      meta={`${window.code} · ${t("mobile.schedule.before", { time: f.time(window.presence.closesAt) })}`}
      onPress={() => onPick({ kind: "window", window })}
    />
  );
}

/** A Task due that day: its title, then "DK4073 · 23:59". */
function DueLine({ task, onPick }: { task: Task; onPick: (picked: Picked) => void }) {
  const f = useDayFormat();
  const v = useTheme().v4;
  return (
    <LaneRow
      testID={`row.due.${task.id}`}
      icon={<Icons.Clock size={22} color={v.muted} weight="bold" />}
      title={task.title}
      meta={`${task.courseCode} · ${f.time(task.dueAt!)}`}
      onPress={() => onPick({ kind: "due", task })}
    />
  );
}

/** Meetings SIX shows that day that the app couldn't read. */
function UnreadLine({ day, onPick }: { day: ScheduleDay; onPick: (picked: Picked) => void }) {
  const t = useT();
  const v = useTheme().v4;
  return (
    <LaneRow
      testID="row.unread"
      icon={<Icons.Info size={22} color={v.ambFg} weight="bold" />}
      title={t("schedule.unread.chip", { count: day.unread.length })}
      meta={t("mobile.schedule.unreadMeta")}
      onPress={() => onPick({ kind: "unread", day: day.day, unread: day.unread })}
    />
  );
}
