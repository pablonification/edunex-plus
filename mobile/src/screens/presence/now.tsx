// What needs the Student now, at the top of Presensi (src/app/screens/presence.tsx's NowZone), each
// said once: signing in to SIX, Tandai Hadir open, an Edunex window open that may count, SIX's
// count that didn't go up after a class, today's receipt, a clash today with which class to go to,
// the exam-week note. On the phone each card's button sits under its words, within a thumb's reach.
import { View } from "react-native";
import type { Attendance, OpenWindow } from "../../../../src/app/attendance";
import { useActionLabel } from "../../../../src/app/attendance-labels";
import { useOpenCheckIn, useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import type { AttendanceHealth } from "../../../../src/core/attendance";
import { sixTimetableUrl } from "../../../../src/core/links";
import type { CalendarEvent, ClassSession } from "../../../../src/core/models";
import { useNav } from "../../nav";
import { CountdownBar } from "../../parts/meter";
import { useSignIn } from "../../shell/source-status";
import { Button } from "../../ui/controls";
import { Card, LiveDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta, Notice } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { clashAnswer, dayLabel, type Zone } from "./logic";

export function NowZone({ zone, attendance }: { zone: Zone; attendance: Attendance }) {
  const signIn = !attendance.sixConnected;
  const any =
    signIn ||
    zone.checkIns.length ||
    zone.windows.length ||
    zone.results.length ||
    zone.counted.length ||
    zone.countedLate.length ||
    zone.clashes.length ||
    zone.week !== null;
  if (!any) return null;
  return (
    <View style={{ gap: space[3] }}>
      {signIn && <SignInSix quiet={zone.windows.length > 0} />}
      {zone.checkIns.map((session) => (
        <OpenCheckIn key={session.id} session={session} />
      ))}
      {zone.windows.map((window) => (
        <OpenPresence key={window.session.id} window={window} />
      ))}
      {zone.results.map((result) => (
        <SixResult key={result.id} result={result} health={attendance.courses.find((c) => c.course.code === result.code)?.health} />
      ))}
      {(zone.counted.length > 0 || zone.countedLate.length > 0) && <Receipt counted={zone.counted} late={zone.countedLate} />}
      {zone.clashes.map((clash) => (
        <ClashCard key={`${clash.a.course.code}-${clash.b.course.code}`} clash={clash} />
      ))}
      {zone.week && <WeekNote event={zone.week.event} />}
    </View>
  );
}

/** Signed out of SIX, with nothing of it kept: where the count comes from, and the way in. */
function SignInSix({ quiet }: { quiet: boolean }) {
  const t = useT();
  const { signIn, busy } = useSignIn();
  return (
    <Card variant="raised" style={{ padding: space[4], gap: space[3] }}>
      <View>
        <Text size="title" weight="semibold">
          {t("presence.answer.noSix")}
        </Text>
        <Text size="small" tone="muted" style={{ marginTop: space[1] }}>
          {`${t("presence.noSix.hint")} ${t("presence.noSix.noWatch")}`}
        </Text>
      </View>
      <Button variant={quiet ? "secondary" : "primary"} busy={busy} onPress={() => void signIn("six")} testID="action.signInSix">
        {t("presence.signInSix")}
      </Button>
    </Card>
  );
}

/** A class where SIX shows "Tandai Hadir" now (as the app last read its popup), with the way to press it. */
function OpenCheckIn({ session }: { session: ClassSession }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const openCheckIn = useOpenCheckIn();
  const student = useDataset("six.student");
  if (!student) return null;
  return (
    <Card variant="raised" style={{ padding: space[4], gap: space[3] }} testID="card.checkIn">
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <LiveDot />
          <Text size="title" weight="semibold" style={{ flex: 1 }}>
            {t("home.now.checkInOpen")}
          </Text>
        </View>
        <View style={{ marginTop: space[1] }}>
          <Meta>{t("presence.checkIn.class", { code: session.courseCode, time: f.time(session.end) })}</Meta>
        </View>
      </View>
      <Button
        variant="primary"
        icon={<Icons.ArrowUpRight size={16} color={theme.color.onAccent} />}
        onPress={() => openCheckIn(session.id, sixTimetableUrl(student, session.start))}
        label={t("home.now.openSixLabel", { course: session.courseCode })}
        testID="action.checkIn"
      >
        {t("home.now.openSix")}
      </Button>
    </Card>
  );
}

/**
 * An Edunex window open now that may count: "Kumpulkan Tugas 02 Bab II sebelum 23:59", with the way
 * to do it and the time left. Without SIX nobody can say it counts: worth doing just in case, so
 * said calmly, its button quiet.
 */
function OpenPresence({ window }: { window: OpenWindow }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const open = useOpenExternal();
  const { go } = useNav();
  const actionLabel = useActionLabel();
  const { session, code, health, action } = window;
  const task = action.activity === "assignment" ? action.task : null;
  const noSix = health?.countedIn === "noSix";
  const where = noSix ? "presence.open.noSix" : health?.countedIn === "unknown" ? "presence.open.notKnown" : "presence.open.counts";
  const iconColor = noSix ? theme.color.fg : theme.color.onAccent;
  return (
    <Card variant="raised" style={{ padding: space[4], gap: space[3] }} testID={`card.presenceOpen.${code}`}>
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <LiveDot />
          <Text size="title" weight="semibold" style={{ flex: 1 }}>
            {t("presence.open.do", { action: actionLabel(window), time: f.time(session.closesAt) })}
          </Text>
        </View>
        <View style={{ marginTop: space[1] }}>
          <Meta>{t(where, { code })}</Meta>
        </View>
      </View>
      <CountdownBar opensAt={session.opensAt} closesAt={session.closesAt} now={now} label={t("presence.open.left", { time: f.countdown(session.closesAt) })} />
      {task ? (
        <Button
          variant={noSix ? "secondary" : "primary"}
          icon={<Icons.ArrowRight size={16} color={iconColor} />}
          onPress={() => go({ screen: "task", taskId: task.id })}
          testID="action.presenceTask"
        >
          {t("presence.open.task")}
        </Button>
      ) : (
        <Button
          variant={noSix ? "secondary" : "primary"}
          icon={<Icons.ArrowUpRight size={16} color={iconColor} />}
          onPress={() => open(action.url)}
          testID="action.presenceRecord"
        >
          {t("presence.open.record")}
        </Button>
      )}
    </Card>
  );
}

/** SIX's count didn't go up after a class: marked absent (red) or not counted yet (amber), who fixes it, and by when. */
function SixResult({ result, health }: { result: Zone["results"][number]; health: AttendanceHealth | undefined }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const student = useDataset("six.student");
  const today = f.dayOffset(result.start) === 0;
  const vars = { code: result.code, day: dayLabel(f, result.start) };
  const title = result.absent
    ? t(today ? "presence.six.absent" : "presence.six.absentOn", vars)
    : t(today ? "presence.six.missing" : "presence.six.missingOn", vars);
  const body =
    result.absent && health?.state === "out"
      ? t("presence.six.absentOut", { code: result.code, target: health.target })
      : t("alert.six.body", { attended: health?.attended ?? 0, held: health?.held ?? 0 });
  return (
    <Notice
      tone={result.absent ? "danger" : "warning"}
      title={title}
      testID={`note.sixResult.${result.code}`}
      action={
        student ? (
          <Button size="sm" icon={<Icons.ArrowUpRight size={14} />} onPress={() => open(sixTimetableUrl(student, result.start))}>
            {t("presence.checkSix")}
          </Button>
        ) : undefined
      }
    >
      {body}
    </Notice>
  );
}

/** "PL3002, PL3032 dan KU5014 sudah dihitung di SIX hari ini.": the classes SIX counted today, one quiet line. */
function Receipt({ counted, late }: { counted: string[]; late: string[] }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const lines = [
    ...(counted.length ? [t("presence.six.counted", { codes: f.list(counted) })] : []),
    ...late.map((code) => t("presence.six.countedLate", { code })),
  ];
  return (
    <View style={{ gap: space[1] }}>
      {lines.map((line) => (
        <View key={line} style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
          <View style={{ paddingTop: 3 }}>
            <Icons.CheckCircle size={14} weight="bold" color={theme.color.successFg} />
          </View>
          <Text size="small" tone="muted" style={{ flex: 1 }}>
            {line}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Two classes today at the same time: when, and which to go to if the Student can make only one, with why. */
function ClashCard({ clash }: { clash: Zone["clashes"][number] }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const body = clashAnswer(t, clash.a.health, clash.b.health);
  return (
    <Card style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3], padding: space[4] }} testID="card.clash">
      <View style={{ paddingTop: 3 }}>
        <Icons.Overlap size={16} weight="bold" color={theme.color.warningFg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="body" weight="semibold">
          {t("presence.clash.today", { a: clash.a.course.code, b: clash.b.course.code, time: f.timeRange(clash.from, clash.to) })}
        </Text>
        {body && (
          <Text size="small" tone="muted" style={{ marginTop: 2 }}>
            {body}
          </Text>
        )}
      </View>
    </Card>
  );
}

/** Classes in an exam week (or on a holiday) that SIX still lists: said once for every course. */
function WeekNote({ event }: { event: CalendarEvent }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const period = t(event.kind === "uts" ? "presence.period.uts" : event.kind === "uas" ? "presence.period.uas" : "presence.period.off");
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
      <View style={{ paddingTop: 3 }}>
        <Icons.GraduationCap size={14} weight="bold" color={theme.color.sourceItbFg} />
      </View>
      <Text size="small" tone="muted" style={{ flex: 1 }}>
        {t("presence.weekNote", { period, range: f.dayRange(event.firstDay, event.lastDay) })}
      </Text>
    </View>
  );
}
