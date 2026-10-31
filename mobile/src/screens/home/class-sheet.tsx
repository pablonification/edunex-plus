// A class's sheet on Beranda: what the now card and Hari ini's rows leave out so they stay short (src/app/screens/
// home.tsx's now card, said in full). When and where, what changed about it, a clash, where its attendance counts and
// what's left, Tandai Hadir or an Edunex Presence open now, what comes after it, and the way to the course. The one
// thing to do is the sheet's filled button at the bottom, within reach; the way to the course sits beside it.
import type { ReactNode } from "react";
import { View } from "react-native";
import { budgetLabel } from "../../../../src/app/attendance-labels";
import type { TermCourse } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useExamIds } from "../../../../src/app/schedule-data";
import { useDataset, useStatus } from "../../../../src/app/store";
import { type AttendanceHealth, percent } from "../../../../src/core/attendance";
import { checkingIn } from "../../../../src/core/check-in";
import { sixTimetableUrl } from "../../../../src/core/links";
import type { NowCard } from "../../../../src/core/needs";
import { dayNoon } from "../../../../src/core/schedule";
import { type Route, useNav } from "../../nav";
import { CountdownBar } from "../../parts/meter";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { BigButton } from "../../ui/big-button";
import { Button } from "../../ui/controls";
import { LiveDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Sheet } from "../../ui/sheet";
import { Text, type TextTone } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { useCheckIn } from "./checked-in";
import { DAY, MINUTE, movedLabel, nameOf, STATE_TEXT } from "./parts";

/** What the sheet is about: the now card's, or a Hari ini row's class (a card of its own, with nothing beside it). */
export function ClassSheet({ card, courses, open, onClose }: { card: NowCard | null; courses: readonly TermCourse[]; open: boolean; onClose(): void }) {
  return (
    // The buttons end the content rather than sit in the sheet's footer: the native sheet measured the footer short and
    // cut its buttons off on every phone tried (mid, weak).
    <Sheet open={open && card !== null} onClose={onClose} testID="sheet.nowClass">
      {card && (
        <>
          <Details card={card} courses={courses} onLeave={onClose} />
          <View style={{ marginTop: space[6], marginBottom: space[2] }}>
            <Actions card={card} onLeave={onClose} courses={courses} />
          </View>
        </>
      )}
    </Sheet>
  );
}

/** The class or meeting the card is about, its course and its times. */
export function cardSubject(card: NowCard) {
  const session = card.class?.session ?? null;
  const meeting = card.meeting?.meeting ?? null;
  const slot = session ?? meeting;
  const code = session?.courseCode ?? card.meeting?.code ?? card.presence!.code;
  // A window alone on the card: the class it's for, as a window can stay open for days, into the next one.
  const windowFor = !session && card.presence ? (card.presence.class ?? card.presence.session) : null;
  return { session, meeting, slot, code, windowFor, link: card.class?.link ?? meeting?.link ?? null };
}

function Details({ card, courses, onLeave }: { card: NowCard; courses: readonly TermCourse[]; onLeave(): void }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const { session, meeting, slot, code, windowFor } = cardSubject(card);
  const facts = card.class;
  const live = slot !== null && slot.start <= now && now < slot.end;
  const past = slot !== null && slot.end <= now;
  const fresh = useStatus(meeting ? "edunex" : "six").state === "live";
  const kind = session && !/^kuliah$/i.test(session.activity) ? session.activity : null;
  const name = nameOf(courses, code, session?.courseName);
  const crumb = [
    code,
    kind ?? session?.activity ?? (meeting ? t(meeting.online ? "home.today.meetingOnline" : "home.today.meeting", { number: meeting.number }) : null),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={{ gap: space[4] }}>
      {/* v4: the course's tile, "PL3002 · Kuliah", the name in the display face. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}>
        <CourseTile code={code} name={name} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="bodyMedium" weight="medium" style={{ color: v.muted }}>
            {crumb}
          </Text>
          <Text size="titleLarge" face="display" weight="bold" accessibilityRole="header" style={{ color: v.fg, fontSize: 20, lineHeight: 26, marginTop: 2 }}>
            {name}
          </Text>
        </View>
      </View>
      <View>
        {slot && (
          <Fact icon={(c) => <Icons.Clock size={22} color={c} />}>
            <Text size="bodyLarge" tabular>
              {`${f.relativeDay(slot.start)} · ${f.timeRange(slot.start, slot.end)}`}
            </Text>
            {live && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                {fresh && <LiveDot />}
                <Text size="bodyMedium" tone="success">
                  {t("mobile.home.liveUntil", { time: f.time(slot.end) })}
                </Text>
              </View>
            )}
            {!live && !past && (
              <Text size="bodyMedium" tone="muted">
                {f.fromNow(slot.start)}
              </Text>
            )}
          </Fact>
        )}
        {windowFor && (
          <Fact icon={(c) => <Icons.Clock size={22} color={c} />}>{`${f.relativeDay(windowFor.start)} · ${f.timeRange(windowFor.start, windowFor.end)}`}</Fact>
        )}
        {facts?.moved && (
          <Fact tone="warning" icon={(c) => <Icons.CalendarClock size={22} color={c} />}>
            {movedLabel(t, f, facts)}
          </Fact>
        )}
        {session?.room && <Fact icon={(c) => <Icons.MapPin size={22} color={c} />}>{session.room}</Fact>}
        {meeting && !card.meeting?.maybeInSix && (
          <Fact tone="warning" icon={(c) => <Icons.Info size={22} color={c} />}>
            {t("home.today.notInSix")}
          </Fact>
        )}
        {facts?.overlap && (
          <Fact tone="warning" icon={(c) => <Icons.Overlap size={22} color={c} />}>
            {t("home.today.overlap", { course: facts.overlap.code, time: f.timeRange(facts.overlap.from, facts.overlap.to) })}
          </Fact>
        )}
        <Attendance card={card} past={past} onLeave={onLeave} />
        {card.after && (
          <Fact icon={(c) => <Icons.ArrowRight size={22} color={c} />}>
            {`${t("home.now.after", { time: f.time(card.after.start), course: card.after.courseCode })} ${nameOf(courses, card.after.courseCode, card.after.courseName)}${card.after.room ? ` · ${card.after.room}` : ""}`}
          </Fact>
        )}
        {card.unreadDay && (
          <Fact icon={(c) => <Icons.Info size={22} color={c} />}>
            <Text size="bodyLarge">{t("home.now.unread", { day: f.relativeDay(dayNoon(card.unreadDay)) })}</Text>
            <View style={{ flexDirection: "row", marginTop: space[1] }}>
              <OpenSixTimetable day={card.unreadDay} />
            </View>
          </Fact>
        )}
      </View>
    </View>
  );
}

/** One fact with its icon (v4: a 48 dp row, the icon in the quiet grey, the words a step softer than a title). */
function Fact({ icon, tone = "fg", end, children }: { icon: (color: string) => ReactNode; tone?: TextTone; end?: ReactNode; children: ReactNode }) {
  const theme = useTheme();
  const v = theme.v4;
  const color = tone === "warning" ? theme.color.warningFg : tone === "success" ? theme.color.successFg : v.muted;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 48, paddingVertical: space[2] }}>
      <View style={{ width: 22, alignItems: "center" }}>{icon(color)}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {typeof children === "string" ? (
          <Text size="bodyLarge" tone={tone} style={tone === "fg" ? { color: v.fg2 } : undefined}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
      {end}
    </View>
  );
}

/** The absences: one pip each, used in the danger colour, still allowed in the track's (v4's pip meter). */
function Pips({ health }: { health: AttendanceHealth }) {
  const v = useTheme().v4;
  const used = health.held !== null && health.attended !== null ? Math.max(0, health.held - health.attended) : 0;
  const left = Math.max(0, health.absencesLeft ?? 0);
  const total = Math.min(8, used + left);
  if (total === 0) return null;
  return (
    <View style={{ flexDirection: "row", gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: pips are positions
        <View key={i} style={{ width: 18, height: 8, borderRadius: 4, backgroundColor: i < used ? v.redFg : v.line, opacity: i < used ? 0.8 : 1 }} />
      ))}
    </View>
  );
}

/**
 * Where attendance counts, and how it stands: SIX's Tandai Hadir while the class is on (what the app last saw of its
 * button, and how often it looks), an Edunex Presence before it closes, the course's share and what's left. With both,
 * SIX comes first. From the now card of src/app/screens/home.tsx.
 */
function Attendance({ card, past, onLeave }: { card: NowCard; past: boolean; onLeave(): void }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const checkIns = useDataset("six.checkIn");
  const student = useDataset("six.student");
  const facts = card.class;
  const presence = card.presence;
  const counted = facts?.countedIn ?? "unknown";
  const session = facts?.session ?? null;
  const health = facts?.health && facts.state !== "unknown" ? facts.health : null;
  const check = session ? checkIns?.[session.id] : undefined;
  const watching = session && student && !past && (card.state === "live" || card.state === "next") && checkingIn(session, now);
  // Tandai Hadir's state as a label, never the how (the rules: no explanatory sentences on Beranda's sheets).
  const checkLine = watching
    ? check?.state === "open"
      ? { key: "mobile.home.checkIn.open" as const, tone: "success" as const }
      : check?.state === "gone"
        ? { key: "mobile.home.checkIn.gone" as const, tone: "fg" as const }
        : counted === "six" || counted === "both" || counted === "unknown" || check
          ? { key: "mobile.home.checkIn.waiting" as const, tone: "fg" as const }
          : null
    : null;
  const window = presence?.session ?? null;
  if (!health && !checkLine && !presence) return null;
  return (
    <>
      {health && (
        <Fact icon={(c) => <Icons.Hand size={22} color={c} />} end={<Pips health={health} />}>
          <Text size="bodyLarge" weight="medium" tone={STATE_TEXT[health.state]} style={STATE_TEXT[health.state] === "muted" ? { color: v.fg2 } : undefined}>
            {budgetLabel(t, health)}
          </Text>
          {health.held ? (
            <Text size="bodyMedium" tone="muted">
              {t("mobile.home.share", { percent: percent(health.attended ?? 0, health.held), target: health.target })}
            </Text>
          ) : null}
        </Fact>
      )}
      {checkLine && (
        <Fact tone={checkLine.tone} icon={(c) => <Icons.CheckCircle size={22} color={c} />}>
          {t(checkLine.key)}
        </Fact>
      )}
      {presence && window && (
        <Fact icon={(c) => <Icons.ListChecks size={22} color={c} />}>
          <Text size="bodyLarge" style={{ color: v.fg2 }}>
            {t("mobile.home.presenceUntil", { time: f.dayTime(window.closesAt) })}
          </Text>
          {presence.counts !== false && (
            <CountdownBar
              style={{ marginTop: space[2] }}
              opensAt={window.opensAt}
              closesAt={window.closesAt}
              now={now}
              label={
                window.closesAt - now < DAY
                  ? t("home.now.closesIn", { left: f.countdown(window.closesAt) })
                  : t("home.now.closesWhen", { when: f.fromNow(window.closesAt) })
              }
              showLabel={window.closesAt - now < DAY || f.dayOffset(window.closesAt) > 1}
            />
          )}
          {/* Optional where it's known not to count: a quiet way to it here, the footer keeps the class's own. */}
          {presence.counts === false && <PresenceButton card={card} variant="ghost" onLeave={onLeave} />}
        </Fact>
      )}
    </>
  );
}

/** The one thing to do for this card, if any: what the card's button does too. */
export type CardAction = "checkIn" | "presence" | "join" | null;

export function cardAction(card: NowCard, now: number, checkInOpen: boolean): CardAction {
  const { slot, link } = cardSubject(card);
  if (checkInOpen) return "checkIn";
  if (card.presence && card.presence.counts !== false) return "presence";
  if (link && card.state !== "later" && (card.state === "live" || (slot !== null && slot.start - now < 15 * MINUTE))) return "join";
  return null;
}

/** Whether SIX shows Tandai Hadir for the card's class right now (as the app last read it). */
export function useCheckInOpen(card: NowCard): boolean {
  const now = useNow();
  const checkIns = useDataset("six.checkIn");
  const student = useDataset("six.student");
  const session = card.class?.session;
  return Boolean(
    session && student && (card.state === "live" || card.state === "next") && checkingIn(session, now) && checkIns?.[session.id]?.state === "open",
  );
}

/** The footer: the one thing to do (filled), then the way to the course (or the exam). */
function Actions({ card, courses, onLeave }: { card: NowCard; courses: readonly TermCourse[]; onLeave(): void }) {
  const t = useT();
  const now = useNow();
  const { go } = useNav();
  const examIds = useExamIds();
  const checkInOpen = useCheckInOpen(card);
  const action = cardAction(card, now, checkInOpen);
  const { session, code } = cardSubject(card);
  const course = courses.find((c) => c.code === code);
  const examId = session ? examIds.get(session.id) : undefined;
  const target: Route | null = examId
    ? { screen: "exam", examId }
    : course?.edunex
      ? { screen: "course", code, tab: "meetings" }
      : course
        ? { screen: "presence" }
        : null;
  const leave = (route: Route) => {
    onLeave();
    go(route);
  };
  // v4: the one thing to do filled, the way to the course (or the exam) outlined under it.
  return (
    <View style={{ gap: space[2] }}>
      {action && <MainAction card={card} action={action} onLeave={onLeave} />}
      {target && (
        <BigButton variant="outline" onPress={() => leave(target)} testID="action.openCourse">
          {t(examId ? "mobile.home.openExam" : "home.now.openCourse")}
        </BigButton>
      )}
    </View>
  );
}

/** The card's one action, filled: Tandai Hadir, the Presence, or joining the online class. */
export function MainAction({ card, action, onLeave }: { card: NowCard; action: Exclude<CardAction, null>; onLeave?(): void }) {
  const t = useT();
  const now = useNow();
  const v = useTheme().v4;
  const student = useDataset("six.student");
  const checkIn = useCheckIn();
  const external = useOpenExternal();
  const { session, code, link } = cardSubject(card);
  if (action === "presence") return <PresenceButton card={card} variant="primary" onLeave={onLeave} />;
  if (action === "checkIn" && session && student)
    return (
      <BigButton
        icon={<Icons.Hand size={20} weight="fill" color={v.onBrand} />}
        // The sheet goes first: SIX's page opens as a screen of its own, which a sheet would stay over.
        onPress={() => {
          onLeave?.();
          checkIn(session.id, sixTimetableUrl(student, session.start), now);
        }}
        label={t("home.now.openSixLabel", { course: session.courseCode })}
        testID="action.checkIn"
      >
        {t("mobile.notification.checkIn")}
      </BigButton>
    );
  if (action === "join" && link)
    return (
      <BigButton
        icon={<Icons.Video size={20} color={v.onBrand} />}
        onPress={() => external(link)}
        label={t("home.today.joinLabel", { course: code })}
        testID="action.join"
      >
        {t("home.today.join")}
      </BigButton>
    );
  return null;
}

/** An Edunex Presence's way in: the Task it's recorded by (opened here), or Edunex's page. */
function PresenceButton({ card, variant, onLeave }: { card: NowCard; variant: "primary" | "ghost"; onLeave?(): void }) {
  const t = useT();
  const theme = useTheme();
  const { go } = useNav();
  const external = useOpenExternal();
  const presence = card.presence;
  if (!presence) return null;
  const viaTask = presence.activity === "assignment" && presence.task !== null;
  const open = () => {
    if (viaTask && presence.task) {
      onLeave?.();
      go({ screen: "task", taskId: presence.task.id });
    } else external(presence.url);
  };
  const label = viaTask ? t("home.now.openTask") : t("home.now.recordLabel", { course: presence.code });
  const words = viaTask ? t("home.now.openTask") : t("presence.open.record");
  if (variant === "primary")
    return (
      <BigButton icon={viaTask ? undefined : <Icons.ArrowUpRight size={20} color={theme.v4.onBrand} />} onPress={open} label={label} testID="action.presence">
        {words}
      </BigButton>
    );
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={viaTask ? undefined : <Icons.ArrowUpRight size={16} color={theme.color.primary} />}
      onPress={open}
      label={label}
      testID="action.presence"
      style={{ alignSelf: "flex-start", marginLeft: -space[3] }}
    >
      {words}
    </Button>
  );
}

/** A card for one of Hari ini's classes, so its sheet says what the now card's would. */
export function classCard(facts: NonNullable<NowCard["class"]>, now: number): NowCard {
  const { session } = facts;
  return {
    state: session.start <= now && now < session.end ? "live" : session.start > now ? "next" : "later",
    class: facts,
    meeting: null,
    presence: null,
    after: null,
    unreadDay: null,
  };
}

export const budgetTone = (t: Translate, health: AttendanceHealth): { text: string; tone: TextTone } => ({
  text: budgetLabel(t, health),
  tone: STATE_TEXT[health.state],
});
