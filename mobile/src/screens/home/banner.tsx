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
import { useEffect, useRef, useState } from "react";
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
import { PulseDot } from "../../ui/expressive";
import { haptic } from "../../ui/haptics";
import { type IconName, Icons } from "../../ui/icons";
import { CrossFade } from "../../ui/moves";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, THEMES, useTheme } from "../../ui/theme";
import { useReadStatuses } from "../first-scan/scan";
import { showOnSchedule } from "../schedule/schedule-screen";
import { useCheckIn, useWentToCheckIn } from "./checked-in";
import { type CardAction, ClassSheet, cardAction, cardSubject, useCheckInOpen } from "./class-sheet";
import { nowHold } from "./now-hold";
import { dayAndTime, nameOf } from "./parts";

const RADIUS = 28;

/** The classes whose Presence (or Tandai Hadir) the block offered in this run: when it's gone, the block moves on. */
const offered = new Set<string>();

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
  if (card) return <Banner card={card} courses={courses} schedule={schedule} reading={hold.line} />;
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
  return (
    <View testID={testID} accessibilityState={{ busy: true }} style={{ backgroundColor: b.soft, borderRadius: RADIUS, padding: space[5], gap: space[3] }}>
      <Skeleton height={12} width="45%" />
      <Skeleton height={20} width="85%" />
      <Skeleton height={20} width="55%" />
      <Skeleton height={48} style={{ borderRadius: 24, marginTop: space[2] }} />
    </View>
  );
}

/** A plain bar filled to where it is: the Presence's window, or the class itself. */
function PlainBar({ progress, ink, track, label }: { progress: number; ink: string; track: string; label: string }) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: track, overflow: "hidden" }}
    >
      <View style={{ width: `${Math.max(2, p * 100)}%`, height: 6, borderRadius: 3, backgroundColor: ink }} />
    </View>
  );
}

function Banner({
  card,
  courses,
  schedule,
  reading,
}: {
  card: NowCard;
  courses: readonly TermCourse[];
  schedule: readonly ClassSession[] | null;
  reading: boolean;
}) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const b = useB();
  const v = useTheme().v4;
  const tone = useCourseColor();
  const { go } = useNav();
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
  const window = !settled && card.presence ? card.presence.session : null;
  const span = window ? { from: window.opensAt, to: window.closesAt } : live && slot ? { from: slot.start, to: slot.end } : null;
  const time = window ? t("home.need.presence.closes", { time: f.dayTime(window.closesAt) }) : span ? t("mobile.home.ends", { time: f.time(span.to) }) : null;
  const ink = calm ? b.fg : on;
  const quiet = calm ? b.fg2 : on;
  const went = done !== null ? t("mobile.home.wentToSix", { time: f.time(done) }) : null;
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
        style={{ backgroundColor: calm ? b.soft : fill, borderRadius: RADIUS, padding: space[5] }}
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                {live && <PulseDot color={on} />}
                {calm && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: fill }} />}
                <Text size="labelLarge" weight="medium" numberOfLines={1} style={{ color: quiet, flex: 1 }}>
                  {kicker.filter(Boolean).join(" · ")}
                </Text>
                <Icons.ChevronRight size={20} color={quiet} />
              </View>
              <Text size="titleLarge" face="display" weight="bold" numberOfLines={2} style={{ color: ink, letterSpacing: -0.3, marginTop: 6 }}>
                {subject.name}
              </Text>
            </>
          )}
          {time && span && !reading && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginTop: space[3], minHeight: 20 }}>
              <PlainBar
                progress={(now - span.from) / Math.max(1, span.to - span.from)}
                ink={on}
                track={`${on}59`}
                label={window ? t("home.now.presenceOnly") : t("presence.row.now", { time: f.time(span.to) })}
              />
              <Text size="labelLarge" weight="semibold" tabular style={{ color: on }}>
                {time}
              </Text>
            </View>
          )}
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
        {!reading && !settled && action && <BannerAction card={card} action={action} ink={fill} on={on} />}
      </CrossFade>
      {sheet.current && <ClassSheet card={card} courses={courses} open={open} onClose={() => setOpen(false)} />}
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
          icon: "ArrowUpRight",
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
  const Glyph = button.icon ? Icons[button.icon] : null;
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
      {Glyph && <Glyph size={20} weight="fill" color={ink} />}
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
