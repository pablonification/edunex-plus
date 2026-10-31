// A class's sheet on Beranda: what the now card and Hari ini's rows leave out so they stay short (src/app/screens/
// home.tsx's now card, said in full). When and where, what changed about it, a clash, where its attendance counts and
// what's left, Tandai Hadir or an Edunex Presence open now, what comes after it, and the way to the course. The one
// thing to do is the sheet's filled button at the bottom, within reach; the way to the course sits beside it.
import type { ReactNode } from "react";
import { View } from "react-native";
import { budgetLabel, useActionLabel } from "../../../../src/app/attendance-labels";
import { type TermCourse, useCourseColor } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useExamIds } from "../../../../src/app/schedule-data";
import { useDataset, useStatus } from "../../../../src/app/store";
import { type AttendanceHealth, clashPick, percent } from "../../../../src/core/attendance";
import { checkingIn } from "../../../../src/core/check-in";
import { sixTimetableUrl } from "../../../../src/core/links";
import type { NowCard } from "../../../../src/core/needs";
import { dayNoon } from "../../../../src/core/schedule";
import { type Route, useNav } from "../../nav";
import { CountdownBar } from "../../parts/meter";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { Button } from "../../ui/controls";
import { CourseDot, LiveDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta } from "../../ui/layout";
import { Sheet } from "../../ui/sheet";
import { Text, type TextTone } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { useCheckIn } from "./checked-in";
import { DAY, MINUTE, movedLabel, nameOf, STATE_TEXT } from "./parts";

/** What the sheet is about: the now card's, or a Hari ini row's class (a card of its own, with nothing beside it). */
export function ClassSheet({
  card,
  courses,
  open,
  onClose,
  context,
}: {
  card: NowCard | null;
  courses: readonly TermCourse[];
  open: boolean;
  onClose(): void;
  /** The other course's health, for a clash's pick. */
  context?: { health: ReadonlyMap<string, AttendanceHealth> };
}) {
  return (
    <Sheet
      open={open && card !== null}
      onClose={onClose}
      testID="sheet.nowClass"
      footer={card ? <Actions card={card} onLeave={onClose} courses={courses} /> : undefined}
    >
      {card && <Details card={card} courses={courses} context={context} onLeave={onClose} />}
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

function Details({
  card,
  courses,
  context,
  onLeave,
}: {
  card: NowCard;
  courses: readonly TermCourse[];
  context?: { health: ReadonlyMap<string, AttendanceHealth> };
  onLeave(): void;
}) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const color = useCourseColor();
  const { session, meeting, slot, code, windowFor } = cardSubject(card);
  const facts = card.class;
  const live = slot !== null && slot.start <= now && now < slot.end;
  const past = slot !== null && slot.end <= now;
  const fresh = useStatus(meeting ? "edunex" : "six").state === "live";
  const kind = session && !/^kuliah$/i.test(session.activity) ? session.activity : null;
  const other = facts?.overlap ? context?.health.get(facts.overlap.code) : undefined;
  const picked = facts?.health && other ? clashPick(facts.health, other).pick === code : false;
  return (
    <View style={{ gap: space[4] }}>
      <View>
        <Meta>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <CourseDot color={color(code)} size={8} />
            <Text size="small" weight="semibold" tabular>
              {code}
            </Text>
          </View>
          {kind ?? ""}
          {meeting ? t(meeting.online ? "home.today.meetingOnline" : "home.today.meeting", { number: meeting.number }) : ""}
        </Meta>
        <Text size="titleLarge" accessibilityRole="header" style={{ marginTop: space[1] }}>
          {nameOf(courses, code, session?.courseName)}
        </Text>
      </View>
      <View style={{ gap: space[3] }}>
        {slot && (
          <Fact icon={(c) => <Icons.Clock size={18} color={c} />}>
            <Text size="bodyLarge" tabular>
              {`${f.relativeDay(slot.start)} · ${f.timeRange(slot.start, slot.end)}`}
            </Text>
            {live && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                {fresh && <LiveDot />}
                <Text size="bodyMedium" tone="success">
                  {t("home.now.live", { time: f.time(slot.end) })}
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
          <Fact icon={(c) => <Icons.Clock size={18} color={c} />}>{f.relativeDay(windowFor.start) + " · " + f.timeRange(windowFor.start, windowFor.end)}</Fact>
        )}
        {facts?.moved && (
          <Fact tone="warning" icon={(c) => <Icons.CalendarClock size={18} color={c} />}>
            {movedLabel(t, f, facts)}
          </Fact>
        )}
        {session?.room && <Fact icon={(c) => <Icons.MapPin size={18} color={c} />}>{session.room}</Fact>}
        {meeting && !card.meeting?.maybeInSix && (
          <Fact tone="warning" icon={(c) => <Icons.Info size={18} color={c} />}>
            {t("home.today.notInSix")}
          </Fact>
        )}
        {facts?.overlap && (
          <Fact tone="warning" icon={(c) => <Icons.Overlap size={18} color={c} />}>
            {`${t("home.today.overlap", { course: facts.overlap.code, time: f.timeRange(facts.overlap.from, facts.overlap.to) })}${picked ? `. ${t("home.today.pick")}` : ""}`}
          </Fact>
        )}
        <Attendance card={card} past={past} onLeave={onLeave} />
        {card.after && (
          <Fact icon={(c) => <Icons.ArrowRight size={18} color={c} />}>
            {`${t("home.now.after", { time: f.time(card.after.start), course: card.after.courseCode })} ${nameOf(courses, card.after.courseCode, card.after.courseName)}${card.after.room ? ` · ${card.after.room}` : ""}`}
          </Fact>
        )}
        {card.unreadDay && (
          <Fact icon={(c) => <Icons.Info size={18} color={c} />}>
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

/** One fact with its icon, as Jadwal's class sheet lists them. */
function Fact({ icon, tone = "fg", children }: { icon: (color: string) => ReactNode; tone?: TextTone; children: ReactNode }) {
  const theme = useTheme();
  const color = tone === "warning" ? theme.color.warningFg : tone === "success" ? theme.color.successFg : theme.color.onSurfaceVariant;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[4] }}>
      <View style={{ width: 20, alignItems: "center", paddingTop: 3 }}>{icon(color)}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {typeof children === "string" ? (
          <Text size="bodyLarge" tone={tone}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
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
  const actionLabel = useActionLabel();
  const checkIns = useDataset("six.checkIn");
  const student = useDataset("six.student");
  const facts = card.class;
  const presence = card.presence;
  const counted = facts?.countedIn ?? "unknown";
  const session = facts?.session ?? null;
  const where = presence?.counts
    ? t("home.now.countEdunex")
    : presence?.noSix
      ? t("home.now.countNoSix")
      : presence && presence.counts === null
        ? t("home.now.countNotKnown")
        : counted === "six" || counted === "both"
          ? t("home.now.countSix")
          : facts && !past
            ? t("home.now.countUnknown")
            : null;
  const health = facts?.health && facts.state !== "unknown" ? facts.health : null;
  const check = session ? checkIns?.[session.id] : undefined;
  const watching = session && student && !past && (card.state === "live" || card.state === "next") && checkingIn(session, now);
  const checkLine = watching
    ? check?.state === "open"
      ? { text: t("home.now.checkInOpen"), hint: t("home.now.checkInOpenHint", { time: f.time(session.end) }), tone: "success" as const }
      : check?.state === "gone"
        ? { text: t("home.now.checkInGone"), hint: null, tone: "fg" as const }
        : counted === "six" || counted === "both" || counted === "unknown" || check
          ? { text: t("home.now.checkInWatch"), hint: t("home.now.checkEvery"), tone: "fg" as const }
          : null
    : null;
  const window = presence?.session ?? null;
  if (!where && !health && !checkLine && !presence) return null;
  return (
    <>
      {(where || health) && (
        <Fact icon={(c) => <Icons.Hand size={18} color={c} />}>
          {where && <Text size="bodyLarge">{where}</Text>}
          {health && <Budget health={health} />}
        </Fact>
      )}
      {checkLine && (
        <Fact tone={checkLine.tone} icon={(c) => <Icons.CheckCircle size={18} color={c} />}>
          <Text size="bodyLarge" tone={checkLine.tone}>
            {checkLine.text}
          </Text>
          {checkLine.hint && (
            <Text size="bodyMedium" tone="muted">
              {checkLine.hint}
            </Text>
          )}
        </Fact>
      )}
      {presence && window && (
        <Fact icon={(c) => <Icons.ListChecks size={18} color={c} />}>
          <Text size="bodyLarge">
            {presence.counts !== false
              ? t("home.now.presenceDo", {
                  action: actionLabel({ action: { activity: presence.activity, task: presence.task, url: presence.url } }),
                  time: f.dayTime(window.closesAt),
                })
              : t("home.now.presenceExtra", { time: f.dayTime(window.closesAt) })}
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

/** "Kehadiran 85% · Masih boleh absen 1 kali", what's left in the state's colour. */
function Budget({ health }: { health: AttendanceHealth }) {
  const t = useT();
  return (
    <Meta>
      {health.held ? t("home.now.share", { percent: percent(health.attended ?? 0, health.held) }) : ""}
      <Text size="bodyMedium" weight="medium" tone={STATE_TEXT[health.state]}>
        {budgetLabel(t, health)}
      </Text>
    </Meta>
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
  // Side by side, the main one at the end (nearest the thumb, as Material's dialogs): the sheet stays short.
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
      {target && (
        <Button variant={action ? "secondary" : "tonal"} onPress={() => leave(target)} testID="action.openCourse" style={{ flexGrow: 1, flexBasis: 140 }}>
          {t(examId ? "mobile.home.openExam" : "home.now.openCourse")}
        </Button>
      )}
      {action && <MainAction card={card} action={action} onLeave={onLeave} style={{ flexGrow: 1, flexBasis: 140 }} />}
    </View>
  );
}

/** The card's one action, filled: Tandai Hadir, the Presence, or joining the online class. */
export function MainAction({ card, action, onLeave, style }: { card: NowCard; action: Exclude<CardAction, null>; onLeave?(): void; style?: object }) {
  const t = useT();
  const theme = useTheme();
  const student = useDataset("six.student");
  const checkIn = useCheckIn();
  const external = useOpenExternal();
  const { session, code, link } = cardSubject(card);
  if (action === "presence") return <PresenceButton card={card} variant="primary" onLeave={onLeave} style={style} />;
  if (action === "checkIn" && session && student)
    return (
      <Button
        variant="primary"
        icon={<Icons.Hand size={18} color={theme.color.onPrimary} />}
        // The sheet goes first: SIX's page opens as a screen of its own, which a sheet would stay over.
        onPress={() => {
          onLeave?.();
          checkIn(session.id, sixTimetableUrl(student, session.start));
        }}
        label={t("home.now.openSixLabel", { course: session.courseCode })}
        testID="action.checkIn"
        style={style}
      >
        {t("mobile.notification.checkIn")}
      </Button>
    );
  if (action === "join" && link)
    return (
      <Button
        variant="primary"
        icon={<Icons.Video size={18} color={theme.color.onPrimary} />}
        onPress={() => external(link)}
        label={t("home.today.joinLabel", { course: code })}
        testID="action.join"
        style={style}
      >
        {t("home.today.join")}
      </Button>
    );
  return null;
}

/** An Edunex Presence's way in: the Task it's recorded by (opened here), or Edunex's page. */
function PresenceButton({ card, variant, onLeave, style }: { card: NowCard; variant: "primary" | "ghost"; onLeave?(): void; style?: object }) {
  const t = useT();
  const theme = useTheme();
  const { go } = useNav();
  const external = useOpenExternal();
  const presence = card.presence;
  if (!presence) return null;
  const viaTask = presence.activity === "assignment" && presence.task !== null;
  return (
    <Button
      variant={variant}
      size={variant === "ghost" ? "sm" : "md"}
      icon={viaTask ? undefined : <Icons.ArrowUpRight size={16} color={variant === "primary" ? theme.color.onPrimary : theme.color.primary} />}
      onPress={() => {
        if (viaTask && presence.task) {
          onLeave?.();
          go({ screen: "task", taskId: presence.task.id });
        } else external(presence.url);
      }}
      label={viaTask ? t("home.now.openTask") : t("home.now.recordLabel", { course: presence.code })}
      testID="action.presence"
      style={variant === "ghost" ? { alignSelf: "flex-start", marginLeft: -space[3] } : style}
    >
      {viaTask ? t("home.now.openTask") : t("presence.open.record")}
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
