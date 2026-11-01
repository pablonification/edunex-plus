// What needs the Student now, on Kuliah (round 2, v4; src/app/screens/presence.tsx's NowZone), each said once and
// only while there's something to do: Tandai Hadir open, an Edunex window open that may count, SIX's count that didn't
// go up after a class, and a clash today with which class to go to. Each a card or a row with its one action; the
// reasons are one tap deeper (the clash's sheet). Signing in to SIX is Kuliah's lead card instead (./lead.tsx). The
// quiet facts (SIX counted today's classes; classes in an exam week that may not run) go under the courses (NowNotes).
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import type { Attendance, OpenWindow } from "../../../../src/app/attendance";
import { useActionLabel } from "../../../../src/app/attendance-labels";
import { useOpenCheckIn, useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { type AttendanceHealth, clashPick } from "../../../../src/core/attendance";
import { sixTimetableUrl } from "../../../../src/core/links";
import type { CalendarEvent, ClassSession } from "../../../../src/core/models";
import { useNav } from "../../nav";
import { CountdownBar } from "../../parts/meter";
import { BigButton } from "../../ui/big-button";
import { PulseDot } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CardGroup, StatusChip, TileRow } from "../../ui/v4-list";
import { useCardStyle } from "../home/now";
import { clashAnswer, dayLabel, type Zone } from "./logic";

/** Whether the zone has anything to show above the courses. */
export const nowShown = (zone: Zone) => zone.checkIns.length + zone.windows.length + zone.results.length + zone.clashes.length > 0;

export function NowZone({ zone, attendance }: { zone: Zone; attendance: Attendance }) {
  if (!nowShown(zone)) return null;
  return (
    <View style={{ gap: space[3] }}>
      {zone.checkIns.map((session) => (
        <OpenCheckIn key={session.id} session={session} />
      ))}
      {zone.windows.map((window) => (
        <OpenPresence key={window.session.id} window={window} />
      ))}
      {zone.results.map((result) => (
        <SixResult key={result.id} result={result} health={attendance.courses.find((c) => c.course.code === result.code)?.health} />
      ))}
      {zone.clashes.length > 0 && (
        <CardGroup testID="card.clash">
          {zone.clashes.map((clash, i) => (
            <ClashRow key={`${clash.a.course.code}-${clash.b.course.code}`} clash={clash} first={i === 0} />
          ))}
        </CardGroup>
      )}
    </View>
  );
}

/** The quiet facts, said once under the courses: what SIX counted today, and an exam week's classes that may not run. */
export function NowNotes({ zone }: { zone: Zone }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const lines = [
    ...(zone.counted.length ? [t("presence.six.counted", { codes: f.list(zone.counted) })] : []),
    ...zone.countedLate.map((code) => t("presence.six.countedLate", { code })),
  ];
  if (!lines.length && !zone.week) return null;
  return (
    <View style={{ gap: space[2], paddingHorizontal: space[1] }}>
      {lines.map((line) => (
        <Quiet key={line} icon={<Icons.CheckCircle size={16} weight="fill" color={v.okFg} />}>
          {line}
        </Quiet>
      ))}
      {zone.week && <WeekNote event={zone.week.event} />}
    </View>
  );
}

function Quiet({ icon, children }: { icon: ReactNode; children: string }) {
  const v = useTheme().v4;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
      <View style={{ paddingTop: 2 }}>{icon}</View>
      <Text size="bodyMedium" style={{ color: v.muted, flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/** A live card's head: the breathing dot, its title in the display face, and one meta line. */
function LiveHead({ title, meta }: { title: string; meta: string }) {
  const v = useTheme().v4;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <PulseDot color={v.live} />
        <Text size="titleMedium" face="display" weight="bold" style={{ color: v.fg, flex: 1, fontSize: 18 }}>
          {title}
        </Text>
      </View>
      <Text size="bodyMedium" style={{ color: v.muted, marginTop: space[1] }}>
        {meta}
      </Text>
    </View>
  );
}

/** A class where SIX shows "Tandai Hadir" now (as the app last read its popup), with the way to press it. */
function OpenCheckIn({ session }: { session: ClassSession }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const surface = useCardStyle();
  const openCheckIn = useOpenCheckIn();
  const student = useDataset("six.student");
  if (!student) return null;
  return (
    <View style={[surface, { padding: space[4], gap: space[3] }]} testID="card.checkIn">
      <LiveHead title={t("home.now.checkInOpen")} meta={t("presence.checkIn.class", { code: session.courseCode, time: f.time(session.end) })} />
      <BigButton
        icon={<Icons.Hand size={20} weight="fill" color={v.onBrand} />}
        onPress={() => openCheckIn(session.id, sixTimetableUrl(student, session.start))}
        label={t("home.now.openSixLabel", { course: session.courseCode })}
        testID="action.checkIn"
      >
        {t("home.now.openSix")}
      </BigButton>
    </View>
  );
}

/**
 * An Edunex window open now that may count: "Kumpulkan Tugas 02 Bab II sebelum 23:59", with the way to do it and the
 * time left. Without SIX nobody can say it counts: worth doing just in case, so its button is the quiet one.
 */
function OpenPresence({ window }: { window: OpenWindow }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const surface = useCardStyle();
  const open = useOpenExternal();
  const { go } = useNav();
  const actionLabel = useActionLabel();
  const { session, code, health, action } = window;
  const task = action.activity === "assignment" ? action.task : null;
  const noSix = health?.countedIn === "noSix";
  const where = noSix ? "presence.open.noSix" : health?.countedIn === "unknown" ? "presence.open.notKnown" : "presence.open.counts";
  const iconColor = noSix ? v.fg : v.onBrand;
  return (
    <View style={[surface, { padding: space[4], gap: space[3] }]} testID={`card.presenceOpen.${code}`}>
      <LiveHead title={t("presence.open.do", { action: actionLabel(window), time: f.time(session.closesAt) })} meta={t(where, { code })} />
      <CountdownBar opensAt={session.opensAt} closesAt={session.closesAt} now={now} label={t("presence.open.left", { time: f.countdown(session.closesAt) })} />
      {task ? (
        <BigButton
          variant={noSix ? "outline" : "filled"}
          icon={<Icons.ArrowRight size={18} color={iconColor} />}
          onPress={() => go({ screen: "task", taskId: task.id })}
          testID="action.presenceTask"
        >
          {t("presence.open.task")}
        </BigButton>
      ) : (
        <BigButton
          variant={noSix ? "outline" : "filled"}
          icon={<Icons.ArrowUpRight size={18} color={iconColor} />}
          onPress={() => open(action.url)}
          testID="action.presenceRecord"
        >
          {t("presence.open.record")}
        </BigButton>
      )}
    </View>
  );
}

/** SIX's count didn't go up after a class: marked absent (red) or not counted yet (amber), who fixes it, and by when. */
function SixResult({ result, health }: { result: Zone["results"][number]; health: AttendanceHealth | undefined }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
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
  const [bg, fg] = result.absent ? [v.redBg, v.redFg] : [v.ambBg, v.ambFg];
  return (
    <View testID={`note.sixResult.${result.code}`} style={{ backgroundColor: bg, borderRadius: 20, padding: space[4], gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
        <View style={{ paddingTop: 2 }}>
          <Icons.AlertTriangle size={20} weight="fill" color={fg} />
        </View>
        <View style={{ flex: 1, gap: space[1] }}>
          <Text size="bodyLarge" weight="semibold" style={{ color: fg }}>
            {title}
          </Text>
          <Text size="bodyMedium" style={{ color: v.fg2 }}>
            {body}
          </Text>
        </View>
      </View>
      {student && (
        <BigButton variant="outline" icon={<Icons.ArrowUpRight size={18} color={v.fg} />} onPress={() => open(sixTimetableUrl(student, result.start))}>
          {t("presence.checkSix")}
        </BigButton>
      )}
    </View>
  );
}

/**
 * Two classes today at the same time: "Bentrok 16:00–16:30", the two courses, and which to go to as the chip ("Pilih
 * PL3032"). The why ("Kalau hanya bisa hadir di salah satunya, …") is in its sheet.
 */
function ClashRow({ clash, first }: { clash: Zone["clashes"][number]; first: boolean }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const [open, setOpen] = useState(false);
  const { a, b } = clash;
  const time = f.timeRange(clash.from, clash.to);
  const whole = t("presence.clash.today", { a: a.course.code, b: b.course.code, time });
  const body = clashAnswer(t, a.health, b.health);
  const pick = clashPick(a.health, b.health).pick;
  return (
    <>
      <TileRow
        first={first}
        testID={`row.clash.${a.course.code}-${b.course.code}`}
        leading={
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: v.ambBg, alignItems: "center", justifyContent: "center" }}>
            <Icons.Overlap size={22} weight="bold" color={v.ambFg} />
          </View>
        }
        title={t("mobile.kuliah.clash.title", { time })}
        meta={`${a.course.code} · ${b.course.code}`}
        status={pick ? <StatusChip tone="brand">{t("mobile.kuliah.clash.pick", { code: pick })}</StatusChip> : undefined}
        onPress={body ? () => setOpen(true) : undefined}
        label={body ? `${whole}. ${body}` : whole}
      />
      {body && (
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          background={v.card}
          testID="sheet.clash"
          title={
            <Text size="titleLarge" face="display" weight="bold" accessibilityRole="header" style={{ color: v.fg }}>
              {whole}
            </Text>
          }
        >
          <Text size="bodyLarge" style={{ color: v.fg2, marginBottom: space[4] }}>
            {body}
          </Text>
        </Sheet>
      )}
    </>
  );
}

/** Classes in an exam week (or on a holiday) that SIX still lists: said once for every course. */
function WeekNote({ event }: { event: CalendarEvent }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const period = t(event.kind === "uts" ? "presence.period.uts" : event.kind === "uas" ? "presence.period.uas" : "presence.period.off");
  return (
    <Quiet icon={<Icons.GraduationCap size={16} weight="bold" color={v.muted} />}>
      {t("presence.weekNote", { period, range: f.dayRange(event.firstDay, event.lastDay) })}
    </Quiet>
  );
}
