// A class's sheet on Beranda (v4, cut to three rows on Arqila's word): when, with what moved or clashes folded into its
// one quiet line; where; and the absences with their pips. Tandai Hadir or an Edunex Presence open now is the filled
// button at the bottom, only while it can be used; the way to the course sits under it. What the desktop's now card
// also says stays one tap away: the class after this one is its own row in Nanti hari ini, and SIX's unread timetable
// is on the course's page.
import type { ReactNode } from "react";
import { View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { budgetLabel } from "../../../../src/app/attendance-labels";
import type { TermCourse } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useExamIds } from "../../../../src/app/schedule-data";
import { useDataset } from "../../../../src/app/store";
import { type AttendanceHealth, percent } from "../../../../src/core/attendance";
import { checkingIn } from "../../../../src/core/check-in";
import { sixTimetableUrl } from "../../../../src/core/links";
import type { NowCard } from "../../../../src/core/needs";
import { type Route, useNav } from "../../nav";
import { absenceInk, absenceTone } from "../../ui/absence";
import { BigButton } from "../../ui/big-button";
import { Icons } from "../../ui/icons";
import { Sheet } from "../../ui/sheet";
import { Text, type TextTone } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { useCheckIn } from "./checked-in";
import { type MovedLine, movedLine } from "./moved-line";
import { MINUTE, nameOf, STATE_TEXT } from "./parts";

/** What the sheet is about: the now card's, or a Hari ini row's class (a card of its own, with nothing beside it). */
export function ClassSheet({ card, courses, open, onClose }: { card: NowCard | null; courses: readonly TermCourse[]; open: boolean; onClose(): void }) {
  return (
    // The buttons end the content rather than sit in the sheet's footer: the native sheet measured the footer short and
    // cut its buttons off on every phone tried (mid, weak).
    <Sheet open={open && card !== null} onClose={onClose} background={useTheme().v4.card} testID="sheet.nowClass">
      {card && (
        <>
          <Details card={card} courses={courses} />
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

function Details({ card, courses }: { card: NowCard; courses: readonly TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const attendance = useAttendance();
  const { session, meeting, slot, code, windowFor } = cardSubject(card);
  const facts = card.class;
  const when = slot ?? windowFor;
  const live = slot !== null && slot.start <= now && now < slot.end;
  const past = slot !== null && slot.end <= now;
  const kind = session && !/^kuliah$/i.test(session.activity) ? session.activity : null;
  const name = nameOf(courses, code, session?.courseName);
  const activity =
    kind ?? session?.activity ?? (meeting ? t(meeting.online ? "home.today.meetingOnline" : "home.today.meeting", { number: meeting.number }) : null);
  const crumb = [code, activity].filter(Boolean).join(" · ");
  const moved = facts?.moved ?? null;
  const usual = moved && moved.usualStart !== null && moved.usualEnd !== null ? f.timeRange(moved.usualStart, moved.usualEnd) : null;
  const overlap = facts?.overlap ?? null;
  // A class that's over: what SIX's count did after it, when the app saw (the desktop's Hari ini says it on its row).
  const result = past && session ? attendance?.results[session.id]?.result : undefined;
  // Its one status, as a chip: SIX's verdict on a class that's over, else a clash, else moved, else on now, else not on
  // SIX's timetable.
  const timeChip =
    result === "counted"
      ? { key: "home.today.counted" as const, bg: v.okBg, fg: v.okFg }
      : result === "absent"
        ? { key: "home.today.absent" as const, bg: v.redBg, fg: v.redFg }
        : result === "missing"
          ? { key: "home.today.notCounted" as const, bg: v.ambBg, fg: v.ambFg }
          : overlap
            ? { key: "mobile.home.chip.clash" as const, bg: v.ambBg, fg: v.ambFg }
            : usual
              ? { key: "mobile.home.chip.moved" as const, bg: v.ambBg, fg: v.ambFg }
              : live
                ? { key: "mobile.home.chip.now" as const, bg: v.okBg, fg: v.okFg }
                : meeting && !card.meeting?.maybeInSix
                  ? { key: "home.today.notInSix" as const, bg: v.ambBg, fg: v.ambFg }
                  : null;
  // The time's one quiet line, never a warning sentence: what it clashes with, else when it usually is (saying it moved
  // when SIX's verdict took the chip, ./moved-line.ts), else how far off.
  const timeMeta = overlap
    ? t("mobile.home.clashWith", { course: overlap.code, time: f.timeRange(overlap.from, overlap.to) })
    : usual
      ? line(t, movedLine("time", usual, timeChip?.key === "mobile.home.chip.moved"))
      : !live && !past && slot
        ? f.fromNow(slot.start)
        : null;
  // On now, with a move or a clash as its chip: the time's day word says it ("Sekarang · 08:00–10:00").
  const dayWord = when && live && timeChip?.key !== "mobile.home.chip.now" ? t("home.today.now") : when ? f.relativeDay(when.start) : "";
  const place = session?.room ?? (meeting?.online ? t("mobile.home.online") : null);
  const usualRoom = moved && !usual ? moved.usualRoom : null;
  return (
    <View style={{ gap: space[4] }}>
      {/* v4: the course's tile, "PL3002 · Kuliah", the name in the display face; read out as "PL3002 Ekonomi …, Kuliah". */}
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={[`${code} ${name}`, activity].filter(Boolean).join(", ")}
        style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}
      >
        <CourseTile code={code} name={name} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="bodyMedium" weight="medium" style={{ color: v.muted }}>
            {crumb}
          </Text>
          <Text size="titleLarge" face="display" weight="bold" style={{ color: v.fg, fontSize: 20, lineHeight: 26, marginTop: 2 }}>
            {name}
          </Text>
        </View>
      </View>
      <View>
        {when && (
          <Fact icon={(c) => <Icons.Clock size={22} color={c} />} end={timeChip && <Chip text={t(timeChip.key)} bg={timeChip.bg} fg={timeChip.fg} />}>
            <Text size="bodyLarge" tabular style={{ color: v.fg2 }}>
              {`${dayWord} · ${f.timeRange(when.start, when.end)}`}
            </Text>
            {timeMeta && (
              <Text size="bodyMedium" tone="muted" tabular>
                {timeMeta}
              </Text>
            )}
          </Fact>
        )}
        {place && (
          <Fact
            icon={(c) => <Icons.MapPin size={22} color={c} />}
            end={usualRoom && !timeChip && <Chip text={t("mobile.home.chip.moved")} bg={v.ambBg} fg={v.ambFg} />}
          >
            <Text size="bodyLarge" style={{ color: v.fg2 }}>
              {place}
            </Text>
            {usualRoom && (
              <Text size="bodyMedium" tone="muted">
                {line(t, movedLine("room", usualRoom, !timeChip))}
              </Text>
            )}
          </Fact>
        )}
        <Absences card={card} />
      </View>
    </View>
  );
}

const line = (t: Translate, moved: MovedLine): string => t(moved.key, moved.vars);

/** The sheet's one status. */
function Chip({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: bg }}>
      <Text size="labelMedium" weight="semibold" style={{ color: fg }}>
        {text}
      </Text>
    </View>
  );
}

/** One fact with its icon (v4: a 48 dp row, the icon in the quiet grey, the words a step softer than a title). */
function Fact({
  icon,
  tone = "fg",
  end,
  label,
  children,
}: {
  icon: (color: string) => ReactNode;
  tone?: TextTone;
  end?: ReactNode;
  /** What a screen reader says for the row, when the words on screen leave out what the colour shows. */
  label?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const v = theme.v4;
  const color = tone === "warning" ? theme.color.warningFg : tone === "success" ? theme.color.successFg : v.muted;
  return (
    <View
      accessible={label !== undefined}
      accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 48, paddingVertical: space[2] }}
    >
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

/** The absences: one pip each, used in the absence scale's colour (src/ui/absence.ts), still allowed in the track's (v4's pip meter). */
function Pips({ health }: { health: AttendanceHealth }) {
  const v = useTheme().v4;
  const tone = absenceTone(health.state);
  const ink = tone ? absenceInk(v, tone).fg : v.muted;
  const used = health.held !== null && health.attended !== null ? Math.max(0, health.held - health.attended) : 0;
  const left = Math.max(0, health.absencesLeft ?? 0);
  const total = Math.min(8, used + left);
  if (total === 0) return null;
  return (
    <View style={{ flexDirection: "row", gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: pips are positions
        <View key={i} style={{ width: 18, height: 8, borderRadius: 4, backgroundColor: i < used ? ink : v.line, opacity: i < used ? 0.8 : 1 }} />
      ))}
    </View>
  );
}

/**
 * The absences: the pips, "Boleh absen 1× lagi", and the share against the target under it (v4's pip meter row). Below
 * the target or with none left, the pips carry the warning in their colour and the row says only the share: never a
 * red sentence ("Tak bisa lagi capai 80%" is still what a screen reader hears).
 */
function Absences({ card }: { card: NowCard }) {
  const t = useT();
  const v = useTheme().v4;
  const facts = card.class;
  const health = facts?.health && facts.state !== "unknown" ? facts.health : null;
  if (!health) return null;
  const tone = absenceTone(health.state);
  const budget = budgetLabel(t, health);
  const share = health.held ? t("mobile.home.share", { percent: percent(health.attended ?? 0, health.held), target: health.target }) : null;
  const warned = (tone === "red" || tone === "amber") && share !== null;
  return (
    <Fact icon={(c) => <Icons.Hand size={22} color={c} />} end={<Pips health={health} />} label={warned ? `${budget}, ${share}` : undefined}>
      <Text
        size="bodyLarge"
        weight="medium"
        tone={warned ? undefined : STATE_TEXT[health.state]}
        style={
          warned || STATE_TEXT[health.state] === "muted" ? { color: v.fg2 } : tone === "red" || tone === "amber" ? { color: absenceInk(v, tone).fg } : undefined
        }
      >
        {warned ? share : budget}
      </Text>
      {share && !warned ? (
        <Text size="bodyMedium" tone="muted">
          {share}
        </Text>
      ) : null}
    </Fact>
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
  if (action === "presence") return <PresenceButton card={card} onLeave={onLeave} />;
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
function PresenceButton({ card, onLeave }: { card: NowCard; onLeave?(): void }) {
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
  return (
    <BigButton
      icon={viaTask ? undefined : <Icons.ArrowUpRight size={20} color={theme.v4.onBrand} />}
      onPress={open}
      label={viaTask ? t("home.now.openTask") : t("home.now.recordLabel", { course: presence.code })}
      testID="action.presence"
    >
      {viaTask ? t("home.now.openTask") : t("presence.open.record")}
    </BigButton>
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
