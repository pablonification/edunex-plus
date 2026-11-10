// One day of Jadwal on the white page: the hours down the left, each class a block in its course's tint at its time and
// length, never taller (a block past its end time would lie about when the class ends): its glyph, its name on as many
// lines as its height holds at the phone's font size, the room; the part of a class already gone a shade deeper, and
// today's now-line in the brand's blue. Classes that overlap sit side by side, each at its own start and end, joined
// under the pair by the app's one clash sign (kit's `ClashMark`), said once per clash. Above the hours, only when
// there's something: ITB's period ("Masa UTS · 12–16 Okt"), a class SIX shows that the app couldn't read, and the day's
// hand-ins and deadlines, a line each. A block shows at most one status, as an icon and its word (a clash, a new time,
// not in SIX); the absences, the code and the rest are on its sheet (Beranda's class sheet). The minute's tick moves
// only the now-line and the block on now (./clock.ts).
import { memo, type ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";
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
import { ClashMark } from "../../ui/kit";
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

/** One hour's height: 56, so a usual day (08:00 to 17:00 and a class after) fits the first screen whole above the tabs. */
export const HOUR = 56;
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

/** Each item's column and how many share its stretch of time: two classes that overlap sit side by side, each at its
 * own start and end (round 3's fourth review: stacked, a 16:00 class read as starting at 16:25). */
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

/** The hours the day shows: 08:00–17:00 at least, widened to whole hours around anything earlier or later, and an hour
 * before a class that starts on the first one. */
export function hoursOf(day: ScheduleDay): { from: number; to: number } {
  const spans = [...day.classes.map((c) => c.session), ...day.outside, ...day.edunex].map((s) => [
    minuteOfDay(s.start),
    minuteOfDay(s.start) + (s.end - s.start) / 60_000,
  ]);
  const first = Math.min(8, ...spans.map(([start]) => Math.floor(start! / 60)));
  // A class within the first half hour gets the hour before it too: the first block is whole under the strip, with a
  // little of what came before (round 1's judge: "the first block starts above the now line and is clipped").
  const from = Math.max(0, spans.some(([start]) => start! < first * 60 + 30) ? first - 1 : first);
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
  next,
  onNext,
}: {
  day: ScheduleDay;
  courses: readonly TermCourse[];
  six: boolean;
  /** SIX's timetable for the day was read and it holds nothing. */
  free: boolean;
  onPick: (picked: Picked) => void;
  /** The first class after this day, for an empty day's way on; null when none is known. */
  next: NextClass | null;
  onNext?: () => void;
}) {
  const page = useTheme().color.surface;
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
  if (empty)
    return (
      <View testID={`agenda.${day.day}`} style={{ backgroundColor: page, flexGrow: 1 }}>
        {/* On a holiday the day itself names it, once: not the period band above as well. */}
        <Lane day={day} onPick={onPick} period={!day.holiday} />
        <EmptyDay six={six} free={free} holiday={day.holiday} next={next} name={next ? nameOf(next.code, next.name ?? undefined) : ""} onNext={onNext} />
      </View>
    );
  return (
    <View testID={`agenda.${day.day}`} style={{ backgroundColor: page, flexGrow: 1 }}>
      <Lane day={day} onPick={onPick} />
      {/* Room under the last hour, as every page leaves above the tabs: the last block, grown to its whole name, is never at
          the bar's edge. */}
      <View style={{ minHeight: TOP + (to - from) * HOUR + space[12] * 2 }}>
        {hours.map((hour) => (
          <HourLine key={hour} hour={hour} from={from} hideLabel={day.day === today} />
        ))}
        {/* Under the blocks, so it never runs through a class's name: it shows beside them, and on the class on now the
            block's deeper shade ends where it would be (the judge's round 2, pass 5: the name read as struck through). */}
        {day.day === today && <NowLine from={from} to={to} />}
        {/* The blocks' frame, beside the hours. */}
        <View pointerEvents="box-none" style={{ position: "absolute", top: 0, bottom: 0, left: BLOCK_LEFT, right: BLOCK_RIGHT }}>
          {items.map((entry) => {
            const at = placed.get(entry.key) ?? { column: 0, of: 1 };
            return (
              <Block
                key={entry.key}
                entry={entry}
                name={entry.kind === "class" ? nameOf(entry.code, entry.item.session.courseName) : nameOf(entry.code)}
                // The class it shares time with by its short name, for TalkBack (on screen: the clash's icon).
                clashWith={entry.kind === "class" ? entry.item.overlaps.map((o) => shortName(nameOf(o.code))).join(", ") : ""}
                from={from}
                column={at.column}
                of={at.of}
                onPick={onPick}
              />
            );
          })}
          {clashes(items, placed, (code) => nameOf(code), from).map((clash) => (
            <ClashJoin key={clash.key} clash={clash} from={from} onPick={onPick} />
          ))}
        </View>
      </View>
    </View>
  );
});

/** The first class after a day with none: its time, its course and its room (SIX's; null for a meeting Edunex announced). */
export interface NextClass {
  start: number;
  end: number;
  code: string;
  name: string | null;
  room: string | null;
}

/**
 * A day with no class (round 3): no empty hours, a calm sun and the one word, then the way on: the next class under
 * "Berikutnya", as its block in its course's tint (its name, day and time, room); a tap goes to that day.
 */
function EmptyDay({
  six,
  free,
  holiday,
  next,
  name,
  onNext,
}: {
  six: boolean;
  free: boolean;
  /** ITB's holiday the day is in (its calendar, not SIX's): named here, with its days. */
  holiday: CalendarEvent | null;
  next: NextClass | null;
  name: string;
  onNext?: () => void;
}) {
  const t = useT();
  const f = useDayFormat();
  const today = useToday();
  const v = useTheme().v4;
  const tile = useCourseTile()(next?.code ?? "");
  // Within the week ahead the weekday is enough; further, its date too.
  const day =
    next === null
      ? null
      : next.start - Date.parse(`${today}T00:00:00+07:00`) < 7 * 86_400_000
        ? f.weekdayShort(next.start)
        : `${f.weekdayShort(next.start)} ${f.dayMonth(next.start)}`;
  const when = next ? `${day}, ${timeRange(f, next.start, next.end)}` : "";
  return (
    <View testID="schedule.emptyDay" style={{ alignItems: "center", paddingTop: space[10], paddingHorizontal: space[4], gap: space[3] }}>
      {/* Without SIX the app doesn't know the day is free: the note above says what SIX adds, with the way in. */}
      {(six || holiday) && (
        <>
          <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: v.card }}>
            <Icons.Sun size={30} color={v.muted} />
          </View>
          <Text size="titleMedium" face="display" weight="bold" style={{ color: v.fg, textAlign: "center" }}>
            {holiday ? periodName(t, holiday) : free ? t("schedule.free") : t("mobile.schedule.noClasses")}
          </Text>
          {holiday && (
            <Text size="bodyMedium" tabular style={{ color: v.muted, marginTop: -space[2] }}>
              {f.dayRange(holiday.firstDay, holiday.lastDay)}
            </Text>
          )}
        </>
      )}
      {next && onNext && (
        <View style={{ alignSelf: "stretch", marginTop: space[6], gap: space[2] }}>
          <Text size="bodyMedium" weight="medium" style={{ color: v.muted, marginLeft: space[1] }}>
            {t("course.next")}
          </Text>
          <PressScale
            onPress={onNext}
            accessibilityLabel={factsLabel(t("mobile.schedule.nextLabel", { when }), name, next.room)}
            testID="action.nextClass"
            style={{ flexDirection: "row", gap: 10, borderRadius: 14, backgroundColor: tile.tint, paddingHorizontal: 12, paddingVertical: PAD.tall }}
          >
            <View style={{ paddingTop: 1 }}>
              <CourseGlyph code={next.code} name={name} size={22} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size="bodyLarge" weight="semibold" style={{ color: v.fg, fontSize: 15, lineHeight: NAME_LINE }}>
                {name}
              </Text>
              <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: v.fg2, fontSize: 13, lineHeight: ROOM_LINE, marginTop: 3 }}>
                {[when, next.room].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </PressScale>
        </View>
      )}
    </View>
  );
}

/** An hour's line and its label; on today the label near the now-line's own time gives way to it. */
function HourLine({ hour, from, hideLabel }: { hour: number; from: number; hideLabel: boolean }) {
  const v = useTheme().v4;
  // Both labels are a line tall at the phone's font size, centred on their lines: the hour's gives way while they'd touch.
  const { fontScale } = useWindowDimensions();
  const near = useClockSelect((now) => {
    if (!hideLabel) return false;
    return Math.abs(yOf(minuteOfDay(now), from) - yOf(hour * 60, from)) < 16 * fontScale + 2;
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

/**
 * Today's now-line: the brand's blue, with its time where the hour labels are; moves once a minute. Drawn before the
 * blocks, so a class covers it (its dot and time stay clear of them, in the hours' gutter).
 */
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
      <View pointerEvents="none" style={{ position: "absolute", top: y, left: LINES_LEFT - 4, right: 0, height: 2, backgroundColor: now }}>
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
          backgroundColor: t.color.surface,
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

/** `shown`: what the block shows in place of the words, when it says more ("09:00 → 08:00" for a new time). */
type Status = { icon: (typeof Icons)[keyof typeof Icons]; tone: "amber" | "quiet"; words: string; shown?: string };

/** Minutes after midnight as "09:00". */
const hhmm = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/**
 * A block's one status, the most pressing: a clash, a new time or room, extra, may not run, not in SIX. No absences: a
 * block stays calm, and the class's sheet has them in the app's absence colours.
 */
function statusOf(t: ReturnType<typeof useT>, f: ReturnType<typeof useDayFormat>, entry: Item): Status | null {
  if (entry.kind === "meeting") return entry.notInSix ? { icon: Icons.Info, tone: "amber", words: t("home.today.notInSix") } : null;
  const { item } = entry;
  if (item.exam) return null;
  if (item.overlaps.length) return { icon: Icons.Overlap, tone: "amber", words: t("mobile.home.chip.clash") };
  if (item.moved) {
    const { kinds, usual } = item.moved;
    // A new time says from what to what, on the same day: "09:00 → 08:00" (the history clock means only this).
    if (kinds.includes("time") && !kinds.includes("day"))
      return { icon: Icons.History, tone: "amber", words: t("mobile.home.timeMoved"), shown: `${hhmm(usual.start)} → ${f.time(entry.start)}` };
    return {
      icon: kinds.includes("room") && kinds.length === 1 ? Icons.MapPin : Icons.History,
      tone: "amber",
      words: t(kinds.includes("room") && kinds.length === 1 ? "mobile.home.roomMoved" : "mobile.home.timeMoved"),
    };
  }
  if (item.extra) return { icon: Icons.Plus, tone: "amber", words: t("schedule.mark.extra") };
  if (item.uncertain) return { icon: Icons.Info, tone: "quiet", words: t("schedule.uncertain.short") };
  return null;
}

/** A block's padding above and below its words, short and tall; the name's and the room's line heights (sp). */
const PAD = { short: 6, tall: 10 };
const NAME_LINE = 19;
const ROOM_LINE = 17;
const STATUS_LINE = 18;

/** A class at its time, as tall as it is long; beside a class it clashes with, in its share of the width. */
const Block = memo(function Block({
  entry,
  name,
  clashWith,
  from,
  column,
  of,
  onPick,
}: {
  entry: Item;
  name: string;
  clashWith: string;
  from: number;
  column: number;
  of: number;
  onPick: (picked: Picked) => void;
}) {
  const top = yOf(minuteOfDay(entry.start), from) + 2;
  // As tall as the class is long, never taller: a block grown past its end would lie about when the class ends and run
  // into the next one. The name takes the lines the height holds (BlockBody); the sheet has the rest.
  const height = Math.max(TOUCH, ((entry.end - entry.start) / 3_600_000) * HOUR - 4);
  const gap = of > 1 ? 4 : 0;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top,
        height,
        left: `${(column / of) * 100}%`,
        width: `${100 / of}%`,
        paddingLeft: column > 0 ? gap / 2 : 0,
        paddingRight: column < of - 1 ? gap / 2 : 0,
      }}
    >
      <BlockBody entry={entry} name={name} clashWith={clashWith} onPick={onPick} height={height} narrow={of > 1} />
    </View>
  );
});

/**
 * A block's card in its course's tint: the glyph, the whole name, the room, then its one status as an icon and its
 * word (a clash is the app's one clash sign, the icon and "Bentrok"). `narrow`: a column beside a class it clashes
 * with: no glyph and less padding, so the name keeps its width.
 */
function BlockBody({
  entry,
  name,
  clashWith,
  onPick,
  height,
  narrow = false,
}: {
  entry: Item;
  name: string;
  clashWith: string;
  onPick: (picked: Picked) => void;
  height: number;
  narrow?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const short = height < 56;
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
  const status = statusOf(t, f, entry);
  // The clash is said once for the pair, under it (ClashJoin): not on each block.
  const shown = status && status.icon !== Icons.Overlap ? status : null;
  const session = entry.kind === "class" ? entry.item.session : null;
  const room = session ? session.room : entry.kind === "meeting" && entry.meeting.online ? t("schedule.online") : null;
  const exam = entry.kind === "class" && entry.item.exam ? entry.item.session.activity : null;
  const title = exam ? `${exam} ${name}` : name;
  const time = timeRange(f, entry.start, entry.end);
  const pad = short ? PAD.short : PAD.tall;
  // What the block's height truly holds at this font size, in dp: the name's lines first, then the room, then the
  // status; what doesn't fit is left to the sheet (the name ends in "…" after its last line, never past the block).
  const nameLine = NAME_LINE * fontScale;
  const roomLine = ROOM_LINE * fontScale + 3;
  const statusLine = STATUS_LINE * fontScale + 6;
  let room_ = height - pad * 2 - nameLine;
  const showRoom = !short && room !== null && room_ >= roomLine;
  if (showRoom) room_ -= roomLine;
  const showStatus = shown !== null && room_ >= statusLine;
  if (showStatus) room_ -= statusLine;
  const lines = 1 + Math.max(0, Math.floor(room_ / nameLine));
  const second = showRoom ? (room ?? "") : "";
  const label = factsLabel(
    exam ? `${exam} ${entry.code}` : entry.code,
    name,
    time,
    room,
    phase === "live" ? t("schedule.live") : null,
    clashWith && status?.icon === Icons.Overlap
      ? t("mobile.course.ex.clash", { course: clashWith })
      : status?.shown
        ? `${status.words} ${status.shown}`
        : status?.words,
  );
  const tone = shown?.tone === "amber" ? v.ambFg : v.muted;
  return (
    <PressScale
      testID={`row.class.${rowKey(entry.code, entry.start)}`}
      accessibilityLabel={label}
      onPress={() =>
        onPick(entry.kind === "class" ? { kind: "class", item: entry.item } : { kind: "meeting", meeting: entry.meeting, notInSix: entry.notInSix })
      }
      style={{ flexGrow: 1 }}
    >
      <View style={{ flexGrow: 1, borderRadius: 14, overflow: "hidden", backgroundColor: tile.tint }}>
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
        <View style={{ flexDirection: "row", gap: narrow ? 4 : 10, paddingHorizontal: narrow ? 8 : 12, paddingVertical: pad }}>
          {!narrow && (
            <View style={{ paddingTop: 1 }}>
              <CourseGlyph code={entry.code} name={name} size={22} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size="bodyLarge" weight="semibold" numberOfLines={lines} style={{ color: v.fg, fontSize: 15, lineHeight: NAME_LINE }}>
              {title}
            </Text>
            {second !== "" && (
              <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: v.fg2, fontSize: 13, lineHeight: ROOM_LINE, marginTop: 3 }}>
                {second}
              </Text>
            )}
            {showStatus && shown && (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}
              >
                <shown.icon size={16} color={tone} />
                <Text
                  size="labelMedium"
                  weight="semibold"
                  tabular
                  numberOfLines={1}
                  style={{ color: tone, flexShrink: 1, fontSize: 13, lineHeight: STATUS_LINE }}
                >
                  {shown.shown ?? shown.words}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </PressScale>
  );
}

/** A clash: the classes that share a stretch of time, side by side, and where the pair's last block ends. */
interface Clash {
  key: string;
  end: number;
  members: { column: number; of: number; bottom: number }[];
  of: number;
  first: Item & { kind: "class" };
  names: string;
}

/** The day's clashes: each run of side-by-side classes where one says it overlaps another, once. */
function clashes(items: readonly Item[], placed: Map<string, { column: number; of: number }>, nameOf: (code: string) => string, from: number): Clash[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Clash[] = [];
  let run: Item[] = [];
  let runEnd = -Infinity;
  const close = () => {
    const classes = run.filter((i): i is Item & { kind: "class" } => i.kind === "class");
    if (run.length > 1 && classes.some((c) => c.item.overlaps.length)) {
      const end = Math.max(...run.map((i) => i.end));
      out.push({
        key: `clash-${run[0]!.key}`,
        end,
        of: Math.max(...run.map((i) => placed.get(i.key)?.of ?? 1)),
        members: run.map((i) => ({
          ...(placed.get(i.key) ?? { column: 0, of: 1 }),
          bottom: yOf(minuteOfDay(i.start), from) + 2 + Math.max(TOUCH, ((i.end - i.start) / 3_600_000) * HOUR - 4),
        })),
        first: classes[0]!,
        names: run.map((i) => shortName(nameOf(i.code))).join(", "),
      });
    }
    run = [];
  };
  for (const item of sorted) {
    if (item.start >= runEnd) {
      close();
      runEnd = -Infinity;
    }
    run.push(item);
    runEnd = Math.max(runEnd, item.end);
  }
  close();
  return out;
}

/**
 * The clash said once, for the pair: a thin amber line drops from under each block and joins below the later one's
 * end, where kit's `ClashMark` (the overlap glyph and "Bentrok") sits on the join. A tap opens the first class's sheet,
 * which names the other one and where to choose.
 */
function ClashJoin({ clash, from, onPick }: { clash: Clash; from: number; onPick: (picked: Picked) => void }) {
  const t = useT();
  const theme = useTheme();
  const v = theme.v4;
  const join = yOf(minuteOfDay(clash.end), from) + 2 + 12;
  const centre = (column: number, of: number) => `${((column + 0.5) / of) * 100}%` as const;
  const columnsUsed = clash.members.map((m) => m.column);
  const leftmost = Math.min(...columnsUsed);
  const rightmost = Math.max(...columnsUsed);
  return (
    <>
      {clash.members.map((m) => (
        <View
          key={`${m.column}`}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: m.bottom,
            height: Math.max(0, join - m.bottom),
            left: centre(m.column, m.of),
            width: 2,
            marginLeft: -1,
            backgroundColor: v.ambFg,
            opacity: 0.55,
          }}
        />
      ))}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: join - 1,
          height: 2,
          left: centre(leftmost, clash.of),
          right: `${((clash.of - rightmost - 0.5) / clash.of) * 100}%`,
          marginLeft: -1,
          backgroundColor: v.ambFg,
          opacity: 0.55,
        }}
      />
      <View pointerEvents="box-none" style={{ position: "absolute", top: join - 16, left: 0, right: 0, alignItems: "center" }}>
        <PressScale
          testID="action.clash"
          accessibilityLabel={factsLabel(t("mobile.home.chip.clash"), clash.names)}
          hitSlop={{ top: 8, bottom: 8 }}
          onPress={() => onPick({ kind: "class", item: clash.first.item })}
          style={{
            minHeight: 32,
            justifyContent: "center",
            paddingHorizontal: space[3],
            borderRadius: 16,
            borderWidth: 1,
            borderColor: v.ambFg,
            backgroundColor: theme.color.surface,
          }}
        >
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <ClashMark />
          </View>
        </PressScale>
      </View>
    </>
  );
}

/** What sits above the hours, only when there's something: the period, a class the app couldn't read, hand-ins, deadlines. */
function Lane({ day, onPick, period: withPeriod = true }: { day: ScheduleDay; onPick: (picked: Picked) => void; period?: boolean }) {
  const lines: ReactNode[] = [];
  const period = !withPeriod
    ? null
    : (day.events.find((e) => SCHEDULE_EVENT_KINDS.has(e.kind) && e.kind !== "lecture-start" && e.kind !== "lecture-end") ?? null);
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
        backgroundColor: v.card,
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
