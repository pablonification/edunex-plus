// Above the course page's tabs, on the phone (src/app/screens/course.tsx's RiskStrip and MeetingNow):
// for a course in trouble, what that means now; then what's on now or next. While a class is on or
// a Presence window is open, a raised card (its time, what it is, where, the one thing to do, the
// window's countdown under it); otherwise the next meeting in one quiet line.
import type { ReactNode } from "react";
import { View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { verdictLabel } from "../../../../src/app/attendance-labels";
import { useOpenCheckIn, useOpenExternal } from "../../../../src/app/hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import { useDone, useSnoozes } from "../../../../src/app/snoozes";
import { useDataset, useStatus } from "../../../../src/app/store";
import { type AttendanceHealth, firstUnreadDay, percent } from "../../../../src/core/attendance";
import { clashes, type Meeting, openPresences, pinnedMeeting } from "../../../../src/core/course-meetings";
import { outOfReachKey } from "../../../../src/core/done";
import { edunexCourseUrl, sixTimetableUrl } from "../../../../src/core/links";
import type { PresenceSession } from "../../../../src/core/models";
import { dayNoon } from "../../../../src/core/schedule";
import { attendanceKey, attendanceSnoozable } from "../../../../src/core/snooze";
import { useNav } from "../../nav";
import { CountdownBar } from "../../parts/meter";
import { NowCard, NowLine, NowZone } from "../../parts/now-card";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { DoneButton, SnoozeMenu } from "../../parts/snooze";
import { Button } from "../../ui/controls";
import { LiveDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta, Notice } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { meetingModuleTitle, meetingTitle, pageModules } from "./meetings";

const DAY = 86_400_000;

/**
 * The attendance banner shows with no room left or the target out of reach, unless it's put off
 * with "Ingatkan nanti" (here or on Beranda: they share it) until its time or a new count.
 */
function useBannerShows(code: string, health: AttendanceHealth | undefined): boolean {
  const { snoozed } = useSnoozes();
  const { done } = useDone();
  if (!health || (health.state !== "out" && health.state !== "none")) return false;
  // Out of reach and marked "Sudah tahu" (here or on Beranda): the header's meter says it from then on.
  if (health.state === "out" && done(outOfReachKey(code, health))) return false;
  return !snoozed(attendanceKey(code, health));
}

/** "7 pertemuan lagi sampai 4 Des. Hadiri semuanya agar tetap 80%." From src/app/screens/course.tsx. */
function noneLeft(t: Translate, f: Format, health: AttendanceHealth, lastDay: string | null): string {
  const { count, estimated } = health.left;
  // The sure meetings alone fall short: one that may not run has to.
  if (health.needsUncertain) return t("course.risk.noneIfRuns", { target: health.target });
  if (count === 0) return "";
  if (!lastDay) return t("course.risk.noneNoDate", { target: health.target });
  const date = f.dayMonth(Date.parse(`${lastDay}T12:00:00+07:00`));
  return t(estimated ? "course.risk.noneAbout" : "course.risk.none", { count, date, target: health.target });
}

/**
 * When a Presence window closes: "tutup 23:00 (1 jam 5 mnt lagi)" today; with its day when it isn't
 * today, and how long is left only while that's under a day. From src/app/screens/course.tsx.
 */
function closesLabel(t: Translate, f: Format, closesAt: number, now: number): string {
  const time = f.dayTime(closesAt);
  return closesAt - now < DAY ? t("course.closesAt", { time, left: f.countdown(closesAt) }) : t("course.closesOn", { time });
}

/**
 * For a course in trouble (no absences left, or the target out of reach): what that means now, in
 * one place. The next meeting, and a clash with another class that day.
 */
export function RiskStrip({ page }: { page: CoursePage }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const { go } = useNav();
  const open = useOpenExternal();
  const attendance = useAttendance();
  const schedule = useDataset("six.schedule");
  const student = useDataset("six.student");
  const health = attendance?.courses.find((c) => c.course.code === page.course.code)?.health;
  const shows = useBannerShows(page.course.code, health);
  if (!health || !attendance || !shows) return null;
  const later = attendanceSnoozable(page.course.code, health);
  const next = page.meetings.find((m) => m.end > now && !m.notInSix);
  const clash = next ? clashes(next, page.course.code, schedule ?? [])[0] : undefined;
  // The meeting right below already shows the next one; say it here only when it doesn't.
  const nextShownBelow = next !== undefined && pinnedMeeting(page.meetings, now)?.meeting.key === next.key;
  const out = health.state === "out";
  const title = verdictLabel(t, health);
  const text = [
    out ? t("course.risk.best", { best: percent(health.best ?? 0) }) : noneLeft(t, f, health, attendance.lastDay),
    next && !nextShownBelow
      ? t("course.risk.next", {
          when: `${f.relativeDay(next.start)}, ${f.timeRange(next.start, next.end)}`,
          room: next.six?.room ? t("course.risk.room", { room: next.six.room }) : "",
        })
      : "",
    // The minutes the two classes share, as Beranda and Jadwal say it.
    next && clash
      ? t("course.risk.clash", { code: clash.courseCode, time: f.timeRange(Math.max(next.start, clash.start), Math.min(next.end, clash.end)) })
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <View style={{ marginBottom: space[4] }}>
      <Notice
        testID="notice.courseRisk"
        tone={out ? "danger" : "warning"}
        title={title}
        action={
          // The fix: out of reach, a class SIX may have missed; no absences left, every class from here on, as Presensi plans them.
          out && student ? (
            <Button size="sm" icon={<Icons.ArrowUpRight size={14} />} onPress={() => open(sixTimetableUrl(student))}>
              {t("presence.checkSix")}
            </Button>
          ) : (
            <Button size="sm" onPress={() => go({ screen: "presence" })}>
              {t("course.risk.seePresence")}
            </Button>
          )
        }
        snooze={
          <>
            {out && (
              <DoneButton
                item={outOfReachKey(page.course.code, health)}
                how="gotIt"
                name={`${page.course.code}: ${title}`}
                said={t("done.toast.gotIt", { course: page.course.code })}
                words
              />
            )}
            <SnoozeMenu item={later} name={`${page.course.code}: ${title}`} words />
          </>
        }
      >
        {/* One text, as the desktop says it: the sentences read (and are found) together. */}
        <Text size="small" style={{ color: out ? theme.color.dangerFg : theme.color.warningFg }}>
          {text}
        </Text>
      </Notice>
    </View>
  );
}

/** An icon and its words, side by side, in a line of facts. */
function Fact({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
      {icon}
      <Text size="small" tone="muted" style={{ flexShrink: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/**
 * What's on now or next. While a class is on or a Presence window is open, a raised card: its time,
 * what it is, where, and the one thing to do (record attendance, join online), with the window's
 * countdown under it. A window can stay open long after its class: with no class on, the card is
 * about that class, and the next one keeps its quiet line under it. Otherwise, the next meeting in
 * one quiet line.
 */
export function MeetingNow({ page }: { page: CoursePage }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const c = theme.color;
  const open = useOpenExternal();
  const attendance = useAttendance();
  const live = useStatus("edunex").state === "live";
  const schedule = useDataset("six.schedule");
  const student = useDataset("six.student");
  const checkIns = useDataset("six.checkIn");
  const openCheckIn = useOpenCheckIn();
  const unread = useDataset("six.scheduleUnread");
  const modules = pageModules(page);
  const pinned = pinnedMeeting(page.meetings, now);
  const windows = openPresences(page.presence ?? [], now);
  const current = pinned?.current ? pinned.meeting : null;
  // The card's window: the class going on has only its own; with no class on, the one closing first.
  const presence = current ? (windows.find((p) => p.id === current.presence?.id) ?? null) : (windows[0] ?? null);
  const meetingOf = (p: PresenceSession) => page.meetings.find((m) => m.presence?.id === p.id) ?? null;
  const meeting = current ?? (presence ? meetingOf(presence) : null);
  const next = pinned && !pinned.current && pinned.meeting !== meeting ? pinned.meeting : null;
  const countedIn = attendance?.courses.find((x) => x.course.code === page.course.code)?.health.countedIn;
  const courseUrl = page.course.edunex ? edunexCourseUrl(page.course.edunex.courseId) : null;
  const url = presence?.url ?? courseUrl;
  // Edunex's window is the thing to do only where it may be what counts.
  const presenceCounts = countedIn !== "six" && countedIn !== "noSix";
  // A class SIX counts, on now: SIX's button is the thing to do, as on Beranda (the app never presses it).
  const sixSession = current && countedIn === "six" && current.six && student ? current.six : null;
  // As strong as Beranda's: filled while Tandai Hadir shows, outlined while it's still to come, quiet once it's gone.
  const sixState = sixSession ? (checkIns?.[sixSession.id]?.state ?? "waiting") : null;
  const sixVariant = sixState === "open" ? "primary" : sixState === "waiting" ? "secondary" : "ghost";

  const linkOf = (m: Meeting) => (m.end > now ? (m.announced?.link ?? null) : null);
  const placeOf = (m: Meeting) => [
    m.six?.room ? (
      <Fact key="room" icon={<Icons.MapPin size={14} color={c.muted} />}>
        {m.six.room}
      </Fact>
    ) : (
      ""
    ),
    m.announced?.online ? (
      <Fact key="online" icon={<Icons.Video size={14} color={c.muted} />}>
        {t("course.online")}
      </Fact>
    ) : (
      ""
    ),
  ];
  const notInSixOf = (m: Meeting) =>
    m.notInSix ? (
      <Text key="notInSix" size="small" tone="warning">
        {t("meeting.notInSix")}
      </Text>
    ) : (
      ""
    );

  // Windows still open from earlier classes, each with its own class and close, under the card.
  const lines: ReactNode[] = windows
    .filter((p) => p !== presence)
    .map((p) => {
      const of = meetingOf(p);
      const href = p.url ?? courseUrl;
      return (
        <NowLine
          key={`p${p.id}`}
          icon={<Icons.Hand size={16} color={c.muted} />}
          action={
            href ? (
              <Button size="sm" variant="ghost" icon={<Icons.ArrowUpRight size={14} color={c.muted} />} onPress={() => open(href)}>
                {t("course.recordInEdunex")}
              </Button>
            ) : undefined
          }
        >
          <Meta>
            <Text size="small" weight="medium">
              {t("course.presenceStillOpen")}
            </Text>
            {`${f.relativeDay(of?.start ?? p.start)}, ${f.timeRange(of?.start ?? p.start, of?.end ?? p.end)}`}
            {closesLabel(t, f, p.closesAt, now)}
          </Meta>
        </NowLine>
      );
    });
  if (next) {
    const link = linkOf(next);
    const what = meetingModuleTitle(t, modules, next) ?? next.presence?.topic ?? next.six?.activity ?? null;
    lines.push(
      <NowLine
        key="next"
        icon={<Icons.CalendarClock size={16} color={c.muted} />}
        action={
          link && f.dayOffset(next.start) === 0 ? (
            <Button size="sm" variant="ghost" icon={<Icons.Video size={14} color={c.muted} />} onPress={() => open(link)}>
              {t("course.join")}
            </Button>
          ) : undefined
        }
      >
        <Meta>
          <Text size="small" weight="medium">
            {t("course.next")}
          </Text>
          {`${f.relativeDay(next.start)}, ${f.timeRange(next.start, next.end)}`}
          {placeOf(next)}
          {/* "Kuliah" is every class: only a topic says something. */}
          {what && !/^kuliah$/i.test(what) ? what : ""}
          {notInSixOf(next)}
        </Meta>
      </NowLine>,
    );
  }
  // A class of the course SIX shows that the app couldn't read, up to the next meeting: its time and room are on SIX.
  const unreadDay = firstUnreadDay(unread ?? [], schedule ?? [], now, next?.start ?? null, page.course.code);
  if (unreadDay)
    lines.push(
      <NowLine key="unread" icon={<Icons.Info size={16} color={c.muted} />} action={<OpenSixTimetable day={unreadDay} />}>
        <Text size="small" weight="medium">
          {t("home.now.unread", { day: f.relativeDay(dayNoon(unreadDay)) })}
        </Text>
      </NowLine>,
    );
  const quiet = lines.length ? <View style={{ gap: space[2] }}>{lines}</View> : null;
  // Nothing on and no window open: at most the next meeting's line, and a class the app couldn't read.
  if (!current && !presence) return quiet ? <View style={{ marginBottom: space[2] }}>{quiet}</View> : null;

  const start = meeting?.start ?? presence!.start;
  const end = meeting?.end ?? presence!.end;
  const link = meeting ? linkOf(meeting) : null;
  const upcoming = meeting !== null && meeting.start > now;
  // A class that's over, on an earlier day: its day, so the time beside it isn't read as today's.
  const day = meeting && !current && !upcoming && f.dayOffset(meeting.start) !== 0 ? f.relativeDay(meeting.start) : "";
  const facts = meeting ? [day, ...placeOf(meeting), notInSixOf(meeting)] : [];
  const card = (
    <NowCard
      testID="card.courseNow"
      raised
      time={{ start: f.time(start), end: f.time(end) }}
      eyebrow={
        current ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            {live && <LiveDot />}
            <Text size="small" weight="medium" tone="success">
              {t("course.nowUntil", { time: f.time(end) })}
            </Text>
          </View>
        ) : upcoming ? (
          <Meta>
            {t("course.next")}
            {f.relativeDay(meeting.start)}
          </Meta>
        ) : (
          <Text size="small" tone="muted">
            {t("course.presenceOpen")}
          </Text>
        )
      }
      // Named as its row on the Pertemuan tab names it ("Pertemuan 3"), never just "Kuliah" when there's more to say.
      title={
        <Text size="title" weight="semibold">
          {meeting ? meetingTitle(t, meeting, meetingModuleTitle(t, modules, meeting)) : (presence?.topic ?? t("meeting.untitled"))}
        </Text>
      }
      meta={facts.some(Boolean) ? <Meta>{facts}</Meta> : undefined}
      note={
        !presence && meeting?.presence?.note ? (
          <Text size="small" tone="muted" numberOfLines={1} style={{ marginTop: space[1] }}>
            {meeting.presence.note}
          </Text>
        ) : undefined
      }
      action={
        link || (presence && url) || sixSession ? (
          <>
            {/* Why SIX's button comes first, in Beranda's words: Tandai Hadir is pressed there, not here. */}
            {sixSession && (
              <View style={{ width: "100%", flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
                <View style={{ marginTop: 2 }}>
                  <Icons.Hand size={16} color={sixState === "open" ? c.accentFg : c.muted} />
                </View>
                <Text size="small" weight={sixState === "open" ? "semibold" : "medium"} style={{ flex: 1 }}>
                  {t(sixState === "open" ? "home.now.checkInOpen" : sixState === "gone" ? "home.now.checkInGone" : "home.now.checkInWatch")}
                </Text>
              </View>
            )}
            {sixSession && student && (
              <Button
                variant={sixVariant}
                icon={<Icons.ArrowUpRight size={16} color={sixVariant === "primary" ? c.onAccent : sixVariant === "ghost" ? c.muted : c.fg} />}
                onPress={() => openCheckIn(sixSession.id, sixTimetableUrl(student, sixSession.start))}
                label={t("home.now.openSixLabel", { course: page.course.code })}
                testID="action.checkIn"
                style={{ flexGrow: 1 }}
              >
                {t("home.now.openSix")}
              </Button>
            )}
            {link && (
              <Button
                variant={presence || sixSession ? "secondary" : "primary"}
                icon={<Icons.Video size={16} color={presence || sixSession ? c.fg : c.onAccent} />}
                onPress={() => open(link)}
                style={{ flexGrow: 1 }}
              >
                {t("course.join")}
              </Button>
            )}
            {presence && url && (
              // Beside SIX's button, Edunex's is the small extra it is on Beranda.
              <Button
                variant={presenceCounts ? "primary" : sixSession ? "ghost" : "secondary"}
                icon={<Icons.ArrowUpRight size={16} color={presenceCounts ? c.onAccent : sixSession ? c.muted : c.fg} />}
                onPress={() => open(url)}
                style={{ flexGrow: 1 }}
                testID="action.recordInEdunex"
              >
                {t("course.recordInEdunex")}
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {presence && (
        <NowZone>
          {/* Said here unless the line above already says it. */}
          {(current || upcoming) && (
            <Text size="small" weight="semibold" style={{ marginBottom: space[1.5] }}>
              {t("course.presenceOpen")}
            </Text>
          )}
          {/* The same shrinking countdown as on Presensi and Beranda. */}
          <CountdownBar opensAt={presence.opensAt} closesAt={presence.closesAt} now={now} label={closesLabel(t, f, presence.closesAt, now)} />
          {!presenceCounts && (
            <Text size="small" tone="muted" style={{ marginTop: space[1.5] }}>
              {t(countedIn === "noSix" ? "course.presenceNoSix" : "course.presenceCountsSix")}
            </Text>
          )}
        </NowZone>
      )}
    </NowCard>
  );
  return (
    <View style={{ marginBottom: space[2], gap: space[3] }}>
      {card}
      {quiet}
    </View>
  );
}
