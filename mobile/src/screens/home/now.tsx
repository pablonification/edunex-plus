// The now card (round 2, v4): white, rounded 24, over the header's lower edge. The course's tile; above its name (the
// display face) "Sekarang · room" with a breathing green dot; Material 3 Expressive's wavy progress for the class gone
// by and the minutes left in big numbers; and one full-width button when there's something to press: Tandai Hadir while
// SIX shows it, the Presence when it counts, joining an online class. After the Student went to SIX's Tandai Hadir and
// SIX no longer shows it, the button turns tonal green, a cookie badge turns in and its check draws itself, with a
// tap of the phone: their step ("Sudah ke SIX · 09:07"), not a claim they're counted. No class on: the next one with a
// countdown; none today: tomorrow's first, calmly. A tap on the card opens its class's sheet (./class-sheet.tsx).
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { View } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import type { AttendanceHealth } from "../../../../src/core/attendance";
import { checkingIn } from "../../../../src/core/check-in";
import type { NowCard } from "../../../../src/core/needs";
import { dayNoon } from "../../../../src/core/schedule";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { BigButton } from "../../ui/big-button";
import { CookieCheck, CountUp, PulseDot, WavyProgress } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile, useCourseTile } from "../../ui/tile";
import { useWentToCheckIn } from "./checked-in";
import { ClassSheet, cardAction, cardSubject, MainAction, useCheckInOpen } from "./class-sheet";
import { MINUTE, nameOf } from "./parts";

/** The card's surface: white on the page's grey, a soft shadow in light (none in dark, where tone does it). */
export function useCardStyle() {
  const theme = useTheme();
  const v = theme.v4;
  return {
    backgroundColor: v.card,
    borderRadius: 24,
    ...(theme.scheme === "light" ? { elevation: 3, shadowColor: "#101828" } : {}),
  } as const;
}

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
  const v = useTheme().v4;
  const surface = useCardStyle();
  if (card) return <Card card={card} courses={courses} health={health} />;
  // Without SIX there's no timetable: no card. With one, a quiet week, unless a class on it can't be read.
  if (!hasSchedule) return null;
  return (
    <View testID="card.now" style={[surface, { padding: space[4], gap: space[3] }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Icons.CalendarCheck size={24} color={v.muted} />
        <Text size="bodyLarge" style={{ color: v.fg2, flex: 1 }}>
          {unread ? t("home.now.unread", { day: f.relativeDay(dayNoon(unread)) }) : t("home.now.free")}
        </Text>
      </View>
      {unread && <OpenSixTimetable day={unread} />}
    </View>
  );
}

/** Minutes until `at`, and their unit: minutes up to two hours, then hours, then days. */
function countdown(from: number, at: number): { value: number; unit: "minute" | "hour" | "day" } {
  const minutes = Math.max(0, Math.ceil((at - from) / MINUTE));
  if (minutes < 120) return { value: minutes, unit: "minute" };
  if (minutes < 48 * 60) return { value: Math.floor(minutes / 60), unit: "hour" };
  return { value: Math.floor(minutes / (24 * 60)), unit: "day" };
}

function Card({ card, courses, health }: { card: NowCard; courses: readonly TermCourse[]; health: ReadonlyMap<string, AttendanceHealth> }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const surface = useCardStyle();
  const tile = useCourseTile();
  const [open, setOpen] = useState(false);
  const { session, meeting, slot, code, windowFor } = cardSubject(card);
  const checkInOpen = useCheckInOpen(card);
  const action = cardAction(card, now, checkInOpen);
  const done = useDone(card);
  const name = nameOf(courses, code, session?.courseName);
  const { ink, tint } = tile(code);
  const place = session?.room ?? (meeting?.online ? t("mobile.home.online") : null);
  const live = card.state === "live" && slot !== null;
  const window = !session && !meeting && card.presence ? card.presence.session : null;
  // What the card leads with, the way the class stands: on (time gone, minutes left), next (a countdown), a window open
  // (its time gone, minutes to close), another day (just when).
  const kicker = live
    ? [t("home.today.now"), place]
    : card.state === "next" && slot
      ? [t("mobile.home.next"), place]
      : card.state === "later" && slot
        ? [f.relativeDay(slot.start), f.time(slot.start)]
        : [t("home.now.presenceOnly"), windowFor ? f.timeRange(windowFor.start, windowFor.end) : null];
  const progress = live && slot ? { from: slot.start, to: slot.end } : window ? { from: window.opensAt, to: window.closesAt } : null;
  const until = progress ? progress.to : card.state === "next" && slot ? slot.start : null;
  const left = until !== null ? countdown(now, until) : null;
  return (
    <View testID="card.now" style={[surface, { padding: space[4] }]}>
      <PressScale onPress={() => setOpen(true)} accessibilityHint={t("mobile.home.nowHint")} testID="action.nowClass" style={{ gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
          <CourseTile code={code} name={name} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {live && <PulseDot color={v.live} />}
              <Text size="bodyMedium" weight="medium" style={{ color: v.muted, flexShrink: 1 }}>
                {kicker.filter(Boolean).join(" · ")}
              </Text>
            </View>
            <Text size="titleMedium" face="display" weight="bold" style={{ color: v.fg, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, marginTop: 3 }}>
              {name}
            </Text>
          </View>
        </View>
        {left && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
            {progress ? (
              <WavyProgress
                progress={(now - progress.from) / Math.max(1, progress.to - progress.from)}
                ink={ink}
                track={tint}
                label={t("home.now.live", { time: f.time(progress.to) })}
              />
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
              <CountUp
                id={`now:${code}:${until}`}
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
      </PressScale>
      {done !== null ? (
        <View style={{ marginTop: space[4] }}>
          <BigButton variant="done" icon={<CookieCheck color={v.okFg} check={v.okBg} />} testID="card.now.checkedIn">
            {t("mobile.home.wentToSix", { time: f.time(done) })}
          </BigButton>
        </View>
      ) : (
        action && (
          <View style={{ marginTop: space[4] }}>
            <MainAction card={card} action={action} />
          </View>
        )
      )}
      <ClassSheet card={card} courses={courses} open={open} onClose={() => setOpen(false)} context={{ health }} />
    </View>
  );
}

/**
 * When the Student went to SIX's Tandai Hadir for the card's class from here and SIX no longer shows it: the moment
 * they went (with a tap of the phone, once). Null otherwise.
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
    if (done !== null) void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(() => undefined);
  }, [done]);
  return done;
}
