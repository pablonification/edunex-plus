// Jadwal's month on a phone (src/app/screens/schedule/month.tsx): the desktop's cells hold words a
// phone has no room for, so the grid shows each day's number with a dot per course that meets that
// day (in its color) and ITB's periods tinted; tapping a day lists below what the desktop's cell
// and its popover say. First what's unusual, one line each, worst first (a class the app couldn't
// read, an exam, Presence by handing in a Task, a deadline, a moved or extra class, a meeting only
// Edunex announced), then the routine ("4 kuliah", "Bentrok 16:00"), then the day in time order,
// each row opening its sheet, and the way to its week.
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { type Format, type Translate, useFormat, useT } from "../../../../src/app/i18n";
import { wibDay } from "../../../../src/core/course-meetings";
import type { CalendarEvent } from "../../../../src/core/models";
import { dayNoon, isEmptyDay, type MonthGrid, type ScheduleDay } from "../../../../src/core/schedule";
import { taskStatus } from "../../../../src/core/tasks";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { Button } from "../../ui/controls";
import { CourseDot, Tag } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, List } from "../../ui/layout";
import { Text, type TextTone } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
import type { Picked } from "./details";
import { rowKey } from "./week";
import { handInLabel, periodName, type ScheduleWorld, timeRange, useWorld } from "./world";

/** ITB's periods tinted behind their days; single days (the term's first and last lecture day) get a line instead. */
const TINTED = new Set(["uts", "uas", "holiday", "drs", "urs"]);
const MARKED = new Set(["lecture-start", "lecture-end"]);
/** Course dots a day shows before it runs out of room. */
const DOTS = 4;

/** The courses that meet that day (classes and meetings), each once, in time order. */
const codesOf = (day: ScheduleDay) => [
  ...new Set(
    [...day.classes.map((c) => ({ code: c.session.courseCode, start: c.session.start })), ...day.outside, ...day.edunex]
      .sort((a, b) => a.start - b.start)
      .map((item) => item.code),
  ),
];

export function MonthView({
  month,
  plan,
  periods,
  chosen,
  onChoose,
  onPick,
  onShowWeek,
}: {
  month: MonthGrid;
  plan: readonly ScheduleDay[];
  periods: readonly CalendarEvent[];
  chosen: string;
  onChoose: (day: string) => void;
  onPick: (picked: Picked) => void;
  onShowWeek: (day: string) => void;
}) {
  const f = useFormat();
  const theme = useTheme();
  const world = useWorld();
  const today = wibDay(world.now);
  const tinted = periods.filter((e) => TINTED.has(e.kind));
  const weeks = month.weeks.map((week) => week.map((day) => plan.find((d) => d.day === day)!));
  const picked = plan.find((d) => d.day === chosen) ?? null;
  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: space[1] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {month.weeks[0]!.map((day) => (
          <Text key={day} size="caption" weight="semibold" tone="muted" style={{ flex: 1, textAlign: "center" }}>
            {f.weekdayShort(dayNoon(day))}
          </Text>
        ))}
      </View>
      <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: theme.color.line, overflow: "hidden", backgroundColor: theme.color.surface }}>
        {weeks.map((week, w) => (
          <View key={week[0]!.day} style={{ flexDirection: "row", borderTopWidth: w > 0 ? 1 : 0, borderTopColor: theme.color.line }}>
            {week.map((day) => {
              const inMonth = day.day.startsWith(month.month);
              const period = tinted.find((e) => e.firstDay <= day.day && day.day <= e.lastDay) ?? null;
              const codes = inMonth ? codesOf(day) : [];
              const isToday = day.day === today;
              const isPicked = day.day === chosen;
              return (
                <Pressable
                  key={day.day}
                  testID={`day.${day.day}`}
                  onPress={() => onChoose(day.day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isPicked }}
                  accessibilityLabel={f.dateLong(dayNoon(day.day))}
                  style={{
                    flex: 1,
                    minHeight: 56,
                    alignItems: "center",
                    paddingVertical: space[1.5],
                    gap: 3,
                    backgroundColor: isPicked ? theme.color.selected : period ? theme.color.sourceItbBg : inMonth ? undefined : theme.color.sunken,
                  }}
                >
                  <View
                    style={{
                      minWidth: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isToday ? theme.color.accent : undefined,
                      borderWidth: isPicked && !isToday ? 1.5 : 0,
                      borderColor: theme.color.fg,
                    }}
                  >
                    <Text
                      size="small"
                      weight="semibold"
                      tabular
                      style={{ color: isToday ? theme.color.onAccent : inMonth ? theme.color.fg : theme.color.faint }}
                    >
                      {String(Number(day.day.slice(8)))}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 2, paddingHorizontal: 2 }}>
                    {inMonth && day.unread.length > 0 && <CourseDot color={undefined} size={6} />}
                    {codes.slice(0, DOTS).map((code) => (
                      <CourseDot key={code} color={world.color(code)} size={6} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {picked && (
        <DayPanel
          day={picked}
          period={tinted.find((e) => e.firstDay <= picked.day && picked.day <= e.lastDay) ?? null}
          onPick={onPick}
          onShowWeek={() => onShowWeek(picked.day)}
        />
      )}
    </View>
  );
}

interface Line {
  key: string;
  icon: (color: string) => ReactNode;
  text: string;
  tone: TextTone;
  bold?: boolean;
}

/**
 * What's unusual that day, one line each, worst first (the desktop's monthLines, said in full as
 * its cells name them to a screen reader): classes the app couldn't read, ITB's marked days, exams,
 * hand-in windows, deadlines, moves, extras, meetings only Edunex announced.
 */
function monthLines(day: ScheduleDay, t: Translate, f: Format, world: ScheduleWorld): Line[] {
  const lines: Line[] = [];
  const time = (ms: number) => f.time(ms);
  if (day.unread.length)
    lines.push({
      key: "unread",
      icon: (c) => <Icons.Info size={14} color={c} weight="bold" />,
      text: t("schedule.unread.chip", { count: day.unread.length }),
      tone: "fg",
    });
  for (const event of day.events.filter((e) => MARKED.has(e.kind)))
    lines.push({ key: `c${event.id}`, icon: (c) => <Icons.Flag size={14} color={c} weight="bold" />, text: periodName(t, event), tone: "fg", bold: true });
  for (const { session, exam } of day.classes) {
    if (!exam) continue;
    lines.push({
      key: `e${session.id}`,
      icon: () => <Tag>{session.activity}</Tag>,
      // The room only when SIX gives one: never "UTS DK4073 11:00 · " with nothing after it.
      text: factsLabel(t("schedule.month.exam", { activity: session.activity, code: session.courseCode, time: time(session.start) }), session.room),
      tone: "fg",
      bold: true,
    });
  }
  for (const window of day.windows) {
    const done = window.presence.recorded?.present || (window.task !== null && taskStatus(window.task, world.now) === "submitted");
    lines.push({
      key: `w${window.presence.id}`,
      icon: (c) => (done ? <Icons.CheckCircle size={14} color={c} weight="bold" /> : <Icons.Upload size={14} color={c} weight="bold" />),
      text: factsLabel(
        window.code,
        done
          ? t("schedule.window.done", { task: window.task?.title ?? window.code })
          : t("schedule.handIn", { task: window.task?.title ?? window.code, time: time(window.presence.closesAt) }),
      ),
      tone: done ? "success" : "accent",
      bold: !done,
    });
  }
  for (const task of day.due)
    lines.push({
      key: `t${task.id}`,
      icon: (c) => <Icons.Clock size={14} color={c} weight="bold" />,
      text: t("schedule.month.due", { code: task.courseCode, title: task.title, time: time(task.dueAt!) }),
      tone: "fg",
    });
  for (const { session, moved, extra } of day.classes) {
    if (moved)
      lines.push({
        key: `m${session.id}`,
        icon: (c) => <Icons.History size={14} color={c} weight="bold" />,
        text: t("schedule.month.moved", { code: session.courseCode, time: time(session.start) }),
        tone: "warning",
        bold: true,
      });
    if (extra)
      lines.push({
        key: `x${session.id}`,
        icon: (c) => <Icons.Plus size={14} color={c} weight="bold" />,
        text: t("schedule.month.extra", { code: session.courseCode, time: time(session.start) }),
        tone: "warning",
        bold: true,
      });
  }
  for (const meeting of day.outside)
    lines.push({
      key: `a${meeting.code}${meeting.start}`,
      icon: (c) => (meeting.online ? <Icons.Video size={14} color={c} weight="bold" /> : <Icons.MapPin size={14} color={c} weight="bold" />),
      text: t("schedule.month.outside", { code: meeting.code, time: time(meeting.start) }),
      tone: "warning",
      bold: true,
    });
  return lines;
}

/** Classes that share time, once per pair: "Bentrok KU5014 · PL3032 · 16:00–16:30", and when it starts. */
function clashesOf(day: ScheduleDay, t: Translate, f: Format): { full: string; from: string }[] {
  const seen = new Map<string, { full: string; from: string }>();
  for (const { session, overlaps } of day.classes) {
    for (const o of overlaps) {
      const pair = factsLabel(...[session.courseCode, o.code].sort());
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

const TONE_COLOR: Partial<Record<TextTone, "warningFg" | "successFg" | "accentFg">> = { warning: "warningFg", success: "successFg", accent: "accentFg" };

/** The chosen day: what's unusual, the routine, then everything on it in time order, and the way to its week. */
function DayPanel({
  day,
  period,
  onPick,
  onShowWeek,
}: {
  day: ScheduleDay;
  period: CalendarEvent | null;
  onPick: (picked: Picked) => void;
  onShowWeek: () => void;
}) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const world = useWorld();
  const lines = monthLines(day, t, f, world);
  const routine = routineCount(day, t);
  const clashes = clashesOf(day, t, f);
  const timed = [
    ...day.classes.map((c) => ({
      key: c.session.id,
      start: c.session.start,
      end: c.session.end,
      code: c.session.courseCode,
      title: c.exam
        ? `${c.session.activity} ${world.name(c.session.courseCode, c.session.courseName)}`
        : world.name(c.session.courseCode, c.session.courseName),
      where: c.session.room,
      exam: c.exam,
      note: c.overlaps.length
        ? t("schedule.mark.overlap", { code: c.overlaps[0]!.code })
        : c.moved
          ? t("schedule.mark.moved")
          : c.extra
            ? t("schedule.mark.extra")
            : null,
      pick: { kind: "class", item: c } as Picked,
    })),
    // A meeting outside SIX is "Tidak ada di SIX" unless the day has a class the app couldn't read; Edunex's own (no SIX) never is.
    ...[...day.outside.map((m) => ({ m, notInSix: !m.maybeInSix })), ...day.edunex.map((m) => ({ m, notInSix: false }))].map(({ m, notInSix }) => ({
      key: `${m.code}${m.start}`,
      start: m.start,
      end: m.end,
      code: m.code,
      title: m.number !== null ? t("schedule.meeting", { n: m.number }) : t("schedule.meetingEdunex"),
      where: m.online ? t("schedule.online") : null,
      exam: false,
      note: null as string | null,
      pick: { kind: "meeting", meeting: m, notInSix } as Picked,
    })),
  ].sort((a, b) => a.start - b.start);
  return (
    <View style={{ marginTop: space[5] }} testID={`agenda.${day.day}`}>
      <Text size="title" weight="semibold" accessibilityRole="header">
        {f.dateLong(dayNoon(day.day))}
      </Text>
      {period && (
        <Text size="small" weight="medium" style={{ color: theme.color.sourceItbFg, marginTop: 2 }}>
          {periodName(t, period)}
        </Text>
      )}
      {isEmptyDay(day) ? (
        <Text size="body" tone="muted" style={{ marginTop: space[3] }}>
          {t("schedule.month.nothing")}
        </Text>
      ) : (
        <>
          {(lines.length > 0 || routine || clashes.length > 0) && (
            <View style={{ marginTop: space[3], gap: space[1.5] }}>
              {lines.map((line) => {
                const color = theme.color[TONE_COLOR[line.tone] ?? "muted"];
                return (
                  <View key={line.key} style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
                    <View style={{ minHeight: 19, justifyContent: "center" }}>{line.icon(color)}</View>
                    <Text size="small" tone={line.tone} weight={line.bold ? "semibold" : "regular"} style={{ flex: 1 }}>
                      {line.text}
                    </Text>
                  </View>
                );
              })}
              {routine && (
                <Text size="small" tone="muted">
                  {routine}
                </Text>
              )}
              {clashes.map((clash) => (
                <View key={clash.full} style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
                  <View style={{ minHeight: 19, justifyContent: "center" }}>
                    <Icons.Overlap size={14} color={theme.color.warningFg} weight="bold" />
                  </View>
                  <Text size="small" weight="semibold" tone="warning" style={{ flex: 1 }}>
                    {clash.full}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {(timed.length > 0 || day.windows.length > 0 || day.due.length > 0 || day.unread.length > 0) && (
            <List style={{ marginTop: space[4] }}>
              {day.unread.map((one) => (
                <DayRow
                  key={`u${one.row}`}
                  testID="row.unread"
                  when="-"
                  label={t("schedule.unread.title", { count: 1 })}
                  onPress={() => onPick({ kind: "unread", day: day.day, unread: day.unread })}
                >
                  <Text size="body" weight="semibold">
                    {t("schedule.unread.title", { count: 1 })}
                  </Text>
                  <Text size="caption" tone="muted">
                    {one.row}
                  </Text>
                </DayRow>
              ))}
              {timed.map((item) => (
                <DayRow
                  key={item.key}
                  testID={`row.class.${rowKey(item.code, item.start)}`}
                  when={timeRange(f, item.start, item.end)}
                  label={factsLabel(item.code, item.title, timeRange(f, item.start, item.end), item.where, item.note)}
                  onPress={() => onPick(item.pick)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space[1.5] }}>
                    <CourseDot color={world.color(item.code)} size={8} />
                    <Text size="body" weight="semibold" tabular>
                      {item.code}
                    </Text>
                  </View>
                  <Text size="body" weight={item.exam ? "semibold" : "regular"}>
                    {item.title}
                  </Text>
                  {(item.where || item.note) && (
                    <Text size="small" tone="muted">
                      {factsLabel(item.where, item.note)}
                    </Text>
                  )}
                </DayRow>
              ))}
              {day.windows.map((w) => (
                <DayRow
                  key={`w${w.presence.id}`}
                  when={f.time(w.presence.closesAt)}
                  label={handInLabel(t, f, w)}
                  onPress={() => onPick({ kind: "window", window: w })}
                >
                  <Text size="body" tone="accent">
                    {handInLabel(t, f, w)}
                  </Text>
                </DayRow>
              ))}
              {day.due.map((task) => (
                <DayRow
                  key={`t${task.id}`}
                  when={f.time(task.dueAt!)}
                  label={t("schedule.due.short", { code: task.courseCode, title: task.title })}
                  onPress={() => onPick({ kind: "due", task })}
                >
                  <Text size="body">{t("schedule.due.short", { code: task.courseCode, title: task.title })}</Text>
                </DayRow>
              ))}
            </List>
          )}
        </>
      )}
      <View style={{ marginTop: space[4], gap: space[2] }}>
        {day.unread.length > 0 && <OpenSixTimetable day={day.day} />}
        <Button variant="secondary" onPress={onShowWeek} testID="action.showWeek">
          {t("schedule.month.showWeek")}
        </Button>
      </View>
    </View>
  );
}

/** One thing on the chosen day: its time in a column, what it is beside it. */
function DayRow({ when, label, onPress, testID, children }: { when: string; label: string; onPress: () => void; testID?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: theme.color.selected }}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], minHeight: 56 }}
    >
      <Text size="small" weight="semibold" tabular style={{ width: 92, paddingTop: 2 }}>
        {when}
      </Text>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>{children}</View>
      <View style={{ paddingTop: 3 }}>
        <Icons.ChevronRight size={16} color={theme.color.faint} />
      </View>
    </Pressable>
  );
}
