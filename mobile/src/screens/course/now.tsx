// What's on now or next in the course, above its tabs (round 2, v4; src/app/screens/course.tsx's MeetingNow). While a
// class is on or an Edunex Presence window is open, a white card as Beranda's now card: "Sekarang · room" with the
// breathing dot, what the class is, Material 3 Expressive's wave for the time gone by and the minutes left in big
// figures, and one big button for the thing to do (Tandai Hadir while SIX shows it, then "Sudah ke SIX" in green;
// Edunex's Presence where it counts; joining an online class). Whether the Presence counts is a chip, not a sentence.
// Otherwise, quiet rows in one white card: windows still open from earlier classes, the next meeting when the
// attendance card above doesn't already say it, a class SIX shows that the app couldn't read.
import * as Haptics from "expo-haptics";
import { type ReactNode, useEffect } from "react";
import { View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import { useDataset, useStatus } from "../../../../src/app/store";
import { firstUnreadDay } from "../../../../src/core/attendance";
import { type Meeting, openPresences, pinnedMeeting } from "../../../../src/core/course-meetings";
import { edunexCourseUrl, sixTimetableUrl } from "../../../../src/core/links";
import type { PresenceSession } from "../../../../src/core/models";
import { dayNoon } from "../../../../src/core/schedule";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { BigButton } from "../../ui/big-button";
import { CookieCheck, CountUp, PulseDot, Rise, WavyProgress } from "../../ui/expressive";
import { IconTile } from "../../ui/icon-tile";
import { Icons } from "../../ui/icons";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { useCourseTile } from "../../ui/tile";
import { CardGroup, StatusChip, TileRow } from "../../ui/v4-list";
import { useCheckIn, useWentToCheckIn } from "../home/checked-in";
import { useCardStyle } from "../home/now";
import { meetingModuleTitle, meetingTitle, pageModules } from "./meetings";

const MINUTE = 60_000;

/** Minutes until `at`, and their unit: minutes up to two hours, then hours, then days (as Beranda's card counts). */
function countdown(from: number, at: number): { value: number; unit: "minute" | "hour" | "day" } {
  const minutes = Math.max(0, Math.ceil((at - from) / MINUTE));
  if (minutes < 120) return { value: minutes, unit: "minute" };
  if (minutes < 48 * 60) return { value: Math.floor(minutes / 60), unit: "hour" };
  return { value: Math.floor(minutes / (24 * 60)), unit: "day" };
}

/**
 * `shownNext`: the start of the next class the attendance card above already shows (its next meeting isn't said
 * twice); `card`: the attendance card is there (and says a class the app couldn't read itself).
 */
export function MeetingNow({ page, shownNext, card, rise }: { page: CoursePage; shownNext: number | null; card: boolean; rise: string }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const open = useOpenExternal();
  const attendance = useAttendance();
  const schedule = useDataset("six.schedule");
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
            <IconTile tint={v.page}>
              <Icons.Hand size={20} color={v.muted} />
            </IconTile>
          }
          title={t("course.presenceStillOpen")}
          meta={`${when} · ${t("mobile.course.presenceCloses", { time: f.dayTime(p.closesAt) })}`}
          onPress={href ? () => open(href) : undefined}
          label={`${t("course.presenceStillOpen")}, ${when}. ${t("course.recordInEdunex")}`}
          testID={`row.courseWindow.${p.id}`}
        />
      );
    });
  if (next && next.start !== shownNext) {
    const link = linkOf(next);
    const today = link !== null && f.dayOffset(next.start) === 0;
    const what = meetingModuleTitle(t, modules, next) ?? next.presence?.topic ?? next.six?.activity ?? null;
    const facts = [
      `${f.relativeDay(next.start)}, ${f.timeRange(next.start, next.end)}`,
      next.six?.room ?? "",
      next.announced?.online ? t("course.online") : "",
      // "Kuliah" is every class: only a topic says something.
      what && !/^kuliah$/i.test(what) ? what : "",
    ].filter(Boolean);
    rows.push((first) => (
      <TileRow
        key="next"
        first={first}
        leading={
          <IconTile tint={v.page}>
            <Icons.CalendarClock size={20} color={v.muted} />
          </IconTile>
        }
        title={t("course.next")}
        meta={facts.join(" · ")}
        status={next.notInSix ? <StatusChip tone="amber">{t("meeting.notInSix")}</StatusChip> : undefined}
        // An online class today: the row joins it.
        onPress={today && link ? () => open(link) : undefined}
        label={[t("course.next"), ...facts, next.notInSix ? t("meeting.notInSix") : "", today ? t("course.join") : ""].filter(Boolean).join(", ")}
        testID="row.courseNext"
      />
    ));
  }
  // A class of the course SIX shows that the app couldn't read, up to the next meeting: its time and room are on SIX.
  const unreadDay = card ? null : firstUnreadDay(unread ?? [], schedule ?? [], now, next?.start ?? null, page.course.code);
  if (unreadDay)
    rows.push((first) => (
      <TileRow
        key="unread"
        first={first}
        leading={
          <IconTile tint={v.page}>
            <Icons.Info size={20} color={v.muted} />
          </IconTile>
        }
        title={t("home.now.unread", { day: f.relativeDay(dayNoon(unreadDay)) })}
        status={<OpenSixTimetable day={unreadDay} />}
      />
    ));
  const quiet = rows.length ? <CardGroup style={{ marginTop: space[3] }}>{rows.map((row, i) => row(i === 0))}</CardGroup> : null;
  const countedIn = attendance?.courses.find((x) => x.course.code === page.course.code)?.health.countedIn;
  if (!current && !presence)
    return quiet ? (
      <Rise screen={rise} index={2}>
        {quiet}
      </Rise>
    ) : null;
  return (
    <Rise screen={rise} index={2}>
      <NowCard page={page} meeting={meeting} presence={presence} current={current !== null} countedIn={countedIn} modules={modules} />
      {quiet}
    </Rise>
  );
}

function NowCard({
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
  const surface = useCardStyle();
  const open = useOpenExternal();
  const checkIn = useCheckIn();
  const live = useStatus("edunex").state === "live";
  const student = useDataset("six.student");
  const checkIns = useDataset("six.checkIn");
  const { ink, tint } = useCourseTile()(page.course.code);
  const code = page.course.code;
  const start = meeting?.start ?? presence!.start;
  const end = meeting?.end ?? presence!.end;
  const link = meeting && meeting.end > now ? (meeting.announced?.link ?? null) : null;
  const upcoming = meeting !== null && meeting.start > now;
  const url = presence?.url ?? (page.course.edunex ? edunexCourseUrl(page.course.edunex.courseId) : null);
  // Edunex's window is the thing to do only where it may be what counts.
  const presenceCounts = countedIn !== "six" && countedIn !== "noSix";
  // A class SIX counts, on now: SIX's Tandai Hadir is the thing to do, as on Beranda (the app never presses it).
  const sixSession = current && meeting && countedIn === "six" && meeting.six && student ? meeting.six : null;
  const sixState = sixSession ? (checkIns?.[sixSession.id]?.state ?? "waiting") : null;
  const went = useWentToCheckIn(sixSession?.id ?? null);
  const done = sixState === "gone" && went !== null ? went : null;
  useEffect(() => {
    if (done !== null) void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(() => undefined);
  }, [done]);

  // What the card leads with: on now (and where), next (when), or a window alone (the class it's for).
  const place = meeting?.six?.room ?? (meeting?.announced?.online ? t("course.online") : null);
  const day = !current && f.dayOffset(start) !== 0 ? f.relativeDay(start) : null;
  const kicker = current
    ? [t("home.today.now"), f.timeRange(start, end), place]
    : upcoming
      ? [t("mobile.home.next"), day ?? t("time.today"), f.timeRange(start, end), place]
      : [t("course.presenceOpen"), day, f.timeRange(start, end)];
  const title = meeting ? meetingTitle(t, meeting, meetingModuleTitle(t, modules, meeting)) : (presence?.topic ?? t("meeting.untitled"));
  const facts = [
    presence ? t("mobile.course.presenceCloses", { time: f.dayTime(presence.closesAt) }) : null,
    meeting?.notInSix ? t("meeting.notInSix") : null,
    !presence && meeting?.presence?.note ? meeting.presence.note : null,
  ].filter(Boolean);
  // The wave: the class's time while it's on, else the window's; the minutes left beside it.
  const progress = current ? { from: start, to: end } : presence ? { from: presence.opensAt, to: presence.closesAt } : null;
  const until = progress?.to ?? (upcoming ? start : null);
  const left = until !== null ? countdown(now, until) : null;

  // The one thing to do, then at most one more, quieter.
  const actions: { key: string; node: (variant: "filled" | "outline") => ReactNode }[] = [];
  if (sixSession && student && done === null && sixState !== "gone")
    actions.push({
      key: "six",
      node: (variant) => (
        <BigButton
          variant={sixState === "open" ? variant : "outline"}
          icon={<Icons.Hand size={20} weight="fill" color={sixState === "open" && variant === "filled" ? v.onBrand : v.fg} />}
          onPress={() => {
            void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(() => undefined);
            checkIn(sixSession.id, sixTimetableUrl(student, sixSession.start), now);
          }}
          label={t("home.now.openSixLabel", { course: code })}
          testID="action.checkIn"
        >
          {t("mobile.notification.checkIn")}
        </BigButton>
      ),
    });
  if (presence && url && presenceCounts)
    actions.push({
      key: "presence",
      node: (variant) => (
        <BigButton
          variant={variant}
          icon={<Icons.ArrowUpRight size={20} color={variant === "filled" ? v.onBrand : v.fg} />}
          onPress={() => open(url)}
          label={t("home.now.recordLabel", { course: code })}
          testID="action.recordInEdunex"
        >
          {t("course.recordInEdunex")}
        </BigButton>
      ),
    });
  if (link)
    actions.push({
      key: "join",
      node: (variant) => (
        <BigButton
          variant={variant}
          icon={<Icons.Video size={20} color={variant === "filled" ? v.onBrand : v.fg} />}
          onPress={() => open(link)}
          label={t("home.today.joinLabel", { course: code })}
          testID="action.join"
        >
          {t("course.join")}
        </BigButton>
      ),
    });
  // Where only SIX counts, Edunex's Presence is still there to fill in: the quiet second way.
  if (presence && url && !presenceCounts)
    actions.push({
      key: "presence",
      node: () => (
        <BigButton
          variant="outline"
          icon={<Icons.ArrowUpRight size={20} color={v.fg} />}
          onPress={() => open(url)}
          label={t("home.now.recordLabel", { course: code })}
          testID="action.recordInEdunex"
        >
          {t("course.recordInEdunex")}
        </BigButton>
      ),
    });
  const shown = actions.slice(0, 2);

  return (
    <View testID="card.courseNow" style={[surface, { padding: space[4], marginTop: space[3] }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {current && live && <PulseDot color={v.live} />}
            <Text size="bodyMedium" weight="medium" tabular style={{ color: v.muted, flexShrink: 1 }}>
              {kicker.filter(Boolean).join(" · ")}
            </Text>
          </View>
          <Text size="titleMedium" face="display" weight="bold" style={{ color: v.fg, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, marginTop: 3 }}>
            {title}
          </Text>
          {facts.length > 0 && (
            <Text size="bodyMedium" tabular style={{ color: meeting?.notInSix ? v.ambFg : v.muted, marginTop: 2 }}>
              {facts.join(" · ")}
            </Text>
          )}
        </View>
        {/* Whether the open Presence counts, where only SIX does or nobody can say. */}
        {presence && !presenceCounts && (
          <StatusChip tone={countedIn === "noSix" ? "amber" : "neutral"}>
            {t(countedIn === "noSix" ? "mobile.course.mayNotCount" : "mobile.course.optional")}
          </StatusChip>
        )}
      </View>
      {left && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginTop: space[4] }}>
          {progress ? (
            <WavyProgress
              progress={(now - progress.from) / Math.max(1, progress.to - progress.from)}
              ink={ink}
              track={tint}
              label={
                current
                  ? t("home.now.live", { time: f.time(progress.to) })
                  : t("course.closesAt", { time: f.dayTime(progress.to), left: f.countdown(progress.to) })
              }
            />
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
            <CountUp
              id={`course:${code}:now:${until}`}
              value={left.value}
              style={{ color: v.fg, fontFamily: "PlusJakartaSans-Bold", fontSize: 15, fontVariant: ["tabular-nums"] }}
            />
            <Text size="bodyMedium" face="display" weight="bold" style={{ color: v.fg, fontSize: 15 }}>
              {t(`mobile.home.unit.${left.unit}`, { count: left.value })}
            </Text>
            <Text size="bodyMedium" weight="medium" style={{ color: v.muted, fontSize: 13 }}>
              {t("mobile.home.left")}
            </Text>
          </View>
        </View>
      )}
      {done !== null ? (
        <View style={{ marginTop: space[4] }}>
          <BigButton variant="done" icon={<CookieCheck color={v.okFg} check={v.okBg} />} testID="card.courseNow.checkedIn">
            {t("mobile.home.wentToSix", { time: f.time(done) })}
          </BigButton>
        </View>
      ) : null}
      {shown.length > 0 && (
        <View style={{ marginTop: space[4], gap: space[2] }}>
          {shown.map((action, i) => (
            <View key={action.key}>{action.node(i === 0 ? "filled" : "outline")}</View>
          ))}
        </View>
      )}
    </View>
  );
}
