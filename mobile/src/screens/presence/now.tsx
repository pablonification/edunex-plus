// What needs the Student now, on Kuliah (the super-app round; src/app/screens/presence.tsx's NowZone), each said once
// and only while there's something to do, each **one line** flat on the page: a Presence open in Edunex or Tandai Hadir
// open in SIX (the course, "tutup 09:30", and the one presence button, the same part as Beranda's: never a card titled
// "Isi Presensi" with a button named something else), SIX's count that didn't go up after a class, and a clash today
// (the one clash sign, the time, the two courses; a tap says which class to go to and why). Signing in to SIX is
// Kuliah's line instead (./lead.tsx). Why a window may not count is in ⋮ ("Cara menghitung"), not under the line.
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import type { Attendance, OpenWindow } from "../../../../src/app/attendance";
import { useOpenCheckIn, useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import { useDataset } from "../../../../src/app/store";
import { type AttendanceHealth, clashPick } from "../../../../src/core/attendance";
import { sixTimetableUrl } from "../../../../src/core/links";
import type { ClassSession } from "../../../../src/core/models";
import { useNav } from "../../nav";
import { BigButton } from "../../ui/big-button";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Appear, Tap } from "../../ui/moves";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { useCourseTile } from "../../ui/tile";
import { shortName } from "../home/parts";
import { ClashMark, PresenceButton } from "./kit-standin";
import { clashAnswer, dayLabel, type Zone } from "./logic";

/** Whether the zone has anything to show above the courses. */
export const nowShown = (zone: Zone) => zone.checkIns.length + zone.windows.length + zone.results.length + zone.clashes.length > 0;

export function NowZone({ zone, attendance }: { zone: Zone; attendance: Attendance }) {
  if (!nowShown(zone)) return null;
  return (
    <View>
      {zone.checkIns.map((session) => (
        <OpenCheckIn key={session.id} session={session} />
      ))}
      {zone.windows.map((window) => (
        <OpenPresence key={window.session.id} window={window} />
      ))}
      {zone.results.map((result) => (
        <View key={result.id} style={{ marginVertical: space[2] }}>
          <SixResult result={result} health={attendance.courses.find((c) => c.course.code === result.code)?.health} />
        </View>
      ))}
      {zone.clashes.map((clash) => (
        <ClashRow key={`${clash.a.course.code}-${clash.b.course.code}`} clash={clash} />
      ))}
    </View>
  );
}

/**
 * One line for a class whose attendance can be marked now: a dot in the course's colour, its name, when the window
 * closes under it, and the one presence button at its end. It comes and goes with the window (Appear).
 */
function PresenceLine({ code, name, meta, button, testID }: { code: string; name: string; meta: string; button: ReactNode; testID: string }) {
  const v = useTheme().v4;
  const { ink } = useCourseTile()(code);
  return (
    <Appear testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 64, paddingVertical: space[2] }}>
      <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: ink }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="bodyLarge" weight="semibold" numberOfLines={2} style={{ color: v.fg, lineHeight: 21 }}>
          {name}
        </Text>
        <Text size="bodyMedium" tabular style={{ color: v.fg2, marginTop: 2 }}>
          {meta}
        </Text>
      </View>
      {button}
    </Appear>
  );
}

/** A class where SIX shows "Tandai Hadir" now (as the app last read its popup): the same line, SIX's own word. */
function OpenCheckIn({ session }: { session: ClassSession }) {
  const t = useT();
  const f = useFormat();
  const names = useCourseNames();
  const openCheckIn = useOpenCheckIn();
  const student = useDataset("six.student");
  if (!student) return null;
  return (
    <PresenceLine
      testID="card.checkIn"
      code={session.courseCode}
      name={shortName(names(session.courseCode, undefined))}
      meta={t("mobile.kuliah.classUntil", { time: f.time(session.end) })}
      button={
        <PresenceButton
          onPress={() => openCheckIn(session.id, sixTimetableUrl(student, session.start))}
          label={t("home.now.openSixLabel", { course: session.courseCode })}
          testID="action.checkIn"
        >
          {t("mobile.notification.checkIn")}
        </PresenceButton>
      }
    />
  );
}

/**
 * An Edunex window open now: the course, "tutup 09:30" (and "belum pasti dihitung" while nobody can say it counts:
 * without SIX, or before either has a count), and "Isi Presensi", which opens it in Edunex. A Presence that is a Task
 * opens that Task instead. Without SIX the button is the quiet one.
 */
function OpenPresence({ window }: { window: OpenWindow }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const { go } = useNav();
  const names = useCourseNames();
  const { session, code, health, action } = window;
  const task = action.activity === "assignment" ? action.task : null;
  const noSix = health?.countedIn === "noSix";
  const notKnown = !noSix && health?.countedIn === "unknown";
  const name = shortName(names(code, window.course?.name));
  return (
    <PresenceLine
      testID={`card.presenceOpen.${code}`}
      code={code}
      name={name}
      meta={factsLabel(t("presence.open.closes", { time: f.time(session.closesAt) }), (noSix || notKnown) && t("presence.open.maybe"))}
      button={
        task ? (
          <PresenceButton quiet={noSix} onPress={() => go({ screen: "task", taskId: task.id })} testID="action.presenceTask">
            {t("presence.open.task")}
          </PresenceButton>
        ) : (
          <PresenceButton quiet={noSix} onPress={() => open(action.url)} label={t("mobile.kuliah.presenceLabel", { course: name })}>
            {t("presence.open.fill")}
          </PresenceButton>
        )
      }
    />
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
 * Two classes today at the same time, on one line: the clash sign ("Bentrok", as on Beranda and Jadwal), the time, and
 * the two courses by their short names. A tap opens which to go to and why ("Kalau hanya bisa hadir di salah satunya,
 * pilih Ekonomi Infrastruktur …").
 */
function ClashRow({ clash }: { clash: Zone["clashes"][number] }) {
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
  // With a pick but no why to open, the pick is said on the line itself.
  const names2 = !body && pick ? t("mobile.kuliah.clash.pick", { code: short(pick) }) : `${short(a.course.code)} · ${short(b.course.code)}`;
  return (
    <>
      <Tap
        feel="row"
        testID={`row.clash.${a.course.code}-${b.course.code}`}
        onPress={body ? () => setOpen(true) : undefined}
        disabled={!body}
        accessibilityLabel={body ? `${whole}. ${body}` : whole}
        style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56, paddingVertical: space[2] }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: space[2] }}>
            <ClashMark />
            <Text size="bodyMedium" weight="semibold" tabular style={{ color: v.fg }}>
              {time}
            </Text>
          </View>
          <Text size="bodyMedium" style={{ color: v.fg2, marginTop: 2 }}>
            {names2}
          </Text>
        </View>
        {body && <Icons.ChevronRight size={18} color={v.muted} />}
      </Tap>
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
