// Beranda (#77): the ten-second answer. The date and the greeting; then
// "Sekarang", the class going on (or next) with where its attendance counts
// and the one thing to do; then two columns: "Hari ini" (today's classes, the
// meetings outside SIX, what's due today and tomorrow) and "Perlu
// perhatianmu" (the week ahead, never repeating today); then a short "Yang
// berubah" (the bell has it all) and this term's courses. A deadline (in either
// column) and anything in "Perlu perhatianmu" can be put off ("Ingatkan
// nanti"); what's put off is listed under "Perlu perhatianmu". The reasoning
// lives in src/core/needs.ts.
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { rupiah } from "../../core/academic";
import { type AttendanceHealth, type AttendanceState, percent } from "../../core/attendance";
import { checkingIn } from "../../core/check-in";
import { wibDay } from "../../core/course-meetings";
import { edunexCourseUrl, sixStatusUrl, sixTimetableUrl } from "../../core/links";
import type { Alert, AlertKind, ClassSession, SixCheckIn, SnoozeEntry } from "../../core/models";
import {
  attention,
  type ClassFacts,
  dueItems,
  type HomeContext,
  homeContext,
  type NeedDraft,
  type NowCard,
  nowCard,
  recentChanges,
  type TodayPlan,
  todayPlan,
} from "../../core/needs";
import { activeSnooze, partitionSnoozed, snoozable, snoozeKey } from "../../core/snooze";
import { budgetLabel, useActionLabel, verdictLabel } from "../attendance-labels";
import { AttendanceSummary } from "../attendance-parts";
import { type TermCourse, useTerm, useTermCourses } from "../courses";
import { useHomeWorld } from "../home-world";
import { useOpenCheckIn, useOpenExternal } from "../hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../i18n";
import { firstName } from "../names";
import { type Route, useNav } from "../nav";
import { openAlerts } from "../shell/alerts";
import { useRefresh, useSignIn } from "../shell/source-status";
import { canSnooze, refocus, SnoozeMenu } from "../snooze-menu";
import { useSnoozes } from "../snoozes";
import { useDataset, useStatus } from "../store";
import { Button, IconButton } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card, CourseDot, EmptyState, LiveDot, Skeleton } from "../ui/display";
import { Icons } from "../ui/icons";
import { factsLabel, List, Meta, Page, PageHeader, Row, Section } from "../ui/layout";
import { CountdownBar } from "../ui/meter";
import { PresenceList } from "../ui/motion/presence-list";
import { NowCard as NowCardShell } from "../ui/now-card";
import { Tooltip } from "../ui/overlays";

const MINUTE = 60_000;
const DAY = 86_400_000;
/** A later class says "dalam …" only this close to its start; further off, the time column says enough. */
const SOON = 2 * 60 * MINUTE;
/** "Yang berubah" shows this many; the bell has the rest. */
const CHANGES_SHOWN = 5;

/** Attendance state as a status color for text: quiet while an absence is still allowed. Never the course's color. */
const STATE_TEXT: Record<AttendanceState, string> = {
  out: "text-danger-fg",
  missed: "text-danger-fg",
  none: "text-warning-fg",
  risk: "text-muted",
  safe: "text-muted",
  met: "text-muted",
  unknown: "text-faint",
};

export function Home() {
  const f = useFormat();
  const now = useNow();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const courses = useTermCourses();
  const term = useTerm();
  const name = account?.name ?? student?.name;
  const world = useHomeWorld();
  const context = useMemo(() => (world ? homeContext(world) : undefined), [world]);

  return (
    <Page>
      <PageHeader
        className="mb-6"
        eyebrow={
          <Meta>
            {f.dateLong(now)}
            {term ? f.term(term) : null}
          </Meta>
        }
        title={`${f.greeting()}${name ? `, ${firstName(name)}` : ""}`}
        description={<ExamWeek />}
      />
      {context ? <Answers context={context} courses={courses ?? []} /> : <AnswersLoading />}
      <Section id="home-courses" title={useT()("home.coursesThisTerm")} count={courses?.length}>
        <Courses courses={courses} nim={student?.nim} context={context} />
      </Section>
    </Page>
  );
}

const colorOf = (courses: readonly TermCourse[], code: string | null) => courses.find((course) => course.code === code)?.color ?? "var(--faint)";
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
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}

function Answers({ context, courses }: { context: HomeContext; courses: readonly TermCourse[] }) {
  const card = useMemo(() => nowCard(context), [context]);
  const plan = useMemo(() => todayPlan(context), [context]);
  const needs = useMemo(() => attention(context, card, plan), [context, card, plan]);
  const due = useMemo(() => dueItems(context, plan), [context, plan]);
  return (
    <>
      <NowSection card={card} courses={courses} hasSchedule={context.schedule !== null} />
      <div className="@container mt-10">
        {/* The day on the left; what needs you and what changed beside it, so neither column runs on alone.
            Narrower, one column that can shrink: a long title with no spaces wraps instead of widening the page. */}
        <div className="grid grid-cols-1 items-start gap-x-8 gap-y-10 @min-[800px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Today context={context} plan={plan} due={due} courses={courses} onCard={cardKey(card)} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-y-10">
            <NeedsYou needs={needs} due={due} courses={courses} />
            <Changes context={context} courses={courses} />
          </div>
        </div>
      </div>
    </>
  );
}

/** UTS or UAS week starting within two weeks, or going on, from ITB's calendar: a calm line, not a tag. */
function ExamWeek() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const calendar = useDataset("itb.calendar");
  const exams = calendar?.events.filter((e) => e.kind === "uts" || e.kind === "uas") ?? [];
  const running = exams.find((e) => e.start <= now && now < e.end);
  const next = exams.find((e) => e.start > now && e.start - now <= 14 * DAY);
  if (!running && !next) return null;
  const date = (at: number) => `${f.weekday(at)}, ${f.dayMonth(at)}`;
  let facts: string[];
  if (running) facts = [t(running.kind === "uts" ? "home.utsNow" : "home.uasNow", { date: date(running.end - 1) })];
  else {
    const days = f.dayOffset(next!.start);
    facts = [
      t(next!.kind === "uts" ? "home.utsStarts" : "home.uasStarts", { date: date(next!.start) }),
      days === 1 ? t("time.tomorrowWord") : t("home.inDays", { count: days }),
    ];
  }
  return (
    <span className="flex items-center gap-2 text-body text-muted">
      <Icons.CalendarClock className="size-4 shrink-0 text-faint" />
      <Meta>{facts}</Meta>
    </span>
  );
}

// ---------------------------------------------------------------- Sekarang

function NowSection({ card, courses, hasSchedule }: { card: NowCard | null; courses: readonly TermCourse[]; hasSchedule: boolean }) {
  const t = useT();
  if (!card) {
    // Without SIX there's no timetable: "Hari ini" says how to get it. With one, a quiet week.
    if (!hasSchedule) return null;
    return (
      <section aria-labelledby="home-now">
        <h2 id="home-now" className="sr-only">
          {t("home.now")}
        </h2>
        <Card variant="sunken" className="px-5 py-4 text-body text-muted">
          {t("home.now.free")}
        </Card>
      </section>
    );
  }
  return (
    <section aria-labelledby="home-now">
      <h2 id="home-now" className="sr-only">
        {t("home.now")}
      </h2>
      <NowCardView card={card} courses={courses} />
    </section>
  );
}

function NowCardView({ card, courses }: { card: NowCard; courses: readonly TermCourse[] }) {
  const t = useT();
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
  const color = colorOf(courses, code);
  const course = courses.find((c) => c.code === code);
  // A window alone on the card: the class it's for, as a window can stay open for days, into the next one.
  const windowFor = !session && card.presence ? (card.presence.class ?? card.presence.session) : null;

  const eyebrow =
    card.state === "live" && slot
      ? t("home.now.live", { time: f.time(slot.end) })
      : card.state === "next" && slot
        ? t("home.now.next", { when: f.fromNow(slot.start) })
        : card.state === "later" && slot
          ? t("home.now.later", { day: f.relativeDay(slot.start) })
          : t("home.now.presenceOnly");

  const open = (): Route => (course?.edunex ? { screen: "course", code, tab: "meetings" } : { screen: "presence" });

  return (
    <NowCardShell
      // Lifted while it matters now: a class on, or a Presence window to do.
      raised={card.state === "live" || Boolean(card.presence && card.presence.counts !== false)}
      time={slot ? { start: f.time(slot.start), end: f.time(slot.end) } : null}
      eyebrow={
        <span className={cx("flex items-center gap-2", card.state === "live" ? "text-success-fg" : "text-muted")}>
          {card.state === "live" && (fresh ? <LiveDot /> : <span aria-hidden className="size-2 shrink-0 rounded-full bg-faint" />)}
          <Meta>{eyebrow}</Meta>
        </span>
      }
      title={
        <button
          type="button"
          onClick={() => go(open())}
          className="focus-ring block max-w-full truncate rounded text-left text-heading font-semibold tracking-[-0.01em] hover:underline hover:decoration-faint hover:underline-offset-4"
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
            <span className={cx("font-semibold", /\b(UTS|UAS)\b/i.test(session.activity) && "text-danger-fg")}>{session.activity}</span>
          ) : (
            ""
          )}
          {meeting ? t(meeting.online ? "home.today.meetingOnline" : "home.today.meeting", { number: meeting.number }) : ""}
        </Meta>
      }
      note={
        facts?.moved ? (
          <Meta className="mt-1 text-small font-medium text-warning-fg">{movedLabel(t, f, facts)}</Meta>
        ) : meeting ? (
          // Read from the lecturer's text, not SIX: said where the Student decides to go.
          <span className="mt-1 block text-small font-medium text-warning-fg">{t("home.today.notInSix")}</span>
        ) : undefined
      }
      action={
        link && card.state !== "later" && !card.presence?.counts ? (
          <JoinButton link={link} code={code} primary={card.state === "live" || (slot !== null && slot.start - now < 15 * MINUTE)} />
        ) : undefined
      }
    >
      <Attendance card={card} />
      {card.after && <AfterThis session={card.after} courses={courses} />}
    </NowCardShell>
  );
}

/**
 * Where attendance counts, and the one thing to do: "Tandai Hadir" in SIX
 * (while the class is on, what the app last saw of SIX's button, and the way
 * to it), or the Edunex Presence before it closes. With both, SIX comes first.
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

  const budget = facts?.health && facts.state !== "unknown" ? budgetLabel(t, facts.health) : null;
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

  // The class on now (or about to start) while the app reads its popup on SIX: where SIX counts, or once SIX showed its button.
  const session = facts?.session ?? null;
  const check = session ? checkIns?.[session.id] : undefined;
  if (session && student && (card.state === "live" || card.state === "next") && checkingIn(session, now)) {
    if (check || counted === "six" || counted === "both" || counted === "unknown")
      return (
        <CheckIn
          session={session}
          check={check}
          countsInSix={counted === "six" || counted === "both"}
          url={sixTimetableUrl(student, session.start)}
          budget={budget ? <span className={STATE_TEXT[facts!.state]}>{budget}</span> : null}
        >
          {presence && (
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3">
              <p className="min-w-0 flex-1 text-small text-muted">
                {/* Optional only where it's known not to count; not known yet, it's simply there to do. */}
                {presence.counts !== false
                  ? t("presence.record.edunexDo", {
                      action: actionLabel({ action: { activity: presence.activity, task: presence.task, url: presence.url } }),
                      time: f.dayTime(presence.session.closesAt),
                    })
                  : t("home.now.presenceExtra", { time: f.dayTime(presence.session.closesAt) })}
              </p>
              <Button
                variant="ghost"
                size="sm"
                icon={viaTask ? undefined : <Icons.ArrowUpRight className="size-3.5" />}
                onClick={openPresence}
                aria-label={viaTask ? t("home.now.openTask") : t("home.now.recordLabel", { course: presence.code })}
              >
                {viaTask ? t("home.now.openTask") : t("presence.open.record")}
              </Button>
            </div>
          )}
        </CheckIn>
      );
  }

  // Doing it counts, or nobody can say yet (doing it costs nothing): the Presence is the action.
  if (presence && presence.counts !== false) {
    const { session } = presence;
    const action = actionLabel({ action: { activity: presence.activity, task: presence.task, url: presence.url } });
    // Without SIX nobody can say it counts: worth doing just in case, so said calmly, its button quiet.
    const quiet = presence.noSix;
    return (
      <div className="border-t border-line bg-sunken/60 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-body font-semibold">
              <Icons.Hand className={cx("size-4 shrink-0", quiet ? "text-muted" : "text-accent-fg")} />
              {t("home.now.presenceDo", { action, time: f.dayTime(session.closesAt) })}
            </p>
            <p className="mt-0.5 text-small text-muted">
              <Meta>
                {where ?? ""}
                {budget ? <span className={STATE_TEXT[facts!.state]}>{budget}</span> : ""}
              </Meta>
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Button
              variant={quiet ? "secondary" : "primary"}
              icon={viaTask ? undefined : <Icons.ArrowUpRight className="size-3.5" />}
              onClick={openPresence}
              aria-label={viaTask ? t("home.now.openTask") : t("home.now.recordLabel", { course: presence.code })}
            >
              {viaTask ? t("home.now.openTask") : t("presence.open.record")}
            </Button>
          </div>
        </div>
        <CountdownBar
          className="mt-3"
          opensAt={session.opensAt}
          closesAt={session.closesAt}
          now={now}
          // Under a day, how long is left; a window can stay open for days, and "50 jam" says nothing.
          label={
            session.closesAt - now < DAY
              ? t("home.now.closesIn", { left: f.countdown(session.closesAt) })
              : t("home.now.closesWhen", { when: f.fromNow(session.closesAt) })
          }
          // "tutup besok" under "sebelum besok, 23:00" would say it twice.
          showLabel={session.closesAt - now < DAY || f.dayOffset(session.closesAt) > 1}
        />
      </div>
    );
  }

  if (!where && !presence) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line bg-sunken/60 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        {where && (
          <p className="flex items-center gap-2 text-body font-medium">
            <Icons.CheckCircle className="size-4 shrink-0 text-success-fg" weight="bold" />
            {where}
          </p>
        )}
        <p className="mt-0.5 pl-6 text-small text-muted">
          <Meta>
            {budget ? <span className={cx("font-medium", STATE_TEXT[facts!.state])}>{budget}</span> : ""}
            {presence ? t("home.now.presenceExtra", { time: f.dayTime(presence.session.closesAt) }) : ""}
          </Meta>
        </p>
      </div>
      {presence && (
        <Button
          variant="ghost"
          size="sm"
          icon={viaTask ? undefined : <Icons.ArrowUpRight className="size-3.5" />}
          onClick={openPresence}
          aria-label={viaTask ? t("home.now.openTask") : t("home.now.recordLabel", { course: presence.code })}
        >
          {viaTask ? t("home.now.openTask") : t("presence.open.record")}
        </Button>
      )}
    </div>
  );
}

/** SIX's "Tandai Hadir" for the class on now: open (the button shows), gone (it showed, and doesn't now), or still to come. */
function CheckIn({
  session,
  check,
  countsInSix,
  url,
  budget,
  children,
}: {
  session: ClassSession;
  check: SixCheckIn | undefined;
  /** SIX's count says attendance counts there; else nobody can say yet (early in the term), and it isn't claimed. */
  countsInSix: boolean;
  url: string;
  budget: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  const f = useFormat();
  const openCheckIn = useOpenCheckIn();
  const state = check?.state ?? "waiting";
  return (
    <div className="border-t border-line bg-sunken/60 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className={cx("flex items-center gap-2 text-body", state === "open" ? "font-semibold" : "font-medium")}>
            <Icons.Hand className={cx("size-4 shrink-0", state === "open" ? "text-accent-fg" : "text-muted")} />
            {state === "open"
              ? t("home.now.checkInOpen")
              : state === "gone"
                ? t("home.now.checkInGone")
                : countsInSix
                  ? t("home.now.countSix")
                  : t("home.now.checkInWatch")}
          </p>
          <p className="mt-0.5 pl-6 text-small text-muted">
            <Meta>
              {state === "open" ? t("home.now.checkInOpenHint", { time: f.time(session.end) }) : state === "waiting" ? t("home.now.checkInWaiting") : ""}
              {budget ?? ""}
            </Meta>
          </p>
        </div>
        <Button
          variant={state === "open" ? "primary" : state === "waiting" ? "secondary" : "ghost"}
          icon={<Icons.ArrowUpRight className="size-3.5" />}
          onClick={() => openCheckIn(session.id, url)}
          aria-label={t("home.now.openSixLabel", { course: session.courseCode })}
        >
          {t("home.now.openSix")}
        </Button>
      </div>
      {children}
    </div>
  );
}

function AfterThis({ session, courses }: { session: NonNullable<NowCard["after"]>; courses: readonly TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  return (
    <p className="flex items-center gap-2 border-t border-line px-5 py-2.5 text-small text-muted">
      <Icons.ArrowRight className="size-3.5 shrink-0 text-faint" />
      <Meta>
        {`${t("home.now.after", { time: f.time(session.start), course: session.courseCode })} ${nameOf(courses, session.courseCode, session.courseName)}`}
        {session.room ?? ""}
      </Meta>
    </p>
  );
}

/** A class's day and time, as the course page names the class a window is for: "Kam, 8 Okt, 08:00–10:00". */
const classDayTime = (f: Format, start: number, end: number) => `${f.relativeDay(start)}, ${f.timeRange(start, end)}`;

function movedLabel(t: Translate, f: Format, facts: ClassFacts): string {
  const moved = facts.moved!;
  if (moved.usualStart !== null && moved.usualEnd !== null) {
    const time = f.timeRange(moved.usualStart, moved.usualEnd);
    return t("home.today.changed", {
      usual: f.dayOffset(moved.usualStart) === f.dayOffset(facts.session.start) ? time : `${f.weekday(moved.usualStart)} ${time}`,
    });
  }
  return t("home.today.roomChanged", { room: moved.usualRoom ?? "" });
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
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-sunken px-4 py-3.5 text-body text-muted">
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
  | { kind: "class"; at: number; facts: ClassFacts }
  | { kind: "meeting"; at: number; code: string; meeting: TodayPlan["announced"][number]["meeting"] }
  | { kind: "due"; at: number; task: TodayPlan["due"][number]; need: NeedDraft | null };

/** The Hari ini row key of what the now card shows. */
const cardKey = (card: NowCard | null) =>
  card?.class ? `class:${card.class.session.id}` : card?.meeting ? `meeting:${card.meeting.code}:${card.meeting.meeting.start}` : null;

/**
 * `due`: the deadlines as Beranda's items, so each can be put off; one put off
 * leaves the day and is listed under "Perlu perhatianmu" until it's back.
 * `onCard`: the row key of what the now card above already shows, so its row doesn't say the same again.
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
  const day = wibDay(context.now);
  const needOf = (task: TodayPlan["due"][number]) => due.find((need) => need.kind === "task" && need.task.id === task.id) ?? null;
  const items: TodayItem[] = [
    ...plan.classes.map((facts): TodayItem => ({ kind: "class", at: facts.session.start, facts })),
    ...plan.announced.map(({ code, meeting }): TodayItem => ({ kind: "meeting", at: meeting.start, code, meeting })),
    ...plan.due.map((task): TodayItem => ({ kind: "due", at: task.dueAt!, task, need: needOf(task) })),
  ].sort((a, b) => a.at - b.at);
  const putOff = (item: TodayItem) => item.kind === "due" && item.need !== null && activeSnooze(snoozeKey(item.need), entries, now) !== undefined;
  const shown = items.filter((item) => !putOff(item));
  const today = shown.filter((item) => wibDay(item.at) === day);
  const tomorrow = shown.filter((item) => wibDay(item.at) !== day);
  // Never "no deadlines today" while today's are only put off.
  const snoozedToday = items.some((item) => putOff(item) && wibDay(item.at) === day);
  return (
    <Section id="home-today" title={t("home.today")} className="mt-0">
      {!context.schedule && <NoSixToday />}
      {today.length > 0 ? (
        <List label={t("home.today")} className={cx(!context.schedule && "mt-3")}>
          {/* A deadline put off fades out, and focus moves on to the next row. */}
          <PresenceList>
            {today.map((item) => (
              <TodayRow key={keyOf(item)} item={item} courses={courses} onCard={onCard} />
            ))}
          </PresenceList>
        </List>
      ) : (
        context.schedule && (
          <p className="rounded-xl bg-sunken px-4 py-3.5 text-body text-muted">{t(snoozedToday ? "home.today.noneSnoozed" : "home.today.none")}</p>
        )
      )}
      {tomorrow.length > 0 && (
        <>
          <h3 className="mt-5 mb-2 text-small font-semibold text-muted">{t("home.today.tomorrow")}</h3>
          <List label={t("home.today.tomorrow")}>
            <PresenceList>
              {tomorrow.map((item) => (
                <TodayRow key={keyOf(item)} item={item} courses={courses} onCard={onCard} />
              ))}
            </PresenceList>
          </List>
        </>
      )}
    </Section>
  );
}

const keyOf = (item: TodayItem) =>
  item.kind === "class" ? `class:${item.facts.session.id}` : item.kind === "meeting" ? `meeting:${item.code}:${item.at}` : `due:${item.task.id}`;

/** The time column: start over end, or a deadline's one time. */
function When({ start, end, past, tone }: { start: string; end?: string; past?: boolean; tone?: string }) {
  return (
    <span className="w-[46px] text-small tabular-nums">
      <span className={cx("block font-semibold", past ? "text-faint" : (tone ?? "text-fg"))}>{start}</span>
      {end && <span className="block text-caption text-faint">{end}</span>}
    </span>
  );
}

function TodayRow({ item, courses, onCard }: { item: TodayItem; courses: readonly TermCourse[]; onCard: string | null }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const open = useOpenExternal();
  const fresh = useStatus("six").state === "live";
  const edunexFresh = useStatus("edunex").state === "live";
  const shownAbove = keyOf(item) === onCard;

  if (item.kind === "due") {
    const { task, need } = item;
    const close = task.dueAt! - now <= 6 * 60 * MINUTE;
    // Put off as "Perlu perhatianmu" puts off a deadline: the moments that still fit, never past its last hours.
    const later = need ? snoozable(need, now) : null;
    return (
      <Row
        id={need ? needRowId(need.id) : undefined}
        actions={later && canSnooze(later, now) ? <SnoozeMenu item={later} name={factsLabel(task.title, task.courseCode)} /> : undefined}
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
    return (
      <Row
        leading={<When start={f.time(meeting.start)} end={f.time(meeting.end)} />}
        title={nameOf(courses, code)}
        meta={
          <Meta>
            <CourseMark code={code} courses={courses} />
            {t(meeting.online ? "home.today.meetingOnline" : "home.today.meeting", { number: meeting.number })}
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
                !shownAbove && t("home.today.notInSix"),
              )
            : undefined
        }
        onClick={() => (meeting.link ? open(meeting.link) : go({ screen: "course", code, tab: "meetings" }))}
      >
        {/* The now card says it for the meeting it shows. */}
        {!shownAbove && <span className="mt-1 block text-small font-medium text-warning-fg">{t("home.today.notInSix")}</span>}
      </Row>
    );
  }

  const { facts } = item;
  const { session } = facts;
  const past = session.end <= now;
  const course = courses.find((c) => c.code === session.courseCode);
  const exam = /\b(UTS|UAS)\b/i.test(session.activity);
  // Said once: the now card shows its class's budget, and "tak bisa lagi capai" is in Perlu perhatianmu and on the course card.
  const budget = facts.health && facts.state !== "unknown" && facts.state !== "out" && !past && !shownAbove ? budgetLabel(t, facts.health) : null;
  // The now card says "Jam berubah · biasanya …" for its class; the row keeps only the amber time.
  const moved = facts.moved && !shownAbove;
  const clash = facts.overlap ? t("home.today.overlap", { course: facts.overlap.code, time: f.timeRange(facts.overlap.from, facts.overlap.to) }) : null;
  return (
    <Row
      // Past, quieter in token greys that still read at 4.5:1; never faded with opacity.
      className={cx(past && "text-muted")}
      leading={
        <When start={f.time(session.start)} end={f.time(session.end)} past={past} tone={facts.moved?.usualStart != null ? "text-warning-fg" : undefined} />
      }
      title={course?.name ?? session.courseName}
      meta={
        <Meta className={cx(past && "text-faint")}>
          <CourseMark code={session.courseCode} courses={courses} past={past} />
          {session.room ?? ""}
          {exam || !/^kuliah$/i.test(session.activity) ? (
            <span className={cx("font-semibold", exam && !past && "text-danger-fg")}>{session.activity}</span>
          ) : (
            ""
          )}
        </Meta>
      }
      trailing={
        facts.live ? (
          <NowMark fresh={fresh} />
        ) : past ? (
          <span className="text-caption text-faint">{t("home.today.done")}</span>
        ) : session.start - now <= SOON ? (
          <span className="text-caption whitespace-nowrap text-muted tabular-nums">{f.fromNow(session.start)}</span>
        ) : undefined
      }
      onClick={() => go(course?.edunex ? { screen: "course", code: session.courseCode, tab: "meetings" } : { screen: "presence" })}
    >
      {!past && (budget || clash) && (
        // Kept beside a clash: choosing between two classes is when "Jangan absen lagi" matters most.
        <Meta className="mt-1 text-small font-medium">
          {budget ? <span className={STATE_TEXT[facts.state]}>{budget}</span> : ""}
          {clash ? <span className="text-warning-fg">{clash}</span> : ""}
        </Meta>
      )}
      {!past && moved && <Meta className="mt-1 text-small font-medium text-warning-fg">{movedLabel(t, f, facts)}</Meta>}
    </Row>
  );
}

/** "Sekarang" on the row of a class or meeting going on. */
function NowMark({ fresh }: { fresh: boolean }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-success-fg">
      {fresh && <LiveDot className="scale-75" />}
      {t("home.today.now")}
    </span>
  );
}

function CourseMark({ code, courses, past = false }: { code: string; courses: readonly TermCourse[]; past?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 font-medium tabular-nums", past ? "text-faint" : "text-fg/80")}>
      <CourseDot color={colorOf(courses, code)} className="size-2" />
      {code}
    </span>
  );
}

// ---------------------------------------------------------------- Perlu perhatianmu

/** `due`: "Hari ini"'s deadlines, as items: the ones put off are listed here with the rest. */
function NeedsYou({ needs, due, courses }: { needs: readonly NeedDraft[]; due: readonly NeedDraft[]; courses: readonly TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const tasks = useDataset("edunex.tasks");
  // Until Edunex's Tasks arrive, an empty list would claim more than the app knows.
  const edunex = useStatus("edunex");
  const loading = tasks === undefined && edunex.state !== "signed-out";
  // What the Student put off ("Ingatkan nanti") leaves the list until its time, or until it changes.
  const { entries } = useSnoozes();
  const { shown, snoozed } = useMemo(() => {
    const own = partitionSnoozed(needs, snoozeKey, entries, now);
    // "Hari ini"'s first, as the page reads: they're the soonest.
    return { shown: own.shown, snoozed: [...partitionSnoozed(due, snoozeKey, entries, now).snoozed, ...own.snoozed] };
  }, [needs, due, entries, now]);
  const [listOpen, setListOpen] = useState(false);
  // Closed once nothing is put off, so the next snooze doesn't find the list open.
  if (listOpen && !snoozed.length) setListOpen(false);
  const snoozedLine = snoozed.length > 0 && <SnoozedLine count={snoozed.length} open={listOpen} onToggle={() => setListOpen(!listOpen)} />;
  return (
    <Section id="home-needs" title={t("home.needs")} count={loading || shown.length === 0 ? undefined : shown.length} className="mt-0">
      {loading ? (
        <Card className="p-4" aria-busy="true">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-2/3" />
        </Card>
      ) : shown.length ? (
        <>
          <List label={t("home.needs")}>
            {/* A row put off fades out, and focus moves on to the next. */}
            <PresenceList>
              {shown.map((need) => (
                <NeedRow key={need.id} need={need} courses={courses} />
              ))}
            </PresenceList>
          </List>
          {snoozedLine && <div className="mt-2.5 px-1">{snoozedLine}</div>}
        </>
      ) : (
        // Everything left is put off: say so, never "nothing due".
        <div className="rounded-xl bg-sunken px-4 py-3.5">
          <p className="flex items-center gap-2 text-body font-medium">
            {/* Green says "all clear": not while things are only put off. */}
            {snoozed.length ? (
              <Icons.Snooze className="size-4 shrink-0 text-faint" />
            ) : (
              <Icons.CheckCircle className="size-4 shrink-0 text-success-fg" weight="bold" />
            )}
            {snoozed.length ? t("home.needs.allSnoozed") : t("home.needs.none", { day: `${f.weekday(now + 7 * DAY)}, ${f.dayMonth(now + 7 * DAY)}` })}
          </p>
          <div className="mt-0.5 pl-6 text-small text-muted">{snoozedLine || t("home.needs.noneHint")}</div>
        </div>
      )}
      {!loading && listOpen && snoozed.length > 0 && (
        <List label={t("snooze.list")} className="mt-2.5">
          {snoozed.map(({ item, entry }) => (
            <SnoozedRow key={item.id} need={item} entry={entry} courses={courses} />
          ))}
        </List>
      )}
    </Section>
  );
}

/** "2 ditunda · Tampilkan": quiet, at the end of the list, opening what's put off. */
function SnoozedLine({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <Meta className="text-small text-muted">
      <span className="inline-flex items-center gap-1.5">
        <Icons.Snooze className="size-3.5 shrink-0 text-faint" />
        {t("snooze.count", { count })}
      </span>
      <button type="button" data-snoozed="" aria-expanded={open} onClick={onToggle} className="focus-ring rounded font-medium text-accent-fg hover:underline">
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
  const wakeNow = (button: HTMLElement) => {
    const row = button.closest("li");
    const sibling = (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLElement>("button");
    void wake(entry.id).catch(() => undefined);
    // Its row leaves with the button: on to the next thing put off, else to the item itself, back in the list.
    refocus(() => sibling ?? document.getElementById(needRowId(need.id)));
  };
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
        <Button size="sm" variant="ghost" aria-label={t("snooze.wakeFor", { title: fullName(need, view) })} onClick={(event) => wakeNow(event.currentTarget)}>
          {t("snooze.wake")}
        </Button>
      }
    />
  );
}

/** A Needs-you row's id, so focus can be sent back to it. */
const needRowId = (id: string) => `need-${id}`;

interface NeedView {
  title: string;
  /** Short facts: the course, a time, a place. */
  meta: ReactNode[];
  /** A sentence on its own line under the facts ("SIX dan Edunex beda tanggal"), so the facts line stays short. */
  note?: { text: string; tone: "danger" | "warning" | null };
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

function useNeedView(courses: readonly TermCourse[]): (need: NeedDraft) => NeedView {
  const t = useT();
  const f = useFormat();
  const now = useNow();
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
          // Where SIX counts, the window is optional: said so, never as a thing to do.
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
            : need.countedIn === "six"
              ? {
                  title: t("home.need.presenceOptional", { course: need.course ?? "" }),
                  which,
                  meta: [course, forClass, t("home.need.presenceOptional.counted"), closes],
                  when: null,
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
        if (need.reason === "edited")
          return {
            title: task.title,
            titleLacksCourse: true,
            meta: [course],
            note: { text: t("home.need.task.edited"), tone: "warning" },
            when: null,
            tone: "warning",
          };
        const meta =
          need.reason === "overdue"
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
          when: need.reason === "overdue" ? t("home.need.late") : f.fromNow(task.dueAt!),
          tone: need.reason === "overdue" ? "danger" : near(task.dueAt),
        };
      }
      case "exam": {
        const { exam, sitting } = need;
        const time = sitting.end !== null ? f.timeRange(sitting.start, sitting.end) : f.time(sitting.start);
        return {
          title: t("home.need.exam", { kind: t(`exam.kind.${exam.kind}`), course: nameOf(courses, exam.courseCode) }),
          meta: [course, `${f.relativeDay(sitting.start)}, ${time}`, sitting.source === "six" ? sitting.room : t("home.need.exam.edunex")],
          note: need.disagree
            ? { text: t("home.need.exam.disagree"), tone: "warning" }
            : need.takeHomeDue !== null
              ? // A take-home due another day is the exam's second part: said plainly, no warning.
                { text: t("home.need.exam.takeHome", { date: `${f.weekdayShort(need.takeHomeDue)} ${f.dayMonth(need.takeHomeDue)}` }), tone: null }
              : undefined,
          when: f.fromNow(sitting.start),
          tone: near(sitting.start),
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
        return {
          title: t(health.state === "out" ? "home.need.attendance.out" : "home.need.attendance.none", vars),
          meta: [
            <span key="a" className={health.state === "out" ? "text-danger-fg" : "text-warning-fg"}>
              {t(health.state === "out" ? "home.need.attendance.outMeta" : "home.need.attendance.noneMeta", vars)}
            </span>,
          ],
          when: null,
          tone: health.state === "out" ? "danger" : "warning",
        };
      }
      case "meeting": {
        const { meeting } = need;
        return {
          title: t(meeting.online ? "home.need.meeting.online" : "home.need.meeting", { course: need.course ?? "", day: f.relativeDay(meeting.start) }),
          meta: [course, f.timeRange(meeting.start, meeting.end), t("home.today.notInSix")],
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
  const view = useNeedView(courses)(need);
  const now = useNow();
  const { go } = useNav();
  const open = useOpenExternal();
  const act = () => (need.action.kind === "go" ? go(need.action.route) : open(need.action.url));
  const later = snoozable(need, now);
  return (
    <Row
      id={needRowId(need.id)}
      title={view.title}
      label={view.label}
      meta={<Meta>{view.meta}</Meta>}
      actions={canSnooze(later, now) ? <SnoozeMenu item={later} name={fullName(need, view)} /> : undefined}
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
    >
      {view.note && (
        <Meta
          className={cx(
            "mt-1 text-small font-medium",
            view.note.tone === "danger" ? "text-danger-fg" : view.note.tone === "warning" ? "text-warning-fg" : "text-muted",
          )}
        >
          {view.note.text}
        </Meta>
      )}
    </Row>
  );
}

// ---------------------------------------------------------------- Yang berubah

const CHANGE_ICON: Partial<Record<AlertKind, typeof Icons.Home>> = {
  newTask: Icons.ListChecks,
  newMaterial: Icons.FileText,
  taskEdited: Icons.PenLine,
  scheduleChanged: Icons.CalendarClock,
  meeting: Icons.Megaphone,
  exam: Icons.GraduationCap,
  grade: Icons.Star,
  krs: Icons.ShieldCheck,
};
const IMPORTANT: ReadonlySet<string> = new Set(["alert.taskEdited.afterSubmit", "alert.materialToday", "home.change.moved", "home.change.meeting"]);

/** A short look at the last week's changes: the bell keeps all of them, with the same words. */
function Changes({ context, courses }: { context: HomeContext; courses: readonly TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const history = useDataset("app.alerts");
  const all = useMemo(() => recentChanges(context, history?.items ?? []), [context, history]);
  const changes = all.slice(0, CHANGES_SHOWN);
  return (
    <Section
      id="home-changes"
      className="mt-0"
      title={t("home.changes")}
      action={
        <button type="button" onClick={openAlerts} className="focus-ring rounded text-small font-medium text-accent-fg hover:underline">
          {t("home.changes.all")}
        </button>
      }
    >
      {changes.length === 0 ? (
        <p className="rounded-xl bg-sunken px-4 py-3.5 text-body text-muted">{t("home.changes.none")}</p>
      ) : (
        <List label={t("home.changes")}>
          {changes.map((item) => (
            <ChangeRow key={item.id} item={item} f={f} courses={courses} onOpen={() => go(item.target)} />
          ))}
        </List>
      )}
    </Section>
  );
}

function ChangeRow({ item, f, courses, onOpen }: { item: Alert; f: Format; courses: readonly TermCourse[]; onOpen: () => void }) {
  const t = useT();
  const Icon = CHANGE_ICON[item.kind] ?? Icons.Bell;
  const important = IMPORTANT.has(item.title.key);
  const code = typeof item.title.vars?.course === "string" ? item.title.vars.course : null;
  return (
    <Row
      className="py-2.5"
      leading={
        <span className="relative mt-0.5">
          <Icon className={cx("size-4", important ? "text-warning-fg" : "text-faint")} />
          {code && <CourseDot color={colorOf(courses, code)} className="absolute -right-1 -bottom-1 size-2 ring-2 ring-surface" />}
        </span>
      }
      title={<Meta>{t(item.title.key, item.title.vars)}</Meta>}
      meta={item.body ? <Meta truncate>{t(item.body.key, item.body.vars)}</Meta> : undefined}
      trailing={
        <span className="text-caption whitespace-nowrap text-faint tabular-nums">{f.dayOffset(item.at) === 0 ? f.time(item.at) : f.relativeDay(item.at)}</span>
      }
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-3 h-4 w-4/5" />
              <Skeleton className="mt-2 h-3 w-12" />
            </Card>
          ))}
        </div>
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
  return <CourseGrid courses={courses} nim={nim} context={context} />;
}

const CARD_MIN = 220;
const CARD_GAP = 12;

/** The cards in even rows: five courses sit 3 + 2, not 4 + 1 with one left alone. */
function CourseGrid({ courses, nim, context }: { courses: TermCourse[]; nim: string | undefined; context: HomeContext | undefined }) {
  const list = useRef<HTMLUListElement>(null);
  const [fits, setFits] = useState<number | null>(null);
  useEffect(() => {
    const element = list.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setFits(Math.max(1, Math.floor((entry!.contentRect.width + CARD_GAP) / (CARD_MIN + CARD_GAP)))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const columns = fits === null ? null : Math.ceil(courses.length / Math.ceil(courses.length / fits));
  return (
    <ul
      ref={list}
      className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3"
      style={columns === null ? undefined : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {courses.map((course) => (
        <li key={course.code}>
          <CourseCard course={course} nim={nim} health={context?.health.get(course.code)} />
        </li>
      ))}
    </ul>
  );
}

function CourseCard({ course, nim, health }: { course: TermCourse; nim: string | undefined; health: AttendanceHealth | undefined }) {
  const t = useT();
  const open = useOpenExternal();
  const { go } = useNav();
  const facts = [course.classNo ? t("course.class", { no: course.classNo }) : null, course.sks !== null ? t("course.sks", { count: course.sks }) : null];
  const external = course.edunex
    ? { label: t("action.openInEdunex"), url: edunexCourseUrl(course.edunex.courseId) }
    : nim
      ? { label: t("action.openInSix"), url: sixStatusUrl(nim) }
      : null;
  return (
    <Card className={cx("group relative flex h-full flex-col p-4", course.edunex && "transition-shadow duration-150 hover:shadow-lift")}>
      {/* A course on Edunex opens its course page (the whole card); one only in SIX has none. */}
      {course.edunex ? (
        <button
          type="button"
          className="focus-ring block rounded pr-6 text-left after:absolute after:inset-0 after:rounded-xl after:content-['']"
          onClick={() => go({ screen: "course", code: course.code })}
        >
          <CardHead course={course} />
        </button>
      ) : (
        <div className="pr-6">
          <CardHead course={course} />
        </div>
      )}
      {facts.some(Boolean) && <Meta className="mt-0.5 text-small text-muted">{facts}</Meta>}
      {/* From the top, so the meters of a row of cards line up (the name always takes two lines). */}
      <div className="pt-3">
        {course.inSix && <CourseAttendance health={health} />}
        {!course.edunex && <span className="mt-1 block text-caption text-faint">{t("course.notOnEdunex")}</span>}
      </div>
      {/* Last in the markup, so Tab reaches the course before its way out to Edunex or SIX. */}
      {external && (
        <Tooltip content={external.label}>
          <IconButton
            size="sm"
            label={`${external.label}: ${course.code}`}
            // A second way out, the card itself opening the course: shown on hover and keyboard focus, always where there's no hover.
            className="absolute top-2.5 right-2.5 z-10 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
            onClick={() => open(external.url)}
          >
            <Icons.ArrowUpRight className="size-3.5" />
          </IconButton>
        </Tooltip>
      )}
    </Card>
  );
}

function CardHead({ course }: { course: TermCourse }) {
  return (
    <>
      <span className="inline-flex items-center gap-1.5 text-small font-semibold tabular-nums">
        <CourseDot color={course.color} className="size-2" />
        {course.code}
      </span>
      <span className="mt-1.5 line-clamp-2 block min-h-[2lh] text-body font-semibold">{course.name}</span>
    </>
  );
}

/**
 * "Kehadiran 4/6 · 66%" over a meter with the course's target as a tick; the
 * share rounds down so it never looks better than it is. With no room to
 * spare, the state in words under it; a course with room stays quiet.
 */
function CourseAttendance({ health }: { health: AttendanceHealth | undefined }) {
  const t = useT();
  if (!health?.held) return <span className="text-caption text-faint">{t("course.noMeetingsYet")}</span>;
  return <AttendanceSummary health={health} words={health.state === "safe" ? null : verdictLabel(t, health)} />;
}
