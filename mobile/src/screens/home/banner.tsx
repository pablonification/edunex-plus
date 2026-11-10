// What's on now (`home.now`): one block in the course's own colour, the only block of colour on Beranda's white page. It
// says each thing once: where the class stands and its room ("Sekarang · 9009", the breathing dot), its name, one plain
// bar with the one time that matters at its end ("tutup 09:30" while a Presence is open, else when the class ends), and
// one white button when there's something to press. A tap on the block opens the class's sheet (./class-sheet.tsx).
//
// Its states: a class on now with a Presence (or Tandai Hadir) open; on now with nothing to press (the bar runs to the
// class's end); next up today (its time in the line over the name, no bar); nothing left today (a calm block for the
// next day's first class, or a calm line for a free week); the first read still running (./now-hold.ts); and no block at
// all without SIX's timetable. Once the Presence the block offered is gone (marked, or closed), the block moves on to
// what's next: the next class today, else the next day's first, else a calm line. What the app can know: that the
// Student went to SIX from here and SIX's button is gone, or that the Edunex window it showed in this run is no longer
// open. It can't know SIX counted them: SIX says so only after class (the class sheet).
//
// Nothing false, and nothing that moves, while the first read runs (round 1's first-minute charge: the block grew
// about 100 px when "Isi Presensi" arrived and the course's name flipped from English to Indonesian). The block is
// drawn at its final height from the first paint: the line over the name, the name (until the official one is in),
// the bar and the button each stand as a quiet shape in their own place, and the room they took is kept for that
// class afterwards (`kept`), so nothing under the block moves once it's on screen.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import { type TermCourse, useCourseColor } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { checkingIn } from "../../../../src/core/check-in";
import { wibDay } from "../../../../src/core/course-meetings";
import { sixTimetableUrl } from "../../../../src/core/links";
import type { ClassSession } from "../../../../src/core/models";
import type { NowCard } from "../../../../src/core/needs";
import { dayNoon } from "../../../../src/core/schedule";
import { useSettling } from "../../host/settling";
import { useNav } from "../../nav";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { useFirstReadRunning } from "../../shell/source-status";
import { useB } from "../../ui/b";
import { Skeleton } from "../../ui/display";
import { haptic } from "../../ui/haptics";
import { type IconName, Icons } from "../../ui/icons";
import { PlainBar, PresenceButton } from "../../ui/kit";
import { CrossFade } from "../../ui/moves";
import { PressScale } from "../../ui/press";
import { Text, useTextWidth } from "../../ui/text";
import { space, THEMES, useTheme } from "../../ui/theme";
import { useReadStatuses } from "../first-scan/scan";
import { showOnSchedule } from "../schedule/schedule-screen";
import { useCheckIn, useWentToCheckIn } from "./checked-in";
import { type CardAction, ClassSheet, cardAction, cardSubject, useCheckInOpen } from "./class-sheet";
import { nowHold } from "./now-hold";
import { dayAndTime, LiveDot, nameOf } from "./parts";

const RADIUS = 28;
/** The block's inside edge, the name's line and the rows under it: tight, so more of the day shows above the fold. */
const PAD = space[4];
const NAME_LINE = 26;
const BAR_ROW = 20;
const BUTTON = 48;

/**
 * The room the block kept for a class while the first read ran (two lines of name, the bar's row, the button's):
 * held for that class for the rest of the run, so the block never shrinks or grows under the grid.
 */
const kept = new Map<string, { name: boolean; rows: boolean }>();

/** The classes whose Presence (or Tandai Hadir) the block offered in this run: when it's gone, the block moves on. */
const offered = new Set<string>();

/**
 * The class the block moved on to (its course and start), so the list under it doesn't say that class again
 * (./later.tsx). Null while the block shows its own card's class: the list already leaves that one out.
 */
let movedOnTo: string | null = null;
const watching = new Set<() => void>();
const watch = (watcher: () => void) => {
  watching.add(watcher);
  return () => void watching.delete(watcher);
};
export const blockClassKey = (code: string, start: number) => `${code}:${start}`;
export const useBlockMovedOnTo = (): string | null => useSyncExternalStore(watch, () => movedOnTo);

/** What comes after the block's class: today's next (the card's own), else the first class after now on another day. */
type After = { code: string; name?: string; start: number; room: string | null; today: boolean };

function afterOf(card: NowCard, schedule: readonly ClassSession[] | null, now: number, skip: string | null): After | null {
  if (card.after) return { code: card.after.courseCode, name: card.after.courseName, start: card.after.start, room: card.after.room ?? null, today: true };
  const next = (schedule ?? []).filter((session) => session.start > now && session.id !== skip).sort((a, b) => a.start - b.start)[0];
  return next ? { code: next.courseCode, name: next.courseName, start: next.start, room: next.room ?? null, today: wibDay(next.start) === wibDay(now) } : null;
}

export function NowBanner({
  card,
  courses,
  schedule,
  unread,
}: {
  card: NowCard | null;
  courses: readonly TermCourse[];
  /** SIX's timetable, null without SIX. */
  schedule: readonly ClassSession[] | null;
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
  if (card) return <Banner card={card} courses={courses} schedule={schedule} reading={hold.line} holdName={hold.name} />;
  if (hold.shape) return <BannerShape />;
  // Without SIX there's no timetable: no block, and the strip leads. With one, a quiet week, unless a class on it can't be read.
  if (schedule === null) return null;
  return (
    <View testID="home.now" style={{ backgroundColor: b.soft, borderRadius: RADIUS, padding: space[5], gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Icons.CalendarCheck size={24} weight="fill" color={b.muted} />
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
  const scale = useTextWidth(1);
  return (
    <View testID={testID} accessibilityState={{ busy: true }} style={{ backgroundColor: b.soft, borderRadius: RADIUS, padding: PAD }}>
      <View style={{ height: 20 * scale, justifyContent: "center" }}>
        <Skeleton height={12} width="45%" />
      </View>
      <View style={{ height: 2 * NAME_LINE * scale, marginTop: space[1], justifyContent: "space-evenly" }}>
        <Skeleton height={18} width="85%" />
        <Skeleton height={18} width="55%" />
      </View>
      <View style={{ height: BAR_ROW * scale, marginTop: space[2.5], justifyContent: "center" }}>
        <Skeleton height={4} />
      </View>
      <Skeleton height={BUTTON} style={{ borderRadius: 14, marginTop: space[3] }} />
    </View>
  );
}

function Banner({
  card,
  courses,
  schedule,
  reading,
  holdName,
}: {
  card: NowCard;
  courses: readonly TermCourse[];
  schedule: readonly ClassSession[] | null;
  /** The first read runs: the line, the bar and the button are held as shapes. */
  reading: boolean;
  /** And the course isn't named officially yet: the name is held too, so it's said once and never changes. */
  holdName: boolean;
}) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const b = useB();
  const v = useTheme().v4;
  const tone = useCourseColor();
  const { go } = useNav();
  const scale = useTextWidth(1);
  const [open, setOpen] = useState(false);
  // The sheet is drawn once it's asked for: not on Beranda's first frame.
  const sheet = useRef(false);
  if (open) sheet.current = true;
  const { session, meeting, slot, code } = cardSubject(card);
  const checkInOpen = useCheckInOpen(card);
  const action = cardAction(card, now, checkInOpen);
  const done = useDone(card);
  // The Presence the block offered is gone (marked or closed): the block moves on to what's next.
  const pressable = action === "checkIn" || action === "presence";
  if (session && pressable && !reading) offered.add(session.id);
  const settled = session !== null && !reading && action === null && (offered.has(session.id) || done !== null);
  const after = settled ? afterOf(card, schedule, now, session?.id ?? null) : null;
  const subject = after ? { code: after.code, name: nameOf(courses, after.code, after.name) } : { code, name: nameOf(courses, code, session?.courseName) };
  // The course's deep colour in both themes, white on it: one block that reads the same by day and by night.
  const fill = THEMES.light.courseTile(tone(subject.code)).ink;
  const on = v.onHead;
  const place = session?.room ?? (meeting?.online ? t("mobile.home.online") : null);
  const live = card.state === "live" && slot !== null && !settled;
  // Calm, on the page's soft surface: a class on another day (nothing left today), or nothing at all after this one.
  const calm = settled ? !after?.today : card.state === "later" && action === null;
  const kicker = settled
    ? after
      ? [after.today ? t("mobile.home.next") : null, after.today ? f.time(after.start) : dayAndTime(t, f, after.start), after.room]
      : []
    : live
      ? [t("home.today.now"), place]
      : card.state === "next" && slot
        ? [t("mobile.home.next"), f.time(slot.start), place]
        : card.state === "later" && slot
          ? [dayAndTime(t, f, slot.start), place]
          : // A window alone: the class it's for, when there is one. Its own close is the bar's, said once there.
            [t("home.now.presenceOnly"), card.presence?.class ? f.timeRange(card.presence.class.start, card.presence.class.end) : null];
  // One bar, one time: the Presence's window while one is open (it's what runs out first), else the class itself.
  // With SIX's Tandai Hadir on the button the bar is the class's: the bar and the button never speak of two things.
  const window = !settled && card.presence && action !== "checkIn" ? card.presence.session : null;
  const span = window ? { from: window.opensAt, to: window.closesAt } : live && slot ? { from: slot.start, to: slot.end } : null;
  const time = window ? t("home.need.presence.closes", { time: f.dayTime(window.closesAt) }) : span ? t("mobile.home.ends", { time: f.time(span.to) }) : null;
  const ink = calm ? b.fg : on;
  const quiet = calm ? b.fg2 : on;
  const went = done !== null ? t("mobile.home.wentToSix", { time: f.time(done) }) : null;
  const movedTo = after ? blockClassKey(after.code, after.start) : null;
  useEffect(() => {
    if (movedOnTo === movedTo) return;
    movedOnTo = movedTo;
    for (const watcher of watching) watcher();
  }, [movedTo]);
  // The room held during the first read, kept for this class: a class on now can get a bar and a button.
  const key = session?.id ?? `${card.state}:${code}`;
  if (reading && !kept.has(key)) kept.set(key, { name: holdName, rows: card.state === "live" || card.presence !== null });
  const room = settled ? undefined : kept.get(key);
  const shape = calm ? b.line : `${on}40`;
  const showBar = Boolean(time && span && !reading);
  const showAction = !reading && !settled && action !== null;
  const onPress = () => {
    if (!settled) return setOpen(true);
    if (!after) return go({ screen: "schedule" });
    showOnSchedule(wibDay(after.start));
    go({ screen: "schedule" });
  };
  return (
    <View testID="home.now" accessibilityState={reading ? { busy: true } : undefined}>
      <CrossFade
        id={settled ? `after:${after?.code ?? "none"}` : `${card.state}:${code}`}
        style={{ backgroundColor: calm ? b.soft : fill, borderRadius: RADIUS, padding: PAD }}
      >
        <PressScale onPress={onPress} accessibilityHint={settled ? undefined : t("mobile.home.nowHint")} testID="action.nowClass">
          {settled && !after ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
              <Icons.CheckCircle size={24} weight="fill" color={b.ok} />
              <Text size="bodyLarge" style={{ color: b.fg2, flex: 1 }}>
                {t("mobile.home.noneLeft")}
              </Text>
              <Icons.ChevronRight size={20} color={b.muted} />
            </View>
          ) : (
            <>
              {reading ? (
                // The line over the name, held: what half the data says about it changes when the rest is in.
                <View style={{ height: 20 * scale, justifyContent: "center" }}>
                  <View style={{ width: "45%", height: 12, borderRadius: 6, backgroundColor: shape }} />
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 20 * scale }}>
                  {live && <LiveDot color={on} />}
                  {calm && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: fill }} />}
                  <Text size="labelLarge" weight="medium" numberOfLines={1} style={{ color: quiet, flex: 1 }}>
                    {kicker.filter(Boolean).join(" · ")}
                  </Text>
                  <Icons.ChevronRight size={20} color={quiet} />
                </View>
              )}
              {/* One name from the first paint: its shape until the official one is in, then two lines' room kept. */}
              <View style={{ marginTop: space[1], minHeight: room?.name ? 2 * NAME_LINE * scale : undefined, justifyContent: "center" }}>
                {reading && holdName ? (
                  <View style={{ height: 2 * NAME_LINE * scale, justifyContent: "space-evenly" }}>
                    <View style={{ width: "85%", height: 18, borderRadius: 9, backgroundColor: shape }} />
                    <View style={{ width: "55%", height: 18, borderRadius: 9, backgroundColor: shape }} />
                  </View>
                ) : (
                  <Text
                    size="titleLarge"
                    face="display"
                    weight="bold"
                    numberOfLines={2}
                    style={{ color: ink, fontSize: 20, lineHeight: NAME_LINE, letterSpacing: -0.3 }}
                  >
                    {subject.name}
                  </Text>
                )}
              </View>
            </>
          )}
          {/* One bar, and the time at its end says what it measures: "tutup 09:30" (the Presence), "selesai 10:00" (the class). */}
          {showBar && span ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: space[2.5], minHeight: BAR_ROW * scale }}>
              <PlainBar
                value={(now - span.from) / Math.max(1, span.to - span.from)}
                color={on}
                track={`${on}59`}
                height={6}
                label={window ? t("home.now.presenceOnly") : t("presence.row.now", { time: f.time(span.to) })}
                end={time ?? undefined}
                endColor={on}
              />
            </View>
          ) : room?.rows ? (
            // The bar's place, held: its track alone while the read runs, its room after it.
            <View style={{ height: BAR_ROW * scale, marginTop: space[2.5], justifyContent: "center" }}>
              {reading && <View style={{ height: 6, borderRadius: 3, backgroundColor: shape }} />}
            </View>
          ) : null}
          {/* The Student's own step, said once as the block moves on: never a claim that SIX counted it. */}
          {settled && went && (
            <View testID="card.now.checkedIn" style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginTop: space[3] }}>
              <Icons.CheckCircle size={16} weight="fill" color={quiet} />
              <Text size="labelLarge" weight="medium" numberOfLines={1} style={{ color: quiet, flex: 1 }}>
                {went}
              </Text>
            </View>
          )}
        </PressScale>
        {showAction && action ? (
          <BannerAction card={card} action={action} ink={fill} />
        ) : room?.rows ? (
          // The button's place, held: a quiet shape while the read runs, never a button that isn't there yet.
          <View style={{ height: BUTTON, marginTop: space[3], borderRadius: 14, backgroundColor: reading ? shape : "transparent" }} />
        ) : null}
      </CrossFade>
      {sheet.current && <ClassSheet card={card} courses={courses} open={open} onClose={() => setOpen(false)} />}
    </View>
  );
}

/** The block's one button, white on the course's colour: Tandai Hadir, the Presence, or joining the online class (./class-sheet.tsx's MainAction). */
function BannerAction({ card, action, ink }: { card: NowCard; action: Exclude<CardAction, null>; ink: string }) {
  const t = useT();
  const now = useNow();
  const { go } = useNav();
  const student = useDataset("six.student");
  const checkIn = useCheckIn();
  const external = useOpenExternal();
  const { session, code, link } = cardSubject(card);
  const presence = card.presence;
  let button: { text: string; label: string; icon: IconName | null; testID: string; onPress(): void } | null = null;
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
          icon: "Hand",
          testID: "action.presence",
          onPress: () => external(presence.url),
        };
  } else if (action === "checkIn" && session && student) {
    button = {
      text: t("mobile.notification.checkIn"),
      label: t("home.now.openSixLabel", { course: session.courseCode }),
      icon: "Hand",
      testID: "action.checkIn",
      onPress: () => checkIn(session.id, sixTimetableUrl(student, session.start), now),
    };
  } else if (action === "join" && link) {
    button = {
      text: t("home.today.join"),
      label: t("home.today.joinLabel", { course: code }),
      icon: "Video",
      testID: "action.join",
      onPress: () => external(link),
    };
  }
  if (!button) return null;
  // "Isi Presensi" is the kit's one button, with its own word and the hand.
  if (action === "presence" && button.icon !== null) {
    return (
      <View style={{ marginTop: space[3] }}>
        <PresenceButton tone="course" ink={ink} wide onPress={button.onPress} accessibilityLabel={button.label} testID={button.testID} />
      </View>
    );
  }
  // "Tandai Hadir" (SIX's own word), a Task and a class link: the same part with their own word and glyph.
  return (
    <View style={{ marginTop: space[3] }}>
      <PresenceButton
        tone="course"
        ink={ink}
        wide
        label={button.text}
        icon={button.icon ?? undefined}
        onPress={button.onPress}
        accessibilityLabel={button.label}
        testID={button.testID}
      />
    </View>
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
