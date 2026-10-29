// "Hari ini": today's classes, the meetings outside SIX and what's due today, then tomorrow's, as
// src/app/screens/home.tsx lists them. A deadline can be put off or put away from its row: the
// icons beside it, a swipe, or a long press.
import { View } from "react-native";
import { budgetLabel } from "../../../../src/app/attendance-labels";
import type { TermCourse } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useExamIds } from "../../../../src/app/schedule-data";
import { useDone, useSnoozes } from "../../../../src/app/snoozes";
import { useStatus } from "../../../../src/app/store";
import { clashPick } from "../../../../src/core/attendance";
import { wibDay } from "../../../../src/core/course-meetings";
import { taskPutAway } from "../../../../src/core/done";
import type { UnreadSession } from "../../../../src/core/models";
import type { ClassFacts, HomeContext, NeedDraft, NowCard, TodayPlan } from "../../../../src/core/needs";
import { dayStart } from "../../../../src/core/schedule";
import { activeSnooze, snoozable, snoozeKey } from "../../../../src/core/snooze";
import { useNav } from "../../nav";
import { OpenSixTimetable } from "../../parts/six-page-note";
import { useSignIn } from "../../shell/source-status";
import { Button } from "../../ui/controls";
import { LiveDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, List, Meta, Row, Section } from "../../ui/layout";
import { Text, type TextTone } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
import { CourseMark, doneOf, MINUTE, movedLabel, nameOf, QuickRow, Quiet, STATE_TEXT, toned } from "./parts";

/** A later class says "dalam …" only this close to its start; further off, the time column says enough. */
const SOON = 2 * 60 * MINUTE;

type TodayItem =
  | { kind: "unread"; at: number; unread: UnreadSession }
  | { kind: "class"; at: number; facts: ClassFacts }
  | { kind: "meeting"; at: number; code: string; meeting: TodayPlan["announced"][number]["meeting"]; maybeInSix?: true }
  | { kind: "due"; at: number; task: TodayPlan["due"][number]; need: NeedDraft | null };

/** The Hari ini row key of what the now card shows. From src/app/screens/home.tsx. */
export const cardKey = (card: NowCard | null) =>
  card?.class ? `class:${card.class.session.id}` : card?.meeting ? `meeting:${card.meeting.code}:${card.meeting.meeting.start}` : null;

/** From src/app/screens/home.tsx. */
const keyOf = (item: TodayItem) =>
  item.kind === "unread"
    ? `unread:${item.unread.day}:${item.unread.row}`
    : item.kind === "class"
      ? `class:${item.facts.session.id}`
      : item.kind === "meeting"
        ? `meeting:${item.code}:${item.at}`
        : `due:${item.task.id}`;

/** Before SIX's timetable: where today's classes come from, and a way in while signed out. */
function NoSixToday() {
  const t = useT();
  const theme = useTheme();
  const signedOut = useStatus("six").state === "signed-out";
  const { signIn, busy } = useSignIn();
  return (
    <View style={{ borderRadius: radius.xl, backgroundColor: theme.color.sunken, paddingHorizontal: space[4], paddingVertical: space[3.5], gap: space[3] }}>
      <Text tone="muted">{t("home.today.noSix")}</Text>
      {signedOut && (
        <Button size="sm" busy={busy} onPress={() => void signIn("six")} testID="action.signInSix" style={{ alignSelf: "flex-start" }}>
          {t("home.today.signInSix")}
        </Button>
      )}
    </View>
  );
}

/**
 * `due`: the deadlines as Beranda's items, so each can be put off; one put off leaves the day and
 * is listed under "Perlu perhatianmu" until it's back. `onCard`: the row key of what the now card
 * above already shows, so its row doesn't say the same again.
 */
export function Today({
  context,
  plan,
  due,
  courses,
  onCard,
}: {
  context: HomeContext;
  plan: TodayPlan;
  due: readonly NeedDraft[];
  courses: readonly TermCourse[];
  onCard: string | null;
}) {
  const t = useT();
  const now = useNow();
  const { entries } = useSnoozes();
  const { entries: handled } = useDone();
  const day = wibDay(context.now);
  const needOf = (task: TodayPlan["due"][number]) => due.find((need) => need.kind === "task" && need.task.id === task.id) ?? null;
  const items: TodayItem[] = [
    // No time to place it at: first on its day.
    ...plan.unread.map((unread): TodayItem => ({ kind: "unread", at: dayStart(unread.day), unread })),
    ...plan.classes.map((facts): TodayItem => ({ kind: "class", at: facts.session.start, facts })),
    ...plan.announced.map(({ code, meeting, maybeInSix }): TodayItem => ({ kind: "meeting", at: meeting.start, code, meeting, maybeInSix })),
    ...plan.due.map((task): TodayItem => ({ kind: "due", at: task.dueAt!, task, need: needOf(task) })),
  ].sort((a, b) => a.at - b.at);
  // Put off, or put away by the Student (handed in another way, by the group, not at all): listed under "Perlu perhatianmu".
  const snoozed = (item: TodayItem) => item.kind === "due" && item.need !== null && activeSnooze(snoozeKey(item.need), entries, now) !== undefined;
  const putAway = (item: TodayItem) => item.kind === "due" && taskPutAway(item.task, handled) !== undefined;
  const putOff = (item: TodayItem) => snoozed(item) || putAway(item);
  const shown = items.filter((item) => !putOff(item));
  const today = shown.filter((item) => wibDay(item.at) === day);
  const tomorrow = shown.filter((item) => wibDay(item.at) !== day);
  // Never "no deadlines today" while today's are only put off or handled, and never "snoozed" for what's handled.
  const isToday = (item: TodayItem) => wibDay(item.at) === day;
  const empty = items.some((item) => snoozed(item) && isToday(item))
    ? "home.today.noneSnoozed"
    : items.some((item) => putAway(item) && isToday(item))
      ? "home.today.noneHandled"
      : "home.today.none";
  return (
    <Section title={t("home.today")} testID="section.today">
      {!context.schedule && <NoSixToday />}
      {today.length > 0 ? (
        <List style={!context.schedule ? { marginTop: space[3] } : undefined}>
          {today.map((item) => (
            <TodayRow key={keyOf(item)} item={item} courses={courses} onCard={onCard} context={context} />
          ))}
        </List>
      ) : (
        context.schedule && <Quiet>{t(empty)}</Quiet>
      )}
      {tomorrow.length > 0 && (
        <>
          <Text size="small" weight="semibold" tone="muted" accessibilityRole="header" style={{ marginTop: space[5], marginBottom: space[2] }}>
            {t("home.today.tomorrow")}
          </Text>
          <List>
            {tomorrow.map((item) => (
              <TodayRow key={keyOf(item)} item={item} courses={courses} onCard={onCard} context={context} />
            ))}
          </List>
        </>
      )}
    </Section>
  );
}

/** The time column: start over end, or a deadline's one time. */
function When({ start, end, past, tone }: { start: string; end?: string; past?: boolean; tone?: TextTone }) {
  return (
    <View style={{ width: 48 }}>
      <Text size="small" weight="semibold" tabular tone={past ? "faint" : (tone ?? "fg")}>
        {start}
      </Text>
      {end && (
        <Text size="caption" tabular tone="faint">
          {end}
        </Text>
      )}
    </View>
  );
}

/** "Sekarang" on the row of a class or meeting going on. */
function NowMark({ fresh }: { fresh: boolean }) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {fresh && <LiveDot />}
      <Text size="caption" weight="semibold" tone="success">
        {t("home.today.now")}
      </Text>
    </View>
  );
}

function TodayRow({ item, courses, onCard, context }: { item: TodayItem; courses: readonly TermCourse[]; onCard: string | null; context: HomeContext }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const { go } = useNav();
  const open = useOpenExternal();
  const examIds = useExamIds();
  const fresh = useStatus("six").state === "live";
  const edunexFresh = useStatus("edunex").state === "live";
  const key = keyOf(item);
  const testID = `row.today.${key}`;
  const shownAbove = key === onCard;

  if (item.kind === "unread") {
    // As SIX writes it, so the Student knows which class to look for on SIX. Its way to SIX goes under it: beside, it would squeeze the row.
    return (
      <Row
        testID={testID}
        leading={<When start="-" />}
        title={t("schedule.unread.title", { count: 1 })}
        meta={
          <Text size="small" tone="muted">
            {item.unread.row}
          </Text>
        }
      >
        <View style={{ marginTop: space[2], flexDirection: "row" }}>
          <OpenSixTimetable day={item.unread.day} />
        </View>
      </Row>
    );
  }

  if (item.kind === "due") {
    const { task, need } = item;
    const close = task.dueAt! - now <= 6 * 60 * MINUTE;
    // Put off as "Perlu perhatianmu" puts off a deadline: the moments that still fit, never past its last hours.
    const name = factsLabel(task.title, task.courseCode);
    return (
      <QuickRow name={name} done={need && doneOf(t, need)} snooze={need ? snoozable(need, now) : null}>
        {({ actions, onLongPress }) => (
          <Row
            testID={testID}
            actions={actions}
            onLongPress={onLongPress}
            leading={<When start={f.time(task.dueAt!)} tone={close ? "warning" : undefined} />}
            title={task.title}
            meta={
              <Meta>
                <CourseMark code={task.courseCode} />
                {t("home.today.due")}
              </Meta>
            }
            trailing={
              <Text size="caption" tabular weight={close ? "semibold" : "regular"} tone={close ? "warning" : "muted"}>
                {f.fromNow(task.dueAt!)}
              </Text>
            }
            onPress={() => go({ screen: "task", taskId: task.id })}
          />
        )}
      </QuickRow>
    );
  }

  if (item.kind === "meeting") {
    const { meeting, code } = item;
    const live = meeting.start <= now && now < meeting.end;
    // Not on a day SIX shows a class the app couldn't read: this may be it.
    const notInSix = !shownAbove && !item.maybeInSix;
    return (
      <Row
        testID={testID}
        leading={<When start={f.time(meeting.start)} end={f.time(meeting.end)} />}
        title={nameOf(courses, code)}
        meta={
          <Meta>
            <CourseMark code={code} />
            {t(meeting.online ? "home.today.meetingOnline" : "home.today.meeting", { number: meeting.number })}
          </Meta>
        }
        trailing={live ? <NowMark fresh={edunexFresh} /> : meeting.link ? <Icons.Video size={18} color={theme.color.faint} /> : undefined}
        // The name replaces the row's text, so it carries what the row shows: when, "Sekarang", where it came from.
        label={
          meeting.link
            ? factsLabel(
                t("home.today.joinLabel", { course: code }),
                f.timeRange(meeting.start, meeting.end),
                live && t("home.today.now"),
                notInSix && t("home.today.notInSix"),
              )
            : undefined
        }
        onPress={() => (meeting.link ? open(meeting.link) : go({ screen: "course", code, tab: "meetings" }))}
      >
        {/* The now card says it for the meeting it shows. */}
        {notInSix && (
          <Text size="small" weight="medium" tone="warning" style={{ marginTop: space[1] }}>
            {t("home.today.notInSix")}
          </Text>
        )}
      </Row>
    );
  }

  const { facts } = item;
  const { session } = facts;
  const past = session.end <= now;
  const course = courses.find((c) => c.code === session.courseCode);
  const exam = /\b(UTS|UAS)\b/i.test(session.activity);
  // A sitting opens its exam's page: when and where, what to study.
  const examId = examIds.get(session.id);
  // Said on the day: no absences left, or the target out of reach (so the course doesn't vanish from Beranda); the now card says it for its class.
  const budget = facts.health && (facts.state === "none" || facts.state === "out") && !past && !shownAbove ? budgetLabel(t, facts.health) : null;
  // The now card says "Jam berubah · biasanya …" for its class; the row keeps only the amber time.
  const moved = facts.moved && !shownAbove;
  // A clash, with the pick folded in on the course that needs the Student more (Presensi's answer).
  const other = facts.overlap ? context.health.get(facts.overlap.code) : undefined;
  const picked = facts.health && other ? clashPick(facts.health, other).pick === session.courseCode : false;
  const clash = facts.overlap
    ? `${t("home.today.overlap", { course: facts.overlap.code, time: f.timeRange(facts.overlap.from, facts.overlap.to) })}${picked ? `. ${t("home.today.pick")}` : ""}`
    : null;
  // A class that's over: what SIX's count did after it, when the app saw.
  const result = past ? context.classResults?.[session.id]?.result : undefined;
  return (
    <Row
      testID={testID}
      leading={<When start={f.time(session.start)} end={f.time(session.end)} past={past} tone={facts.moved?.usualStart != null ? "warning" : undefined} />}
      // Past, quieter in token greys that still read at 4.5:1; never faded with opacity.
      title={
        <Text weight="medium" tone={past ? "muted" : "fg"} numberOfLines={3}>
          {course?.name ?? session.courseName}
        </Text>
      }
      meta={
        <Meta tone={past ? "faint" : "muted"}>
          <CourseMark code={session.courseCode} past={past} />
          {session.room ?? ""}
          {exam || !/^kuliah$/i.test(session.activity) ? (
            <Text size="small" weight="semibold" tone={past ? "faint" : "muted"}>
              {session.activity}
            </Text>
          ) : (
            ""
          )}
        </Meta>
      }
      trailing={
        facts.live ? (
          <NowMark fresh={fresh} />
        ) : past ? (
          <Text
            size="caption"
            weight={result === "absent" ? "medium" : "regular"}
            tone={result === "absent" ? "danger" : result === "missing" ? "warning" : "faint"}
            style={{ textAlign: "right" }}
          >
            {t(resultKey(result))}
          </Text>
        ) : session.start - now <= SOON ? (
          <Text size="caption" tabular tone="muted">
            {f.fromNow(session.start)}
          </Text>
        ) : undefined
      }
      onPress={() =>
        go(examId ? { screen: "exam", examId } : course?.edunex ? { screen: "course", code: session.courseCode, tab: "meetings" } : { screen: "presence" })
      }
    >
      {!past && (budget || clash) && (
        // Kept beside a clash: choosing between two classes is when "Jatah absen habis" matters most.
        <View style={{ marginTop: space[1] }}>
          <Meta>
            {budget ? (
              <Text size="small" weight="medium" tone={STATE_TEXT[facts.state]}>
                {budget}
              </Text>
            ) : (
              ""
            )}
            {clash ? (
              <Text size="small" weight="medium" tone="warning">
                {clash}
              </Text>
            ) : (
              ""
            )}
          </Meta>
        </View>
      )}
      {!past && moved && (
        <View style={{ marginTop: space[1] }}>
          <Meta>{toned(movedLabel(t, f, facts), "warning", { weight: "medium" })}</Meta>
        </View>
      )}
    </Row>
  );
}

const resultKey = (result: string | undefined): Parameters<Translate>[0] =>
  result === "counted" ? "home.today.counted" : result === "absent" ? "home.today.absent" : result === "missing" ? "home.today.notCounted" : "home.today.done";
