// What Jadwal's agenda draws: a week's line, and a day as a phone's calendar agenda shows one, its date in a column
// at the start (today in the primary colour) and what it holds beside it. A class is a card: its time, its course,
// its room; what's unusual about it (moved, extra, a clash, may not run, no absences left) one chip each, the details
// in its sheet. One target per card, one outcome: the sheet. The minute's tick reaches only a card whose class
// starts or ends (./clock.ts), never the whole list.
import { memo, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { budgetLabel, STATE_TONE } from "../../../../src/app/attendance-labels";
import { useT } from "../../../../src/app/i18n";
import type { ScheduleData } from "../../../../src/app/schedule-data";
import type { Task } from "../../../../src/core/models";
import {
  clockOf,
  dayNoon,
  type EdunexMeeting,
  minuteOfDay,
  type OutsideMeeting,
  SCHEDULE_EVENT_KINDS,
  type ScheduleDay,
  type ScheduledClass,
  type TaskWindow,
  termWeek,
} from "../../../../src/core/schedule";
import { taskStatus } from "../../../../src/core/tasks";
import { toneOf } from "../../parts/attendance";
import { LiveDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Text } from "../../ui/text";
import { shape, space, TOUCH, useTheme } from "../../ui/theme";
import { useClockSelect, useDayFormat, usePhase, useToday } from "./clock";
import type { Picked } from "./details";
import { handInLabel, periodName, timeRange, useWorld } from "./world";

/** A row's key, as the inventory names a class: "pl3002-08-00" (its code and WIB start), unique within a day. */
export const rowKey = (code: string, start: number) => `${code.toLowerCase()}-${clockOf(minuteOfDay(start)).replace(":", "-")}`;

const DATE_COLUMN = 48;

// ---------------------------------------------------------------- a week's line

/** "Minggu ke-7 · 5–11 Okt", ITB's periods that week ("Masa UTS · 12–16 Okt"), and a week SIX hasn't put out yet. */
export const WeekLine = memo(function WeekLine({
  monday,
  days,
  uncovered,
  input,
}: {
  monday: string;
  days: readonly string[];
  uncovered: boolean;
  input: ScheduleData;
}) {
  const t = useT();
  const f = useDayFormat();
  const theme = useTheme();
  const range = f.dayRange(days[0]!, days[6]!);
  const n = termWeek(input.events, monday);
  const bands = input.events.filter((e) => SCHEDULE_EVENT_KINDS.has(e.kind) && e.firstDay <= days[6]! && e.lastDay >= days[0]!);
  return (
    <View style={{ paddingTop: space[6], paddingBottom: space[2], gap: space[2] }} testID={`week.${monday}`}>
      <Text size="titleSmall" tone="muted" accessibilityRole="header">
        {n ? t("schedule.weekOf", { n, range }) : range}
      </Text>
      {bands.map((event) => (
        <View
          key={event.id}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: space[2],
            borderRadius: shape.md,
            backgroundColor: theme.color.tertiaryContainer,
            paddingHorizontal: space[3],
            paddingVertical: space[2],
          }}
        >
          <View style={{ paddingTop: 2 }}>
            <Icons.Flag size={14} color={theme.color.onTertiaryContainer} weight="bold" />
          </View>
          <Text size="bodyMedium" style={{ flex: 1, color: theme.color.onTertiaryContainer }}>
            <Text size="bodyMedium" weight="semibold" style={{ color: theme.color.onTertiaryContainer }}>
              {`${periodName(t, event)} · ${f.dayRange(event.firstDay, event.lastDay)}`}
            </Text>
            {event.kind === "uts" || event.kind === "uas" ? ` · ${t("schedule.band.uncertain")}` : ""}
          </Text>
        </View>
      ))}
      {uncovered && (
        <Text size="bodyMedium" tone="muted">
          {t("schedule.notCovered")}
        </Text>
      )}
    </View>
  );
});

// ---------------------------------------------------------------- a day

/** A day: its date in the column at the start, then what it holds in time order, its deadlines after. */
export const DayBlock = memo(function DayBlock({
  day,
  free,
  six,
  onPick,
}: {
  day: ScheduleDay;
  free: boolean;
  six: boolean;
  onPick: (picked: Picked) => void;
}) {
  const t = useT();
  const f = useDayFormat();
  const theme = useTheme();
  const today = useToday();
  const isToday = day.day === today;
  const noon = dayNoon(day.day);
  const timed: { key: string; start: number; row: ReactNode }[] = [
    ...day.classes.map((item) => ({ key: item.session.id, start: item.session.start, row: <ClassCard item={item} onPick={onPick} /> })),
    ...[...day.outside, ...day.edunex].map((meeting) => {
      const notInSix = six && !("maybeInSix" in meeting && meeting.maybeInSix);
      return { key: `${meeting.code}-${meeting.start}`, start: meeting.start, row: <MeetingCard meeting={meeting} notInSix={notInSix} onPick={onPick} /> };
    }),
  ].sort((a, b) => a.start - b.start);
  const nothing = timed.length === 0 && day.windows.length === 0 && day.due.length === 0 && day.unread.length === 0;
  return (
    <View testID={`agenda.${day.day}`} style={{ flexDirection: "row", gap: space[3], paddingVertical: space[2] }}>
      {/* The date, read with the day's first item: "Kamis, 8 Oktober". */}
      <View style={{ width: DATE_COLUMN, alignItems: "center" }} accessible accessibilityRole="header" accessibilityLabel={f.dateLong(noon)}>
        <Text size="labelMedium" tone={isToday ? "accent" : "muted"}>
          {f.weekdayShort(noon)}
        </Text>
        <View
          style={{
            marginTop: 2,
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isToday ? theme.color.primary : undefined,
          }}
        >
          <Text size="titleLarge" tabular style={{ color: isToday ? theme.color.onPrimary : theme.color.onSurface }}>
            {String(Number(day.day.slice(8)))}
          </Text>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space[2] }}>
        {day.holiday && (
          <Text size="bodyMedium" weight="semibold" style={{ color: theme.color.onTertiaryContainer, paddingTop: space[3] }}>
            {periodName(t, day.holiday)}
          </Text>
        )}
        {day.unread.length > 0 && <UnreadCard day={day} onPick={onPick} />}
        {timed.map((item) => (
          <View key={item.key}>{item.row}</View>
        ))}
        {day.windows.map((window) => (
          <WindowCard key={`w${window.presence.id}`} window={window} onPick={onPick} />
        ))}
        {day.due.map((task) => (
          <DueCard key={`t${task.id}`} task={task} onPick={onPick} />
        ))}
        {nothing && !day.holiday && (
          <Text size="bodyLarge" tone="muted" style={{ paddingTop: space[3] }}>
            {free ? t("schedule.free") : t("schedule.month.nothing")}
          </Text>
        )}
      </View>
    </View>
  );
});

// ---------------------------------------------------------------- cards

/** A card of the agenda: tonal on the page, the course's colour down its start, one target. */
function Card({
  testID,
  label,
  onPress,
  color,
  dashed = false,
  quiet = false,
  live = false,
  children,
}: {
  testID?: string;
  label: string;
  onPress: () => void;
  color?: string;
  dashed?: boolean;
  quiet?: boolean;
  live?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const c = theme.color;
  return (
    <View style={{ borderRadius: shape.md, overflow: "hidden", backgroundColor: quiet ? c.surfaceContainerLowest : c.surfaceContainerLow }}>
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        android_ripple={{ color: c.selected }}
        style={{ flexDirection: "row", minHeight: TOUCH + space[2], paddingVertical: space[3], paddingRight: space[4], paddingLeft: space[4] }}
      >
        {color && (
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              backgroundColor: dashed ? undefined : theme.course(color),
              opacity: quiet ? 0.5 : 1,
            }}
          >
            {dashed &&
              Array.from({ length: 16 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: drawn dashes, no identity
                <View key={i} style={{ height: 6, marginBottom: 4, backgroundColor: theme.course(color) }} />
              ))}
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      </Pressable>
      {/* The class on now: outlined in the live colour, as well as its dot and words. */}
      {live && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: shape.md, borderWidth: 2, borderColor: c.live }}
        />
      )}
    </View>
  );
}

type ChipTone = "warning" | "danger" | "neutral";

/** What's unusual about a class, in a word or two, on a quiet chip of its tone. */
function Chip({ icon: Icon, tone = "warning", children }: { icon?: (typeof Icons)[keyof typeof Icons]; tone?: ChipTone; children: string }) {
  const theme = useTheme();
  const c = theme.color;
  const [bg, fg] =
    tone === "danger" ? [c.dangerBg, c.dangerFg] : tone === "warning" ? [c.warningBg, c.warningFg] : [c.surfaceContainerHighest, c.onSurfaceVariant];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[1],
        borderRadius: shape.sm,
        backgroundColor: bg,
        paddingHorizontal: space[2],
        paddingVertical: 2,
      }}
    >
      {Icon && <Icon size={14} color={fg} weight="bold" />}
      <Text size="labelMedium" style={{ color: fg, flexShrink: 1 }}>
        {children}
      </Text>
    </View>
  );
}

function Chips({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[1], marginTop: space[2] }}>{children}</View>;
}

const ClassCard = memo(function ClassCard({ item, onPick }: { item: ScheduledClass; onPick: (picked: Picked) => void }) {
  const t = useT();
  const f = useDayFormat();
  const theme = useTheme();
  const world = useWorld();
  const { session, exam, moved, extra, overlaps, uncertain } = item;
  const phase = usePhase(session.start, session.end);
  const code = session.courseCode;
  const live = phase === "live";
  const past = phase === "past";
  const time = timeRange(f, session.start, session.end);
  const room = session.room ?? t("schedule.room.none");
  const health = exam ? undefined : world.health(code);
  // The budget is said on a card only once it asks something of the Student (none left, out of reach); the rest is in the sheet.
  const budget = health && (health.state === "none" || health.state === "out" || health.state === "missed") ? health : undefined;
  const movedText = moved
    ? moved.kinds.includes("time") || moved.kinds.includes("day")
      ? t("schedule.moved.short", { usual: `${clockOf(moved.usual.start)}–${clockOf(moved.usual.end)}` })
      : t("schedule.mark.room")
    : null;
  const marks = [
    uncertain ? t("schedule.uncertain.short") : null,
    movedText,
    extra ? t("schedule.mark.extra") : null,
    ...overlaps.map((o) => t("schedule.mark.overlap", { code: o.code })),
    budget ? budgetLabel(t, budget) : null,
  ];
  const label = factsLabel(
    exam ? `${session.activity} ${code}` : code,
    world.name(code, session.courseName),
    time,
    room,
    live ? t("schedule.live") : null,
    ...marks,
  );
  const muted = past || uncertain !== null;
  return (
    <Card
      testID={`row.class.${rowKey(code, session.start)}`}
      label={label}
      onPress={() => onPick({ kind: "class", item })}
      color={world.color(code)}
      quiet={muted}
      live={live}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Text size="titleSmall" tabular tone={muted ? "muted" : "fg"}>
          {time}
        </Text>
        {live && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
            <LiveDot />
            <Text size="labelMedium" tone="success">
              {t("schedule.live")}
            </Text>
          </View>
        )}
        {exam && (
          <View style={{ marginLeft: "auto" }}>
            <Chip tone="neutral">{session.activity}</Chip>
          </View>
        )}
      </View>
      <Text size="bodyMedium" numberOfLines={2} style={{ marginTop: 2 }}>
        <Text size="bodyMedium" weight="semibold" tabular tone={muted ? "muted" : "fg"}>
          {code}
        </Text>
        <Text size="bodyMedium" tone="muted">{` ${world.name(code, session.courseName)}`}</Text>
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], marginTop: 2 }}>
        <Icons.MapPin size={14} color={theme.color.onSurfaceVariant} />
        <Text
          size="bodyMedium"
          weight={exam ? "semibold" : "regular"}
          tone={exam && !past ? "fg" : "muted"}
          style={[{ flexShrink: 1 }, !session.room && { fontStyle: "italic" }]}
        >
          {room}
        </Text>
      </View>
      {(uncertain || moved || extra || overlaps.length > 0 || budget) && (
        <Chips>
          {uncertain && (
            <Chip icon={Icons.Info} tone="neutral">
              {t("schedule.uncertain.short")}
            </Chip>
          )}
          {movedText && <Chip icon={Icons.History}>{movedText}</Chip>}
          {extra && <Chip icon={Icons.Plus}>{t("schedule.mark.extra")}</Chip>}
          {overlaps.map((o) => (
            <Chip key={o.code} icon={Icons.Overlap}>
              {t("schedule.mark.overlap", { code: o.code })}
            </Chip>
          ))}
          {budget && (
            <Chip icon={Icons.Hand} tone={toneOf(STATE_TONE[budget.state]) === "danger" ? "danger" : "warning"}>
              {budgetLabel(t, budget)}
            </Chip>
          )}
        </Chips>
      )}
    </Card>
  );
});

/** A meeting Edunex announced: dashed, "Tidak ada di SIX" when SIX's timetable for it was read and doesn't list it. */
const MeetingCard = memo(function MeetingCard({
  meeting,
  notInSix,
  onPick,
}: {
  meeting: OutsideMeeting | EdunexMeeting;
  notInSix: boolean;
  onPick: (picked: Picked) => void;
}) {
  const t = useT();
  const f = useDayFormat();
  const theme = useTheme();
  const world = useWorld();
  const past = usePhase(meeting.start, meeting.end) === "past";
  const time = timeRange(f, meeting.start, meeting.end);
  // "Pertemuan" alone says nothing: a meeting Edunex didn't number names its course, like a class from SIX.
  const what = meeting.number !== null ? t("schedule.meeting", { n: meeting.number }) : world.name(meeting.code);
  const label = factsLabel(
    meeting.code,
    what,
    time,
    meeting.online ? t("schedule.online") : null,
    notInSix ? t("schedule.notInSix") : t("schedule.fromEdunex"),
  );
  return (
    <Card
      testID={`row.class.${rowKey(meeting.code, meeting.start)}`}
      label={label}
      onPress={() => onPick({ kind: "meeting", meeting, notInSix })}
      color={world.color(meeting.code)}
      dashed
      quiet={past}
    >
      <Text size="titleSmall" tabular tone={past ? "muted" : "fg"}>
        {time}
      </Text>
      <Text size="bodyMedium" numberOfLines={2} style={{ marginTop: 2 }}>
        <Text size="bodyMedium" weight="semibold" tabular tone={past ? "muted" : "fg"}>
          {meeting.code}
        </Text>
        <Text size="bodyMedium" tone="muted">{` ${what}`}</Text>
      </Text>
      {meeting.online && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], marginTop: 2 }}>
          <Icons.Video size={14} color={theme.color.onSurfaceVariant} />
          <Text size="bodyMedium" tone="muted">
            {t("schedule.online")}
          </Text>
        </View>
      )}
      {notInSix && (
        <Chips>
          <Chip icon={Icons.Info}>{t("schedule.notInSix")}</Chip>
        </Chips>
      )}
    </Card>
  );
});

/** Presence by handing in a Task that day: "II4091 Kumpulkan Tugas 02 Bab II sebelum 23:59 untuk hadir", or handed in. */
function WindowCard({ window, onPick }: { window: TaskWindow; onPick: (picked: Picked) => void }) {
  const t = useT();
  const f = useDayFormat();
  const theme = useTheme();
  const handedIn = useClockSelect((now) => window.task !== null && taskStatus(window.task, now) === "submitted");
  const done = Boolean(window.presence.recorded?.present) || handedIn;
  const text = done ? t("schedule.window.done", { task: window.task?.title ?? window.code }) : handInLabel(t, f, window);
  return (
    <Card testID={`row.window.${window.presence.id}`} label={factsLabel(window.code, text)} onPress={() => onPick({ kind: "window", window })} quiet={done}>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <View style={{ paddingTop: 2 }}>
          {done ? (
            <Icons.CheckCircle size={18} color={theme.color.successFg} weight="bold" />
          ) : (
            <Icons.Upload size={18} color={theme.color.primary} weight="bold" />
          )}
        </View>
        <Text size="bodyMedium" tone={done ? "success" : "fg"} style={{ flex: 1 }}>
          <Text size="bodyMedium" weight="semibold" tabular tone={done ? "success" : "fg"}>
            {window.code}
          </Text>
          {` ${text}`}
        </Text>
      </View>
    </Card>
  );
}

/** A Task due that day: "23:59 · DK4073 · Tugas 01 Bab I". */
function DueCard({ task, onPick }: { task: Task; onPick: (picked: Picked) => void }) {
  const t = useT();
  const f = useDayFormat();
  const theme = useTheme();
  const world = useWorld();
  const time = f.time(task.dueAt!);
  return (
    <Card
      testID={`row.due.${task.id}`}
      label={factsLabel(task.courseCode, t("schedule.due", { time, title: task.title }))}
      onPress={() => onPick({ kind: "due", task })}
      color={world.color(task.courseCode)}
    >
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <View style={{ paddingTop: 2 }}>
          <Icons.Clock size={18} color={theme.color.onSurfaceVariant} weight="bold" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="titleSmall" tabular>
            {`${time}  ·  ${task.courseCode}`}
          </Text>
          <Text size="bodyMedium" style={{ marginTop: 2 }}>
            {task.title}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/** Meetings SIX shows that day that the app couldn't read: the day isn't free, and SIX has their time. */
function UnreadCard({ day, onPick }: { day: ScheduleDay; onPick: (picked: Picked) => void }) {
  const t = useT();
  const theme = useTheme();
  const text = t("schedule.unread.chip", { count: day.unread.length });
  return (
    <Card testID="row.unread" label={text} onPress={() => onPick({ kind: "unread", day: day.day, unread: day.unread })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Icons.Info size={18} color={theme.color.onSurfaceVariant} weight="bold" />
        <Text size="bodyMedium" style={{ flex: 1 }}>
          {text}
        </Text>
      </View>
    </Card>
  );
}
