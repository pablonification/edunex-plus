// What needs the Student now, on Kuliah (round 2, v4; src/app/screens/presence.tsx's NowZone), each said once and
// only while there's something to do: Tandai Hadir open, an Edunex window open that may count, SIX's count that didn't
// go up after a class, and a clash today with which class to go to. Each a card or a row with its one action; the
// reasons are one tap deeper (the clash's sheet). Signing in to SIX is Kuliah's card instead (./lead.tsx). What SIX
// counted today is a tick on its course's row; a class that may not run is said on its course's page.
import { useState } from "react";
import { View } from "react-native";
import type { Attendance, OpenWindow } from "../../../../src/app/attendance";
import { useActionLabel } from "../../../../src/app/attendance-labels";
import { useOpenCheckIn, useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import { useDataset } from "../../../../src/app/store";
import { type AttendanceHealth, clashPick } from "../../../../src/core/attendance";
import { sixTimetableUrl } from "../../../../src/core/links";
import type { ClassSession } from "../../../../src/core/models";
import { useNav } from "../../nav";
import { CountdownBar } from "../../parts/meter";
import { BigButton } from "../../ui/big-button";
import { Button } from "../../ui/controls";
import { PulseDot } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CardGroup, StatusChip, TileRow } from "../../ui/v4-list";
import { useCardStyle } from "../home/now";
import { shortName } from "../home/parts";
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
      {meta !== "" && (
        <Text size="bodyMedium" style={{ color: v.muted, marginTop: space[1] }}>
          {meta}
        </Text>
      )}
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
 * An Edunex window open now: what to do ("Isi Presensi", or the action itself) and when it closes, as the desktop's
 * card says it, with the way to do it and the time left. No system says whether the lecturer uses it, so it's never
 * optional. Without SIX (or before either has a count) nobody can say it counts: "belum pasti dihitung", and why under
 * the bar (the desktop's info button); without SIX its button is the quiet one.
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
  const names = useCourseNames();
  const { session, code, health, action } = window;
  const task = action.activity === "assignment" ? action.task : null;
  const noSix = health?.countedIn === "noSix";
  const notKnown = !noSix && health?.countedIn === "unknown";
  const time = f.time(session.closesAt);
  const iconColor = noSix ? v.fg : v.onBrand;
  const fill = action.activity === "course";
  const course = shortName(names(code, window.course?.name));
  return (
    <View style={[surface, { padding: space[4], gap: space[3] }]} testID={`card.presenceOpen.${code}`}>
      <LiveHead
        // A course's own Presence: the course is the card's title and "Isi Presensi" its button, the one name Beranda's
        // now card has for it too (round 4's council: one action, two names).
        title={fill ? course : actionLabel(window)}
        meta={factsLabel(!fill && course, (noSix || notKnown) && t("presence.open.maybe"))}
      />
      {/* The bar says how much is left, "tutup 09:30" beside it says when (round 3's fourth review: a bar with no words
          read as decoration); its spoken name has both. */}
      <CountdownBar
        opensAt={session.opensAt}
        closesAt={session.closesAt}
        now={now}
        text={t("presence.open.closes", { time })}
        label={factsLabel(t("presence.open.closes", { time }), t("presence.open.left", { time: f.countdown(session.closesAt) }))}
      />
      {(noSix || notKnown) && (
        <Text size="bodyMedium" style={{ color: v.muted }}>
          {t(noSix ? "presence.open.noSixWhy" : "presence.open.notKnownWhy")}
        </Text>
      )}
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
          {t(fill ? "presence.open.fill" : "presence.open.record")}
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
 * Two classes today at the same time: "Bentrok 16:00–16:30", the two courses by their short names (a code meant
 * nothing at a glance, round 3's fourth review), and "Pilih kelas" as a tonal button: its sheet says which to go to and
 * why ("Kalau hanya bisa hadir di salah satunya, pilih Ekonomi Infrastruktur …").
 */
function ClashRow({ clash, first }: { clash: Zone["clashes"][number]; first: boolean }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const [open, setOpen] = useState(false);
  const names = useCourseNames();
  const { a, b } = clash;
  const short = (code: string) => shortName(names(code, code === a.course.code ? a.course.name : b.course.name));
  const time = f.timeRange(clash.from, clash.to);
  const whole = t("presence.clash.today", { a: short(a.course.code), b: short(b.course.code), time });
  const body = clashAnswer(t, a.health, b.health, short);
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
        meta={`${short(a.course.code)} · ${short(b.course.code)}`}
        // Which to go to is the row's action, so it looks like one: a tonal button opening the why, as the row does.
        status={
          pick && body ? (
            <Button variant="tonal" size="sm" onPress={() => setOpen(true)} testID="action.clashPick">
              {t("mobile.kuliah.clash.choose")}
            </Button>
          ) : pick ? (
            <StatusChip tone="brand">{t("mobile.kuliah.clash.pick", { code: short(pick) })}</StatusChip>
          ) : undefined
        }
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
