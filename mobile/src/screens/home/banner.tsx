// What's on now, where the official app has its banner (direction B): one block in the course's own colour, the only
// block of colour on Beranda's white page. It says each thing once: where the class stands and its room ("Sekarang ·
// 9009", the breathing dot), its name, one bar with the one time that matters beside it (the Presence's close while a
// window is open, else the minutes left), and one button when there's something to press. A tap on the block opens the
// class's sheet (./class-sheet.tsx). The data, the states and the button's work are the now card's (./now.tsx).
import { useEffect, useState } from "react";
import { View } from "react-native";
import { type TermCourse, useCourseColor } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { checkingIn } from "../../../../src/core/check-in";
import { sixTimetableUrl } from "../../../../src/core/links";
import type { NowCard } from "../../../../src/core/needs";
import { dayNoon } from "../../../../src/core/schedule";
import { useSettling } from "../../host/settling";
import { useNav } from "../../nav";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { useFirstReadRunning } from "../../shell/source-status";
import { useB } from "../../ui/b";
import { Skeleton } from "../../ui/display";
import { PulseDot, WavyProgress } from "../../ui/expressive";
import { Fluent, type FluentName } from "../../ui/fluent";
import { haptic } from "../../ui/haptics";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, THEMES, useTheme } from "../../ui/theme";
import { useReadStatuses } from "../first-scan/scan";
import { useCheckIn, useWentToCheckIn } from "./checked-in";
import { type CardAction, ClassSheet, cardAction, cardSubject, useCheckInOpen } from "./class-sheet";
import { nowHold } from "./now-hold";
import { dayAndTime, MINUTE, nameOf } from "./parts";

const RADIUS = 28;

export function NowBanner({
  card,
  courses,
  hasSchedule,
  unread,
}: {
  card: NowCard | null;
  courses: readonly TermCourse[];
  hasSchedule: boolean;
  /** The first day ahead with a class SIX shows that the app couldn't read. */
  unread: string | null;
}) {
  const t = useT();
  const f = useFormat();
  const b = useB();
  const settling = useSettling();
  const firstReading = useFirstReadRunning();
  const six = useReadStatuses().find((status) => status.source === "six");
  const code = card ? cardSubject(card).code : null;
  const hold = nowHold({
    reading: settling || firstReading,
    official: courses.some((course) => course.code === code && course.official),
    hasCard: card !== null,
    sixComing: six !== undefined && six.state !== "signed-out",
  });
  if (card) return <Banner card={card} courses={courses} reading={hold.line} />;
  if (hold.shape) return <BannerShape />;
  // Without SIX there's no timetable: no block. With one, a quiet week, unless a class on it can't be read.
  if (!hasSchedule) return null;
  return (
    <View testID="home.now" style={{ backgroundColor: b.soft, borderRadius: RADIUS, padding: space[5], gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Fluent name="CalendarCheckmark24Filled" color={b.muted} />
        <Text size="bodyLarge" style={{ color: b.fg2, flex: 1 }}>
          {unread ? t("home.now.unread", { day: f.relativeDay(dayNoon(unread)) }) : t("mobile.home.free")}
        </Text>
      </View>
      {unread && <OpenSixTimetable day={unread} />}
    </View>
  );
}

/** The block's shape while Beranda's data (or SIX's timetable) is on its way. */
export function BannerShape({ testID = "home.now.reading" }: { testID?: string }) {
  const b = useB();
  return (
    <View testID={testID} accessibilityState={{ busy: true }} style={{ backgroundColor: b.soft, borderRadius: RADIUS, padding: space[5], gap: space[3] }}>
      <Skeleton height={12} width="45%" />
      <Skeleton height={20} width="85%" />
      <Skeleton height={20} width="55%" />
      <Skeleton height={48} style={{ borderRadius: 24, marginTop: space[2] }} />
    </View>
  );
}

/** Minutes until `at`, and their unit: minutes up to two hours, then hours, then days. From ./now.tsx. */
function countdown(from: number, at: number): { value: number; unit: "minute" | "hour" | "day" } {
  const minutes = Math.max(0, Math.ceil((at - from) / MINUTE));
  if (minutes < 120) return { value: minutes, unit: "minute" };
  if (minutes < 48 * 60) return { value: Math.floor(minutes / 60), unit: "hour" };
  return { value: Math.floor(minutes / (24 * 60)), unit: "day" };
}

function Banner({ card, courses, reading }: { card: NowCard; courses: readonly TermCourse[]; reading: boolean }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const tone = useCourseColor();
  const [open, setOpen] = useState(false);
  const { session, meeting, slot, code, windowFor } = cardSubject(card);
  const checkInOpen = useCheckInOpen(card);
  const action = cardAction(card, now, checkInOpen);
  const done = useDone(card);
  const name = nameOf(courses, code, session?.courseName);
  // The course's deep colour in both themes, white on it: one block that reads the same by day and by night.
  const fill = THEMES.light.courseTile(tone(code)).ink;
  const on = v.onHead;
  const place = session?.room ?? (meeting?.online ? t("mobile.home.online") : null);
  const live = card.state === "live" && slot !== null;
  const kicker = live
    ? [t("home.today.now"), place]
    : card.state === "next" && slot
      ? [t("mobile.home.next"), place]
      : card.state === "later" && slot
        ? [dayAndTime(t, f, slot.start), place]
        : [t("home.now.presenceOnly"), windowFor ? f.timeRange(windowFor.start, windowFor.end) : null];
  // One bar, one time: the Presence's window while one is open (it's what runs out first), else the class itself.
  const window = card.presence ? card.presence.session : null;
  const span = window ? { from: window.opensAt, to: window.closesAt } : live && slot ? { from: slot.start, to: slot.end } : null;
  const until = span ? span.to : card.state === "next" && slot ? slot.start : null;
  const left = until !== null ? countdown(now, until) : null;
  const time = window
    ? t("home.need.presence.closes", { time: f.dayTime(window.closesAt) })
    : left
      ? `${left.value} ${t(`mobile.home.unit.${left.unit}`, { count: left.value })} ${t("mobile.home.left")}`
      : null;
  return (
    <View
      testID="home.now"
      accessibilityState={reading ? { busy: true } : undefined}
      style={{ backgroundColor: fill, borderRadius: RADIUS, padding: space[5] }}
    >
      <PressScale onPress={() => setOpen(true)} accessibilityHint={t("mobile.home.nowHint")} testID="action.nowClass">
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          {live && <PulseDot color={on} />}
          <Text size="labelLarge" weight="medium" numberOfLines={1} style={{ color: on, flex: 1 }}>
            {kicker.filter(Boolean).join(" · ")}
          </Text>
          <Fluent name="ChevronRight20Regular" color={on} />
        </View>
        <Text size="titleLarge" face="display" weight="bold" numberOfLines={2} style={{ color: on, letterSpacing: -0.3, marginTop: 6 }}>
          {name}
        </Text>
        {time && !reading && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginTop: space[3], minHeight: 20 }}>
            {span ? (
              <WavyProgress
                progress={(now - span.from) / Math.max(1, span.to - span.from)}
                ink={on}
                track={`${on}59`}
                label={window ? t("home.now.presenceOnly") : t("presence.row.now", { time: f.time(span.to) })}
              />
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Text size="labelLarge" weight="semibold" tabular style={{ color: on }}>
              {time}
            </Text>
          </View>
        )}
      </PressScale>
      {reading ? null : done !== null ? (
        <View
          testID="card.now.checkedIn"
          style={{
            marginTop: space[4],
            height: 48,
            borderRadius: 24,
            backgroundColor: `${on}33`,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space[2],
          }}
        >
          <Fluent name="CheckmarkCircle20Filled" color={on} />
          <Text size="labelLarge" weight="semibold" style={{ color: on, fontSize: 15 }}>
            {t("mobile.home.wentToSix", { time: f.time(done) })}
          </Text>
        </View>
      ) : (
        action && <BannerAction card={card} action={action} ink={fill} on={on} />
      )}
      <ClassSheet card={card} courses={courses} open={open} onClose={() => setOpen(false)} />
    </View>
  );
}

/** The block's one button, white on the course's colour: Tandai Hadir, the Presence, or joining the online class (./class-sheet.tsx's MainAction). */
function BannerAction({ card, action, ink, on }: { card: NowCard; action: Exclude<CardAction, null>; ink: string; on: string }) {
  const t = useT();
  const now = useNow();
  const { go } = useNav();
  const student = useDataset("six.student");
  const checkIn = useCheckIn();
  const external = useOpenExternal();
  const { session, code, link } = cardSubject(card);
  const presence = card.presence;
  let button: { text: string; label: string; icon: FluentName | null; testID: string; onPress(): void } | null = null;
  if (action === "presence" && presence) {
    const task = presence.activity === "assignment" ? presence.task : null;
    button = task
      ? {
          text: t("home.now.openTask"),
          label: t("home.now.openTask"),
          icon: null,
          testID: "action.presence",
          onPress: () => go({ screen: "task", taskId: task.id }),
        }
      : {
          text: t("home.now.edunexStep"),
          label: t("home.now.recordLabel", { course: presence.code }),
          icon: "ArrowUpRight20Regular",
          testID: "action.presence",
          onPress: () => external(presence.url),
        };
  } else if (action === "checkIn" && session && student) {
    button = {
      text: t("mobile.notification.checkIn"),
      label: t("home.now.openSixLabel", { course: session.courseCode }),
      icon: "HandRight20Filled",
      testID: "action.checkIn",
      onPress: () => checkIn(session.id, sixTimetableUrl(student, session.start), now),
    };
  } else if (action === "join" && link) {
    button = {
      text: t("home.today.join"),
      label: t("home.today.joinLabel", { course: code }),
      icon: "Video20Filled",
      testID: "action.join",
      onPress: () => external(link),
    };
  }
  if (!button) return null;
  return (
    <PressScale
      onPress={button.onPress}
      accessibilityLabel={button.label}
      testID={button.testID}
      style={{
        marginTop: space[4],
        height: 48,
        borderRadius: 24,
        backgroundColor: on,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space[2],
      }}
    >
      {button.icon && <Fluent name={button.icon} color={ink} />}
      <Text size="labelLarge" face="display" weight="bold" style={{ color: ink, fontSize: 15 }}>
        {button.text}
      </Text>
    </PressScale>
  );
}

/**
 * When the Student went to SIX's Tandai Hadir for the block's class from here and SIX no longer shows it: the moment
 * they went (with a tap of the phone, once). Null otherwise. From ./now.tsx.
 */
function useDone(card: NowCard): number | null {
  const now = useNow();
  const checkIns = useDataset("six.checkIn");
  const student = useDataset("six.student");
  const session = card.class?.session ?? null;
  const went = useWentToCheckIn(session?.id ?? null);
  const watching = session && student && (card.state === "live" || card.state === "next") && checkingIn(session, now);
  const gone = Boolean(watching && session && checkIns?.[session.id]?.state === "gone");
  const done = gone && went !== null ? went : null;
  useEffect(() => {
    if (done !== null) haptic.confirm();
  }, [done]);
  return done;
}
