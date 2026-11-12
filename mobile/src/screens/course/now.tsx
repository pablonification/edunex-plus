// What's on now or next in the course, above its tabs (src/app/screens/course.tsx's MeetingNow). While a class is on or
// an Edunex Presence window is open: the same block as Beranda's (../home/banner.tsx), in the course's colour, said
// once each: "Sekarang · room" with the breathing dot, what the class is, one plain bar with the one time that matters
// at its end ("tutup 09:30" while the Presence is the thing to do, else "selesai 10:00"), and one white button (the
// kit's presence button: "Isi Presensi" for Edunex, "Tandai Hadir" for SIX, the one closing first when both are open,
// the other once that one is done; else joining an online class). No second countdown, no second button. Otherwise,
// quiet rows flat on the page: windows still open from earlier classes, the next meeting, a class SIX shows that the
// app couldn't read.
import { type ReactNode, useEffect } from "react";
import { View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { useCourseColor } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import { useDataset, useStatus } from "../../../../src/app/store";
import { firstUnreadDay } from "../../../../src/core/attendance";
import { type Meeting, openPresences, pinnedMeeting } from "../../../../src/core/course-meetings";
import { edunexCourseUrl, sixTimetableUrl } from "../../../../src/core/links";
import type { PresenceSession } from "../../../../src/core/models";
import { dayNoon } from "../../../../src/core/schedule";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { PulseDot, Rise } from "../../ui/expressive";
import { haptic } from "../../ui/haptics";
import { Icons } from "../../ui/icons";
import { PlainBar, PresenceButton } from "../../ui/kit";
import { Text } from "../../ui/text";
import { space, THEMES, useTheme } from "../../ui/theme";
import { StatusChip, TileRow } from "../../ui/v4-list";
import { useCheckIn, useWentToCheckIn } from "../home/checked-in";
import { shortName } from "../home/parts";
import { FlatRows } from "./flat";
import { meetingModuleTitle, meetingTitle, pageModules } from "./meetings";

/**
 * What the part above the tabs shows: the class on now (or the window open, with its class), the next meeting, and the
 * other open windows. Pertemuan leaves those meetings out of its list (`shownAbove`): one fact, one place.
 */
function nowAndNext(page: CoursePage, now: number) {
  const pinned = pinnedMeeting(page.meetings, now);
  const windows = openPresences(page.presence ?? [], now);
  const current = pinned?.current ? pinned.meeting : null;
  // The card's window: the class going on has only its own; with no class on, the one closing first.
  const presence = current ? (windows.find((p) => p.id === current.presence?.id) ?? null) : (windows[0] ?? null);
  const meetingOf = (p: PresenceSession) => page.meetings.find((m) => m.presence?.id === p.id) ?? null;
  const meeting = current ?? (presence ? meetingOf(presence) : null);
  const next = pinned && !pinned.current && pinned.meeting !== meeting ? pinned.meeting : null;
  return { windows, current, presence, meeting, next, meetingOf };
}

/**
 * The module the block above the tabs names as its title (the class on now, or the open window's class), when it shows
 * one. Materi doesn't lead with that module again: one fact, one place.
 */
export function moduleSaidAbove(page: CoursePage, now: number): number | null {
  const { current, presence, meeting } = nowAndNext(page, now);
  if ((!current && !presence) || !meeting) return null;
  return pageModules(page).get(meeting.key)?.module.id ?? null;
}

/** The keys of the meetings the part above the tabs shows (the class on now, the next one, a window still open). */
export function shownAbove(page: CoursePage, now: number): ReadonlySet<string> {
  const { windows, meeting, next, meetingOf } = nowAndNext(page, now);
  return new Set([meeting, next, ...windows.map(meetingOf)].filter((m): m is Meeting => m !== null).map((m) => m.key));
}

export function MeetingNow({ page, rise }: { page: CoursePage; rise: string }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const open = useOpenExternal();
  const attendance = useAttendance();
  const mine = attendance?.courses.find((x) => x.course.code === page.course.code);
  const schedule = useDataset("six.schedule");
  const unread = useDataset("six.scheduleUnread");
  const modules = pageModules(page);
  const name = useCourseNames();
  const { windows, current, presence, meeting, next, meetingOf } = nowAndNext(page, now);
  const courseUrl = page.course.edunex ? edunexCourseUrl(page.course.edunex.courseId) : null;
  const linkOf = (m: Meeting) => (m.end > now ? (m.announced?.link ?? null) : null);

  // Windows still open from earlier classes, each with its class and its close; the row opens the window.
  const rows: ((first: boolean) => ReactNode)[] = windows
    .filter((p) => p !== presence)
    .map((p) => (first: boolean) => {
      const of = meetingOf(p);
      const href = p.url ?? courseUrl;
      const when = `${f.relativeDay(of?.start ?? p.start)}, ${f.timeRange(of?.start ?? p.start, of?.end ?? p.end)}`;
      return (
        <TileRow
          key={`p${p.id}`}
          first={first}
          leading={
            <Bare>
              <Icons.Hand size={20} color={v.muted} />
            </Bare>
          }
          title={t("course.presenceStillOpen")}
          meta={`${when} · ${t("mobile.course.presenceCloses", { time: f.dayTime(p.closesAt) })}`}
          onPress={href ? () => open(href) : undefined}
          label={`${t("course.presenceStillOpen")}, ${when}. ${t("course.recordInEdunex")}`}
          testID={`row.courseWindow.${p.id}`}
        />
      );
    });
  if (next) {
    const link = linkOf(next);
    const today = link !== null && f.dayOffset(next.start) === 0;
    const what = meetingModuleTitle(t, modules, next) ?? next.presence?.topic ?? next.six?.activity ?? null;
    const room = next.six?.room ?? "";
    const when = `${f.relativeDay(next.start)}, ${f.timeRange(next.start, next.end)}`;
    const rest = [
      next.announced?.online ? t("course.online") : "",
      // "Kuliah" is every class: only a topic says something.
      what && !/^kuliah$/i.test(what) ? what : "",
    ].filter(Boolean);
    const facts = [when, room ? t("mobile.course.room", { room }) : "", ...rest].filter(Boolean);
    // This class shares time with another course's (Jadwal marks it too): said on its row, in the clash's amber.
    const clash = mine?.clash && mine.clash.session.start === next.start ? mine.clash : null;
    const clashWords = clash ? t("mobile.course.ex.clash", { course: shortName(name(clash.other)) }) : "";
    rows.push((first) => (
      <TileRow
        key="next"
        first={first}
        leading={
          <Bare>
            <Icons.CalendarClock size={20} color={v.muted} />
          </Bare>
        }
        title={t("course.next")}
        // The room reads as one with a pin before it ("9134" alone read as a number); the clash, when there is one, under.
        meta={
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: space[2] }}>
              <Text size="bodyMedium" tabular style={{ color: v.muted }}>
                {when}
              </Text>
              {room !== "" && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                  <Icons.MapPin size={14} color={v.muted} />
                  <Text size="bodyMedium" tabular style={{ color: v.muted }}>
                    {room}
                  </Text>
                </View>
              )}
              {rest.length > 0 && (
                <Text size="bodyMedium" numberOfLines={1} style={{ color: v.muted, flexShrink: 1 }}>
                  {rest.join(" · ")}
                </Text>
              )}
            </View>
            {clash && (
              <View testID="mark.courseNextClash" style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
                <Icons.Overlap size={14} weight="bold" color={v.ambFg} />
                {/* One line (round 3's third review: it wrapped): the clash's time first, then the other course, cut last. */}
                <Text size="bodyMedium" weight="medium" tabular numberOfLines={1} style={{ color: v.ambFg, flexShrink: 1 }}>
                  {`${t("mobile.kuliah.clash.title", { time: f.timeRange(clash.from, clash.to) })} · ${shortName(name(clash.other))}`}
                </Text>
              </View>
            )}
          </View>
        }
        status={next.notInSix ? <StatusChip tone="amber">{t("meeting.notInSix")}</StatusChip> : undefined}
        // An online class today: the row joins it.
        onPress={today && link ? () => open(link) : undefined}
        label={[
          t("course.next"),
          ...facts,
          clash ? `${clashWords} ${f.timeRange(clash.from, clash.to)}` : "",
          next.notInSix ? t("meeting.notInSix") : "",
          today ? t("course.join") : "",
        ]
          .filter(Boolean)
          .join(", ")}
        testID="row.courseNext"
      />
    ));
  }
  // A class of the course SIX shows that the app couldn't read, up to the next meeting: its time and room are on SIX.
  const unreadDay = firstUnreadDay(unread ?? [], schedule ?? [], now, next?.start ?? null, page.course.code);
  if (unreadDay)
    rows.push((first) => (
      <TileRow
        key="unread"
        first={first}
        leading={
          <Bare>
            <Icons.Info size={20} color={v.muted} />
          </Bare>
        }
        title={t("home.now.unread", { day: f.relativeDay(dayNoon(unreadDay)) })}
        status={<OpenSixTimetable day={unreadDay} />}
      />
    ));
  const quiet = rows.length ? <FlatRows style={{ marginTop: space[3] }}>{rows.map((row, i) => row(i === 0))}</FlatRows> : null;
  const countedIn = mine?.health.countedIn;
  if (!current && !presence)
    return quiet ? (
      <Rise screen={rise} index={2}>
        {quiet}
      </Rise>
    ) : null;
  return (
    <Rise screen={rise} index={2}>
      <NowBlock page={page} meeting={meeting} presence={presence} current={current !== null} countedIn={countedIn} modules={modules} />
      {quiet}
    </Rise>
  );
}

/** A quiet row's icon, bare on the page (no pale square behind it), in the row's leading slot. */
function Bare({ children }: { children: ReactNode }) {
  return <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>{children}</View>;
}

/** Edunex's open Presence for the course where nobody can say it counts (signed out of SIX): ⋮ offers it, the card may not. */
export function useRecordInEdunexUrl(page: CoursePage): string | null {
  const now = useNow();
  const attendance = useAttendance();
  const countedIn = attendance?.courses.find((x) => x.course.code === page.course.code)?.health.countedIn;
  if (countedIn !== "noSix") return null;
  const window = openPresences(page.presence ?? [], now)[0];
  if (!window) return null;
  return window.url ?? (page.course.edunex ? edunexCourseUrl(page.course.edunex.courseId) : null);
}

/**
 * The class on now (or the window open), the block: Beranda's, in the course's colour, white on it in both themes.
 * Keep it in step with ../home/banner.tsx (the same radius, padding, type, bar and button).
 */
function NowBlock({
  page,
  meeting,
  presence,
  current,
  countedIn,
  modules,
}: {
  page: CoursePage;
  meeting: Meeting | null;
  presence: PresenceSession | null;
  current: boolean;
  countedIn: string | undefined;
  modules: ReturnType<typeof pageModules>;
}) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const tone = useCourseColor();
  const open = useOpenExternal();
  const checkIn = useCheckIn();
  const live = useStatus("edunex").state === "live";
  const student = useDataset("six.student");
  const checkIns = useDataset("six.checkIn");
  const code = page.course.code;
  // The course's deep colour in both themes, white on it: the block reads the same by day and by night.
  const fill = THEMES.light.courseTile(tone(code)).ink;
  const on = v.onHead;
  const start = meeting?.start ?? presence!.start;
  const end = meeting?.end ?? presence!.end;
  const link = meeting && meeting.end > now ? (meeting.announced?.link ?? null) : null;
  const upcoming = meeting !== null && meeting.start > now;
  const url = presence?.url ?? (page.course.edunex ? edunexCourseUrl(page.course.edunex.courseId) : null);
  // Without SIX nobody can say Edunex's window counts: it's still there to fill in, said calmly on the block.
  const presenceCounts = countedIn !== "noSix";
  // A class SIX counts, on now, with SIX showing Tandai Hadir (as the app last read it; the app never presses it).
  const sixSession = current && meeting && (countedIn === "six" || countedIn === "both") && meeting.six && student ? meeting.six : null;
  const sixState = sixSession ? (checkIns?.[sixSession.id]?.state ?? "waiting") : null;
  const went = useWentToCheckIn(sixSession?.id ?? null);
  const done = sixState === "gone" && went !== null ? went : null;
  useEffect(() => {
    if (done !== null) haptic.confirm();
  }, [done]);

  // One main button: the presence that's open; with both open, the one closing first (SIX's goes with the class); when
  // that one is done (Edunex records it, SIX's button goes), the other; with neither, joining the online class.
  const sixOpen = sixSession !== null && sixState === "open";
  const edunexOpen = presence !== null && url !== null;
  const main: "six" | "presence" | "join" | null =
    sixOpen && edunexOpen ? (presence.closesAt <= end ? "presence" : "six") : sixOpen ? "six" : edunexOpen ? "presence" : link ? "join" : null;

  // What the block leads with: on now (and where), next (when), or a window alone (the class it's for).
  const place = meeting?.six?.room ?? (meeting?.announced?.online ? t("course.online") : null);
  const day = !current && f.dayOffset(start) !== 0 ? f.relativeDay(start) : null;
  const range = f.timeRange(start, end);
  const kicker = current
    ? [t("home.today.now"), place ?? range]
    : upcoming
      ? [t("mobile.home.next"), `${day ?? t("time.today")}, ${f.time(start)}`, place]
      : [t("course.presenceOpen"), day ? `${day}, ${f.time(start)}` : range];
  const kickerFull = current
    ? [t("home.today.now"), range, place]
    : upcoming
      ? [t("mobile.home.next"), day ?? t("time.today"), range, place]
      : [t("course.presenceOpen"), day, range];
  const title = meeting ? meetingTitle(t, meeting, meetingModuleTitle(t, modules, meeting)) : (presence?.topic ?? t("meeting.untitled"));
  const facts = [
    presence && !presenceCounts ? t("mobile.course.mayNotCount") : null,
    meeting?.notInSix ? t("meeting.notInSix") : null,
    !presence && meeting?.presence?.note ? meeting.presence.note : null,
  ].filter(Boolean);
  // One bar, one time, and the time says what the bar measures: the Presence's window while it's the thing to do
  // ("tutup 09:30"), else the class itself while it's on ("selesai 10:00"). A class still to come has its time above.
  const window = presence && main !== "six" ? presence : null;
  const span = window ? { from: window.opensAt, to: window.closesAt } : current ? { from: start, to: end } : null;
  const time = window ? t("home.need.presence.closes", { time: f.dayTime(window.closesAt) }) : span ? t("mobile.home.ends", { time: f.time(span.to) }) : null;

  return (
    <View testID="card.courseNow" style={{ backgroundColor: fill, borderRadius: 28, padding: space[5], marginTop: space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        {current && live && <PulseDot color={on} />}
        <Text
          size="labelLarge"
          weight="medium"
          tabular
          numberOfLines={1}
          accessibilityLabel={kickerFull.filter(Boolean).join(" · ")}
          style={{ color: on, flex: 1 }}
        >
          {kicker.filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Text size="titleLarge" face="display" weight="bold" style={{ color: on, letterSpacing: -0.3, marginTop: 6 }}>
        {title}
      </Text>
      {facts.length > 0 && (
        <Text size="bodyMedium" style={{ color: on, marginTop: 2 }}>
          {facts.join(" · ")}
        </Text>
      )}
      {span && time && (
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: space[3], minHeight: 20 }}>
          <PlainBar
            value={(now - span.from) / Math.max(1, span.to - span.from)}
            color={on}
            track={`${on}59`}
            height={6}
            label={window ? t("course.presenceOpen") : t("presence.row.now", { time: f.time(span.to) })}
            end={time}
            endColor={on}
          />
        </View>
      )}
      {/* The Student's own step, said once: never a claim that SIX counted it. */}
      {done !== null && (
        <View testID="card.courseNow.checkedIn" style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginTop: space[3] }}>
          <Icons.CheckCircle size={16} weight="fill" color={on} />
          <Text size="labelLarge" weight="medium" numberOfLines={1} style={{ color: on, flex: 1 }}>
            {t("mobile.home.wentToSix", { time: f.time(done) })}
          </Text>
        </View>
      )}
      {main !== null && (
        <View style={{ marginTop: space[4] }}>
          {main === "presence" && url ? (
            <PresenceButton tone="course" ink={fill} wide onPress={() => open(url)} accessibilityLabel={t("home.now.recordLabel", { course: code })} />
          ) : main === "six" && sixSession && student ? (
            // No haptic: the tap only opens SIX, where the Student presses Tandai Hadir (haptics are for commits).
            <PresenceButton
              label={t("mobile.notification.checkIn")}
              tone="course"
              ink={fill}
              wide
              onPress={() => checkIn(sixSession.id, sixTimetableUrl(student, sixSession.start), now)}
              accessibilityLabel={t("home.now.openSixLabel", { course: code })}
              testID="action.checkIn"
            />
          ) : main === "join" && link ? (
            <PresenceButton
              label={t("course.join")}
              icon="Video"
              tone="course"
              ink={fill}
              wide
              onPress={() => open(link)}
              accessibilityLabel={t("home.today.joinLabel", { course: code })}
              testID="action.join"
            />
          ) : null}
        </View>
      )}
    </View>
  );
}
