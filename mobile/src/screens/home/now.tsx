// "Sekarang": the class on now (or next), where its attendance counts and the one thing to do,
// as src/app/screens/home.tsx says it. On a phone the card stays on top and its actions run the
// card's full width under the words, within a thumb's reach.
import { Children, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { budgetLabel, useActionLabel } from "../../../../src/app/attendance-labels";
import { type TermCourse, useCourseColor } from "../../../../src/app/courses";
import { useOpenCheckIn, useOpenExternal } from "../../../../src/app/hooks";
import { type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset, useStatus } from "../../../../src/app/store";
import { type AttendanceHealth, percent } from "../../../../src/core/attendance";
import { checkingIn } from "../../../../src/core/check-in";
import { sixTimetableUrl } from "../../../../src/core/links";
import type { ClassSession, SixCheckIn } from "../../../../src/core/models";
import type { NowCard } from "../../../../src/core/needs";
import { dayNoon } from "../../../../src/core/schedule";
import { type Route, useNav } from "../../nav";
import { CountdownBar } from "../../parts/meter";
import { NowCard as NowCardShell, NowZone } from "../../parts/now-card";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { Button } from "../../ui/controls";
import { Card, CourseDot, LiveDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { classDayTime, DAY, MINUTE, movedLabel, nameOf, STATE_TEXT, toned } from "./parts";

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
  if (card) return <NowCardView card={card} courses={courses} />;
  // Without SIX there's no timetable: "Hari ini" says how to get it. With one, a quiet week, unless a class on it can't be read.
  if (!hasSchedule) return null;
  if (unread)
    return (
      <Card variant="sunken" testID="card.now" style={{ paddingHorizontal: space[4], paddingVertical: space[4], gap: space[3] }}>
        <View>
          <Meta tone="fg">{t("home.now.unread", { day: f.relativeDay(dayNoon(unread)) })}</Meta>
          <Text size="small" tone="muted">
            {t("schedule.unread.hint", { count: 1 })}
          </Text>
        </View>
        <OpenSixTimetable day={unread} />
      </Card>
    );
  return (
    <Card variant="sunken" testID="card.now" style={{ paddingHorizontal: space[4], paddingVertical: space[4] }}>
      <Text tone="muted">{t("home.now.free")}</Text>
    </Card>
  );
}

function NowCardView({ card, courses }: { card: NowCard; courses: readonly TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const { go } = useNav();
  const facts = card.class;
  const session = facts?.session ?? null;
  const meeting = card.meeting?.meeting ?? null;
  // A meeting only Edunex announced stands where a class would: its time, its link.
  const slot = session ?? meeting;
  const link = facts?.link ?? meeting?.link ?? null;
  const fresh = useStatus(meeting ? "edunex" : "six").state === "live";
  const code = session?.courseCode ?? card.meeting?.code ?? card.presence!.code;
  const color = useCourseColor()(code);
  const course = courses.find((c) => c.code === code);
  // A window alone on the card: the class it's for, as a window can stay open for days, into the next one.
  const windowFor = !session && card.presence ? (card.presence.class ?? card.presence.session) : null;
  const live = card.state === "live";

  const eyebrow =
    live && slot
      ? t("home.now.live", { time: f.time(slot.end) })
      : card.state === "next" && slot
        ? t("home.now.next", { when: f.fromNow(slot.start) })
        : card.state === "later" && slot
          ? t("home.now.later", { day: f.relativeDay(slot.start) })
          : t("home.now.presenceOnly");

  const open = (): Route => (course?.edunex ? { screen: "course", code, tab: "meetings" } : { screen: "presence" });
  const name = nameOf(courses, code, session?.courseName);

  return (
    <NowCardShell
      testID="card.now"
      // Lifted while it matters now: a class on, or a Presence window to do.
      raised={live || Boolean(card.presence && card.presence.counts !== false)}
      time={slot ? { start: f.time(slot.start), end: f.time(slot.end) } : null}
      eyebrow={
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          {live && (fresh ? <LiveDot /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.faint }} />)}
          <View style={{ flex: 1 }}>
            <Meta>{toned(eyebrow, live ? "success" : "muted", { weight: "medium" })}</Meta>
          </View>
        </View>
      }
      title={
        <Pressable accessibilityRole="link" onPress={() => go(open())} testID="action.openCourse">
          <Text size="heading" weight="semibold" numberOfLines={2} style={{ letterSpacing: -0.2 }}>
            {name}
          </Text>
        </Pressable>
      }
      meta={
        <Meta>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <CourseDot color={color} size={8} />
            <Text size="small" weight="semibold" tabular>
              {code}
            </Text>
          </View>
          {session?.room ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icons.MapPin size={14} color={theme.color.muted} />
              <Text size="small" tone="muted">
                {session.room}
              </Text>
            </View>
          ) : (
            ""
          )}
          {windowFor ? classDayTime(f, windowFor.start, windowFor.end) : ""}
          {session && !/^kuliah$/i.test(session.activity) ? (
            // An exam reads by its word and weight; red is for what is lost, overdue or failing (docs/design-system.md).
            <Text size="small" weight="semibold" tone="muted">
              {session.activity}
            </Text>
          ) : (
            ""
          )}
          {meeting ? t(meeting.online ? "home.today.meetingOnline" : "home.today.meeting", { number: meeting.number }) : ""}
        </Meta>
      }
      note={
        facts?.moved ? (
          <View style={{ marginTop: space[1] }}>
            <Meta>{toned(movedLabel(t, f, facts), "warning", { weight: "medium" })}</Meta>
          </View>
        ) : meeting && !card.meeting?.maybeInSix ? (
          // Read from the lecturer's text, not SIX: said where the Student decides to go. Not on a day SIX shows a class the app couldn't read.
          <Text size="small" weight="medium" tone="warning" style={{ marginTop: space[1] }}>
            {t("home.today.notInSix")}
          </Text>
        ) : undefined
      }
      action={
        link && card.state !== "later" && !card.presence?.counts ? (
          <JoinButton link={link} code={code} primary={live || (slot !== null && slot.start - now < 15 * MINUTE)} />
        ) : undefined
      }
    >
      <Attendance card={card} />
      {card.after && <AfterThis session={card.after} courses={courses} />}
      {card.unreadDay && <UnreadAhead day={card.unreadDay} />}
    </NowCardShell>
  );
}

/** A quiet line under the card's zones, split off by a hairline. */
function CardLine({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.color.line,
        paddingHorizontal: space[4],
        paddingVertical: space[2.5],
        gap: space[2],
      }}
    >
      {children}
    </View>
  );
}

/** Under the card: a day up to its class's with a class the app couldn't read, so the card's class isn't taken for the only one. */
function UnreadAhead({ day }: { day: string }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  return (
    <CardLine>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Icons.Info size={14} color={theme.color.faint} />
        <View style={{ flex: 1 }}>
          <Meta>{t("home.now.unread", { day: f.relativeDay(dayNoon(day)) })}</Meta>
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        <OpenSixTimetable day={day} />
      </View>
    </CardLine>
  );
}

function AfterThis({ session, courses }: { session: NonNullable<NowCard["after"]>; courses: readonly TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  return (
    <CardLine>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
        <View style={{ paddingTop: 3 }}>
          <Icons.ArrowRight size={14} color={theme.color.faint} />
        </View>
        {/* One flowing line, the room glued to its dot: on a wrap "· TVST C" starts the next line, so it never reads
            as the end of the course's name. */}
        <Text size="small" tone="muted" style={{ flex: 1 }}>
          {`${t("home.now.after", { time: f.time(session.start), course: session.courseCode })} ${nameOf(courses, session.courseCode, session.courseName)}`}
          {session.room && (
            <>
              {" "}
              <Text size="small" tone="faint">
                ·
              </Text>
              {`\u00a0${session.room.replace(/ /g, "\u00a0")}`}
            </>
          )}
        </Text>
      </View>
    </CardLine>
  );
}

/**
 * Where attendance counts, and the one thing to do: "Tandai Hadir" in SIX (while the class is on,
 * what the app last saw of SIX's button, and the way to it), or the Edunex Presence before it
 * closes. With both, SIX comes first.
 */
function Attendance({ card }: { card: NowCard }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const { go } = useNav();
  const external = useOpenExternal();
  const actionLabel = useActionLabel();
  const student = useDataset("six.student");
  const checkIns = useDataset("six.checkIn");
  const facts = card.class;
  const presence = card.presence;
  const counted = facts?.countedIn ?? "unknown";

  const budget = facts?.health && facts.state !== "unknown" ? cardBudget(t, facts.health) : null;
  const where = presence?.counts
    ? t("home.now.countEdunex")
    : presence?.noSix
      ? t("home.now.countNoSix")
      : presence && presence.counts === null
        ? t("home.now.countNotKnown")
        : counted === "six" || counted === "both"
          ? t("home.now.countSix")
          : facts
            ? t("home.now.countUnknown")
            : null;

  // A Presence recorded by handing in a Task opens that Task here, so its button says so; any other opens Edunex.
  const viaTask = presence?.activity === "assignment" && presence.task !== null;
  const openPresence = () => {
    if (!presence) return;
    if (viaTask && presence.task) go({ screen: "task", taskId: presence.task.id });
    else external(presence.url);
  };
  const presenceButton = (variant: "primary" | "secondary" | "ghost") =>
    presence && (
      <Button
        variant={variant}
        size={variant === "ghost" ? "sm" : "md"}
        icon={viaTask ? undefined : <Icons.ArrowUpRight size={16} color={variant === "primary" ? theme.color.onAccent : theme.color.muted} />}
        onPress={openPresence}
        label={viaTask ? t("home.now.openTask") : t("home.now.recordLabel", { course: presence.code })}
        testID="action.presence"
        style={variant === "ghost" ? { alignSelf: "flex-start", marginLeft: -space[3] } : { marginTop: space[3] }}
      >
        {viaTask ? t("home.now.openTask") : t("presence.open.record")}
      </Button>
    );

  // The class on now (or about to start) while the app reads its popup on SIX: where SIX counts, or once SIX showed its button.
  const session = facts?.session ?? null;
  const check = session ? checkIns?.[session.id] : undefined;
  if (session && student && (card.state === "live" || card.state === "next") && checkingIn(session, now)) {
    if (check || counted === "six" || counted === "both" || counted === "unknown")
      return (
        <CheckIn session={session} check={check} url={sixTimetableUrl(student, session.start)} budget={budget}>
          {presence && (
            <View style={{ marginTop: space[3], paddingTop: space[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.line }}>
              <Text size="small" tone="muted">
                {/* Optional only where it's known not to count; not known yet, it's simply there to do. */}
                {presence.counts !== false
                  ? t("presence.record.edunexDo", {
                      action: actionLabel({ action: { activity: presence.activity, task: presence.task, url: presence.url } }),
                      time: f.dayTime(presence.session.closesAt),
                    })
                  : t("home.now.presenceExtra", { time: f.dayTime(presence.session.closesAt) })}
              </Text>
              {presenceButton("ghost")}
            </View>
          )}
        </CheckIn>
      );
  }

  // Doing it counts, or nobody can say yet (doing it costs nothing): the Presence is the action.
  if (presence && presence.counts !== false) {
    const { session: window } = presence;
    const action = actionLabel({ action: { activity: presence.activity, task: presence.task, url: presence.url } });
    // Without SIX nobody can say it counts: worth doing just in case, so said calmly, its button quiet.
    const quiet = presence.noSix;
    return (
      <NowZone>
        <ZoneHead icon={<Icons.Hand size={16} color={quiet ? theme.color.muted : theme.color.accentFg} />} strong>
          {t("home.now.presenceDo", { action, time: f.dayTime(window.closesAt) })}
        </ZoneHead>
        <ZoneFacts>
          {where ?? ""}
          {budget ?? ""}
        </ZoneFacts>
        {presenceButton(quiet ? "secondary" : "primary")}
        <CountdownBar
          style={{ marginTop: space[3] }}
          opensAt={window.opensAt}
          closesAt={window.closesAt}
          now={now}
          // Under a day, how long is left; a window can stay open for days, and "50 jam" says nothing.
          label={
            window.closesAt - now < DAY
              ? t("home.now.closesIn", { left: f.countdown(window.closesAt) })
              : t("home.now.closesWhen", { when: f.fromNow(window.closesAt) })
          }
          // "tutup besok" under "sebelum besok, 23:00" would say it twice.
          showLabel={window.closesAt - now < DAY || f.dayOffset(window.closesAt) > 1}
        />
      </NowZone>
    );
  }

  if (!where && !presence) return null;
  return (
    <NowZone>
      {where && <ZoneHead icon={<Icons.CheckCircle size={16} weight="bold" color={theme.color.successFg} />}>{where}</ZoneHead>}
      <ZoneFacts>
        {budget ?? ""}
        {presence ? t("home.now.presenceExtra", { time: f.dayTime(presence.session.closesAt) }) : ""}
      </ZoneFacts>
      {presenceButton("ghost")}
    </NowZone>
  );
}

/** A zone's first line: its icon, then what to know or do. */
function ZoneHead({ icon, strong = false, children }: { icon: ReactNode; strong?: boolean; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
      <View style={{ paddingTop: 3 }}>{icon}</View>
      <Text weight={strong ? "semibold" : "medium"} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/** A zone's facts, under its first line's words; none, no line. */
function ZoneFacts({ children }: { children: ReactNode }) {
  if (Children.toArray(children).every((child) => child === "")) return null;
  return (
    <View style={{ marginTop: 2, paddingLeft: 24 }}>
      <Meta>{children}</Meta>
    </View>
  );
}

/** SIX's "Tandai Hadir" for the class on now: open (the button shows), gone (it showed, and doesn't now), or still to come. */
function CheckIn({
  session,
  check,
  url,
  budget,
  children,
}: {
  session: ClassSession;
  check: SixCheckIn | undefined;
  url: string;
  budget: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const openCheckIn = useOpenCheckIn();
  const state = check?.state ?? "waiting";
  const variant = state === "open" ? "primary" : state === "waiting" ? "secondary" : "ghost";
  return (
    <NowZone>
      <ZoneHead icon={<Icons.Hand size={16} color={state === "open" ? theme.color.accentFg : theme.color.muted} />} strong={state === "open"}>
        {state === "open" ? t("home.now.checkInOpen") : state === "gone" ? t("home.now.checkInGone") : t("home.now.checkInWatch")}
      </ZoneHead>
      <ZoneFacts>
        {state === "open" ? t("home.now.checkInOpenHint", { time: f.time(session.end) }) : state === "waiting" ? t("home.now.checkEvery") : ""}
        {budget ?? ""}
      </ZoneFacts>
      <Button
        variant={variant}
        icon={<Icons.ArrowUpRight size={16} color={variant === "primary" ? theme.color.onAccent : variant === "ghost" ? theme.color.muted : theme.color.fg} />}
        onPress={() => openCheckIn(session.id, url)}
        label={t("home.now.openSixLabel", { course: session.courseCode })}
        testID="action.checkIn"
        style={{ marginTop: space[3] }}
      >
        {t("home.now.openSix")}
      </Button>
      {children}
    </NowZone>
  );
}

function JoinButton({ link, code, primary = false }: { link: string; code: string; primary?: boolean }) {
  const t = useT();
  const theme = useTheme();
  const open = useOpenExternal();
  return (
    <Button
      variant={primary ? "primary" : "secondary"}
      icon={<Icons.Video size={16} color={primary ? theme.color.onAccent : theme.color.fg} />}
      onPress={() => open(link)}
      label={t("home.today.joinLabel", { course: code })}
      testID="action.join"
      style={{ flexGrow: 1 }}
    >
      {t("home.today.join")}
    </Button>
  );
}

/**
 * The now card's few words for its course's attendance, two facts for its line (a fragment, so
 * Meta puts its dot between them): SIX's share, labeled ("Kehadiran 93%"), then what's left
 * ("Sisa jatah absen 1×", or the state when none is) in the state's color. From
 * src/app/screens/home.tsx (cardBudget).
 */
function cardBudget(t: Translate, health: AttendanceHealth): ReactNode {
  return (
    <>
      {health.held ? t("home.now.share", { percent: percent(health.attended ?? 0, health.held) }) : ""}
      <Text size="small" tone={STATE_TEXT[health.state]}>
        {budgetLabel(t, health)}
      </Text>
    </>
  );
}
