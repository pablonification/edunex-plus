// Jadwal's week on a phone (src/app/screens/schedule/week.tsx): a seven-column time grid is
// unreadable at this width, so the week is a strip of its days (today marked, a dot under each day
// with something on it, the term's week and the arrows to the next) over the chosen day as a list.
// The list keeps exactly what the desktop's day column holds, worked out by the same scheduleDays:
// each class with its time, code, name and room and what's unusual about it (moved, extra, a clash
// and with which course, may not run in an exam week), meetings only Edunex announced ("Tidak ada
// di SIX", Gabung when online), exam sessions, and under them the day's lane (Presence by handing
// in a Task, deadlines). ITB's periods ("Masa UTS · 12–16 Okt") sit above, as the desktop's bands
// do. Swiping the list sideways moves a day.
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { budgetLabel, STATE_TONE } from "../../../../src/app/attendance-labels";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useT } from "../../../../src/app/i18n";
import type { ScheduleData } from "../../../../src/app/schedule-data";
import { wibDay } from "../../../../src/core/course-meetings";
import type { CalendarEvent, Task } from "../../../../src/core/models";
import {
  clockOf,
  dayNoon,
  type EdunexMeeting,
  isEmptyDay,
  minuteOfDay,
  type OutsideMeeting,
  SCHEDULE_EVENT_KINDS,
  type ScheduleDay,
  type ScheduledClass,
  type TaskWindow,
} from "../../../../src/core/schedule";
import { taskStatus } from "../../../../src/core/tasks";
import { toneOf } from "../../parts/attendance";
import { IconButton } from "../../ui/controls";
import { CourseDot, LiveDot, Tag } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, List } from "../../ui/layout";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
import type { Picked } from "./details";
import { handInLabel, periodName, timeRange, useWorld } from "./world";

const NO_LECTURES = new Set(["uts", "uas", "holiday"]);

/** A row's key, as the inventory names a class: "pl3002-08-00" (its code and WIB start), unique within a day. */
export const rowKey = (code: string, start: number) => `${code.toLowerCase()}-${clockOf(minuteOfDay(start)).replace(":", "-")}`;

/** A day of ITB's calendar without lectures (an exam week, a holiday): tinted in the strip. */
const offDay = (day: ScheduleDay) => day.events.some((e) => NO_LECTURES.has(e.kind));

/** Anything on the day the strip puts a dot under. */
const busy = (day: ScheduleDay) => !isEmptyDay(day);

/**
 * The week's days in a row, under the arrows to the weeks around it. The chosen day is filled,
 * today is in the accent color, a day in an exam week or a holiday is tinted as ITB's calendar is.
 */
export function WeekStrip({
  plan,
  chosen,
  onChoose,
  onStep,
  name,
}: {
  plan: readonly ScheduleDay[];
  chosen: string;
  onChoose: (day: string) => void;
  onStep: (by: number) => void;
  /** The week on screen said from today: "Minggu ini", "Minggu depan". */
  name: string;
}) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const world = useWorld();
  const today = wibDay(world.now);
  return (
    <View style={{ backgroundColor: theme.color.canvas, paddingBottom: space[2], marginHorizontal: -space.page, paddingHorizontal: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <IconButton label={t("schedule.prevWeek")} onPress={() => onStep(-1)} testID="action.prevWeek">
          <Icons.ChevronLeft size={20} color={theme.color.fg} />
        </IconButton>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text size="small" weight="semibold" accessibilityLiveRegion="polite" testID="label.place">
            {name}
          </Text>
        </View>
        <IconButton label={t("schedule.nextWeek")} onPress={() => onStep(1)} testID="action.nextWeek">
          <Icons.ChevronRight size={20} color={theme.color.fg} />
        </IconButton>
      </View>
      {/* The days line up with the page (16 from the edge), as the notice under them does. */}
      <View style={{ flexDirection: "row", paddingHorizontal: space.page - space[2] }} accessibilityRole="tablist">
        {plan.map((day, i) => {
          const noon = dayNoon(day.day);
          const picked = day.day === chosen;
          const isToday = day.day === today;
          const off = offDay(day);
          // One band behind a run of ITB's days off, as the desktop's: rounded only where the run starts and ends.
          const opens = off && !(i > 0 && offDay(plan[i - 1]!));
          const closes = off && !(i < plan.length - 1 && offDay(plan[i + 1]!));
          return (
            <Pressable
              key={day.day}
              testID={`day.${day.day}`}
              onPress={() => onChoose(day.day)}
              accessibilityRole="tab"
              accessibilityState={{ selected: picked }}
              accessibilityLabel={f.dateLong(noon)}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: space[1.5],
                borderTopLeftRadius: opens ? radius.lg : 0,
                borderBottomLeftRadius: opens ? radius.lg : 0,
                borderTopRightRadius: closes ? radius.lg : 0,
                borderBottomRightRadius: closes ? radius.lg : 0,
                backgroundColor: off ? theme.color.sourceItbBg : undefined,
              }}
            >
              <Text size="caption" weight="medium" tone={isToday ? "accent" : "muted"}>
                {f.weekdayShort(noon)}
              </Text>
              <View
                style={{
                  marginTop: 2,
                  minWidth: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  // Today is the accent disc, as the desktop's; a picked day is the desktop's picked tint with a ring, never a bright disc.
                  backgroundColor: picked ? (isToday ? theme.color.accent : theme.color.selected) : undefined,
                  borderWidth: picked && !isToday ? 1.5 : 0,
                  borderColor: theme.color.fg,
                }}
              >
                <Text
                  size="body"
                  weight="semibold"
                  tabular
                  style={{ color: picked && isToday ? theme.color.onAccent : isToday ? theme.color.accentFg : theme.color.fg }}
                >
                  {String(Number(day.day.slice(8)))}
                </Text>
              </View>
              <View style={{ marginTop: 3, width: 5, height: 5, borderRadius: 3, backgroundColor: busy(day) ? theme.color.faint : "transparent" }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** ITB's periods over the week, as the desktop's bands: "Masa UTS · 12–16 Okt · kuliah lain belum pasti ada, cek pengumuman dosen". */
export function WeekBands({ days, plan, events }: { days: readonly string[]; plan: readonly ScheduleDay[]; events: readonly CalendarEvent[] }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const shown = events.filter((e) => SCHEDULE_EVENT_KINDS.has(e.kind) && e.firstDay <= days[6]! && e.lastDay >= days[0]!);
  if (!shown.length) return null;
  return (
    <View style={{ gap: space[2], marginBottom: space[4] }}>
      {shown.map((event) => {
        const uncertain = plan.some((day) => day.classes.some((c) => c.uncertain?.id === event.id));
        return (
          <View
            key={event.id}
            style={{
              flexDirection: "row",
              gap: space[2],
              borderRadius: radius.lg,
              backgroundColor: theme.color.sourceItbBg,
              paddingHorizontal: space[3],
              paddingVertical: space[2],
            }}
          >
            <View style={{ paddingTop: 2 }}>
              <Icons.Flag size={14} color={theme.color.sourceItbFg} weight="bold" />
            </View>
            <Text size="small" style={{ flex: 1, color: theme.color.sourceItbFg }}>
              <Text size="small" weight="semibold" style={{ color: theme.color.sourceItbFg }}>
                {`${periodName(t, event)} · ${f.dayRange(event.firstDay, event.lastDay)}`}
              </Text>
              {uncertain ? ` · ${t("schedule.band.uncertain")}` : ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The chosen day: SIX's classes and the meetings outside SIX in time order, then the day's lane.
 * `free`: the desktop's "Kosong" applies (SIX read, a weekday of a published month, no holiday).
 * Swiping sideways moves a day (`onSwipe(+1)` is the next).
 */
export function DayAgenda({
  day,
  input,
  free,
  onPick,
  onSwipe,
}: {
  day: ScheduleDay;
  input: ScheduleData;
  free: boolean;
  onPick: (picked: Picked) => void;
  onSwipe: (by: number) => void;
}) {
  const t = useT();
  const f = useFormat();
  const swipe = usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-16, 16],
    runOnJS: true,
    onDeactivate: (event) => {
      if (event.canceled) return;
      if (event.translationX <= -60) onSwipe(1);
      else if (event.translationX >= 60) onSwipe(-1);
    },
  });
  const timed: { key: string; start: number; row: ReactNode }[] = [
    ...day.classes.map((item) => ({
      key: item.session.id,
      start: item.session.start,
      row: <ClassRow item={item} onPress={() => onPick({ kind: "class", item })} />,
    })),
    ...[...day.outside, ...day.edunex].map((meeting) => {
      const notInSix = input.six && !("maybeInSix" in meeting && meeting.maybeInSix);
      return {
        key: `${meeting.code}-${meeting.start}`,
        start: meeting.start,
        row: <MeetingRow meeting={meeting} notInSix={notInSix} onPress={() => onPick({ kind: "meeting", meeting, notInSix })} />,
      };
    }),
  ].sort((a, b) => a.start - b.start);
  const lane = [
    ...day.windows.map((window) => <WindowRow key={`w${window.presence.id}`} window={window} onPress={() => onPick({ kind: "window", window })} />),
    ...day.due.map((task) => <DueRow key={`t${task.id}`} task={task} onPress={() => onPick({ kind: "due", task })} />),
  ];
  return (
    <GestureDetector gesture={swipe}>
      <View collapsable={false} testID={`agenda.${day.day}`}>
        <Text size="title" weight="semibold" accessibilityRole="header" style={{ marginBottom: space[3] }}>
          {f.dateLong(dayNoon(day.day))}
        </Text>
        {/* No time to place it at: first, about the whole day. */}
        {day.unread.length > 0 && (
          <View style={{ marginBottom: space[3] }}>
            <UnreadRow count={day.unread.length} onPress={() => onPick({ kind: "unread", day: day.day, unread: day.unread })} />
          </View>
        )}
        {timed.length > 0 ? (
          <List>
            {timed.map((item) => (
              <View key={item.key}>{item.row}</View>
            ))}
          </List>
        ) : (
          day.unread.length === 0 &&
          lane.length === 0 && (
            <Text size="body" tone="muted" style={{ paddingVertical: space[4] }}>
              {free ? t("schedule.free") : t("schedule.month.nothing")}
            </Text>
          )
        )}
        {lane.length > 0 && (
          <View style={{ marginTop: timed.length ? space[5] : 0 }}>
            <Text size="small" weight="semibold" tone="muted" accessibilityRole="header" style={{ marginBottom: space[2] }}>
              {t("schedule.lane")}
            </Text>
            <List>{lane}</List>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------- rows

/**
 * The course's color down the row's left edge; none for a course the app doesn't know. Dashed for a
 * meeting only Edunex announced. It stops short of the row's top and bottom, so the list's rounded
 * corners never shave it into a sliver.
 */
function Stripe({ color, faded = false, dashed = false }: { color: string | undefined; faded?: boolean; dashed?: boolean }) {
  const theme = useTheme();
  if (!color) return null;
  const tone = theme.course(color);
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: radius.xl,
        bottom: radius.xl,
        width: 3,
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
        opacity: faded ? 0.5 : 1,
        overflow: "hidden",
      }}
    >
      {dashed ? (
        Array.from({ length: 24 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the dashes are drawn, they have no identity
          <View key={i} style={{ height: 5, marginBottom: 3, backgroundColor: tone }} />
        ))
      ) : (
        <View style={{ flex: 1, backgroundColor: tone }} />
      )}
    </View>
  );
}

function RowShell({
  testID,
  label,
  onPress,
  sunken,
  children,
}: {
  testID?: string;
  label: string;
  onPress: () => void;
  sunken?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: theme.color.selected }}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space[3],
        paddingLeft: space[4],
        paddingRight: space[3],
        paddingVertical: space[3],
        minHeight: 56,
        backgroundColor: sunken ? theme.color.sunken : undefined,
      }}
    >
      {children}
    </Pressable>
  );
}

type Glyph = (typeof Icons)[keyof typeof Icons];
const TONE_COLOR = { warning: "warningFg", danger: "dangerFg", success: "successFg" } as const;

/** A line about what's unusual, with its icon: "Berubah · biasanya 08:00–09:30", "Bentrok KU5014". */
function Mark({ Icon, tone = "warning", children }: { Icon: Glyph; tone?: keyof typeof TONE_COLOR; children: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], marginTop: 2 }}>
      <Icon size={13} color={theme.color[TONE_COLOR[tone]]} weight="bold" />
      <Text size="small" weight="semibold" tone={tone} style={{ flexShrink: 1 }}>
        {children}
      </Text>
    </View>
  );
}

function ClassRow({ item, onPress }: { item: ScheduledClass; onPress: () => void }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const world = useWorld();
  const { session, exam, moved, extra, overlaps, uncertain } = item;
  const code = session.courseCode;
  const live = session.start <= world.now && world.now < session.end;
  const past = session.end <= world.now;
  const time = timeRange(f, session.start, session.end);
  const room = session.room ?? t("schedule.room.none");
  const marks = [
    uncertain ? t("schedule.uncertain.short") : null,
    moved ? (moved.kinds.includes("room") && moved.kinds.length === 1 ? t("schedule.mark.room") : t("schedule.mark.moved")) : null,
    extra ? t("schedule.mark.extra") : null,
    ...overlaps.map((o) => t("schedule.mark.overlap", { code: o.code })),
  ].filter((m): m is string => m !== null);
  const label = factsLabel(exam ? `${session.activity} ${code}` : code, time, room, ...marks);
  const health = exam ? undefined : world.health(code);
  // The budget is said on a row only once it asks something of the Student (none left, out of reach); the rest is in the sheet.
  const budget = health && (health.state === "none" || health.state === "out" || health.state === "missed") ? health : undefined;
  return (
    <RowShell testID={`row.class.${rowKey(code, session.start)}`} label={label} onPress={onPress} sunken={uncertain !== null || past}>
      {/* The class on now: a green outline as well as the dot, as the desktop's block. */}
      {live && (
        <View
          style={{
            position: "absolute",
            top: 1,
            left: 1,
            right: 1,
            bottom: 1,
            borderRadius: radius.xl - 1,
            borderWidth: 2,
            borderColor: `${theme.color.live}80`,
            pointerEvents: "none",
          }}
        />
      )}
      <Stripe color={world.color(code)} faded={uncertain !== null} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text size="body" weight="semibold" tabular tone={past || uncertain ? "muted" : "fg"} style={{ flexShrink: 1 }}>
            {time}
          </Text>
          {live && <LiveDot />}
          <View style={{ flex: 1 }} />
          {exam && <Tag tone="neutral">{session.activity}</Tag>}
          {uncertain && (
            <Text size="caption" weight="medium" tone="muted">
              {t("schedule.uncertain.short")}
            </Text>
          )}
        </View>
        <Text size="body" numberOfLines={2} style={{ marginTop: 2 }}>
          <Text size="body" weight="semibold" tabular tone={past || uncertain ? "muted" : "fg"}>
            {code}
          </Text>
          <Text size="body" tone="muted">{` ${world.name(code, session.courseName)}`}</Text>
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[1], marginTop: 2 }}>
          <View style={{ paddingTop: 3 }}>
            <Icons.MapPin size={13} color={theme.color.muted} />
          </View>
          <Text
            size={exam ? "body" : "small"}
            weight={exam ? "semibold" : "regular"}
            tone={exam && !past ? "fg" : "muted"}
            style={[{ flexShrink: 1 }, !session.room && { fontStyle: "italic" }]}
          >
            {room}
          </Text>
        </View>
        {moved?.kinds.some((k) => k !== "room") ? (
          <Mark Icon={Icons.History}>{t("schedule.moved.time", { usual: `${clockOf(moved.usual.start)}–${clockOf(moved.usual.end)}` })}</Mark>
        ) : moved ? (
          <Mark Icon={Icons.History}>{t("schedule.mark.room")}</Mark>
        ) : null}
        {extra && <Mark Icon={Icons.Plus}>{t("schedule.extra")}</Mark>}
        {overlaps.map((o) => (
          <Mark key={o.code} Icon={Icons.Overlap}>
            {t("schedule.mark.overlap", { code: o.code })}
          </Mark>
        ))}
        {budget && (
          <Mark Icon={Icons.Hand} tone={toneOf(STATE_TONE[budget.state]) === "danger" ? "danger" : "warning"}>
            {budgetLabel(t, budget)}
          </Mark>
        )}
      </View>
    </RowShell>
  );
}

function MeetingRow({ meeting, notInSix, onPress }: { meeting: OutsideMeeting | EdunexMeeting; notInSix: boolean; onPress: () => void }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const world = useWorld();
  const open = useOpenExternal();
  const time = timeRange(f, meeting.start, meeting.end);
  // "Pertemuan" alone says nothing: a meeting Edunex didn't number names its course, like a class from SIX.
  const what = meeting.number !== null ? t("schedule.meeting", { n: meeting.number }) : world.name(meeting.code);
  const past = meeting.end <= world.now;
  const label = factsLabel(
    meeting.code,
    what,
    time,
    meeting.online ? t("schedule.online") : null,
    notInSix ? t("schedule.notInSix") : t("schedule.fromEdunex"),
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1 }}>
        <RowShell testID={`row.class.${rowKey(meeting.code, meeting.start)}`} label={label} onPress={onPress} sunken={past}>
          <Stripe color={world.color(meeting.code)} dashed />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size="body" weight="semibold" tabular tone={past ? "muted" : "fg"}>
              {time}
            </Text>
            <Text size="body" numberOfLines={2} style={{ marginTop: 2 }}>
              <Text size="body" weight="semibold" tabular tone={past ? "muted" : "fg"}>
                {meeting.code}
              </Text>
              <Text size="body" tone="muted">{` ${what}`}</Text>
            </Text>
            {meeting.online && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], marginTop: 2 }}>
                <Icons.Video size={13} color={theme.color.muted} />
                <Text size="small" tone="muted">
                  {t("schedule.online")}
                </Text>
              </View>
            )}
            {/* Not on SIX's timetable: easy to miss, so amber, as on Beranda and the course page. */}
            {notInSix && <Mark Icon={Icons.Info}>{t("schedule.notInSix")}</Mark>}
          </View>
        </RowShell>
      </View>
      {meeting.link && (
        <Pressable
          onPress={() => open(meeting.link!)}
          accessibilityRole="button"
          accessibilityLabel={factsLabel(t("schedule.join"), meeting.code)}
          testID={`action.join.${rowKey(meeting.code, meeting.start)}`}
          style={{
            marginRight: space[3],
            height: 36,
            flexDirection: "row",
            alignItems: "center",
            gap: space[1.5],
            borderRadius: radius.lg,
            backgroundColor: theme.color.accent,
            paddingHorizontal: space[3],
          }}
        >
          <Icons.Video size={14} color={theme.color.onAccent} weight="bold" />
          <Text size="small" weight="semibold" tone="onAccent">
            {t("schedule.join")}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Presence by handing in a Task that day: "II4091 Kumpulkan Tugas 02 Bab II sebelum 23:59 untuk hadir", or handed in. */
function WindowRow({ window, onPress }: { window: TaskWindow; onPress: () => void }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const world = useWorld();
  const done = window.presence.recorded?.present || (window.task !== null && taskStatus(window.task, world.now) === "submitted");
  const text = done ? t("schedule.window.done", { task: window.task?.title ?? window.code }) : handInLabel(t, f, window);
  return (
    <RowShell testID={`row.window.${window.presence.id}`} label={factsLabel(window.code, text)} onPress={onPress}>
      <View style={{ paddingTop: 3 }}>
        {done ? (
          <Icons.CheckCircle size={16} color={theme.color.successFg} weight="bold" />
        ) : (
          <Icons.Upload size={16} color={theme.color.accentFg} weight="bold" />
        )}
      </View>
      <Text size="body" tone={done ? "success" : "fg"} style={{ flex: 1 }}>
        <Text size="body" weight="semibold" tabular tone={done ? "success" : "fg"}>
          {window.code}
        </Text>
        {` ${text}`}
      </Text>
    </RowShell>
  );
}

/** A Task due that day: "23:59 ■ DK4073 Tugas 01 Bab I". */
function DueRow({ task, onPress }: { task: Task; onPress: () => void }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const world = useWorld();
  const time = f.time(task.dueAt!);
  return (
    <RowShell testID={`row.due.${task.id}`} label={factsLabel(task.courseCode, t("schedule.due", { time, title: task.title }))} onPress={onPress}>
      <View style={{ paddingTop: 3 }}>
        <Icons.Clock size={16} color={theme.color.muted} weight="bold" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[1.5] }}>
          <Text size="body" weight="semibold" tabular>
            {time}
          </Text>
          <CourseDot color={world.color(task.courseCode)} size={8} />
          <Text size="body" weight="semibold" tabular>
            {task.courseCode}
          </Text>
        </View>
        <Text size="body" style={{ marginTop: 2 }}>
          {task.title}
        </Text>
      </View>
    </RowShell>
  );
}

/** Meetings SIX shows that day that the app couldn't read: the day isn't free, and SIX has their time. */
function UnreadRow({ count, onPress }: { count: number; onPress: () => void }) {
  const t = useT();
  const theme = useTheme();
  const text = t("schedule.unread.chip", { count });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={text}
      testID="row.unread"
      android_ripple={{ color: theme.color.selected }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[2],
        minHeight: 48,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: theme.color.edge,
        backgroundColor: theme.color.surface,
        paddingHorizontal: space[3],
      }}
    >
      <Icons.Info size={16} color={theme.color.muted} weight="bold" />
      <Text size="body" style={{ flex: 1 }}>
        {text}
      </Text>
      <Icons.ChevronRight size={16} color={theme.color.faint} />
    </Pressable>
  );
}
