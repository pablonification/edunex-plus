// What a row on Jadwal says when the Student taps it (src/app/screens/schedule/details.tsx), in a
// sheet from the bottom instead of the desktop's popover: when and where, who teaches it, what's
// unusual about it, where attendance counts, Tandai Hadir or an Edunex Presence window open now,
// the join link, and the way to the course, exam or Task. The actions sit at the bottom, in reach.
import type { ReactNode } from "react";
import { View } from "react-native";
import { budgetLabel, STATE_TONE } from "../../../../src/app/attendance-labels";
import { useOpenCheckIn, useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { presenceAction } from "../../../../src/core/attendance";
import { checkingIn } from "../../../../src/core/check-in";
import { sixTimetableUrl } from "../../../../src/core/links";
import type { Task, UnreadSession } from "../../../../src/core/models";
import { clockOf, type EdunexMeeting, type OutsideMeeting, type ScheduledClass, type TaskWindow, weekDays } from "../../../../src/core/schedule";
import { isOpenStatus, taskStatus } from "../../../../src/core/tasks";
import { useNav } from "../../nav";
import { toneOf } from "../../parts/attendance";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { Button } from "../../ui/controls";
import { CourseDot, LiveDot, StatusChip } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta } from "../../ui/layout";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
import { handInLabel, openWindow, periodName, type ScheduleWorld, timeRange, useWorld } from "./world";

/** What the Student tapped on Jadwal. */
export type Picked =
  | { kind: "class"; item: ScheduledClass }
  | { kind: "meeting"; meeting: OutsideMeeting | EdunexMeeting; notInSix: boolean }
  | { kind: "window"; window: TaskWindow }
  | { kind: "due"; task: Task }
  | { kind: "unread"; day: string; unread: readonly UnreadSession[] };

/** The sheet for what was tapped; going to a course, exam or Task closes it first. */
export function DetailSheet({ picked, onClose }: { picked: Picked | null; onClose: () => void }) {
  return (
    <Sheet open={picked !== null} onClose={onClose} testID="sheet.class">
      {picked?.kind === "class" && <ClassDetails item={picked.item} onLeave={onClose} />}
      {picked?.kind === "meeting" && <MeetingDetails meeting={picked.meeting} notInSix={picked.notInSix} onLeave={onClose} />}
      {picked?.kind === "window" && <WindowDetails window={picked.window} onLeave={onClose} />}
      {picked?.kind === "due" && <DueDetails task={picked.task} onLeave={onClose} />}
      {picked?.kind === "unread" && <UnreadDetails day={picked.day} unread={picked.unread} />}
    </Sheet>
  );
}

// ---------------------------------------------------------------- parts

function Head({ code, kind, title, world }: { code: string; kind: string; title: string; world: ScheduleWorld }) {
  return (
    <View>
      <Meta size="small" tone="muted">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <CourseDot color={world.color(code)} size={8} />
          <Text size="small" weight="semibold" tabular>
            {code}
          </Text>
        </View>
        {kind}
      </Meta>
      <Text size="title" weight="semibold" accessibilityRole="header" style={{ marginTop: space[1] }}>
        {title}
      </Text>
    </View>
  );
}

function Fact({ icon, tone = "fg", children }: { icon: (color: string) => ReactNode; tone?: "fg" | "warning" | "success"; children: ReactNode }) {
  const theme = useTheme();
  const color = tone === "warning" ? theme.color.warningFg : tone === "success" ? theme.color.successFg : theme.color.muted;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2.5] }}>
      <View style={{ width: 18, alignItems: "center", paddingTop: 2 }}>{icon(color)}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof children === "string" ? (
          <Text size="body" tone={tone}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return <View style={{ marginTop: space[4], gap: space[2.5] }}>{children}</View>;
}

/** The sheet's buttons, full width at its bottom, the main one last (nearest the thumb). */
function Actions({ children }: { children: ReactNode }) {
  return <View style={{ marginTop: space[5], marginBottom: space[2], gap: space[2] }}>{children}</View>;
}

/** Where the course's attendance counts, and what's left: "Kehadiran dihitung di SIX · Sisa jatah absen 1×". */
function AttendanceFact({ code, world }: { code: string; world: ScheduleWorld }) {
  const t = useT();
  const health = world.health(code);
  if (!health || health.countedIn === "unknown") return null;
  return (
    <Fact icon={(color) => <Icons.Hand size={16} color={color} />}>
      <Text size="body">{t(`schedule.countedIn.${health.countedIn}`)}</Text>
      {health.state !== "unknown" && (
        <Text size="body" weight="semibold" tone={toneOf(STATE_TONE[health.state])}>
          {budgetLabel(t, health)}
        </Text>
      )}
    </Fact>
  );
}

/** SIX shows Tandai Hadir in this class now (as the app last read its popup): the way to press it in SIX. */
function OpenCheckIn({ item, onLeave }: { item: ScheduledClass; onLeave: () => void }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const world = useWorld();
  const checkIns = useDataset("six.checkIn");
  const student = useDataset("six.student");
  const openCheckIn = useOpenCheckIn();
  const { session } = item;
  if (!student || checkIns?.[session.id]?.state !== "open" || !checkingIn(session, world.now)) return null;
  return (
    <View style={{ marginTop: space[4], borderRadius: radius.lg, backgroundColor: theme.color.successBg, padding: space[3], gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <LiveDot />
        <Text size="body" weight="semibold" tone="success" style={{ flex: 1 }}>
          {t("home.now.checkInOpen")}
        </Text>
      </View>
      <Text size="small" tone="success">
        {t("presence.checkIn.class", { code: session.courseCode, time: f.time(session.end) })}
      </Text>
      <Button
        variant="primary"
        icon={<Icons.ArrowUpRight size={16} color={theme.color.onAccent} />}
        // The sheet goes first: SIX's page opens as a screen of its own, which a sheet would stay over.
        onPress={() => {
          onLeave();
          openCheckIn(session.id, sixTimetableUrl(student, session.start));
        }}
        label={t("home.now.openSixLabel", { course: session.courseCode })}
        testID="action.checkIn"
      >
        {t("home.now.openSix")}
      </Button>
    </View>
  );
}

/** An Edunex Presence window open now: until when, and the button that opens the place in Edunex where it counts. */
function OpenPresence({ code, start, world }: { code: string; start: number; world: ScheduleWorld }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const open = useOpenExternal();
  const window = openWindow(world, code, start);
  if (!window) return null;
  const action = presenceAction(window, world.tasks);
  return (
    <View style={{ marginTop: space[4], borderRadius: radius.lg, backgroundColor: theme.color.successBg, padding: space[3], gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <LiveDot />
        <Text size="body" weight="semibold" tone="success" style={{ flex: 1 }}>
          {t("schedule.presenceOpen", { time: f.time(window.closesAt) })}
        </Text>
      </View>
      <Text size="small" tone="success" tabular>
        {t("schedule.presenceOpen.closes", { time: f.countdown(window.closesAt) })}
      </Text>
      <Button
        variant="primary"
        icon={<Icons.ArrowUpRight size={16} color={theme.color.onAccent} />}
        onPress={() => open(action.url)}
        testID="action.recordPresence"
      >
        {t("schedule.record")}
      </Button>
    </View>
  );
}

function JoinButton({ link, primary = false }: { link: string; primary?: boolean }) {
  const t = useT();
  const theme = useTheme();
  const open = useOpenExternal();
  return (
    <Button
      variant={primary ? "primary" : "secondary"}
      icon={<Icons.Video size={16} color={primary ? theme.color.onAccent : theme.color.fg} />}
      onPress={() => open(link)}
      testID="action.join"
    >
      {t("schedule.join")}
    </Button>
  );
}

/** A button that leaves Jadwal: the sheet closes first, so Back comes back to the schedule. */
function GoButton({ primary, onPress, testID, children }: { primary: boolean; onPress: () => void; testID: string; children: string }) {
  const theme = useTheme();
  return (
    <Button variant={primary ? "primary" : "secondary"} onPress={onPress} testID={testID}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Text size="small" weight="semibold" style={{ color: primary ? theme.color.onAccent : theme.color.fg }}>
          {children}
        </Text>
        <Icons.ArrowRight size={14} color={primary ? theme.color.onAccent : theme.color.fg} />
      </View>
    </Button>
  );
}

function OpenCourse({ code, primary = false, onLeave }: { code: string; primary?: boolean; onLeave: () => void }) {
  const t = useT();
  const { go } = useNav();
  return (
    <GoButton
      primary={primary}
      testID="action.openCourse"
      onPress={() => {
        onLeave();
        go({ screen: "course", code });
      }}
    >
      {t("schedule.openCourse")}
    </GoButton>
  );
}

// ---------------------------------------------------------------- what each row says

/** A class or an exam session on SIX's timetable. */
function ClassDetails({ item, onLeave }: { item: ScheduledClass; onLeave: () => void }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const { go } = useNav();
  const checkIns = useDataset("six.checkIn");
  const { session, exam, moved, extra, overlaps, uncertain } = item;
  const code = session.courseCode;
  const live = session.start <= world.now && world.now < session.end;
  const lecturer = world.lecturer(code);
  const examId = exam ? world.examId(session.id) : undefined;
  const presenceOpen = openWindow(world, code, session.start) !== null;
  const checkInOpen = checkIns?.[session.id]?.state === "open" && checkingIn(session, world.now);
  return (
    <>
      <Head code={code} kind={session.activity} title={world.name(code, session.courseName)} world={world} />
      <Facts>
        <Fact icon={(color) => <Icons.Clock size={16} color={color} />}>
          <Text size="body" tabular>
            {`${f.dateLong(session.start)}  ·  ${timeRange(f, session.start, session.end)}`}
            {exam ? (
              <Text size="body" tone="muted">
                {`  ·  ${t("exam.length", { minutes: Math.round((session.end - session.start) / 60_000) })}`}
              </Text>
            ) : null}
          </Text>
          {live && (
            <Text size="body" weight="semibold" tone="success">
              {t("schedule.live")}
            </Text>
          )}
        </Fact>
        <Fact icon={(color) => <Icons.MapPin size={16} color={color} />}>
          {session.room ? (
            <Text size={exam ? "title" : "body"} weight={exam ? "semibold" : "regular"}>
              {session.room}
            </Text>
          ) : (
            <Text size="body" tone="muted">
              {t("schedule.room.none")}
            </Text>
          )}
        </Fact>
        {lecturer && <Fact icon={(color) => <Icons.User size={16} color={color} />}>{lecturer}</Fact>}
        {uncertain && (
          <Fact icon={(color) => <Icons.Info size={16} color={color} />} tone="warning">
            <Text size="body" tone="warning">
              <Text size="body" tone="warning" weight="semibold">
                {t("schedule.uncertain.during", { period: periodName(t, uncertain) })}
              </Text>{" "}
              {t("schedule.uncertain.check")}
            </Text>
          </Fact>
        )}
        {moved && <MovedFacts item={item} />}
        {extra && (
          <Fact icon={(color) => <Icons.Plus size={16} color={color} />} tone="warning">
            {t("schedule.extra")}
          </Fact>
        )}
        {overlaps.map((o) => (
          <Fact key={o.code} icon={(color) => <Icons.Overlap size={16} color={color} />} tone="warning">
            <Text size="body" weight="semibold" tone="warning">
              {t("schedule.overlapWith", { code: o.code, from: f.time(o.from), to: f.time(o.to) })}
            </Text>
          </Fact>
        ))}
        {!exam && <AttendanceFact code={code} world={world} />}
      </Facts>
      {!exam && <OpenCheckIn item={item} onLeave={onLeave} />}
      {!exam && <OpenPresence code={code} start={session.start} world={world} />}
      <Actions>
        <OpenCourse code={code} primary={!exam && !presenceOpen && !checkInOpen} onLeave={onLeave} />
        {exam && examId && (
          <GoButton
            primary
            testID="action.openExam"
            onPress={() => {
              onLeave();
              go({ screen: "exam", examId });
            }}
          >
            {t("schedule.openExam")}
          </GoButton>
        )}
      </Actions>
    </>
  );
}

function MovedFacts({ item }: { item: ScheduledClass }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const moved = item.moved!;
  const usual = `${clockOf(moved.usual.start)}–${clockOf(moved.usual.end)}`;
  // Noon WIB of that weekday this week: the same weekday in any time zone.
  const day = f.weekday(Date.parse(`${weekDays(world.now)[moved.usual.weekday]}T12:00:00+07:00`));
  return (
    <>
      {moved.kinds.includes("time") && (
        <Fact icon={(color) => <Icons.History size={16} color={color} />} tone="warning">
          {t("schedule.moved.time", { usual })}
        </Fact>
      )}
      {moved.kinds.includes("day") && (
        <Fact icon={(color) => <Icons.History size={16} color={color} />} tone="warning">
          {t("schedule.moved.day", { day, usual })}
        </Fact>
      )}
      {moved.kinds.includes("room") && moved.usual.room && (
        <Fact icon={(color) => <Icons.MapPin size={16} color={color} />} tone="warning">
          {t("schedule.moved.room", { room: moved.usual.room })}
        </Fact>
      )}
    </>
  );
}

/** A meeting Edunex knows: announced only in Edunex (SIX's timetable for that month doesn't list it), or, without SIX, any. */
function MeetingDetails({ meeting, notInSix, onLeave }: { meeting: OutsideMeeting | EdunexMeeting; notInSix: boolean; onLeave: () => void }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const kind = meeting.number !== null ? t("schedule.meeting", { n: meeting.number }) : t("schedule.meetingEdunex");
  const lecturer = world.lecturer(meeting.code);
  return (
    <>
      <Head code={meeting.code} kind={kind} title={world.name(meeting.code)} world={world} />
      <Facts>
        <Fact icon={(color) => <Icons.Clock size={16} color={color} />}>
          <Text size="body" tabular>
            {`${f.dateLong(meeting.start)}  ·  ${timeRange(f, meeting.start, meeting.end)}`}
          </Text>
        </Fact>
        <Fact icon={(color) => (meeting.online ? <Icons.Video size={16} color={color} /> : <Icons.MapPin size={16} color={color} />)}>
          {meeting.online ? (
            t("schedule.online")
          ) : (
            <Text size="body" tone="muted">
              {notInSix ? t("schedule.room.none") : t("schedule.room.fromSix")}
            </Text>
          )}
        </Fact>
        {lecturer && <Fact icon={(color) => <Icons.User size={16} color={color} />}>{lecturer}</Fact>}
        {notInSix && (
          <Fact icon={(color) => <Icons.Info size={16} color={color} />} tone="warning">
            {t("schedule.notInSix.long")}
          </Fact>
        )}
        <AttendanceFact code={meeting.code} world={world} />
      </Facts>
      <OpenPresence code={meeting.code} start={meeting.start} world={world} />
      <Actions>
        <OpenCourse code={meeting.code} primary={!meeting.link} onLeave={onLeave} />
        {meeting.link && <JoinButton link={meeting.link} primary />}
      </Actions>
    </>
  );
}

/** Presence by handing in a Task: hand it in inside the window to be counted present. */
function WindowDetails({ window, onLeave }: { window: TaskWindow; onLeave: () => void }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const { go } = useNav();
  const { presence, task, six, code } = window;
  const status = task ? taskStatus(task, world.now) : null;
  return (
    <>
      <Head code={code} kind={t("schedule.window.kind")} title={handInLabel(t, f, window)} world={world} />
      <Facts>
        <Fact icon={(color) => <Icons.Clock size={16} color={color} />}>
          <Text size="body" tabular>
            {`${f.dateLong(presence.opensAt)}  ·  ${timeRange(f, presence.opensAt, presence.closesAt)}`}
          </Text>
          <Text size="small" tone="muted">
            {t("schedule.window.only")}
          </Text>
        </Fact>
        {six && (
          <Fact icon={(color) => <Icons.Calendar size={16} color={color} />}>
            <Text size="body" tone="muted">
              {t("schedule.window.six", { time: timeRange(f, six.start, six.end) })}
            </Text>
          </Fact>
        )}
        {presence.recorded?.present && (
          <Fact icon={(color) => <Icons.CheckCircle size={16} color={color} />} tone="success">
            {t("schedule.window.recorded")}
          </Fact>
        )}
        {status && !presence.recorded?.present && (
          <Fact icon={(color) => <Icons.Upload size={16} color={color} />}>
            <View style={{ alignSelf: "flex-start" }}>
              <StatusChip status={status} />
            </View>
          </Fact>
        )}
      </Facts>
      <Actions>
        <OpenCourse code={code} primary={!task} onLeave={onLeave} />
        {task && (
          <GoButton
            primary={isOpenStatus(status!)}
            testID="action.openTask"
            onPress={() => {
              onLeave();
              go({ screen: "task", taskId: task.id });
            }}
          >
            {t("schedule.openTask")}
          </GoButton>
        )}
      </Actions>
    </>
  );
}

/** A Task's deadline. */
function DueDetails({ task, onLeave }: { task: Task; onLeave: () => void }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const { go } = useNav();
  const status = taskStatus(task, world.now);
  return (
    <>
      <Head code={task.courseCode} kind={t("schedule.due.kind")} title={task.title} world={world} />
      <Facts>
        <Fact icon={(color) => <Icons.Clock size={16} color={color} />}>
          <Text size="body" tabular>
            {f.dueLabel(task.dueAt!)}
          </Text>
          <Text size="small" tone="muted">
            {f.fromNow(task.dueAt!)}
          </Text>
        </Fact>
        <Fact icon={(color) => <Icons.BookOpen size={16} color={color} />}>{world.name(task.courseCode)}</Fact>
        {status !== "not_started" && (
          <Fact icon={(color) => <Icons.Upload size={16} color={color} />}>
            <View style={{ alignSelf: "flex-start" }}>
              <StatusChip status={status} />
            </View>
          </Fact>
        )}
      </Facts>
      <Actions>
        <GoButton
          primary
          testID="action.openTask"
          onPress={() => {
            onLeave();
            go({ screen: "task", taskId: task.id });
          }}
        >
          {t("schedule.openTask")}
        </GoButton>
      </Actions>
    </>
  );
}

/** A day's meetings SIX shows that the app couldn't read: each as SIX writes it, and SIX's timetable for that month. */
function UnreadDetails({ day, unread }: { day: string; unread: readonly UnreadSession[] }) {
  const t = useT();
  const count = unread.length;
  return (
    <>
      <Text size="title" weight="semibold" accessibilityRole="header">
        {t("schedule.unread.title", { count })}
      </Text>
      <Text size="small" tone="muted" style={{ marginTop: space[1] }}>
        {t("schedule.unread.hint", { count })}
      </Text>
      <View style={{ marginTop: space[3], gap: space[1] }}>
        {unread.map((one) => (
          <Text key={one.row} size="caption" tone="muted">
            {one.row}
          </Text>
        ))}
      </View>
      <Actions>
        <OpenSixTimetable day={day} primary />
      </Actions>
    </>
  );
}
