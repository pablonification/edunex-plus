// Beranda (#77): the ten-second answer. A quiet line with the greeting and how
// soon the exams are; then "Sekarang", the one card, the class going on (or
// next) with its two attendance steps, each a line with its button; then two
// plain lists: "Hari ini" (the rest of today's classes, the meetings outside
// SIX, what's due today and tomorrow) and "Perlu perhatianmu" (the week ahead,
// never repeating today), then a short "Yang berubah" (the bell has it all,
// and what the card or Hari ini shows isn't said again), and this term's
// courses with their absences. Each fact is said once, where the Student acts
// on it, in a few words: a status's why and how are in its tooltip, and its
// info button's name. A deadline (in either
// column) and anything in "Perlu perhatianmu" can be put off ("Ingatkan
// nanti"); a row only the Student can know is dealt with has a ✓ that puts it
// away for good ("Sudah kucek"). What's put off and what's handled are listed
// under "Perlu perhatianmu". The reasoning lives in src/core/needs.ts and
// src/core/done.ts.
import { type ReactNode, useMemo } from "react";
import { rupiah } from "../../core/academic";
import { type AttendanceHealth, clashPick, percent } from "../../core/attendance";
import { checkingIn } from "../../core/check-in";
import { wibDay } from "../../core/course-meetings";
import { type DoneTerms, doneTerms, taskPutAway } from "../../core/done";
import { PERIOD_NEAR } from "../../core/exams";
import { heldBack } from "../../core/held-back";
import { withoutGrades } from "../../core/hide-grades";
import { edunexCourseUrl, sixStatusUrl, sixTimetableUrl } from "../../core/links";
import type { Alert, AlertKind, ClassSession, DoneEntry, SixCheckIn, SnoozeEntry, UnreadSession } from "../../core/models";
import {
  attention,
  type ClassFacts,
  dueItems,
  type HomeContext,
  homeContext,
  type NeedDraft,
  type NeedsRange,
  type NowCard,
  needsRange,
  nowCard,
  recentChanges,
  type TodayPlan,
  todayPlan,
  unreadAhead,
} from "../../core/needs";
import { dayNoon, dayStart } from "../../core/schedule";
import { activeSnooze, snoozable, snoozeKey } from "../../core/snooze";
import { dateMove, type EditView, editView, titleOnly } from "../../core/task-edits";
import { useActionLabel } from "../attendance-labels";
import { AbsenceBudget } from "../attendance-parts";
import { type TermCourse, useCourseColor, useTermCourses } from "../courses";
import { useGradesHidden } from "../hide-grades";
import { useHomeWorld } from "../home-world";
import { useOpenCheckIn, useOpenExternal } from "../hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../i18n";
import { firstName } from "../names";
import { type Route, useNav, usePlaceState } from "../nav";
import { useExamIds } from "../schedule-data";
import { openAlerts } from "../shell/alerts";
import { useRefresh, useSignIn } from "../shell/source-status";
import { OpenSixTimetable, SixPageNote, useChangedPage } from "../six-page-note";
import { canSnooze, DoneButton, type RowDone, refocus, rowControls, SnoozeMenu } from "../snooze-menu";
import { useDone, useSnoozes } from "../snoozes";
import { useDataset, useStatus } from "../store";
import { SourceLogo } from "../ui/brand";
import { Button, IconButton } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card, CourseDot, EmptyState, LiveDot, Skeleton } from "../ui/display";
import { Explained, STATUS_TONE, type Status, StatusLine, WhyButton } from "../ui/explain";
import { Icons } from "../ui/icons";
import { factsLabel, List, Meta, Page, Row, Section } from "../ui/layout";
import { CountdownBar } from "../ui/meter";
import { PresenceList } from "../ui/motion/presence-list";
import { NowCard as NowCardShell } from "../ui/now-card";
import { Tooltip } from "../ui/overlays";

const MINUTE = 60_000;
const DAY = 86_400_000;
/** A later class says "dalam …" only this close to its start; further off, the time column says enough. */
const SOON = 2 * 60 * MINUTE;
/** "Yang berubah" shows this many; the bell has the rest. */
const CHANGES_SHOWN = 3;
/**
 * Beranda's lists, plain: only the now card is a card. Rows split by hairlines and the sections by space; the rows'
 * padding reaches past the column, so their words line up with the section's title, and the hairlines stay in it.
 */
const PLAIN =
  "-mx-4 rounded-none border-0 bg-transparent shadow-none [&>li+li]:relative [&>li+li]:border-t-0 [&>li+li]:before:absolute [&>li+li]:before:inset-x-4 [&>li+li]:before:top-0 [&>li+li]:before:h-px [&>li+li]:before:bg-line";

export function Home() {
  const f = useFormat();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const courses = useTermCourses();
  const name = account?.name ?? student?.name;
  const world = useHomeWorld();
  const context = useMemo(() => (world ? homeContext(world) : undefined), [world]);
  // The timetable's page changed: said here. A class on it the app couldn't read is said in Hari ini and on the card, quietly.
  const timetableChanged = useChangedPage(["six.schedule"]);

  return (
    <Page>
      {/* A quiet line, not a title: the eye goes first to what's happening now, under it. The date is the system's to show. */}
      <header className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-lead font-semibold">{`${f.greeting()}${name ? `, ${firstName(name)}` : ""}`}</h1>
        <ExamWeek />
      </header>
      {timetableChanged && <SixPageNote datasets={["six.schedule"]} className="mb-6" />}
      {context ? <Answers context={context} courses={courses ?? []} /> : <AnswersLoading />}
      <HomeCourses courses={courses} nim={student?.nim} context={context} />
    </Page>
  );
}

const nameOf = (courses: readonly TermCourse[], code: string, fallback?: string) => courses.find((course) => course.code === code)?.name ?? fallback ?? code;

function AnswersLoading() {
  return (
    <div aria-busy="true">
      <Card variant="raised" className="p-5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-5 w-2/3" />
        <Skeleton className="mt-3 h-3 w-1/2" />
      </Card>
      <div className="mt-10 grid gap-8 @container">
        <Skeleton className="h-28 w-full rounded-card" />
      </div>
    </div>
  );
}

function Answers({ context, courses }: { context: HomeContext; courses: readonly TermCourse[] }) {
  const card = useMemo(() => nowCard(context), [context]);
  const plan = useMemo(() => todayPlan(context), [context]);
  const needs = useMemo(() => attention(context, card, plan), [context, card, plan]);
  const due = useMemo(() => dueItems(context, plan), [context, plan]);
  const range = useMemo(() => needsRange(context), [context]);
  return (
    <>
      <NowSection card={card} courses={courses} context={context} unread={unreadAhead(context, card)} />
      <div className="@container mt-10">
        {/* The day on the left; what needs you and what changed beside it, so neither column runs on alone.
            Narrower, one column that can shrink: a long title with no spaces wraps instead of widening the page. */}
        <div className="grid grid-cols-1 items-start gap-x-12 gap-y-10 @min-[800px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Today context={context} plan={plan} due={due} courses={courses} onCard={cardKey(card)} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-y-10">
            <NeedsYou needs={needs} due={due} range={range} courses={courses} />
            <Changes context={context} card={card} plan={plan} />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * UTS or UAS week starting within two weeks, or going on, from ITB's calendar: a calm line, not a tag. Ahead, how
 * soon ("UTS 4 hari lagi"), with the day it starts in its tooltip; going on, the day it ends. It opens Jadwal.
 */
function ExamWeek() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const calendar = useDataset("itb.calendar");
  const exams = calendar?.events.filter((e) => e.kind === "uts" || e.kind === "uas") ?? [];
  const running = exams.find((e) => e.start <= now && now < e.end);
  const next = exams.find((e) => e.start > now && e.start - now <= PERIOD_NEAR);
  if (!running && !next) return null;
  const date = (at: number) => `${f.weekday(at)}, ${f.dayMonth(at)}`;
  const uts = (running ?? next)!.kind === "uts";
  const days = next ? f.dayOffset(next.start) : 0;
  const text = running
    ? t(uts ? "home.utsNow" : "home.uasNow", { date: date(running.end - 1) })
    : days === 1
      ? t(uts ? "home.utsTomorrow" : "home.uasTomorrow")
      : t(uts ? "home.utsIn" : "home.uasIn", { count: days });
  const why = next ? t(uts ? "home.utsStarts" : "home.uasStarts", { date: date(next.start) }) : null;
  const line = (
    <button
      type="button"
      onClick={() => go({ screen: "schedule" })}
      aria-label={why ? `${text}. ${why}` : undefined}
      className="focus-ring flex items-center gap-1.5 rounded-tag text-small text-muted hover:text-fg"
    >
      <Icons.CalendarClock className="size-3.5 shrink-0 text-faint" />
      {text}
    </button>
  );
  return why ? <Tooltip content={why}>{line}</Tooltip> : line;
}

// ---------------------------------------------------------------- Sekarang

function NowSection({
  card,
  courses,
  context,
  unread,
}: {
  card: NowCard | null;
  courses: readonly TermCourse[];
  context: HomeContext;
  /** The first day ahead with a class SIX shows that the app couldn't read. */
  unread: string | null;
}) {
  const t = useT();
  const f = useFormat();
  if (!card) {
    // Without SIX there's no timetable: "Hari ini" says how to get it. With one, a quiet week, unless a class on it can't be read.
    if (context.schedule === null) return null;
    return (
      <section aria-labelledby="home-now">
        <h2 id="home-now" className="sr-only">
          {t("home.now")}
        </h2>
        {unread ? (
          <Card variant="sunken" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 text-body">
            <span>
              <Meta className="font-medium">{t("home.now.unread", { day: f.relativeDay(dayNoon(unread)) })}</Meta>
              <span className="block text-small text-muted">{t("schedule.unread.hint", { count: 1 })}</span>
            </span>
            <OpenSixTimetable day={unread} />
          </Card>
        ) : (
          <Card variant="sunken" className="px-5 py-4 text-body text-muted">
            {t("home.now.free")}
          </Card>
        )}
      </section>
    );
  }
  return (
    <section aria-labelledby="home-now">
      <h2 id="home-now" className="sr-only">
        {t("home.now")}
      </h2>
      <NowCardView card={card} courses={courses} context={context} />
    </section>
  );
}

function NowCardView({ card, courses, context }: { card: NowCard; courses: readonly TermCourse[]; context: HomeContext }) {
  const t = useT();
  const examIds = useExamIds();
  const f = useFormat();
  const now = useNow();
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

  const eyebrow =
    // The end is in the time column beside it.
    card.state === "live" && slot
      ? t("home.now.live")
      : card.state === "next" && slot
        ? t("home.now.next", { when: f.fromNow(slot.start) })
        : card.state === "later" && slot
          ? t("home.now.later", { day: f.relativeDay(slot.start) })
          : t("home.now.presenceOnly");

  const open = (): Route => (course?.edunex ? { screen: "course", code, tab: "meetings" } : { screen: "presence" });
  // A sitting opens its exam's page, as its row in Hari ini did before the card took it.
  const examId = session ? examIds.get(session.id) : undefined;
  // The card's class isn't repeated in Hari ini, so its statuses are said here, on its one line of facts.
  const statuses = facts ? classStatuses(t, f, facts, context) : [];

  return (
    <NowCardShell
      // Lifted while it matters now: a class on, or a Presence window to do.
      raised={card.state === "live" || Boolean(card.presence)}
      time={slot ? { start: f.time(slot.start), end: f.time(slot.end) } : null}
      eyebrow={
        // Green only while the app is reading the source: offline, the dot goes grey and the words with it.
        <span className={cx("flex items-center gap-2", card.state === "live" && fresh ? "text-success-fg" : "text-muted")}>
          {card.state === "live" && (fresh ? <LiveDot /> : <span aria-hidden className="size-2 shrink-0 rounded-full bg-faint" />)}
          <Meta>{eyebrow}</Meta>
        </span>
      }
      title={
        <button
          type="button"
          onClick={() => go(examId ? { screen: "exam", examId } : open())}
          // One line, cut short when the name is long: whole on hover.
          title={nameOf(courses, code, session?.courseName)}
          className="focus-ring block max-w-full truncate rounded-tag text-left text-heading font-semibold tracking-[-0.01em] hover:underline hover:decoration-faint hover:underline-offset-4"
        >
          {nameOf(courses, code, session?.courseName)}
        </button>
      }
      meta={
        <Meta>
          <span className="inline-flex items-center gap-1.5 font-semibold text-fg tabular-nums">
            <CourseDot color={color} className="size-2" />
            {code}
          </span>
          {session?.room ? (
            <span className="inline-flex items-center gap-1">
              <Icons.MapPin className="size-3.5" />
              {session.room}
            </span>
          ) : (
            ""
          )}
          {windowFor ? <span className="tabular-nums">{classDayTime(f, windowFor.start, windowFor.end)}</span> : ""}
          {session && !/^kuliah$/i.test(session.activity) ? (
            // An exam reads by its word and weight; red is for what is lost, overdue or failing (docs/design-system.md).
            <span className="font-semibold">{session.activity}</span>
          ) : (
            ""
          )}
          {meeting ? t(meeting.online ? "home.today.meetingOnline" : "home.today.meeting", { number: meeting.number }) : ""}
          {statuses.map((status) => (
            <Explained key={status.key} text={status.text} why={status.why} className={STATUS_TONE[status.tone]} />
          ))}
          {meeting && !card.meeting?.maybeInSix ? (
            // Read from the lecturer's text, not SIX: said where the Student decides to go. Not on a day SIX shows a class the app couldn't read.
            <Explained text={t("home.today.notInSix")} why={t("home.today.notInSixWhy")} />
          ) : (
            ""
          )}
        </Meta>
      }
      action={
        link && card.state !== "later" && !card.presence?.edunexOnly ? (
          <JoinButton link={link} code={code} primary={card.state === "live" || (slot !== null && slot.start - now < 15 * MINUTE)} />
        ) : undefined
      }
    >
      {/* What comes after is the next row of Hari ini, right under the card: not said here again. */}
      <Attendance card={card} />
      {card.unreadDay && <UnreadAhead day={card.unreadDay} />}
    </NowCardShell>
  );
}

/** Under the card: a day up to its class's with a class the app couldn't read, so the card's class isn't taken for the only one. */
function UnreadAhead({ day }: { day: string }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-5 py-2.5 text-small text-muted">
      <span className="flex items-center gap-2">
        <Icons.Info className="size-3.5 shrink-0 text-faint" />
        <Meta>{t("home.now.unread", { day: f.relativeDay(dayNoon(day)) })}</Meta>
      </span>
      <OpenSixTimetable day={day} />
    </div>
  );
}

/**
 * Where attendance counts, and the one thing to do, as steps, one line each with its button: SIX's "Tandai Hadir"
 * while the class is on (what the app last saw of SIX's button), then the Edunex Presence before it closes. With
 * both, the one due first is the blue button. How each is done, and where it counts, is in its info button.
 */
function Attendance({ card }: { card: NowCard }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const external = useOpenExternal();
  const actionLabel = useActionLabel();
  const student = useDataset("six.student");
  const checkIns = useDataset("six.checkIn");
  const facts = card.class;
  const presence = card.presence;
  const counted = facts?.countedIn ?? "unknown";

  const where = presence?.edunexOnly
    ? t("home.now.countEdunex")
    : presence?.noSix
      ? t("home.now.countNoSix")
      : presence && presence.edunexOnly === null
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
  // Edunex's step: what to do and by when are in its info; on the line, the close time and the bar running down to it.
  const edunexStep = (primary: boolean, why: string | null) => {
    if (!presence) return null;
    const { session } = presence;
    const action = actionLabel({ action: { activity: presence.activity, task: presence.task, url: presence.url } });
    return (
      <Step
        icon={<SourceLogo source="edunex" className="size-4" />}
        label={t("home.now.edunexStep")}
        status={t("home.need.presence.closes", { time: f.dayTime(session.closesAt) })}
        why={sentences(t("home.now.edunexWhy", { action, time: f.dayTime(session.closesAt) }), why)}
        extra={
          <CountdownBar
            className="w-20 shrink-0"
            opensAt={session.opensAt}
            closesAt={session.closesAt}
            now={now}
            // Under a day, how long is left; a window can stay open for days, and "50 jam" says nothing.
            label={
              session.closesAt - now < DAY
                ? t("home.now.closesIn", { left: f.countdown(session.closesAt) })
                : t("home.now.closesWhen", { when: f.fromNow(session.closesAt) })
            }
            showLabel={false}
          />
        }
        action={
          <Button
            variant={primary ? "primary" : "secondary"}
            icon={viaTask ? undefined : <Icons.ArrowUpRight className="size-3.5" />}
            onClick={openPresence}
            aria-label={viaTask ? t("home.now.openTask") : t("home.now.recordLabel", { course: presence.code })}
          >
            {viaTask ? t("home.now.openTask") : t("presence.open.record")}
          </Button>
        }
      />
    );
  };

  // The class on now (or about to start) while the app reads its popup on SIX: where SIX counts, or once SIX showed its button.
  const session = facts?.session ?? null;
  const check = session ? checkIns?.[session.id] : undefined;
  if (session && student && (card.state === "live" || card.state === "next") && checkingIn(session, now)) {
    if (check || counted === "six" || counted === "both" || counted === "unknown") {
      // The one due first is the blue button: SIX's while it shows (the lecturer can close it any minute), else Edunex's.
      const open = (check?.state ?? "waiting") === "open";
      return (
        <Steps>
          <CheckIn session={session} check={check} url={sixTimetableUrl(student, session.start)} />
          {/* No system says whether the lecturer uses Edunex's too: it's there to do, never "optional". */}
          {edunexStep(!open, null)}
        </Steps>
      );
    }
  }

  // An open Presence is the action: it may be what counts, and doing it costs nothing. Without SIX nobody can say it
  // counts: worth doing just in case, so said calmly, its button quiet.
  if (presence) return <Steps>{edunexStep(!presence.noSix, where)}</Steps>;

  if (!where) return null;
  const six = counted === "six" || counted === "both";
  return (
    <Steps>
      <Step
        icon={<Icons.CheckCircle className={cx("size-4 shrink-0", six ? "text-success-fg" : "text-faint")} weight="bold" />}
        label={six ? t("home.now.whereSix") : where}
        why={six ? where : null}
      />
    </Steps>
  );
}

/** Sentences for a tooltip, each ending with its full stop. */
const sentences = (...texts: (string | null | undefined)[]) =>
  texts
    .filter((text): text is string => Boolean(text))
    .map((text) => (/[.?!]$/.test(text) ? text : `${text}.`))
    .join(" ");

/** The card's steps, under its head: a hairline above, a quiet background, one line each. */
function Steps({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-2 border-t border-line bg-sunken/60 px-5 py-3">{children}</ul>;
}

/** One step: its icon, what to do in a word or two, its state, the why a button away, and its own button at the end. */
function Step({
  icon,
  label,
  status,
  statusClass,
  why,
  extra,
  action,
}: {
  icon: ReactNode;
  label: string;
  status?: string;
  statusClass?: string;
  why?: string | null;
  extra?: ReactNode;
  action?: ReactNode;
}) {
  return (
    // The words keep 15rem beside the button; with less, the button goes under them.
    <li className="group/row flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1.5">
      <div className="flex min-w-0 flex-1 basis-60 items-center gap-2">
        {icon}
        <Meta className="text-body">
          <span className="font-semibold">{label}</span>
          {status ? <span className={cx("tabular-nums", statusClass ?? "text-muted")}>{status}</span> : ""}
        </Meta>
        {extra}
        {why && <WhyButton why={why} />}
      </div>
      {action && <div className="flex shrink-0 items-center">{action}</div>}
    </li>
  );
}

/**
 * SIX's "Tandai Hadir" for the class on now, as a step: open (the button shows), gone (it showed, and doesn't now),
 * pressed, or still to come.
 */
function CheckIn({ session, check, url }: { session: ClassSession; check: SixCheckIn | undefined; url: string }) {
  const t = useT();
  const f = useFormat();
  const openCheckIn = useOpenCheckIn();
  const state = check?.state ?? "waiting";
  // Seen pressed in the app's SIX window, and the button gone after: said as done.
  const pressed = state === "gone" && check?.pressedAt !== undefined;
  const open = state === "open";
  return (
    <Step
      icon={pressed ? <Icons.CheckCircle className="size-4 shrink-0 text-success-fg" weight="bold" /> : <SourceLogo source="six" className="size-4" />}
      label={t("home.now.sixStep")}
      status={
        pressed
          ? t("home.now.sixPressed", { time: f.time(check.pressedAt!) })
          : open
            ? t("home.now.sixOpen")
            : state === "gone"
              ? t("home.now.sixGone")
              : t("home.now.sixWaiting")
      }
      statusClass={open ? "font-semibold text-fg" : undefined}
      why={
        pressed
          ? null
          : open
            ? t("home.now.checkInOpenHint", { time: f.time(session.end) })
            : state === "gone"
              ? t("home.now.sixGoneWhy")
              : t("home.now.sixWaitingWhy")
      }
      action={
        <Button
          variant={open ? "primary" : state === "gone" ? "ghost" : "secondary"}
          icon={<Icons.ArrowUpRight className="size-3.5" />}
          onClick={() => openCheckIn(session.id, url)}
          aria-label={t("home.now.openSixLabel", { course: session.courseCode })}
        >
          {t("home.now.openSix")}
        </Button>
      }
    />
  );
}

/** A class's day and time, as the course page names the class a window is for: "Kam, 8 Okt, 08:00–10:00". */
const classDayTime = (f: Format, start: number, end: number) => `${f.relativeDay(start)}, ${f.timeRange(start, end)}`;

/** One status of a class, in a few words, and what's behind it. */
type ClassStatus = Status;

/**
 * A class's statuses, most pressing first: its target out of reach, a clash (the pick folded into its why on the
 * course that needs the Student more, Presensi's answer), a new time or room, no absences left.
 */
function classStatuses(t: Translate, f: Format, facts: ClassFacts, context: HomeContext): ClassStatus[] {
  const out: ClassStatus[] = [];
  const { health } = facts;
  if (health && facts.state === "out")
    out.push({
      key: "out",
      text: t("home.today.out", { target: health.target }),
      why: t("home.today.outWhy", { best: percent(health.best ?? 0) }),
      tone: "danger",
    });
  if (facts.overlap) {
    const other = context.health.get(facts.overlap.code);
    const picked = health && other ? clashPick(health, other).pick === facts.session.courseCode : false;
    out.push({
      key: "clash",
      text: t("home.today.overlap"),
      why: sentences(
        t("home.today.overlapWhy", { course: facts.overlap.code, time: f.timeRange(facts.overlap.from, facts.overlap.to) }),
        picked ? t("home.today.pick") : null,
      ),
      tone: "warning",
    });
  }
  const moved = facts.moved;
  if (moved) {
    const time = moved.usualStart !== null && moved.usualEnd !== null ? f.timeRange(moved.usualStart, moved.usualEnd) : null;
    out.push({
      key: "moved",
      text: t(time ? "home.today.changed" : "home.today.roomChanged"),
      why: t("home.today.usual", {
        usual:
          time === null
            ? (moved.usualRoom ?? "")
            : f.dayOffset(moved.usualStart!) === f.dayOffset(facts.session.start)
              ? time
              : `${f.weekday(moved.usualStart!)} ${time}`,
      }),
      tone: "quiet",
    });
  }
  // No absences left is a fact to keep in mind, not something to do now: quiet, as amber is for that.
  if (health && facts.state === "none") out.push({ key: "none", text: t("home.today.mustAttend"), why: t("home.today.mustAttendWhy"), tone: "quiet" });
  return out;
}

function JoinButton({ link, code, primary = false }: { link: string; code: string; primary?: boolean }) {
  const t = useT();
  const open = useOpenExternal();
  return (
    <Button
      variant={primary ? "primary" : "secondary"}
      icon={<Icons.Video className="size-3.5" />}
      onClick={() => open(link)}
      aria-label={t("home.today.joinLabel", { course: code })}
    >
      {t("home.today.join")}
    </Button>
  );
}

// ---------------------------------------------------------------- Hari ini

/** Before SIX's timetable: where today's classes come from, and a way in while signed out. */
function NoSixToday() {
  const t = useT();
  const signedOut = useStatus("six").state === "signed-out";
  const { signIn, busy } = useSignIn();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-1 text-body text-muted">
      {t("home.today.noSix")}
      {signedOut && (
        <Button size="sm" busy={busy} onClick={() => void signIn("six")}>
          {t("home.today.signInSix")}
        </Button>
      )}
    </div>
  );
}

type TodayItem =
  | { kind: "unread"; at: number; unread: UnreadSession }
  | { kind: "class"; at: number; facts: ClassFacts }
  | { kind: "meeting"; at: number; code: string; meeting: TodayPlan["announced"][number]["meeting"]; maybeInSix?: true }
  | { kind: "due"; at: number; task: TodayPlan["due"][number]; need: NeedDraft | null };

/** The Hari ini row key of what the now card shows. */
const cardKey = (card: NowCard | null) =>
  card?.class ? `class:${card.class.session.id}` : card?.meeting ? `meeting:${card.meeting.code}:${card.meeting.meeting.start}` : null;

/**
 * `due`: the deadlines as Beranda's items, so each can be put off; one put off
 * leaves the day and is listed under "Perlu perhatianmu" until it's back.
 * `onCard`: the row key of what the now card above already shows, so it isn't listed again.
 */
function Today({
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
  // What the card above shows isn't listed again: the day goes on from it.
  const shown = items.filter((item) => !putOff(item) && keyOf(item) !== onCard);
  const today = shown.filter((item) => wibDay(item.at) === day);
  const tomorrow = shown.filter((item) => wibDay(item.at) !== day);
  // Never "no deadlines today" while today's are only put off or handled, and never "snoozed" for what's handled.
  const isToday = (item: TodayItem) => wibDay(item.at) === day;
  // With today's class on the card, "no classes today" would be wrong: nothing else, instead.
  const empty = items.some((item) => keyOf(item) === onCard && isToday(item))
    ? "home.today.noneElse"
    : items.some((item) => snoozed(item) && isToday(item))
      ? "home.today.noneSnoozed"
      : items.some((item) => putAway(item) && isToday(item))
        ? "home.today.noneHandled"
        : "home.today.none";
  return (
    <Section id="home-today" title={t("home.today")} className="mt-0">
      {!context.schedule && <NoSixToday />}
      {today.length > 0 ? (
        <List label={t("home.today")} className={cx(PLAIN, !context.schedule && "mt-3")}>
          {/* A deadline put off fades out, and focus moves on to the next row. */}
          <PresenceList>
            {today.map((item) => (
              <TodayRow key={keyOf(item)} item={item} courses={courses} context={context} />
            ))}
          </PresenceList>
        </List>
      ) : (
        context.schedule && <p className="py-1 text-body text-muted">{t(empty)}</p>
      )}
      {tomorrow.length > 0 && (
        <>
          <h3 className="mt-5 mb-2 text-small font-semibold text-muted">{t("home.today.tomorrow")}</h3>
          <List label={t("home.today.tomorrow")} className={PLAIN}>
            <PresenceList>
              {tomorrow.map((item) => (
                <TodayRow key={keyOf(item)} item={item} courses={courses} context={context} />
              ))}
            </PresenceList>
          </List>
        </>
      )}
    </Section>
  );
}

const keyOf = (item: TodayItem) =>
  item.kind === "unread"
    ? `unread:${item.unread.day}:${item.unread.row}`
    : item.kind === "class"
      ? `class:${item.facts.session.id}`
      : item.kind === "meeting"
        ? `meeting:${item.code}:${item.at}`
        : `due:${item.task.id}`;

/** The time column: start over end, or a deadline's one time. */
function When({ start, end, past, tone }: { start: string; end?: string; past?: boolean; tone?: string }) {
  return (
    <span className="w-[46px] text-small tabular-nums">
      <span className={cx("block font-semibold", past ? "text-faint" : (tone ?? "text-fg"))}>{start}</span>
      {end && <span className="block text-caption text-faint">{end}</span>}
    </span>
  );
}

function TodayRow({ item, courses, context }: { item: TodayItem; courses: readonly TermCourse[]; context: HomeContext }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const open = useOpenExternal();
  const examIds = useExamIds();
  const fresh = useStatus("six").state === "live";
  const edunexFresh = useStatus("edunex").state === "live";

  if (item.kind === "unread") {
    // As SIX writes it, so the Student knows which class to look for on SIX.
    return (
      <Row
        leading={<When start="-" />}
        title={t("schedule.unread.title", { count: 1 })}
        meta={<span className="break-words">{item.unread.row}</span>}
        trailing={<OpenSixTimetable day={item.unread.day} />}
      />
    );
  }

  if (item.kind === "due") {
    const { task, need } = item;
    const close = task.dueAt! - now <= 6 * 60 * MINUTE;
    // Put off as "Perlu perhatianmu" puts off a deadline: the moments that still fit, never past its last hours.
    const later = need ? snoozable(need, now) : null;
    const name = factsLabel(task.title, task.courseCode);
    return (
      <Row
        id={need ? needRowId(need.id) : undefined}
        actions={rowControls(need && doneButton(t, need, name), later && canSnooze(later, now) ? <SnoozeMenu item={later} name={name} /> : undefined)}
        leading={<When start={f.time(task.dueAt!)} tone={close ? "text-warning-fg" : undefined} />}
        title={task.title}
        meta={
          <Meta>
            <CourseMark code={task.courseCode} courses={courses} />
            {t("home.today.due")}
          </Meta>
        }
        trailing={
          <span className={cx("text-caption whitespace-nowrap tabular-nums", close ? "font-semibold text-warning-fg" : "text-muted")}>
            {f.fromNow(task.dueAt!)}
          </span>
        }
        onClick={() => go({ screen: "task", taskId: task.id })}
      />
    );
  }

  if (item.kind === "meeting") {
    const { meeting, code } = item;
    const live = meeting.start <= now && now < meeting.end;
    // Not on a day SIX shows a class the app couldn't read: this may be it.
    const notInSix = !item.maybeInSix;
    return (
      <Row
        leading={<When start={f.time(meeting.start)} end={f.time(meeting.end)} />}
        title={nameOf(courses, code)}
        meta={
          // Its number is the course page's; online with a link, the camera beside it says so.
          <Meta>
            <CourseMark code={code} courses={courses} />
            {meeting.online && !meeting.link ? t("home.today.online") : ""}
          </Meta>
        }
        trailing={live ? <NowMark fresh={edunexFresh} /> : meeting.link ? <Icons.Video className="size-4 text-faint" /> : undefined}
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
        actions={notInSix ? rowControls(undefined, <WhyButton why={t("home.today.notInSixWhy")} />) : undefined}
        onClick={() => (meeting.link ? open(meeting.link) : go({ screen: "course", code, tab: "meetings" }))}
      >
        {/* A fact, not something to do now: quiet. */}
        {notInSix && <StatusLine statuses={[{ key: "notInSix", text: t("home.today.notInSix"), why: "", tone: "quiet" }]} />}
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
  // Said on the day, at most two, most pressing first: the target out of reach (red, so the course doesn't vanish from
  // Beranda), a clash, a new time or room, no absences left. What's behind each is in the info button beside the row.
  const statuses = past ? [] : classStatuses(t, f, facts, context);
  // A class that's over: what SIX's count did after it, when the app saw.
  const result = past ? context.classResults?.[session.id]?.result : undefined;
  return (
    <Row
      // Past, quieter in token greys that still read at 4.5:1; never faded with opacity.
      className={cx(past && "text-muted")}
      leading={<When start={f.time(session.start)} end={f.time(session.end)} past={past} />}
      title={course?.name ?? session.courseName}
      meta={
        <Meta className={cx(past && "text-faint")}>
          <CourseMark code={session.courseCode} courses={courses} past={past} />
          {session.room ?? ""}
          {exam || !/^kuliah$/i.test(session.activity) ? <span className="font-semibold">{session.activity}</span> : ""}
        </Meta>
      }
      trailing={
        facts.live ? (
          <NowMark fresh={fresh} />
        ) : past ? (
          <span className={cx("text-caption", result === "absent" ? "font-medium text-danger-fg" : result === "missing" ? "text-warning-fg" : "text-faint")}>
            {t(
              result === "counted"
                ? "home.today.counted"
                : result === "absent"
                  ? "home.today.absent"
                  : result === "missing"
                    ? "home.today.notCounted"
                    : "home.today.done",
            )}
          </span>
        ) : session.start - now <= SOON ? (
          <span className="text-caption whitespace-nowrap text-muted tabular-nums">{f.fromNow(session.start)}</span>
        ) : undefined
      }
      actions={statuses.length ? rowControls(undefined, <WhyButton why={sentences(...statuses.map((status) => status.why))} />) : undefined}
      onClick={() =>
        go(examId ? { screen: "exam", examId } : course?.edunex ? { screen: "course", code: session.courseCode, tab: "meetings" } : { screen: "presence" })
      }
    >
      {statuses.length > 0 && <StatusLine statuses={statuses.slice(0, 2)} icons={STATUS_ICON} />}
    </Row>
  );
}

const STATUS_ICON: Record<string, typeof Icons.Home> = {
  out: Icons.Target,
  clash: Icons.Overlap,
  moved: Icons.Clock,
  none: Icons.Hand,
  notInSix: Icons.Megaphone,
};

/** "Sekarang" on the row of a class or meeting going on. */
function NowMark({ fresh }: { fresh: boolean }) {
  const t = useT();
  return (
    // Green only while the app is reading the source, as on the card.
    <span className={cx("inline-flex items-center gap-1.5 text-caption font-semibold", fresh ? "text-success-fg" : "text-muted")}>
      {fresh && <LiveDot className="scale-75" />}
      {t("home.today.now")}
    </span>
  );
}

function CourseMark({ code, past = false }: { code: string; courses: readonly TermCourse[]; past?: boolean }) {
  const color = useCourseColor()(code);
  return (
    <span className={cx("inline-flex items-center gap-1.5 font-medium tabular-nums", past ? "text-faint" : "text-fg/80")}>
      <CourseDot color={color} className="size-2" />
      {code}
    </span>
  );
}

// ---------------------------------------------------------------- Perlu perhatianmu

/**
 * `due`: "Hari ini"'s deadlines, as items: the ones put off or put away are listed here with the rest.
 * `range`: how far ahead it looks, for the empty list to say only what's true.
 */
function NeedsYou({
  needs,
  due,
  range,
  courses,
}: {
  needs: readonly NeedDraft[];
  due: readonly NeedDraft[];
  range: NeedsRange;
  courses: readonly TermCourse[];
}) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const tasks = useDataset("edunex.tasks");
  // Until Edunex's Tasks arrive, an empty list would claim more than the app knows.
  const edunex = useStatus("edunex");
  const loading = tasks === undefined && edunex.state !== "signed-out";
  // What the Student put off ("Ingatkan nanti") leaves the list until its time, or until it changes;
  // what they marked handled ("Sudah kucek") leaves it until a new fact brings it back.
  const { entries } = useSnoozes();
  const { entries: handled } = useDone();
  const { shown, snoozed, done } = useMemo(() => heldBack(needs, due, entries, handled, now), [needs, due, entries, handled, now]);
  const [listOpen, setListOpen] = usePlaceState("home.snoozedOpen", false);
  const away = snoozed.length + done.length;
  // Closed once nothing is put off or away, so the next one doesn't find the list open.
  if (listOpen && !away) setListOpen(false);
  const awayLine = away > 0 && <AwayLine snoozed={snoozed.length} done={done.length} open={listOpen} onToggle={() => setListOpen(!listOpen)} />;
  return (
    <Section id="home-needs" title={t("home.needs")} count={loading || shown.length === 0 ? undefined : shown.length} className="mt-0">
      {loading ? (
        <div className="py-1" aria-busy="true">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-2/3" />
        </div>
      ) : shown.length ? (
        <>
          <List label={t("home.needs")} className={PLAIN}>
            {/* A row put off or away fades out, and focus moves on to the next. */}
            <PresenceList>
              {shown.map((need) => (
                <NeedRow key={need.id} need={need} courses={courses} />
              ))}
            </PresenceList>
          </List>
          {awayLine && <div className="mt-2.5">{awayLine}</div>}
        </>
      ) : (
        // Everything left is put off or handled: say so, never "nothing due".
        <div className="py-1">
          <p className="flex items-center gap-2 text-body font-medium">
            {/* Green says "all clear": not while things are only put off. */}
            {snoozed.length ? (
              <Icons.Snooze className="size-4 shrink-0 text-faint" />
            ) : (
              <Icons.CheckCircle className="size-4 shrink-0 text-success-fg" weight="bold" />
            )}
            {snoozed.length
              ? t("home.needs.allSnoozed")
              : // A group Task marked done may still be due: "handled", not "nothing due".
                done.length
                ? t("home.needs.allHandled")
                : // Something due that isn't listed here (Hari ini has it, or it isn't open yet): never "nothing due".
                  range.next !== null
                  ? t("home.needs.noneElse")
                  : t("home.needs.none", { count: range.days })}
          </p>
          <div className="mt-0.5 pl-6 text-small text-muted">
            {awayLine ||
              (range.next !== null
                ? t("home.needs.noneElseHint", { when: f.dayTimeWord(range.next) })
                : t("home.needs.noneHint", { day: `${f.weekday(range.until - 1)}, ${f.dayMonth(range.until - 1)}` }))}
          </div>
        </div>
      )}
      {!loading && listOpen && snoozed.length > 0 && (
        <List label={t("snooze.list")} className={cx(PLAIN, "mt-2.5")}>
          {snoozed.map(({ item, entry }) => (
            <SnoozedRow key={item.id} need={item} entry={entry} courses={courses} />
          ))}
        </List>
      )}
      {!loading && listOpen && done.length > 0 && (
        <List label={t("done.list")} className={cx(PLAIN, "mt-2.5")}>
          {done.map(({ item, entry }) => (
            <DoneRow key={item.id} need={item} entry={entry} courses={courses} />
          ))}
        </List>
      )}
    </Section>
  );
}

/** "2 ditunda · 1 sudah beres · Tampilkan": quiet, at the end of the list, opening what's put off and away. */
function AwayLine({ snoozed, done, open, onToggle }: { snoozed: number; done: number; open: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <Meta className="text-small text-muted">
      {snoozed > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          <Icons.Snooze className="size-3.5 shrink-0 text-faint" />
          {t("snooze.count", { count: snoozed })}
        </span>
      ) : (
        ""
      )}
      {done > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          <Icons.Check className="size-3.5 shrink-0 text-faint" weight="bold" />
          {t("done.count", { count: done })}
        </span>
      ) : (
        ""
      )}
      <button
        type="button"
        data-snoozed=""
        aria-expanded={open}
        onClick={onToggle}
        className="focus-ring rounded-tag font-medium text-accent-fg hover:underline"
      >
        {open ? t("snooze.hideList") : t("snooze.showList")}
      </button>
    </Meta>
  );
}

/** Something put off: what it is, when it's back, and the way to bring it back now. */
function SnoozedRow({ need, entry, courses }: { need: NeedDraft; entry: SnoozeEntry; courses: readonly TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  const { wake } = useSnoozes();
  const view = useNeedView(courses)(need);
  const when = f.dueLabel(entry.until);
  return (
    <Row
      title={view.title}
      meta={
        <Meta>
          {view.titleLacksCourse && need.course ? <CourseMark code={need.course} courses={courses} /> : null}
          {view.which ? <span className="tabular-nums">{view.which}</span> : null}
          {entry.reason === "change" ? t("snooze.untilChange", { when }) : t("snooze.until", { when })}
        </Meta>
      }
      trailing={
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("snooze.wakeFor", { title: fullName(need, view) })}
          onClick={(event) => bringBack(event.currentTarget, need, () => wake(entry.id))}
        >
          {t("snooze.wake")}
        </Button>
      }
    />
  );
}

/** Something handled: what it is, when the Student said so, and the way to show it again. */
function DoneRow({ need, entry, courses }: { need: NeedDraft; entry: DoneEntry; courses: readonly TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  const { unmark } = useDone();
  const view = useNeedView(courses)(need);
  return (
    <Row
      title={view.title}
      meta={
        <Meta>
          {view.titleLacksCourse && need.course ? <CourseMark code={need.course} courses={courses} /> : null}
          {view.which ? <span className="tabular-nums">{view.which}</span> : null}
          {t(`done.line.${entry.how}`, { when: f.dayTimeWord(entry.at) })}
        </Meta>
      }
      trailing={
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("done.showAgainFor", { title: fullName(need, view) })}
          onClick={(event) => bringBack(event.currentTarget, need, () => unmark(entry.id))}
        >
          {t("done.showAgain")}
        </Button>
      }
    />
  );
}

/** Brings an item back from the list of what's put off or away; its row leaves with the button, so focus goes on to the next one there, else to the item itself, back in the list. */
function bringBack(button: HTMLElement, need: NeedDraft, change: () => Promise<void>) {
  const row = button.closest("li");
  const sibling = (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLElement>("button");
  void change().catch(() => undefined);
  refocus(() => sibling ?? document.getElementById(needRowId(need.id)));
}

/** The ✓ for an item only the Student can know is dealt with, saying until what it's put away; none for the rest. */
function doneButton(t: Translate, need: NeedDraft, name: string): ReactNode {
  const terms = doneTerms(need);
  if (!terms?.how) return undefined;
  return <DoneButton item={terms.key} how={terms.how as RowDone} name={name} said={doneSaid(t, need, terms)} />;
}

function doneSaid(t: Translate, need: NeedDraft, terms: DoneTerms): string {
  switch (terms.how) {
    case "gotIt":
      return need.kind === "attendance" && need.health.state === "out"
        ? t("done.toast.gotIt", { course: need.course ?? "" })
        : terms.key.id.includes(":class:")
          ? t("done.toast.gotItClass")
          : t("done.toast.gotItCount");
    case "checked":
    case "groupDone":
    case "paid":
      return t(`done.toast.${terms.how}`);
    default:
      return "";
  }
}

/** A Needs-you row's id, so focus can be sent back to it. */
const needRowId = (id: string) => `need-${id}`;

interface NeedView {
  title: string;
  /** Short facts: the course, a time, a place. */
  meta: ReactNode[];
  /** The last fact of the line, in its own tone ("SIX dan Edunex beda tanggal"). */
  note?: { text: string; tone: "danger" | "warning" | null };
  /** What to do about it, behind an info button beside the row (an attendance warning has no snooze there). */
  why?: string;
  /** The right side: when, said the human way. */
  when: string | null;
  tone: "danger" | "warning" | null;
  /** What the row's click does, for screen readers. */
  label?: string;
  /** The title is a Task's own name ("Tugas 02"), which doesn't say which course. */
  titleLacksCourse?: boolean;
  /** What tells it from a look-alike of the same course: a Presence window's class ("Kam, 8 Okt, 08:00–10:00"). */
  which?: string;
}

/** What an item is, said whole where its facts aren't beside it: a Task's name with its course ("Tugas 02 · II4091"), a window with its class. */
const fullName = (need: NeedDraft, view: NeedView) => factsLabel(view.title, view.titleLacksCourse && need.course, view.which);

/**
 * What a Task's newest edit changed, as a row's note says it: how many
 * things, or the one date that moved, by name. Null when nothing's to say:
 * never edited, checked, not compared, or nothing compared changed.
 */
function editNote(t: Translate, f: Format, view: EditView | null, afterSubmit: boolean): string | null {
  if (!view || view.checked || view.state !== "known") return null;
  const move = dateMove(view.changes);
  const date = (at: number) => `${f.weekdayShort(at)}, ${f.dayMonth(at)}`;
  if (move) {
    const change =
      move.kind === "deadline"
        ? move.to === null
          ? t("home.move.deadlineRemoved")
          : move.from === null
            ? t("home.move.deadlineAdded", { date: date(move.to) })
            : t(move.to < move.from ? "home.move.deadlineEarlier" : "home.move.deadline", { date: date(move.to) })
        : move.to === null
          ? t("home.move.opensNow")
          : t("home.move.opens", { date: date(move.to) });
    return t(afterSubmit ? "home.need.task.editedMove" : "home.need.task.changedMove", { change });
  }
  return t(afterSubmit ? "home.need.task.editedCount" : "home.need.task.changedCount", { count: view.changes.length });
}

function useNeedView(courses: readonly TermCourse[]): (need: NeedDraft) => NeedView {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const edits = useDataset("edunex.taskEdits");
  const { entries: handled } = useDone();
  const near = (at: number | null) => (at !== null && at - now <= DAY ? "warning" : null);
  return (need) => {
    const course = need.course ? <CourseMark key="course" code={need.course} courses={courses} /> : null;
    switch (need.kind) {
      case "presence": {
        // Which class it's for: a window can stay open for days, into the course's next class.
        const of = need.class ?? need.session;
        const which = classDayTime(f, of.start, of.end);
        const forClass = (
          <span key="class" className="tabular-nums">
            {which}
          </span>
        );
        const closes = t("home.need.presence.closes", { time: f.dayTime(need.session.closesAt) });
        if (need.open)
          // Without SIX nobody knows whether it counts: worth doing just in case, so no amber.
          return need.countedIn === "noSix"
            ? {
                title: t("home.need.presenceNoSix", { course: need.course ?? "" }),
                which,
                meta: [course, forClass, closes],
                note: { text: t("home.need.presenceNoSix.note"), tone: null },
                when: f.fromNow(need.session.closesAt),
                tone: null,
              }
            : {
                title: t("home.need.presence", { course: need.course ?? "" }),
                which,
                meta: [course, forClass, closes],
                when: f.fromNow(need.session.closesAt),
                tone: "warning",
              };
        return {
          title: need.task ? t("home.need.presenceAhead.assignment", { task: need.task.title }) : t("home.need.presenceAhead", { course: need.course ?? "" }),
          titleLacksCourse: need.task !== null,
          meta: [course],
          note: {
            text:
              f.dayOffset(need.session.opensAt) === f.dayOffset(need.session.closesAt)
                ? t("home.need.presenceAhead.when", {
                    date: f.relativeDay(need.session.opensAt),
                    time: f.timeRange(need.session.opensAt, need.session.closesAt),
                  })
                : // Open across days: each end with its own day.
                  t("home.need.presenceAhead.span", { from: f.dueLabel(need.session.opensAt), to: f.dayTime(need.session.closesAt) }),
            tone: null,
          },
          when: f.fromNow(need.session.opensAt),
          tone: null,
        };
      }
      case "task": {
        const { task } = need;
        const edit = editView(task, edits, handled);
        if (need.reason === "edited")
          return {
            title: task.title,
            titleLacksCourse: true,
            meta: [course],
            // How many things changed (the Task page's History says which); not compared: as before.
            note: { text: editNote(t, f, edit, true) ?? t("home.need.task.edited"), tone: "warning" },
            when: null,
            tone: "warning",
          };
        // Changed before hand-in: a quiet note on the Task's own row for two weeks, never a second row; title alone is History's.
        const editAt = edit?.record?.at ?? task.editedAt;
        const changed = edit && editAt !== null && now - editAt < 14 * DAY && !titleOnly(edit.changes) ? editNote(t, f, edit, false) : null;
        const meta =
          need.reason === "returned"
            ? t("home.need.task.returned")
            : need.reason === "overdue"
              ? t("home.need.task.overdue")
              : need.reason === "short"
                ? t("home.need.task.short", { duration: f.countdown(now + (task.dueAt! - task.opensAt!)) })
                : t("home.need.task.due", { when: f.dueLabel(task.dueAt!) });
        return {
          title: task.title,
          titleLacksCourse: true,
          meta: [
            course,
            <span key="m" className={cx(need.reason === "overdue" && "text-danger-fg")}>
              {meta}
            </span>,
            need.draft ? t("home.need.task.draft") : null,
          ],
          note: changed ? { text: changed, tone: null } : undefined,
          when:
            need.reason === "overdue" || (need.reason === "returned" && task.dueAt !== null && task.dueAt < now)
              ? t("home.need.late")
              : task.dueAt === null
                ? null
                : f.fromNow(task.dueAt),
          tone: need.reason === "overdue" ? "danger" : need.reason === "returned" ? "warning" : near(task.dueAt),
        };
      }
      case "exam": {
        const { exam, sitting } = need;
        // Open for days on Edunex: it runs out when it closes, like a deadline.
        const closes = need.window && sitting.end !== null ? sitting.end : null;
        // The title names the course; the end is on the exam's page, and a take-home part is its own Task.
        return {
          title: t("home.need.exam", { kind: t(`exam.kind.${exam.kind}`), course: nameOf(courses, exam.courseCode) }),
          meta: [
            closes !== null ? t("home.need.exam.closes", { when: f.dueLabel(closes) }) : f.relativeDay(sitting.start),
            closes !== null ? null : (
              <span key="time" className="tabular-nums">
                {f.time(sitting.start)}
              </span>
            ),
            sitting.source === "six" ? sitting.room : t("home.need.exam.edunex"),
          ],
          note: need.disagree ? { text: t("home.need.exam.disagree"), tone: "warning" } : undefined,
          when: f.fromNow(closes ?? sitting.start),
          tone: near(closes ?? sitting.start),
        };
      }
      case "attendance": {
        const { health } = need;
        const vars = {
          attended: health.attended ?? 0,
          held: health.held ?? 0,
          target: health.target,
          best: percent(health.best ?? 0),
          course: need.course ?? "",
        };
        const out = health.state === "out";
        // No absences left: said the day before each class, with its time; with no class known, every day.
        const tomorrow = !out && need.at !== null;
        return {
          title: t(out ? "home.need.attendance.out" : tomorrow ? "home.need.attendance.tomorrow" : "home.need.attendance.none", vars),
          meta: [
            tomorrow && need.at !== null ? (
              <span key="t" className="tabular-nums">
                {f.time(need.at)}
              </span>
            ) : null,
            <span key="a" className={out ? "text-danger-fg" : "text-warning-fg"}>
              {t(out ? "home.need.attendance.outMeta" : "home.need.attendance.noneMeta", vars)}
            </span>,
          ],
          why: out ? t("home.need.attendance.outWhy") : undefined,
          when: null,
          tone: out ? "danger" : "warning",
        };
      }
      case "meeting": {
        const { meeting } = need;
        return {
          title: t(meeting.online ? "home.need.meeting.online" : "home.need.meeting", { course: need.course ?? "", day: f.relativeDay(meeting.start) }),
          meta: [course, f.timeRange(meeting.start, meeting.end), need.maybeInSix ? null : t("home.today.notInSix")],
          when: f.fromNow(meeting.start),
          tone: null,
          label: need.action.kind === "open" ? t("home.today.joinLabel", { course: need.course ?? "" }) : undefined,
        };
      }
      case "krs": {
        const date = `${f.weekdayShort(need.open ? need.closesAt - 1 : need.at!)} ${f.dayMonth(need.open ? need.closesAt - 1 : need.at!)}`;
        return {
          title: t("home.need.krs"),
          meta: [need.open ? t("home.need.krs.closes", { date }) : t("home.need.krs.opens", { date })],
          when: f.fromNow(need.open ? need.closesAt : need.at!),
          tone: need.open ? near(need.closesAt) : null,
        };
      }
      case "bill": {
        const { bill } = need;
        const date = `${f.weekdayShort(bill.nextDueAt! - 1)} ${f.dayMonth(bill.nextDueAt! - 1)}`;
        return {
          title: t("home.need.bill", { amount: rupiah(Math.max(0, (bill.amount ?? 0) - (bill.paid ?? 0))) }),
          meta: [
            <span key="b" className={cx(need.overdue && "text-danger-fg")}>
              {t(need.overdue ? "home.need.bill.overdue" : "home.need.bill.due", { date })}
            </span>,
          ],
          when: need.overdue ? t("home.need.late") : f.fromNow(bill.nextDueAt!),
          tone: need.overdue ? "danger" : near(bill.nextDueAt),
        };
      }
      case "class":
        // Today's classes are in "Hari ini"; attention() leaves them out.
        return { title: need.session.courseName, meta: [], when: null, tone: null };
    }
  };
}

function NeedRow({ need, courses }: { need: NeedDraft; courses: readonly TermCourse[] }) {
  const t = useT();
  const view = useNeedView(courses)(need);
  const now = useNow();
  const { go } = useNav();
  const open = useOpenExternal();
  const act = () => (need.action.kind === "go" ? go(need.action.route) : open(need.action.url));
  const later = snoozable(need, now);
  const name = fullName(need, view);
  // Attendance has "Sudah tahu" instead of a snooze: the warning is for one class, or for good. Its why goes there instead.
  const snooze =
    need.kind === "attendance" ? view.why && <WhyButton why={view.why} /> : canSnooze(later, now) ? <SnoozeMenu item={later} name={name} /> : undefined;
  return (
    <Row
      id={needRowId(need.id)}
      title={view.title}
      label={view.label}
      meta={
        // One line of facts: the note, when there is one, is its last.
        <Meta>
          {view.meta}
          {view.note ? (
            <span
              className={cx("font-medium", view.note.tone === "danger" ? "text-danger-fg" : view.note.tone === "warning" ? "text-warning-fg" : "text-muted")}
            >
              {view.note.text}
            </span>
          ) : null}
        </Meta>
      }
      actions={rowControls(doneButton(t, need, name), snooze)}
      trailing={
        view.when ? (
          <span
            className={cx(
              "text-caption font-medium whitespace-nowrap tabular-nums",
              view.tone === "danger" ? "text-danger-fg" : view.tone === "warning" ? "text-warning-fg" : "text-muted",
            )}
          >
            {view.when}
          </span>
        ) : undefined
      }
      onClick={act}
    />
  );
}

// ---------------------------------------------------------------- Yang berubah

const CHANGE_ICON: Partial<Record<AlertKind, typeof Icons.Home>> = {
  newTask: Icons.ListChecks,
  newMaterial: Icons.FileText,
  taskEdited: Icons.PenLine,
  taskHandedBack: Icons.HandedBack,
  taskComment: Icons.Chat,
  scheduleChanged: Icons.CalendarClock,
  meeting: Icons.Megaphone,
  exam: Icons.GraduationCap,
  grade: Icons.Star,
  krs: Icons.ShieldCheck,
};
const IMPORTANT: ReadonlySet<string> = new Set([
  "alert.taskEdited.afterSubmit",
  "alert.handedBack",
  "alert.materialToday",
  "home.change.moved",
  "home.change.meeting",
]);
/** An edit after hand-in whose title names the change ("Tenggat diundur ke …") still says so in its body. */
const IMPORTANT_BODY: ReadonlySet<string> = new Set(["alert.taskEdited.afterSubmit.body", "alert.taskEdited.count.after"]);

/**
 * A short look at the last week's changes: the bell keeps all of them, with the same words. A class moved that the
 * card or a row of Hari ini says is new, and a meeting outside SIX listed there, aren't said again.
 */
function Changes({ context, card, plan }: { context: HomeContext; card: NowCard | null; plan: TodayPlan }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const history = useDataset("app.alerts");
  const all = useMemo(() => recentChanges(context, history?.items ?? []), [context, history]);
  const above = useMemo(() => {
    // The card shows every status of its class; a row, its first two.
    const moved = [
      ...(card?.class ? [card.class] : []),
      ...plan.classes.filter((facts) =>
        classStatuses(t, f, facts, context)
          .slice(0, 2)
          .some((status) => status.key === "moved"),
      ),
    ].map((facts) => `schedule.moved:${facts.session.id}:`);
    const meetings = [...(card?.meeting ? [card.meeting] : []), ...plan.announced].map(({ code, meeting }) => `meeting:${code}:${meeting.start}`);
    return (item: Alert) => moved.some((prefix) => item.id.startsWith(prefix)) || meetings.includes(item.id);
  }, [card, plan, context, t, f]);
  const fresh = all.filter((item) => !above(item));
  const changes = fresh.slice(0, CHANGES_SHOWN);
  return (
    <Section
      id="home-changes"
      className="mt-0"
      title={t("home.changes")}
      action={
        <button type="button" onClick={openAlerts} className="focus-ring rounded-tag text-small font-medium text-accent-fg hover:underline">
          {t("home.changes.all")}
        </button>
      }
    >
      {changes.length === 0 ? (
        <p className="py-1 text-body text-muted">{t(all.length ? "home.changes.shown" : "home.changes.none")}</p>
      ) : (
        <List label={t("home.changes")} className={PLAIN}>
          {changes.map((item) => (
            <ChangeRow key={item.id} item={item} f={f} onOpen={() => go(item.target)} />
          ))}
        </List>
      )}
    </Section>
  );
}

function ChangeRow({ item, f, onOpen }: { item: Alert; f: Format; onOpen: () => void }) {
  const t = useT();
  const Icon = CHANGE_ICON[item.kind] ?? Icons.Bell;
  const important = IMPORTANT.has(item.title.key) || (item.body !== null && item.body !== undefined && IMPORTANT_BODY.has(item.body.key));
  const code = typeof item.title.vars?.course === "string" ? item.title.vars.course : null;
  const colorOf = useCourseColor();
  // Hidden grades: a new grade names its course only, never the grade or the IPK.
  const words = useGradesHidden() ? withoutGrades(item) : item;
  const title = t(words.title.key, words.title.vars);
  const when = f.dayOffset(item.at) === 0 ? f.time(item.at) : f.relativeDay(item.at);
  // The details, on hover and in its name; whole where it opens.
  const whole = factsLabel(title, words.body && t(words.body.key, words.body.vars));
  return (
    <Row
      className="py-2.5"
      leading={
        <span className="relative mt-0.5">
          <Icon className={cx("size-4", important ? "text-warning-fg" : "text-faint")} />
          {code && <CourseDot color={colorOf(code)} className="absolute -right-1 -bottom-1 size-2 ring-2 ring-surface" />}
        </span>
      }
      // One line: what changed and when.
      title={
        <span className="block" title={whole}>
          <Meta>{title}</Meta>
        </span>
      }
      label={words.body ? factsLabel(whole, when) : undefined}
      trailing={<span className="text-caption whitespace-nowrap text-faint tabular-nums">{when}</span>}
      onClick={onOpen}
    />
  );
}

// ---------------------------------------------------------------- courses

function Courses({ courses, nim, context }: { courses: TermCourse[] | undefined; nim: string | undefined; context: HomeContext | undefined }) {
  const t = useT();
  const statuses = [useStatus("edunex"), useStatus("six")];
  const { refresh, busy } = useRefresh();

  if (!courses) {
    if (statuses.some((status) => status.state === "connecting" || status.state === "live"))
      return (
        <List className={PLAIN}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3" aria-busy="true">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-2/5" />
            </li>
          ))}
        </List>
      );
    return (
      <EmptyState icon={<Icons.BookOpen className="size-5" />} title={t("home.coursesUnavailable")}>
        {statuses.some((status) => status.state !== "expired" && status.state !== "signed-out") && (
          <Button size="sm" busy={busy} onClick={() => void refresh()}>
            {t("action.tryAgain")}
          </Button>
        )}
      </EmptyState>
    );
  }
  if (courses.length === 0) return <EmptyState icon={<Icons.BookOpen className="size-5" />} title={t("home.noCourses")} />;
  return (
    <List className={PLAIN}>
      {courses.map((course) => (
        <CourseRow key={course.code} course={course} nim={nim} health={context?.health.get(course.code)} />
      ))}
    </List>
  );
}

/**
 * This term's courses, one plain row each: what the sidebar can't say (the absences left; class and SKS are on the
 * course page), under one quiet "Jatah absen" over the bars, and
 * the list's own states (loading, unavailable, none). When SIX changed its course table, the ones shown are
 * its last good list (or Edunex's) and say so; with none to show, the note says why on its own. Rows SIX
 * wrote another way are said on Presensi.
 */
function HomeCourses({ courses, nim, context }: { courses: TermCourse[] | undefined; nim: string | undefined; context: HomeContext | undefined }) {
  const t = useT();
  const changed = useChangedPage(["six.courses"]);
  const onlyNote = changed && courses?.length === 0;
  return (
    <Section
      id="home-courses"
      title={t("home.coursesThisTerm")}
      count={onlyNote ? undefined : courses?.length}
      // The bars' one label, so no row says it again: laid out as a row's end (the word's column, the gap, the
      // way-out button's room), so it ends where the bars end and sits right over them.
      action={
        courses?.some((course) => course.inSix) ? (
          <span className="flex items-center gap-x-6">
            <span className="flex items-center gap-2.5">
              <span className="text-caption text-faint">{t("presence.bar.label")}</span>
              <span className="min-w-24" />
            </span>
            <span className="size-7" />
          </span>
        ) : undefined
      }
      className="mt-10"
    >
      {changed && <SixPageNote datasets={["six.courses"]} className="mb-3" />}
      {!onlyNote && <Courses courses={courses} nim={nim} context={context} />}
    </Section>
  );
}

function CourseRow({ course, nim, health }: { course: TermCourse; nim: string | undefined; health: AttendanceHealth | undefined }) {
  const t = useT();
  const open = useOpenExternal();
  const { go } = useNav();
  const external = course.edunex
    ? { label: t("action.openInEdunex"), url: edunexCourseUrl(course.edunex.courseId) }
    : nim
      ? { label: t("action.openInSix"), url: sixStatusUrl(nim) }
      : null;
  const head = (
    <>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-body font-semibold tabular-nums">
        <CourseDot color={course.color} className="size-2" />
        {course.code}
      </span>
      <span className="min-w-0 truncate text-body" title={course.name}>
        {course.name}
      </span>
    </>
  );
  return (
    <li className={cx("group relative flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5", course.edunex && "hover:bg-hover")}>
      {/* A course on Edunex opens its course page (the whole row); one only in SIX has none. */}
      {course.edunex ? (
        <button
          type="button"
          className="focus-ring flex min-w-[14rem] flex-1 items-baseline gap-2.5 rounded-tag text-left after:absolute after:inset-0 after:content-['']"
          onClick={() => go({ screen: "course", code: course.code })}
        >
          {head}
        </button>
      ) : (
        <div className="flex min-w-[14rem] flex-1 items-baseline gap-2.5">{head}</div>
      )}
      {course.inSix && <CourseAttendance health={health} />}
      {!course.edunex && <span className="text-caption text-faint">{t("course.notOnEdunex")}</span>}
      {/* Last in the markup, so Tab reaches the course before its way out to Edunex or SIX. */}
      {external && (
        <Tooltip content={external.label}>
          <IconButton
            size="sm"
            label={`${external.label}: ${course.code}`}
            // A second way out, the row itself opening the course: shown on hover and keyboard focus, always where there's no hover.
            className="relative z-10 -my-1 ml-auto transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
            onClick={() => open(external.url)}
          >
            <Icons.ArrowUpRight className="size-3.5" />
          </IconButton>
        </Tooltip>
      )}
    </li>
  );
}

/** The course's absences, as Presensi draws them, in one line: the bar and its one word ("sisa 1×", "habis"). */
function CourseAttendance({ health }: { health: AttendanceHealth | undefined }) {
  const t = useT();
  if (!health?.held) return <span className="text-caption text-faint">{t("course.noMeetingsYet")}</span>;
  return <AbsenceBudget health={health} place="line" className="shrink-0" />;
}
