// Kuliah's "Hari ini" (the super-app round; src/app/screens/presence.tsx's NowZone), always there, so Presensi has a
// fixed place: while a Presence is open in Edunex or Tandai Hadir is open in SIX, the class-on-now block in the
// course's colour (the name whole over the block's width, then "tutup 09:30" and the kit's one presence button on the
// line under it: the same part as Beranda's); otherwise one quiet line that says what's true (the next class today
// and its time, that today's classes are over, or that there are none). Under it SIX's count that didn't go up after
// a class, and a clash today (the one clash sign, the time, the two courses; a tap says which class to go to and why). Signing in to SIX is
// Kuliah's line instead (./lead.tsx). Why a window may not count is in ⋮ ("Cara menghitung"), not under the line.
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import type { Attendance, OpenWindow } from "../../../../src/app/attendance";
import { useCourseColor } from "../../../../src/app/courses";
import { useOpenCheckIn, useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import { useDataset } from "../../../../src/app/store";
import { type AttendanceHealth, clashPick, isExamActivity } from "../../../../src/core/attendance";
import { wibDay } from "../../../../src/core/course-meetings";
import { sixTimetableUrl } from "../../../../src/core/links";
import type { ClassSession } from "../../../../src/core/models";
import { useNav } from "../../nav";
import { BigButton } from "../../ui/big-button";
import { Icons } from "../../ui/icons";
import { ClashMark, PresenceButton } from "../../ui/kit";
import { Appear, Tap } from "../../ui/moves";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, THEMES, useTheme } from "../../ui/theme";
import { shortName } from "../home/parts";
import { clashAnswer, dayLabel, type Zone } from "./logic";

/** Whether the zone has anything to do above the courses (a Presence, Tandai Hadir, a count to check, a clash). */
export const nowShown = (zone: Zone) => zone.checkIns.length + zone.windows.length + zone.results.length + zone.clashes.length > 0;

/** Whether "Hari ini" has something true to say: something to do, or a timetable to read today's classes from. */
export const todayShown = (zone: Zone, attendance: Attendance) => nowShown(zone) || attendance.schedule.length > 0;

export function NowZone({ zone, attendance, now }: { zone: Zone; attendance: Attendance; now: number }) {
  if (!todayShown(zone, attendance)) return null;
  return (
    <View>
      {zone.checkIns.length + zone.windows.length === 0 && attendance.schedule.length > 0 && <TodayLine sessions={attendance.schedule} now={now} />}
      {zone.checkIns.map((session) => (
        <OpenCheckIn key={session.id} session={session} />
      ))}
      {zone.windows.map((window) => (
        <OpenPresence
          key={window.session.id}
          window={window}
          // Where the class is, as Beranda's block says it ("R.SG PWK LT.6"): the class of this course on now.
          room={attendance.schedule.find((s) => s.courseCode === window.code && s.start <= now && s.end > now)?.room ?? null}
        />
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
 * "Hari ini" with nothing open, on one quiet line: the class on now ("… · selesai 10:00"), else the next class today
 * and its time, else that today's classes are over, or that there are none. A class named opens its course.
 */
function TodayLine({ sessions, now }: { sessions: readonly ClassSession[]; now: number }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const { go } = useNav();
  const names = useCourseNames();
  const day = wibDay(now);
  const todays = sessions.filter((s) => wibDay(s.start) === day && !isExamActivity(s.activity)).sort((a, b) => a.start - b.start);
  const next = todays.find((s) => s.end > now);
  const words = !next
    ? t(todays.length ? "mobile.kuliah.today.over" : "mobile.kuliah.today.none")
    : next.start <= now
      ? t("mobile.kuliah.today.live", { course: names(next.courseCode, undefined), time: f.time(next.end) })
      : t("mobile.kuliah.today.next", { course: names(next.courseCode, undefined), time: f.time(next.start) });
  const line = (
    <>
      <Icons.Clock size={20} color={v.fg2} />
      <Text size="bodyLarge" style={{ flex: 1, minWidth: 0, color: v.fg2 }}>
        {words}
      </Text>
    </>
  );
  const style = { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48, paddingVertical: space[1] } as const;
  if (!next)
    return (
      <View testID="line.coursesToday" accessible accessibilityLabel={words} style={style}>
        {line}
      </View>
    );
  return (
    <Tap feel="row" testID="line.coursesToday" accessibilityLabel={words} onPress={() => go({ screen: "course", code: next.courseCode })} style={style}>
      {line}
      <Icons.ChevronRight size={18} color={v.muted} />
    </Tap>
  );
}

/**
 * The class on now as a line: the block's small size (Beranda's and a course's page), in the course's own colour, white
 * on it in both themes. The course's name whole, over the block's width (two lines for a long one, never three beside
 * the button); under it the one time that matters ("tutup 09:30") and, at the line's end, the one presence button,
 * white. On a narrow line (font size 1.3) the button drops under the time. It comes and goes with the window (Appear).
 */
function PresenceLine({ code, name, meta, button, testID }: { code: string; name: string; meta: string; button: (ink: string) => ReactNode; testID: string }) {
  const v = useTheme().v4;
  const tone = useCourseColor();
  const fill = THEMES.light.courseTile(tone(code)).ink;
  const on = v.onHead;
  return (
    <Appear
      testID={testID}
      style={{
        backgroundColor: fill,
        borderRadius: 20,
        paddingVertical: space[3],
        paddingHorizontal: space[4],
        marginBottom: space[2],
      }}
    >
      <Text size="bodyLarge" face="display" weight="bold" numberOfLines={2} style={{ color: on, lineHeight: 22 }}>
        {name}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[3], rowGap: space[2], marginTop: space[2] }}>
        <Text size="bodyMedium" weight="medium" tabular style={{ color: on, flexGrow: 1, flexShrink: 1, flexBasis: 96, minWidth: 0 }}>
          {meta}
        </Text>
        {button(fill)}
      </View>
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
      name={names(session.courseCode, undefined)}
      meta={t("mobile.home.ends", { time: f.time(session.end) })}
      button={(ink) => (
        <PresenceButton
          label={t("mobile.notification.checkIn")}
          tone="course"
          ink={ink}
          onPress={() => openCheckIn(session.id, sixTimetableUrl(student, session.start))}
          accessibilityLabel={t("home.now.openSixLabel", { course: session.courseCode })}
          testID="action.checkIn"
        />
      )}
    />
  );
}

/**
 * An Edunex window open now: the course, "tutup 09:30" (and "belum pasti dihitung" while nobody can say it counts:
 * without SIX, or before either has a count), and "Isi Presensi", which opens it in Edunex. A Presence that is a Task
 * opens that Task instead.
 */
function OpenPresence({ window, room = null }: { window: OpenWindow; room?: string | null }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const { go } = useNav();
  const names = useCourseNames();
  const { session, code, health, action } = window;
  const task = action.activity === "assignment" ? action.task : null;
  const noSix = health?.countedIn === "noSix";
  const notKnown = !noSix && health?.countedIn === "unknown";
  const name = names(code, window.course?.name);
  return (
    <PresenceLine
      testID={`card.presenceOpen.${code}`}
      code={code}
      name={name}
      meta={[room, t("presence.open.closes", { time: f.time(session.closesAt) }), (noSix || notKnown) && t("presence.open.maybe")].filter(Boolean).join(" · ")}
      button={(ink) =>
        task ? (
          <PresenceButton
            label={t("presence.open.task")}
            icon="ListChecks"
            tone="course"
            ink={ink}
            onPress={() => go({ screen: "task", taskId: task.id })}
            testID="action.presenceTask"
          />
        ) : (
          <PresenceButton tone="course" ink={ink} onPress={() => open(action.url)} accessibilityLabel={t("mobile.kuliah.presenceLabel", { course: name })} />
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
 * Two classes today at the same time: the clash sign ("Bentrok", as on Beranda and Jadwal) with the time, then the two
 * courses, each name whole on its own line. A tap opens which to go to and why ("Kalau hanya bisa hadir di salah satunya,
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
  // With a pick but no why to open, the pick is said on the line itself. Else the two courses, each whole on its own
  // line (round 3: "the clash row cuts both course names").
  const lines =
    !body && pick ? [t("mobile.kuliah.clash.pick", { code: short(pick) })] : [names(a.course.code, a.course.name), names(b.course.code, b.course.name)];
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
          <ClashMark detail={time} />
          {lines.map((line) => (
            <Text key={line} size="bodyMedium" style={{ color: v.fg2, marginTop: 2 }}>
              {line}
            </Text>
          ))}
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
