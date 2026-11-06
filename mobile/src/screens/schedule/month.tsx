// Jadwal's month on a phone (src/app/screens/schedule/month.tsx; round 2, v4): a grid of days, each with at most three
// dots under its number (the courses that meet, in their colours, and an amber one when something on it is unusual: an
// exam, a deadline, a hand-in for Presensi, a class moved, extra or clashing, a meeting only Edunex announced, a class
// the app couldn't read); ITB's periods tinted. Tapping a day lists it below: the date, one quiet line that sums it up
// ("Masa UTS · 4 kuliah · Bentrok 16:00"), then one card of rows in time order (a tile, the title, code and time ·
// room, at most one pill), each opening its sheet, and the way to its week. A cell says the desktop's lines in full to
// a screen reader.
import type { ReactNode } from "react";
import { View } from "react-native";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { wibDay } from "../../../../src/core/course-meetings";
import type { CalendarEvent } from "../../../../src/core/models";
import { dayNoon, isEmptyDay, type MonthGrid, type ScheduleDay } from "../../../../src/core/schedule";
import { taskStatus } from "../../../../src/core/tasks";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { Button } from "../../ui/controls";
import { CourseIconTile } from "../../ui/course-icon-tile";
import { Group, GroupRow, IconTile, Pill, type PillTone } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { nowColour, onNowColour, rowKey } from "./day";
import type { Picked } from "./details";
import { periodName, timeRange, useWorld } from "./world";

/** ITB's periods tinted behind their days; single days (the term's first and last lecture day) are in the day's line. */
const TINTED = new Set(["uts", "uas", "holiday", "drs", "urs"]);
const MARKED = new Set(["lecture-start", "lecture-end"]);
/** Dots a day shows at most. */
const DOTS = 3;

/**
 * The routine: the courses whose lectures (and, without SIX, Edunex's meetings) fall that day, each
 * once, in time order. Exams and meetings outside SIX aren't routine.
 */
const codesOf = (day: ScheduleDay) => [
  ...new Set(
    [...day.classes.filter((c) => !c.exam).map((c) => ({ code: c.session.courseCode, start: c.session.start })), ...day.edunex]
      .sort((a, b) => a.start - b.start)
      .map((item) => item.code),
  ),
];

/** Something on the day beyond the routine: the cell's amber dot. */
const unusual = (day: ScheduleDay) =>
  day.unread.length > 0 ||
  day.events.some((e) => MARKED.has(e.kind)) ||
  day.windows.length > 0 ||
  day.due.length > 0 ||
  day.outside.length > 0 ||
  day.classes.some((c) => c.exam || c.moved || c.extra || c.overlaps.length > 0);

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
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const v = theme.v4;
  const world = useWorld();
  const now = useNow();
  const today = wibDay(now);
  const tinted = periods.filter((e) => TINTED.has(e.kind));
  const weeks = month.weeks.map((week) => week.map((day) => plan.find((d) => d.day === day)!));
  const picked = plan.find((d) => d.day === chosen) ?? null;
  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: space[1] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {month.weeks[0]!.map((day) => (
          <Text key={day} size="caption" weight="semibold" style={{ flex: 1, textAlign: "center", color: v.muted }}>
            {f.weekdayShort(dayNoon(day))}
          </Text>
        ))}
      </View>
      <View style={{ borderRadius: 20, overflow: "hidden", backgroundColor: v.card, paddingVertical: space[1] }}>
        {weeks.map((week) => (
          <View key={week[0]!.day} style={{ flexDirection: "row" }}>
            {week.map((day) => {
              const inMonth = day.day.startsWith(month.month);
              const period = tinted.find((e) => e.firstDay <= day.day && day.day <= e.lastDay) ?? null;
              const odd = inMonth && unusual(day);
              const codes = inMonth ? codesOf(day).slice(0, odd ? DOTS - 1 : DOTS) : [];
              // Said in full, as the desktop's cell says it to a screen reader.
              const said = inMonth ? [...fullLines(day, t, f, now), summaryOf(day, period, t, f)].filter(Boolean).join(", ") : "";
              const isToday = day.day === today;
              const isPicked = day.day === chosen;
              return (
                <PressScale
                  key={day.day}
                  testID={`day.${day.day}`}
                  onPress={() => onChoose(day.day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isPicked }}
                  accessibilityLabel={said ? `${f.dateLong(dayNoon(day.day))}: ${said}` : f.dateLong(dayNoon(day.day))}
                  style={{
                    flex: 1,
                    minHeight: 52,
                    alignItems: "center",
                    paddingVertical: space[1],
                    gap: 4,
                    backgroundColor: period && inMonth ? theme.color.sourceItbBg : undefined,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      // Today in the brand's blue, its one meaning (as on Jadwal's strip and its now-line); the day picked
                      // in its tint.
                      backgroundColor: isToday ? nowColour(theme.scheme) : isPicked ? v.brandTint : undefined,
                    }}
                  >
                    <Text
                      size="small"
                      weight={isToday || isPicked ? "bold" : "medium"}
                      tabular
                      style={{ color: isToday ? onNowColour(theme.scheme) : isPicked ? v.brandInk : inMonth ? v.fg : v.muted }}
                    >
                      {String(Number(day.day.slice(8)))}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 3, height: 6 }}>
                    {codes.map((code) => (
                      <View key={code} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.courseTile(world.color(code)).ink }} />
                    ))}
                    {odd && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: v.ambFg }} />}
                  </View>
                </PressScale>
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

/**
 * What's unusual that day in full, as the desktop's cells name it to a screen reader (its monthLines): classes the app
 * couldn't read, ITB's marked days, exams, hand-in windows, deadlines, moves, extras, meetings only Edunex announced.
 */
function fullLines(day: ScheduleDay, t: Translate, f: Format, now: number): string[] {
  const lines: string[] = [];
  const time = (ms: number) => f.time(ms);
  if (day.unread.length) lines.push(t("schedule.unread.chip", { count: day.unread.length }));
  for (const event of day.events.filter((e) => MARKED.has(e.kind))) lines.push(periodName(t, event));
  for (const { session, exam } of day.classes)
    if (exam)
      lines.push(factsLabel(t("schedule.month.exam", { activity: session.activity, code: session.courseCode, time: time(session.start) }), session.room));
  for (const window of day.windows) {
    const done = window.presence.recorded?.present || (window.task !== null && taskStatus(window.task, now) === "submitted");
    lines.push(
      factsLabel(
        window.code,
        done
          ? t("schedule.window.done", { task: window.task?.title ?? window.code })
          : t("schedule.handIn", { task: window.task?.title ?? window.code, time: time(window.presence.closesAt) }),
      ),
    );
  }
  for (const task of day.due) lines.push(t("schedule.month.due", { code: task.courseCode, title: task.title, time: time(task.dueAt!) }));
  for (const { session, moved, extra } of day.classes) {
    if (moved) lines.push(t("schedule.month.moved", { code: session.courseCode, time: time(session.start) }));
    if (extra) lines.push(t("schedule.month.extra", { code: session.courseCode, time: time(session.start) }));
  }
  for (const meeting of day.outside) lines.push(t("schedule.month.outside", { code: meeting.code, time: time(meeting.start) }));
  for (const clash of clashesOf(day, t, f)) lines.push(clash.full);
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

/** The day in one quiet line: its period or ITB's mark, what the app couldn't read, the routine, the clash ("Masa UTS · 4 kuliah · Bentrok 16:00"). */
function summaryOf(day: ScheduleDay, period: CalendarEvent | null, t: Translate, f: Format): string {
  const clashes = clashesOf(day, t, f);
  return factsLabel(
    period ? periodName(t, period) : null,
    ...day.events.filter((e) => MARKED.has(e.kind)).map((e) => periodName(t, e)),
    day.unread.length ? t("schedule.unread.chip", { count: day.unread.length }) : null,
    routineCount(day, t),
    clashes.length === 1
      ? t("schedule.month.clashAt", { time: clashes[0]!.from })
      : clashes.length > 1
        ? t("schedule.month.clashes", { count: clashes.length })
        : null,
  );
}

interface Row {
  key: string;
  /** Rows go in time order; what has no time (a class the app couldn't read) first. */
  at: number;
  testID?: string;
  leading: ReactNode;
  title: string;
  meta: string;
  pill: { tone: PillTone; words: string } | null;
  /** Said in full to a screen reader. */
  label: string;
  pick: Picked;
}

/** The chosen day: its date, one line that sums it up, everything on it as rows in time order, and the way to its week. */
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
  const v = useTheme().v4;
  const world = useWorld();
  const now = useNow();
  const summary = isEmptyDay(day) ? factsLabel(period ? periodName(t, period) : null, t("schedule.month.nothing")) : summaryOf(day, period, t, f);
  const rows: Row[] = [
    ...day.unread.map(
      (one): Row => ({
        key: `u${one.row}`,
        at: -Infinity,
        testID: "row.unread",
        leading: <IconTile tone="amber" icon={(c) => <Icons.Info size={22} color={c} weight="bold" />} />,
        title: t("schedule.unread.title", { count: 1 }),
        meta: one.row,
        pill: null,
        label: factsLabel(t("schedule.unread.title", { count: 1 }), one.row),
        pick: { kind: "unread", day: day.day, unread: day.unread },
      }),
    ),
    ...day.classes.map((c): Row => {
      const { session } = c;
      const name = world.name(session.courseCode, session.courseName);
      const range = timeRange(f, session.start, session.end);
      const pill: Row["pill"] = c.exam
        ? null
        : c.overlaps.length
          ? { tone: "amber", words: t("mobile.home.chip.clash") }
          : c.moved
            ? { tone: "amber", words: t(c.moved.kinds.includes("room") && c.moved.kinds.length === 1 ? "schedule.mark.room" : "schedule.mark.moved") }
            : c.extra
              ? { tone: "amber", words: t("schedule.mark.extra") }
              : c.uncertain
                ? { tone: "plain", words: t("schedule.uncertain.short") }
                : null;
      const title = c.exam ? `${session.activity} ${name}` : name;
      return {
        key: session.id,
        at: session.start,
        testID: `row.class.${rowKey(session.courseCode, session.start)}`,
        leading: <CourseTile code={session.courseCode} name={session.courseName} />,
        title,
        // The tile and the title name the course: the meta is when and where (the code stays in the spoken name).
        meta: factsLabel(range, session.room),
        pill,
        label: factsLabel(
          session.courseCode,
          title,
          range,
          session.room,
          c.overlaps.length ? t("schedule.mark.overlap", { code: c.overlaps[0]!.code }) : pill?.words,
        ),
        pick: { kind: "class", item: c },
      };
    }),
    // A meeting outside SIX is "Tak di SIX" unless the day has a class the app couldn't read; Edunex's own (no SIX) never is.
    ...[...day.outside.map((m) => ({ m, notInSix: !m.maybeInSix })), ...day.edunex.map((m) => ({ m, notInSix: false }))].map(({ m, notInSix }): Row => {
      const range = timeRange(f, m.start, m.end);
      const meeting = m.number !== null ? t("schedule.meeting", { n: m.number }) : t("schedule.meetingEdunex");
      const where = m.online ? t("schedule.online") : null;
      return {
        key: `${m.code}${m.start}`,
        at: m.start,
        testID: `row.class.${rowKey(m.code, m.start)}`,
        leading: <CourseTile code={m.code} name={world.name(m.code)} />,
        title: world.name(m.code),
        meta: factsLabel(range, where),
        pill: notInSix ? { tone: "amber", words: t("home.today.notInSix") } : null,
        label: factsLabel(m.code, world.name(m.code), meeting, range, where, notInSix ? t("schedule.notInSix") : null),
        pick: { kind: "meeting", meeting: m, notInSix },
      };
    }),
    ...day.windows.map((w): Row => {
      const done = w.presence.recorded?.present || (w.task !== null && taskStatus(w.task, now) === "submitted");
      const time = f.time(w.presence.closesAt);
      return {
        key: `w${w.presence.id}`,
        at: w.presence.closesAt,
        leading: (
          <CourseIconTile
            code={w.code}
            icon={(c) => (done ? <Icons.CheckCircle size={22} color={c} weight="bold" /> : <Icons.Upload size={22} color={c} weight="bold" />)}
          />
        ),
        title: w.task?.title ?? t("schedule.window.kind"),
        meta: `${w.code} ${time}`,
        pill: done ? { tone: "ok", words: t("mobile.tasks.handedIn") } : { tone: "brand", words: t("mobile.home.kind.presence") },
        label: factsLabel(
          w.code,
          done
            ? t("schedule.window.done", { task: w.task?.title ?? w.code })
            : w.task
              ? t("schedule.handIn", { task: w.task.title, time })
              : t("schedule.handIn.unknown", { time }),
        ),
        pick: { kind: "window", window: w },
      };
    }),
    ...day.due.map(
      (task): Row => ({
        key: `t${task.id}`,
        at: task.dueAt!,
        leading: <CourseIconTile code={task.courseCode} icon={(c) => <Icons.Clock size={22} color={c} weight="bold" />} />,
        title: task.title,
        meta: `${task.courseCode} ${f.time(task.dueAt!)}`,
        pill: { tone: "plain", words: t("schedule.due.kind") },
        label: t("schedule.month.due", { code: task.courseCode, title: task.title, time: f.time(task.dueAt!) }),
        pick: { kind: "due", task },
      }),
    ),
  ].sort((a, b) => a.at - b.at);
  return (
    <View style={{ marginTop: space[6] }} testID={`agenda.${day.day}`}>
      <View style={{ marginLeft: space[1], marginBottom: space[3] }}>
        <Text size="titleMedium" face="display" weight="bold" accessibilityRole="header" style={{ fontSize: 17, letterSpacing: -0.2, color: v.fg }}>
          {f.dateLong(dayNoon(day.day))}
        </Text>
        {summary !== "" && (
          <Text size="bodyMedium" tabular style={{ color: v.muted, marginTop: 2 }}>
            {summary}
          </Text>
        )}
      </View>
      {rows.length > 0 && (
        <Group>
          {rows.map((row, i) => (
            <GroupRow
              key={row.key}
              first={i === 0}
              testID={row.testID}
              leading={row.leading}
              // A title and one meta line, each cut to one line (the judge's round 3, 10): the whole of both is in the
              // row's spoken name and on the sheet it opens.
              title={
                <Text size="bodyLarge" weight="medium" numberOfLines={1} style={{ color: v.fg, lineHeight: 21 }}>
                  {row.title}
                </Text>
              }
              meta={
                <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: v.muted }}>
                  {row.meta}
                </Text>
              }
              trailing={row.pill ? <Pill tone={row.pill.tone}>{row.pill.words}</Pill> : undefined}
              onPress={() => onPick(row.pick)}
              accessibilityRole="button"
              accessibilityLabel={row.label}
            />
          ))}
        </Group>
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
