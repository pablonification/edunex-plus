// "Sekarang": the class on now (or next) as Beranda's one leading card, answering in three seconds whether a class is
// on, where, and whether there's anything to press. The time big, the course, the room, a chip for what's unusual
// ("Jam berubah", no absences left), one line for Tandai Hadir, and at most one button: Tandai Hadir when SIX shows it,
// the Presence when it counts, joining an online class about to start. A tap on the card opens the class's sheet
// (./class-sheet.tsx) with the rest: where attendance counts, what's left, what comes after. When the Student comes
// back from pressing Tandai Hadir and SIX no longer shows it, the card says so with a check that draws itself.
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { budgetLabel, useActionLabel } from "../../../../src/app/attendance-labels";
import { type TermCourse, useCourseColor } from "../../../../src/app/courses";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset, useStatus } from "../../../../src/app/store";
import type { AttendanceHealth } from "../../../../src/core/attendance";
import { checkingIn } from "../../../../src/core/check-in";
import type { NowCard } from "../../../../src/core/needs";
import { dayNoon } from "../../../../src/core/schedule";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { Card, CourseDot, LiveDot, Tag } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta } from "../../ui/layout";
import { useReduceMotion } from "../../ui/motion";
import { Text } from "../../ui/text";
import { motion, space, useTheme } from "../../ui/theme";
import { useWentToCheckIn } from "./checked-in";
import { ClassSheet, cardAction, cardSubject, MainAction, useCheckInOpen } from "./class-sheet";
import { nameOf } from "./parts";

export function NowSection({
  card,
  courses,
  hasSchedule,
  unread,
  health,
}: {
  card: NowCard | null;
  courses: readonly TermCourse[];
  hasSchedule: boolean;
  /** The first day ahead with a class SIX shows that the app couldn't read. */
  unread: string | null;
  health: ReadonlyMap<string, AttendanceHealth>;
}) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  if (card) return <Hero card={card} courses={courses} health={health} />;
  // Without SIX there's no timetable: "Hari ini" says how to get it. With one, a quiet week, unless a class on it can't be read.
  if (!hasSchedule) return null;
  if (unread)
    return (
      <Card variant="raised" testID="card.now" style={{ padding: space[4], gap: space[3] }}>
        <View>
          <Text size="bodyLarge">{t("home.now.unread", { day: f.relativeDay(dayNoon(unread)) })}</Text>
          <Text size="bodyMedium" tone="muted">
            {t("schedule.unread.hint", { count: 1 })}
          </Text>
        </View>
        <OpenSixTimetable day={unread} />
      </Card>
    );
  return (
    <Card variant="raised" testID="card.now" style={{ padding: space[4], flexDirection: "row", alignItems: "center", gap: space[3] }}>
      <Icons.CalendarCheck size={22} color={theme.color.onSurfaceVariant} />
      <Text size="bodyLarge" tone="muted" style={{ flex: 1 }}>
        {t("home.now.free")}
      </Text>
    </Card>
  );
}

function Hero({ card, courses, health }: { card: NowCard; courses: readonly TermCourse[]; health: ReadonlyMap<string, AttendanceHealth> }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const { session, meeting, slot, code, windowFor } = cardSubject(card);
  const facts = card.class;
  const fresh = useStatus(meeting ? "edunex" : "six").state === "live";
  const color = useCourseColor()(code);
  const live = card.state === "live";
  const checkInOpen = useCheckInOpen(card);
  const action = cardAction(card, now, checkInOpen);
  const name = nameOf(courses, code, session?.courseName);
  const eyebrow =
    live && slot
      ? t("home.now.live", { time: f.time(slot.end) })
      : card.state === "next" && slot
        ? t("home.now.next", { when: f.fromNow(slot.start) })
        : card.state === "later" && slot
          ? t("home.now.later", { day: f.relativeDay(slot.start) })
          : t("home.now.presenceOnly");
  const budget = facts?.health && (facts.state === "none" || facts.state === "out") ? facts.health : null;
  const kind = session && !/^kuliah$/i.test(session.activity) ? session.activity : null;
  const when = slot ?? windowFor;
  return (
    <>
      <Card variant="raised" testID="card.now">
        <Pressable
          onPress={() => setOpen(true)}
          android_ripple={{ color: theme.color.selected }}
          accessibilityRole="button"
          accessibilityHint={t("mobile.home.nowHint")}
          testID="action.nowClass"
          style={{ padding: space[4], paddingBottom: action ? space[3] : space[4] }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            {live && (fresh ? <LiveDot /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.onSurfaceVariant }} />)}
            <Text size="labelLarge" tone={live ? "success" : "muted"} style={{ flex: 1 }} numberOfLines={2}>
              {eyebrow}
            </Text>
          </View>
          {when && (
            <Text style={{ marginTop: space[2] }} accessibilityLabel={f.timeRange(when.start, when.end)}>
              <Text size="displaySmall" tabular>
                {f.time(when.start)}
              </Text>
              <Text size="titleLarge" tone="muted" tabular>
                {`–${f.time(when.end)}`}
              </Text>
            </Text>
          )}
          <Text size="titleLarge" weight="semibold" numberOfLines={2} style={{ marginTop: space[1] }}>
            {name}
          </Text>
          <View style={{ marginTop: space[1] }}>
            <Meta>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <CourseDot color={color} size={8} />
                <Text size="small" weight="semibold" tabular>
                  {code}
                </Text>
              </View>
              {session?.room ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icons.MapPin size={14} color={theme.color.onSurfaceVariant} />
                  <Text size="small" tone="muted">
                    {session.room}
                  </Text>
                </View>
              ) : (
                ""
              )}
              {meeting ? t(meeting.online ? "home.today.meetingOnline" : "home.today.meeting", { number: meeting.number }) : ""}
            </Meta>
          </View>
          {(facts?.moved || budget || kind || (meeting && !card.meeting?.maybeInSix)) && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] }}>
              {kind && <Tag size="md">{kind}</Tag>}
              {facts?.moved && (
                <Tag tone="warning" size="md">
                  {t(facts.moved.usualStart !== null ? "mobile.home.timeMoved" : "mobile.home.roomMoved")}
                </Tag>
              )}
              {budget && (
                <Tag tone={budget.state === "out" ? "danger" : "warning"} size="md">
                  {budgetLabel(t, budget)}
                </Tag>
              )}
              {meeting && !card.meeting?.maybeInSix && (
                <Tag tone="warning" size="md">
                  {t("home.today.notInSix")}
                </Tag>
              )}
            </View>
          )}
          <CheckInLine card={card} />
        </Pressable>
        {action && (
          <View style={{ paddingHorizontal: space[4], paddingBottom: space[4] }}>
            <MainAction card={card} action={action} />
          </View>
        )}
      </Card>
      <ClassSheet card={card} courses={courses} open={open} onClose={() => setOpen(false)} context={{ health }} />
    </>
  );
}

/**
 * The one line about pressing something for this class: Tandai Hadir open (the button is under it), still to come, or
 * done; or the Presence to fill in before it closes. Nothing for a class with nothing to press.
 */
function CheckInLine({ card }: { card: NowCard }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const actionLabel = useActionLabel();
  const checkIns = useDataset("six.checkIn");
  const student = useDataset("six.student");
  const session = card.class?.session ?? null;
  const went = useWentToCheckIn(session?.id ?? null);
  const counted = card.class?.countedIn ?? "unknown";
  const watching = session && student && (card.state === "live" || card.state === "next") && checkingIn(session, now);
  const state = session ? checkIns?.[session.id]?.state : undefined;
  let line: { text: string; tone: "success" | "muted" } | null = null;
  if (watching) {
    if (state === "gone" && went) return <CheckedIn />;
    if (state === "open") line = { text: t("home.now.checkInOpen"), tone: "success" };
    else if (state === "gone") line = { text: t("home.now.checkInGone"), tone: "muted" };
    else if (counted === "six" || counted === "both" || counted === "unknown" || state) line = { text: t("home.now.checkInWatch"), tone: "muted" };
  } else if (card.presence && card.presence.counts !== false) {
    const { presence } = card;
    line = {
      text: t("home.now.presenceDo", {
        action: actionLabel({ action: { activity: presence.activity, task: presence.task, url: presence.url } }),
        time: f.dayTime(presence.session.closesAt),
      }),
      tone: "muted",
    };
  }
  if (!line) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2], marginTop: space[3] }}>
      <View style={{ paddingTop: 2 }}>
        <Icons.Hand size={16} color={line.tone === "success" ? theme.color.successFg : theme.color.onSurfaceVariant} />
      </View>
      <Text size="bodyMedium" tone={line.tone} style={{ flex: 1 }}>
        {line.text}
      </Text>
    </View>
  );
}

const CHECK = "M5 12.5l4.5 4.5L19 7.5";
const CHECK_LENGTH = 22;
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Tandai Hadir done: a check that draws itself in a circle that pops in, and a tap of the phone. Fades with less motion. */
function CheckedIn() {
  const t = useT();
  const theme = useTheme();
  const still = useReduceMotion();
  const pop = useSharedValue(still ? 1 : 0.4);
  const shown = useSharedValue(0);
  const drawn = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(() => undefined);
    shown.value = withTiming(1, { duration: motion.duration.short });
    if (still) return;
    pop.value = withSpring(1, motion.expressive);
    drawn.value = withDelay(120, withTiming(1, { duration: motion.duration.long }));
  }, [still, pop, shown, drawn]);
  const circle = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scale: pop.value }] }));
  const stroke = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - drawn.value) }));
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginTop: space[3] }}
      accessibilityLiveRegion="polite"
      testID="card.now.checkedIn"
    >
      <Animated.View
        style={[{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.color.successBg, alignItems: "center", justifyContent: "center" }, circle]}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <AnimatedPath
            d={CHECK}
            stroke={theme.color.successFg}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={CHECK_LENGTH}
            animatedProps={stroke}
          />
        </Svg>
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text size="bodyLarge" weight="medium" tone="success">
          {t("mobile.home.checkedIn")}
        </Text>
        <Text size="bodyMedium" tone="muted">
          {t("mobile.home.checkedInHint")}
        </Text>
      </View>
    </View>
  );
}
