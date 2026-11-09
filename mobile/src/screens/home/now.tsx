// The now card (round 2, v4): white, rounded 24, over the header's lower edge. The course's tile; above its name (the
// display face) "Sekarang · room" with a breathing green dot; Material 3 Expressive's wavy progress for the class gone
// by and the minutes left in big numbers; and one full-width button when there's something to press: Tandai Hadir while
// SIX shows it, the Presence when it counts, joining an online class. After the Student went to SIX's Tandai Hadir and
// SIX no longer shows it, the button turns tonal green, a cookie badge turns in and its check draws itself, with a
// tap of the phone: their step ("Sudah ke SIX · 09:07"), not a claim they're counted. An Edunex Presence open for the
// class is its own row over the button, as the desktop's card says it: "Isi Presensi", "tutup 09:30". No class on: the
// next one with a countdown; none today: tomorrow's first, calmly. A tap on the card opens its class's sheet (./class-sheet.tsx).
// While the first read runs, the card shows what won't change and holds the rest in its place (./now-hold.ts).
import * as Haptics from "expo-haptics";
import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet, type TextStyle, View, type ViewStyle } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { checkingIn } from "../../../../src/core/check-in";
import type { NowCard } from "../../../../src/core/needs";
import { dayNoon } from "../../../../src/core/schedule";
import { useSettling } from "../../host/settling";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { useFirstReadRunning } from "../../shell/source-status";
import { BigButton } from "../../ui/big-button";
import { Skeleton } from "../../ui/display";
import { CookieCheck, CountUp, PulseDot, WavyProgress } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile, useCourseTile } from "../../ui/tile";
import { useReadStatuses } from "../first-scan/scan";
import { useWentToCheckIn } from "./checked-in";
import { ClassSheet, cardAction, cardSubject, MainAction, PresenceStep, useCheckInOpen } from "./class-sheet";
import { type NowHold, nowHold } from "./now-hold";
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
}: {
  card: NowCard | null;
  courses: readonly TermCourse[];
  hasSchedule: boolean;
  /** The first day ahead with a class SIX shows that the app couldn't read. */
  unread: string | null;
}) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const surface = useCardStyle();
  // The demo's first sync, or the Student's first read after a sign-in (the top bar's "Membaca …").
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
  if (card) return <Card card={card} courses={courses} hold={hold} />;
  if (hold.shape) return <HeldShape />;
  // Without SIX there's no timetable: no card. With one, a quiet week, unless a class on it can't be read.
  if (!hasSchedule) return null;
  return (
    <View testID="card.now" style={[surface, { padding: space[4], gap: space[3] }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Icons.CalendarCheck size={24} color={v.muted} />
        <Text size="bodyLarge" style={{ color: v.fg2, flex: 1 }}>
          {unread ? t("home.now.unread", { day: f.relativeDay(dayNoon(unread)) }) : t("mobile.home.free")}
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

/** The card's display-face name. */
const NAME: TextStyle = { fontSize: 18, lineHeight: 24, letterSpacing: -0.2 };

function Card({ card, courses, hold }: { card: NowCard; courses: readonly TermCourse[]; hold: NowHold }) {
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
  const { ink } = tile(code);
  const place = session?.room ?? (meeting?.online ? t("mobile.home.online") : null);
  const live = card.state === "live" && slot !== null;
  const window = !session && !meeting && card.presence ? card.presence.session : null;
  // What the card leads with, the way the class stands, and where: on ("Sekarang · 9009", with the breathing dot), next
  // ("Berikutnya · 9009", a countdown), another day ("Besok 08:00 · 9009"), a window open (its time, minutes to close).
  const kicker = live
    ? [t("home.today.now"), place]
    : card.state === "next" && slot
      ? [t("mobile.home.next"), place]
      : card.state === "later" && slot
        ? [`${f.relativeDay(slot.start)} ${f.time(slot.start)}`, place]
        : [t("home.now.presenceOnly"), windowFor ? f.timeRange(windowFor.start, windowFor.end) : null];
  const progress = live && slot ? { from: slot.start, to: slot.end } : window ? { from: window.opensAt, to: window.closesAt } : null;
  const until = progress ? progress.to : card.state === "next" && slot ? slot.start : null;
  const left = until !== null ? countdown(now, until) : null;
  return (
    <View testID="card.now" accessibilityState={hold.line ? { busy: true } : undefined} style={[surface, { padding: space[4] }]}>
      <PressScale onPress={() => setOpen(true)} accessibilityHint={t("mobile.home.nowHint")} testID="action.nowClass" style={{ gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
          <CourseTile code={code} name={name} bare={hold.name} />
          <View style={{ flex: 1, minWidth: 0 }}>
            {hold.line ? (
              <Held style={{ alignSelf: "flex-start", maxWidth: "100%" }} testID="card.now.reading">
                <Text size="bodyMedium" weight="medium">
                  {kicker.filter(Boolean).join(" · ")}
                </Text>
              </Held>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {live && <PulseDot color={v.live} />}
                <Text size="bodyMedium" weight="medium" style={{ color: v.muted, flexShrink: 1 }}>
                  {kicker.filter(Boolean).join(" · ")}
                </Text>
              </View>
            )}
            <View style={{ marginTop: 3 }}>
              {hold.name ? (
                <HeldLines style={NAME}>{name}</HeldLines>
              ) : (
                <Text size="titleMedium" face="display" weight="bold" style={[NAME, { color: v.fg }]}>
                  {name}
                </Text>
              )}
            </View>
          </View>
        </View>
        {left && hold.line && (
          // The wave's track, still, in the course's colour; the minutes in their place.
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
            <View style={{ flex: 1, height: 14, justifyContent: "center" }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: `${ink}4d` }} />
            </View>
            <Held>
              <Text size="bodyMedium" face="display" weight="bold" style={{ fontSize: 15 }}>
                {`${left.value} ${t(`mobile.home.unit.${left.unit}`, { count: left.value })} ${t("mobile.home.left")}`}
              </Text>
            </Held>
          </View>
        )}
        {left && !hold.line && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
            {progress ? (
              <WavyProgress
                progress={(now - progress.from) / Math.max(1, progress.to - progress.from)}
                ink={ink}
                track={`${ink}4d`}
                label={t("presence.row.now", { time: f.time(progress.to) })}
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
      {/* Edunex's Presence, open for this class: "Isi Presensi", "tutup 09:30", the desktop's step. */}
      {!hold.line && card.presence && (
        <View style={{ marginTop: space[2] }}>
          <PresenceStep card={card} action={action} />
        </View>
      )}
      {hold.line ? null : done !== null ? (
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
      <ClassSheet card={card} courses={courses} open={open} onClose={() => setOpen(false)} />
    </View>
  );
}

/**
 * What's still coming, in its place: the stand-in laid out unseen (so the space is the same once it fills in), a calm
 * bar over it. Never read out.
 */
function Held({ children, style, testID }: { children: ReactNode; style?: ViewStyle; testID?: string }) {
  return (
    <View style={style} testID={testID}>
      <View style={{ opacity: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {children}
      </View>
      <View style={[StyleSheet.absoluteFill, { justifyContent: "center" }]}>
        <Skeleton height={12} />
      </View>
    </View>
  );
}

/** A name still coming: its stand-in laid out unseen, a bar over each of its lines (one name or two, the same space). */
function HeldLines({ children, style }: { children: string; style: TextStyle }) {
  const [lines, setLines] = useState<readonly number[]>([]);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Unseen by opacity: Android draws a "transparent" text colour as black. */}
      <View style={{ opacity: 0 }}>
        <Text
          size="titleMedium"
          face="display"
          weight="bold"
          style={style}
          onTextLayout={(event) => {
            const widths = event.nativeEvent.lines.map((line) => Math.round(line.width));
            setLines((before) => (before.join() === widths.join() ? before : widths));
          }}
        >
          {children}
        </Text>
      </View>
      {lines.map((width, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a bar per line, in order
        <Skeleton key={i} height={16} width={width} style={{ position: "absolute", left: 0, top: i * 24 + 4 }} />
      ))}
    </View>
  );
}

/**
 * No card yet, SIX's timetable on its way (or Beranda's data not in yet): the card's shape in its place, a tile, the
 * line, a name of two lines (most courses' names on a phone), the wave.
 */
export function HeldShape({ testID = "card.now.reading" }: { testID?: string }) {
  const surface = useCardStyle();
  return (
    <View testID={testID} accessibilityState={{ busy: true }} style={[surface, { padding: space[4], gap: space[4] }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
        <Skeleton height={44} width={44} style={{ borderRadius: 14 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ height: 20, justifyContent: "center" }}>
            <Skeleton height={12} width="45%" />
          </View>
          <View style={{ height: 48, marginTop: 3, justifyContent: "space-around" }}>
            <Skeleton height={16} width="85%" />
            <Skeleton height={16} width="55%" />
          </View>
        </View>
      </View>
      <View style={{ height: 20, justifyContent: "center" }}>
        <Skeleton height={4} />
      </View>
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
