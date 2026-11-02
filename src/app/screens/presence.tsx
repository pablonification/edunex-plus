// Presensi (#85), "absences left": am I OK, and what do I do? Under the title,
// the answer for the next class day ("4 classes today. Only PL3002 has an
// absence to spare."). Then only what needs the Student now, each said once:
// signing in to SIX, Tandai Hadir open, an Edunex window open that may count,
// SIX's count that didn't go up after a class, today's receipt, a clash today
// with which class to go to, the exam-week note. Then every course, grouped
// by what it asks of the Student (out of reach, no absences left, recorded in
// Edunex, absences to spare, …), each row the course and its next class,
// SIX's share labeled over its absences as a bar with words ("Kehadiran 85%
// sejauh ini (6 dari 7)", "Jatah absen", "Terpakai 1× · sisa 1×"), and one
// exception at most on a line of its own. How it's recorded and that later
// dates are estimated is said once, under the groups. Targets are one panel
// from the header. Nothing here is hidden by a snooze elsewhere.
import { type ReactNode, useState } from "react";
import {
  type AttendanceHealth,
  clashPick,
  dayAnswer,
  firstUnreadDay,
  GROUP_ORDER,
  isExamActivity,
  onUsualSlot,
  type PresenceGroup,
  percent,
  presenceGroup,
  resultNeedsStudent,
  sortGroup,
} from "../../core/attendance";
import { checkingIn } from "../../core/check-in";
import { wibDay } from "../../core/course-meetings";
import { sixTimetableUrl } from "../../core/links";
import type { CalendarEvent, ClassSession, SixCheckIn, SixStudent, UnreadSession } from "../../core/models";
import { dayNoon } from "../../core/schedule";
import { type Attendance, type CourseAttendance, type OpenWindow, useAttendance } from "../attendance";
import { budgetWords, useActionLabel } from "../attendance-labels";
import { AbsenceBudget, TargetsPanel } from "../attendance-parts";
import { useOpenCheckIn, useOpenExternal } from "../hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { useCourseNames } from "../schedule-data";
import { useSignIn } from "../shell/source-status";
import { SixPageNote, useChangedPage } from "../six-page-note";
import { useDataset, useSettings } from "../store";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card, CourseCode, EmptyState, LiveDot, Skeleton } from "../ui/display";
import { Icons } from "../ui/icons";
import { List, Meta, Notice, Page, PageHeader, Section } from "../ui/layout";
import { CountdownBar } from "../ui/meter";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** A class whose Tandai Hadir went this long ago still gets "did it go through?" on its row. */
const GONE_FOR = HOUR;

/** The groups' order frozen while the Targets panel is open, so nothing moves under the pointer. */
type Still = { group: PresenceGroup; codes: string[] }[];

export function PresenceScreen() {
  const t = useT();
  const attendance = useAttendance();
  const now = useNow();
  const student = useDataset("six.student");
  const checkIns = useDataset("six.checkIn");
  const unread = useDataset("six.scheduleUnread");
  const calendar = useDataset("itb.calendar");
  const { attendanceTargets } = useSettings();
  const name = useCourseNames();
  const [targets, setTargets] = useState<{ open: boolean; focus: string | null }>({ open: false, focus: null });
  const [still, setStill] = useState<Still | null>(null);
  // SIX changed its course table before it read: the note at the top says why there's nothing to list.
  const listChanged = useChangedPage(["six.courses"]) !== undefined;
  if (!attendance) return <Loading />;
  const { courses, sixConnected } = attendance;
  const signedOut = !sixConnected;
  const groups = groupsOf(courses, signedOut, still);
  const openTargets = (open: boolean, focus: string | null = null) => {
    setTargets({ open, focus: open ? focus : null });
    setStill(open ? groups.map(({ group, items }) => ({ group, codes: items.map((c) => c.course.code) })) : null);
  };
  const zone = nowZone(attendance, { now, student, checkIns, events: calendar?.events ?? [] });
  const lectures = attendance.lastDay !== null && wibDay(now) > attendance.lastDay;
  const context: RowContext = {
    now,
    student,
    checkIns: checkIns ?? {},
    events: calendar?.events ?? [],
    zone,
    signedOut,
    schedule: attendance.schedule,
    unread: unread ?? [],
    own: attendanceTargets,
    soFar: attendance.period === null,
    onChangeTarget: (code) => openTargets(true, code),
  };

  return (
    <Page>
      <PageHeader
        className="items-start"
        title={t("nav.presence")}
        description={sixConnected && courses.length > 0 ? <DayLine attendance={attendance} /> : undefined}
        actions={
          sixConnected && courses.length > 0 ? (
            <TargetsPanel
              courses={courses.map((c) => ({ code: c.course.code, name: name(c.course.code, c.course.name), color: c.course.color }))}
              open={targets.open}
              onOpenChange={(open) => openTargets(open)}
              focus={targets.focus}
              trigger={
                <Button icon={<Icons.Target className="size-3.5" />} data-targets-trigger="">
                  {t("presence.targets.button")}
                  <span className="font-normal text-muted tabular-nums">{targetRange(courses)}</span>
                </Button>
              }
            />
          ) : undefined
        }
      />

      {/* What needs the Student now, then the groups, 40 px apart. */}
      <div>
        <SixPageNote datasets={["six.courses", "six.schedule"]} className="mb-8" />
        <NowZone zone={zone} attendance={attendance} />
        {courses.length === 0
          ? !listChanged && (
              <div className="mt-10 first:mt-0">
                <EmptyState icon={<Icons.Hand className="size-5" />} title={t("presence.empty")} description={t("presence.emptyHint")} />
              </div>
            )
          : groups.map(({ group, items }) => (
              <Section key={group} id={`presence-${group}`} title={<GroupTitle group={group} items={items} />} count={items.length}>
                <List label={groupLabel(t, group, items)} className="@container">
                  {items.map((item) => (
                    <CourseRow key={item.course.code} item={item} group={group} context={context} />
                  ))}
                </List>
              </Section>
            ))}
      </div>

      {courses.length > 0 && sixConnected && !lectures && <Footer attendance={attendance} />}
      {courses.length > 0 && <HowCounted lastDay={attendance.lastDay} />}
    </Page>
  );
}

function Loading() {
  return (
    <Page>
      <div aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-3 h-5 w-96" />
        <Skeleton className="mt-8 h-96 w-full rounded-xl" />
      </div>
    </Page>
  );
}

/** "80%", or "75–80%" when courses have their own. */
function targetRange(courses: readonly CourseAttendance[]): string {
  const values = courses.map((c) => c.health.target);
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? `${low}%` : `${low}–${high}%`;
}

// ---------------------------------------------------------------- the groups

function groupsOf(courses: readonly CourseAttendance[], signedOut: boolean, still: Still | null): { group: PresenceGroup; items: CourseAttendance[] }[] {
  const byCode = new Map(courses.map((c) => [c.course.code, c]));
  if (still) {
    const placed = new Set(still.flatMap((s) => s.codes));
    const frozen = still.map(({ group, codes }) => ({
      group,
      items: codes.map((code) => byCode.get(code)).filter((c): c is CourseAttendance => c !== undefined),
    }));
    // A course that appears meanwhile joins its group's end (or a group of its own), never a second copy of a group.
    for (const extra of groupsOf(
      courses.filter((c) => !placed.has(c.course.code)),
      signedOut,
      null,
    )) {
      const same = frozen.find((g) => g.group === extra.group);
      if (same) same.items.push(...extra.items);
      else frozen.push(extra);
    }
    return frozen;
  }
  return GROUP_ORDER.map((group) => ({
    group,
    items: sortGroup(
      group,
      courses.filter((c) => presenceGroup(c.health, signedOut) === group),
      (c) => c.health,
      (c) => c.nextWindow?.session.opensAt ?? null,
    ),
  })).filter(({ items }) => items.length > 0);
}

/** All the group's courses share a target: the heading names it; else it says "the target". */
const sharedTarget = (items: readonly CourseAttendance[]) => (new Set(items.map((c) => c.health.target)).size === 1 ? items[0].health.target : null);

function groupLabel(t: Translate, group: PresenceGroup, items: readonly CourseAttendance[]): string {
  const target = sharedTarget(items);
  switch (group) {
    case "out":
      return target === null ? t("presence.group.outMixed") : t("presence.status.out", { target });
    case "none":
      return t("presence.group.none");
    case "edunex":
      return t("presence.group.edunex");
    case "spare":
      return t("presence.group.spare");
    case "unknown":
      return t("presence.budget.unknown");
    case "missed":
      return target === null ? t("presence.group.missedMixed") : t("presence.budget.missed", { target });
    case "met":
      return target === null ? t("presence.group.metMixed") : t("presence.group.met", { target });
    case "courses":
      return t("presence.courses");
  }
}

const GROUP_ICON: Record<PresenceGroup, ReactNode> = {
  out: <Icons.AlertTriangle className="size-4 shrink-0 text-danger-fg" weight="bold" />,
  none: <Icons.AlertTriangle className="size-4 shrink-0 text-warning-fg" weight="bold" />,
  edunex: <Icons.Hand className="size-4 shrink-0 text-muted" />,
  spare: <Icons.CheckCircle className="size-4 shrink-0 text-success-fg" weight="bold" />,
  unknown: <Icons.Circle className="size-4 shrink-0 text-faint" />,
  missed: <Icons.AlertTriangle className="size-4 shrink-0 text-danger-fg" weight="bold" />,
  met: <Icons.CheckCircle className="size-4 shrink-0 text-success-fg" weight="bold" />,
  courses: <Icons.BookOpen className="size-4 shrink-0 text-faint" />,
};

function GroupTitle({ group, items }: { group: PresenceGroup; items: readonly CourseAttendance[] }) {
  const t = useT();
  return (
    // Lined up on the words' baseline, so the count after it sits on the same line.
    <span className="inline-flex items-baseline gap-2">
      <span className="self-center">{GROUP_ICON[group]}</span>
      {groupLabel(t, group, items)}
    </span>
  );
}

// ---------------------------------------------------------------- the next class day

/** "4 classes today. Only PL3002 has an absence to spare.", or the next class day, or when lectures ended. */
function DayLine({ attendance }: { attendance: Attendance }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const unread = useDataset("six.scheduleUnread");
  const answer = dayAnswer(
    attendance.courses.map((c) => c.health),
    attendance.schedule,
    attendance.period,
    now,
    unread,
  );
  if (!answer) return null;
  if (answer.kind === "ended") return <span>{t("presence.ended", { date: dayLabel(f, noonOf(answer.lastDay)) })}</span>;
  // A class SIX shows that the app couldn't read: counted on its day, and said, with where to look.
  const unreadLine = answer.unread ? ` ${t("presence.day.unread", { count: answer.unread })}` : "";
  if (answer.kind === "next") return <span>{`${t("presence.day.next", { day: dayLabel(f, answer.at) })}${unreadLine}`}</span>;
  const first = `${t(answer.day === "today" ? "presence.day.today" : "presence.day.tomorrow", { count: answer.count })}${unreadLine}`;
  const { spare } = answer;
  // Said only of the courses SIX has a count for; with some still uncounted, they're named instead of "only" or "each".
  const second = !spare
    ? ""
    : spare.of < spare.courses
      ? spare.codes.length
        ? t("presence.day.some", { codes: f.list(spare.codes), count: spare.codes.length })
        : ""
      : spare.of === 1
        ? t(spare.codes.length ? "presence.day.one" : "presence.day.oneNone")
        : spare.codes.length === spare.of
          ? t("presence.day.all")
          : spare.codes.length === 0
            ? t("presence.day.none")
            : t("presence.day.only", { codes: f.list(spare.codes), count: spare.codes.length });
  return <span>{second ? `${first} ${second}` : first}</span>;
}

/** "Kam 15 Okt" / "Thu 15 Oct". */
const dayLabel = (f: Format, at: number) => `${f.weekdayShort(at)} ${f.dayMonth(at)}`;
const noonOf = (day: string) => Date.parse(`${day}T12:00:00+07:00`);

// ---------------------------------------------------------------- what needs the Student now

interface Zone {
  checkIns: ClassSession[];
  windows: OpenWindow[];
  /** SIX's count that didn't go up after a class, by SIX's meeting id. */
  results: { id: string; code: string; absent: boolean; start: number }[];
  counted: string[];
  countedLate: string[];
  clashes: { a: CourseAttendance; b: CourseAttendance; from: number; to: number }[];
  /** Two or more courses' next class falls in one exam week (or holiday): said once. */
  week: { event: CalendarEvent; codes: string[] } | null;
}

function nowZone(
  attendance: Attendance,
  {
    now,
    student,
    checkIns,
    events,
  }: { now: number; student: SixStudent | undefined; checkIns: Record<string, SixCheckIn> | undefined; events: readonly CalendarEvent[] },
): Zone {
  const today = wibDay(now);
  const byCode = new Map(attendance.courses.map((c) => [c.course.code, c]));
  const open = student ? attendance.schedule.filter((s) => checkIns?.[s.id]?.state === "open" && checkingIn(s, now)) : [];
  const results = Object.entries(attendance.results)
    .filter(([, r]) => byCode.has(r.courseCode) && resultNeedsStudent(r, attendance.countLog, now))
    .map(([id, r]) => ({ id, code: r.courseCode, absent: r.result === "absent", start: r.start }))
    .sort((a, b) => a.start - b.start);
  const countedToday = Object.values(attendance.results)
    .filter((r) => r.result === "counted" && wibDay(r.at) === today && byCode.has(r.courseCode))
    .sort((a, b) => a.start - b.start);
  const counted = [...new Set(countedToday.filter((r) => r.wasAt === undefined).map((r) => r.courseCode))];
  const countedLate = [...new Set(countedToday.filter((r) => r.wasAt !== undefined).map((r) => r.courseCode))];
  // Today's classes that share time and haven't ended, each pair once.
  const todays = attendance.schedule
    .filter((s) => wibDay(s.start) === today && s.end > now && !isExamActivity(s.activity) && byCode.has(s.courseCode))
    .sort((a, b) => a.start - b.start);
  const clashes: Zone["clashes"] = [];
  for (const [i, x] of todays.entries())
    for (const y of todays.slice(i + 1))
      if (
        y.courseCode !== x.courseCode &&
        y.start < x.end &&
        x.start < y.end &&
        !clashes.some((c) => c.a.course.code === x.courseCode && c.b.course.code === y.courseCode)
      )
        clashes.push({ a: byCode.get(x.courseCode)!, b: byCode.get(y.courseCode)!, from: Math.max(x.start, y.start), to: Math.min(x.end, y.end) });
  // The next class of each course, when it may not run, by the exam week (or holiday) it falls in.
  const uncertain = new Map<CalendarEvent, string[]>();
  for (const c of attendance.courses) {
    const first = c.health.left.upcoming[0];
    if (!first?.uncertain || c.health.needsUncertain) continue;
    const event = periodOf(events, first.start);
    if (event) uncertain.set(event, [...(uncertain.get(event) ?? []), c.course.code]);
  }
  const shared = [...uncertain.entries()].find(([, codes]) => codes.length >= 2);
  return {
    checkIns: open,
    windows: attendance.open.filter((w) => w.counts),
    results,
    counted,
    countedLate,
    clashes,
    week: shared ? { event: shared[0], codes: shared[1] } : null,
  };
}

const periodOf = (events: readonly CalendarEvent[], at: number) => {
  const day = wibDay(at);
  return events.find((e) => (e.kind === "uts" || e.kind === "uas" || e.kind === "holiday") && e.firstDay <= day && day <= e.lastDay);
};

function NowZone({ zone, attendance }: { zone: Zone; attendance: Attendance }) {
  const t = useT();
  const signIn = !attendance.sixConnected;
  const any =
    signIn ||
    zone.checkIns.length ||
    zone.windows.length ||
    zone.results.length ||
    zone.counted.length ||
    zone.countedLate.length ||
    zone.clashes.length ||
    zone.week !== null;
  if (!any) return null;
  return (
    <section aria-label={t("presence.now")} data-guide="presence-now" className="space-y-3">
      {signIn && <SignInSix quiet={zone.windows.length > 0} />}
      {zone.checkIns.map((session) => (
        <OpenCheckIn key={session.id} session={session} />
      ))}
      {zone.windows.map((window) => (
        <OpenPresence key={window.session.id} window={window} />
      ))}
      {zone.results.map((result) => (
        <SixResult key={result.id} result={result} health={attendance.courses.find((c) => c.course.code === result.code)?.health} />
      ))}
      {(zone.counted.length > 0 || zone.countedLate.length > 0) && <Receipt counted={zone.counted} late={zone.countedLate} />}
      {zone.clashes.map((clash) => (
        <ClashCard key={`${clash.a.course.code}-${clash.b.course.code}`} clash={clash} />
      ))}
      {zone.week && <WeekNote event={zone.week.event} />}
    </section>
  );
}

/** Signed out of SIX, with nothing of it kept: where the count comes from, and the way in. */
function SignInSix({ quiet }: { quiet: boolean }) {
  const t = useT();
  const { signIn, busy } = useSignIn();
  return (
    <Card variant="raised" className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-title font-semibold">{t("presence.answer.noSix")}</p>
        <p className="mt-1 text-small text-muted">{`${t("presence.noSix.hint")} ${t("presence.noSix.noWatch")}`}</p>
      </div>
      <Button variant={quiet ? "secondary" : "primary"} busy={busy} onClick={() => void signIn("six")}>
        {t("presence.signInSix")}
      </Button>
    </Card>
  );
}

/** A class where SIX shows "Tandai Hadir" now (as the app last read its popup), with the way to press it. */
function OpenCheckIn({ session }: { session: ClassSession }) {
  const t = useT();
  const f = useFormat();
  const openCheckIn = useOpenCheckIn();
  const student = useDataset("six.student");
  if (!student) return null;
  return (
    <section aria-label={t("presence.checkIn.title")} className="rounded-2xl border border-edge bg-raised px-5 py-4 shadow-raised">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-title font-semibold">
            <LiveDot />
            {t("home.now.checkInOpen")}
          </p>
          <Meta className="mt-1 text-small text-muted">{t("presence.checkIn.class", { code: session.courseCode, time: f.time(session.end) })}</Meta>
        </div>
        <Button
          variant="primary"
          icon={<Icons.ArrowUpRight className="size-3.5" />}
          onClick={() => openCheckIn(session.id, sixTimetableUrl(student, session.start))}
          aria-label={t("home.now.openSixLabel", { course: session.courseCode })}
        >
          {t("home.now.openSix")}
        </Button>
      </div>
    </section>
  );
}

/**
 * An Edunex window open now that may count: "Kumpulkan Tugas 02 Bab II
 * sebelum 23:59", with the way to do it and the time left. Without SIX
 * nobody can say it counts: worth doing just in case, so said calmly, its
 * button quiet.
 */
function OpenPresence({ window }: { window: OpenWindow }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const open = useOpenExternal();
  const { go } = useNav();
  const actionLabel = useActionLabel();
  const { session, code, health, action } = window;
  const task = action.activity === "assignment" ? action.task : null;
  const noSix = health?.countedIn === "noSix";
  const where = noSix ? "presence.open.noSix" : health?.countedIn === "unknown" ? "presence.open.notKnown" : "presence.open.counts";
  return (
    <section aria-label={t("presence.open.title")} className="rounded-2xl border border-edge bg-raised px-5 py-4 shadow-raised">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-title font-semibold">
            <LiveDot />
            {t("presence.open.do", { action: actionLabel(window), time: f.time(session.closesAt) })}
          </p>
          <Meta className="mt-1 text-small text-muted">{t(where, { code })}</Meta>
        </div>
        {task ? (
          <Button variant={noSix ? "secondary" : "primary"} onClick={() => go({ screen: "task", taskId: task.id })}>
            {t("presence.open.task")}
            <Icons.ArrowRight className="size-3.5" />
          </Button>
        ) : (
          <Button variant={noSix ? "secondary" : "primary"} icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(action.url)}>
            {t("presence.open.record")}
          </Button>
        )}
      </div>
      <CountdownBar
        className="mt-3"
        opensAt={session.opensAt}
        closesAt={session.closesAt}
        now={now}
        label={t("presence.open.left", { time: f.countdown(session.closesAt) })}
      />
    </section>
  );
}

/** SIX's count didn't go up after a class: marked absent (red) or not counted yet (amber), who fixes it, and by when. */
function SixResult({ result, health }: { result: Zone["results"][number]; health: AttendanceHealth | undefined }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const student = useDataset("six.student");
  const today = f.dayOffset(result.start) === 0;
  const vars = { code: result.code, day: dayLabel(f, result.start) };
  const title = result.absent
    ? t(today ? "presence.six.absent" : "presence.six.absentOn", vars)
    : t(today ? "presence.six.missing" : "presence.six.missingOn", vars);
  const body =
    result.absent && health?.state === "out"
      ? t("presence.six.absentOut", { code: result.code, target: health.target })
      : t("alert.six.body", { attended: health?.attended ?? 0, held: health?.held ?? 0 });
  return (
    <Notice
      tone={result.absent ? "danger" : "warning"}
      title={title}
      action={
        student ? (
          <Button size="sm" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(sixTimetableUrl(student, result.start))}>
            {t("presence.checkSix")}
          </Button>
        ) : undefined
      }
    >
      {body}
    </Notice>
  );
}

/** "PL3002, PL3032 dan KU5014 sudah dihitung di SIX hari ini.": the classes SIX counted today, one quiet line. */
function Receipt({ counted, late }: { counted: string[]; late: string[] }) {
  const t = useT();
  const f = useFormat();
  const lines = [
    ...(counted.length ? [t("presence.six.counted", { codes: f.list(counted) })] : []),
    ...late.map((code) => t("presence.six.countedLate", { code })),
  ];
  return (
    <div className="space-y-1">
      {lines.map((line) => (
        <p key={line} className="flex items-start gap-2 text-small text-muted">
          <Icons.CheckCircle className="mt-0.5 size-3.5 shrink-0 text-success-fg" weight="bold" />
          {line}
        </p>
      ))}
    </div>
  );
}

/** Two classes today at the same time: when, and which to go to if the Student can make only one, with why. */
function ClashCard({ clash }: { clash: Zone["clashes"][number] }) {
  const t = useT();
  const f = useFormat();
  const body = clashAnswer(t, clash.a.health, clash.b.health);
  return (
    <Card className="flex items-start gap-3 px-5 py-4">
      <Icons.Overlap className="mt-0.5 size-4 shrink-0 text-warning-fg" weight="bold" />
      <div className="min-w-0">
        <p className="text-body font-semibold">
          {t("presence.clash.today", { a: clash.a.course.code, b: clash.b.course.code, time: f.timeRange(clash.from, clash.to) })}
        </p>
        {body && <p className="mt-0.5 text-small text-muted">{body}</p>}
      </div>
    </Card>
  );
}

/** The clash answer in words, from `clashPick`; null when the app can't say (the title stands alone). */
function clashAnswer(t: Translate, a: AttendanceHealth, b: AttendanceHealth): string | null {
  const pick = clashPick(a, b);
  if (!pick.why) return null;
  const picked = pick.pick === a.code ? a : b;
  const other = picked === a ? b : a;
  const left = (h: AttendanceHealth) => h.absencesLeft ?? 0;
  switch (pick.why) {
    case "none":
      return t("presence.clash.none", { code: picked.code });
    case "fewer":
      return t("presence.clash.fewer", { code: picked.code, count: left(picked), other: other.code, otherCount: left(other) });
    case "noneOut":
      return t("presence.clash.noneOut", { code: picked.code, other: other.code, target: other.target });
    case "spareOut":
      return t("presence.clash.spareOut", { code: picked.code, count: left(picked), other: other.code, target: other.target });
    case "bothNone":
      return t("presence.clash.bothNone");
    case "even":
      return t("presence.clash.even", { count: left(a) });
  }
}

/** Classes in an exam week (or on a holiday) that SIX still lists: said once for every course. */
function WeekNote({ event }: { event: CalendarEvent }) {
  const t = useT();
  const f = useFormat();
  const period = t(event.kind === "uts" ? "presence.period.uts" : event.kind === "uas" ? "presence.period.uas" : "presence.period.off");
  return (
    <p className="flex items-start gap-2 text-small text-muted">
      <Icons.GraduationCap className="mt-0.5 size-3.5 shrink-0 text-(--source-itb-fg)" weight="bold" />
      {t("presence.weekNote", { period, range: f.dayRange(event.firstDay, event.lastDay) })}
    </p>
  );
}

// ---------------------------------------------------------------- a course

interface RowContext {
  now: number;
  student: SixStudent | undefined;
  checkIns: Record<string, SixCheckIn>;
  events: readonly CalendarEvent[];
  zone: Zone;
  signedOut: boolean;
  schedule: readonly ClassSession[];
  /** SIX's meetings the app couldn't read, by day (ADR 0013). */
  unread: readonly UnreadSession[];
  own: Readonly<Record<string, number>>;
  /** Without ITB's calendar: absences count only SIX's timetable so far. */
  soFar: boolean;
  onChangeTarget: (code: string) => void;
}

/**
 * A course: the course (the strongest thing in the row) and its next class on
 * the left, its absences and SIX's share at the row's end, and one exception
 * at most on a line of its own under both, its actions at the row's end too.
 * The whole row opens the course's meetings; its own controls sit above it.
 */
function CourseRow({ item, group, context }: { item: CourseAttendance; group: PresenceGroup; context: RowContext }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const name = useCourseNames();
  const { course, health } = item;
  const meta = metaParts(t, f, item, context);
  const words = context.signedOut ? null : budgetWords(t, health, context.soFar);
  const own = Object.hasOwn(context.own, course.code);
  const label = [
    `${course.code} ${name(course.code, course.name)}`,
    words ? t("presence.bar.label") : "",
    words?.lead ?? "",
    words?.bold ?? "",
    words && own ? t("presence.row.ownTarget", { value: health.target }) : "",
    words && health.held
      ? t("presence.row.count", { attended: health.attended ?? 0, held: health.held, percent: percent(health.attended ?? 0, health.held) })
      : "",
    !words ? sideText(t, group, health) : "",
    ...meta,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <li className="group relative has-[>button:hover]:bg-hover">
      <button
        type="button"
        aria-label={label}
        onClick={() => go({ screen: "course", code: course.code, tab: "meetings" })}
        className="absolute inset-0 z-0 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus"
      />
      {/* Wide: the course and its next class on the left, its attendance on the right, the exception across both. Narrow (the window small, or zoomed in): one under another. */}
      <div className="pointer-events-none relative grid grid-cols-1 px-5 py-4 @[48rem]:grid-cols-[minmax(0,1fr)_auto] @[48rem]:gap-x-8">
        <div className="min-w-0">
          <p className="flex min-w-0 items-baseline gap-2">
            <CourseCode code={course.code} color={course.color} className="shrink-0 text-small" />
            <span className="line-clamp-2 min-w-0 text-body font-semibold" title={name(course.code, course.name)}>
              {name(course.code, course.name)}
            </span>
          </p>
          {meta.length > 0 && <Meta className="mt-1 text-small text-muted">{meta}</Meta>}
        </div>
        <Side item={item} group={group} own={own} soFar={context.soFar} signedOut={context.signedOut} />
        <div className="@[48rem]:col-span-2">
          <Exception item={item} context={context} />
        </div>
      </div>
    </li>
  );
}

/** The row's end: the absences, Edunex's own tally, or how it finished. */
function Side({ item, group, own, soFar, signedOut }: { item: CourseAttendance; group: PresenceGroup; own: boolean; soFar: boolean; signedOut: boolean }) {
  const t = useT();
  const { health } = item;
  // One width on every row, so the labels and bars line up down the list.
  const place = "mt-2.5 @[48rem]:mt-0.5 @[48rem]:w-104 @[48rem]:self-start";
  if (signedOut) return null;
  if (group === "out" || group === "none" || group === "spare" || group === "unknown")
    return <AbsenceBudget health={health} place="row" own={own} soFar={soFar} className={place} />;
  const text = sideText(t, group, health);
  if (!text) return null;
  return <p className={cx(place, "text-small", group === "missed" ? "font-semibold text-danger-fg" : "text-muted")}>{text}</p>;
}

function sideText(t: Translate, group: PresenceGroup, health: AttendanceHealth): string {
  if (group === "edunex" && health.edunexClosed > 0) return t("presence.edunexTally", { recorded: health.edunexRecorded, closed: health.edunexClosed });
  if ((group === "met" || group === "missed") && health.held) return t("presence.row.final", { percent: percent(health.attended ?? 0, health.held) });
  return "";
}

/** The class going on now, else the next one (SIX's, else the weekly slot carried on). */
function classOf(item: CourseAttendance, context: RowContext): { session: ClassSession | null; start: number; live: boolean } | null {
  const live = context.schedule.find((s) => s.courseCode === item.course.code && s.start <= context.now && context.now < s.end && !isExamActivity(s.activity));
  if (live) return { session: live, start: live.start, live: true };
  const next = item.health.left.next;
  if (next) return { session: next, start: next.start, live: false };
  const coming = item.health.left.upcoming[0];
  return coming ? { session: null, start: coming.start, live: false } : null;
}

/** When an Edunex window is: a hand-in's close is a deadline ("Jum 16 Okt, kumpulkan sebelum 23:59"), any other its time. */
function windowWhen(t: Translate, f: Format, window: NonNullable<CourseAttendance["nextWindow"]>): string {
  const { session, action } = window;
  if (action.activity === "assignment") return t("presence.row.handIn", { day: dayLabel(f, session.closesAt), time: f.time(session.closesAt) });
  return `${f.relativeDay(session.opensAt)}, ${f.timeRange(session.opensAt, session.closesAt)}`;
}

/** The meta line: on now until when, or the next class and its room; signed out of SIX, the next Edunex window. */
function metaParts(t: Translate, f: Format, item: CourseAttendance, context: RowContext): string[] {
  if (context.signedOut) return item.nextWindow ? [t("presence.row.window", { when: windowWhen(t, f, item.nextWindow) })] : [];
  const at = classOf(item, context);
  if (at?.live && at.session) return [t("presence.row.now", { time: f.time(at.session.end) }), at.session.room ?? ""].filter(Boolean);
  // A class of the course SIX shows that the app couldn't read, before the next one it can: that comes first.
  const unreadDay = firstUnreadDay(context.unread, context.schedule, context.now, at?.start ?? null, item.course.code);
  if (unreadDay) return [t("home.now.unread", { day: f.relativeDay(dayNoon(unreadDay)) })];
  if (!at) return [];
  const time = at.session ? f.timeRange(at.session.start, at.session.end) : f.time(at.start);
  const offset = f.dayOffset(at.start);
  const when =
    offset === 0
      ? t("presence.row.nextToday", { time })
      : offset === 1
        ? t("presence.row.nextTomorrow", { time })
        : t("presence.row.nextOn", { day: dayLabel(f, at.start), time });
  return [when, at.session?.room ?? ""].filter(Boolean);
}

/**
 * One exception at most, the first that applies: Tandai Hadir watched for the
 * class on now; gone from SIX ("did it go through?"); out of reach or finished
 * below, with the fix; the target hanging on a class that may not run; a
 * clash with which to go to; what the next class's Edunex window asks; that
 * the next class may not run; a lab's own rules.
 */
function Exception({ item, context }: { item: CourseAttendance; context: RowContext }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const actionLabel = useActionLabel();
  const { course, health, nextWindow } = item;
  const { now, student, checkIns, zone } = context;
  if (context.signedOut) return null;
  const at = classOf(item, context);
  const counts = health.countedIn === "six" || health.countedIn === "both" || health.countedIn === "unknown";
  // 1–2. Tandai Hadir for the class on now (or one that ended within the hour).
  if (student && counts) {
    const recent = context.schedule.find(
      (s) => s.courseCode === course.code && !isExamActivity(s.activity) && s.start <= now && now < s.end + GONE_FOR && checkIns[s.id]?.state === "gone",
    );
    if (at?.live && at.session && checkingIn(at.session, now) && (checkIns[at.session.id]?.state ?? "waiting") === "waiting")
      return <Quiet icon={<Icons.Hand className="mt-0.5 size-3.5 shrink-0" />}>{t("presence.row.watching")}</Quiet>;
    if (recent) return <Quiet icon={<Icons.Hand className="mt-0.5 size-3.5 shrink-0" />}>{t("presence.row.gone")}</Quiet>;
  }
  // 3. Out of reach or finished below: a count SIX got wrong, or a wrong target, is the way back.
  // The heading and the bar already say what's lost in red; this is the fix, so calm, its actions blue.
  if ((health.state === "out" || health.state === "missed") && !zone.results.some((r) => r.code === course.code && r.absent))
    return (
      <Quiet
        icon={<Icons.Info className="mt-0.5 size-3.5 shrink-0" />}
        action={
          <>
            {student && (
              <RowLink icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(sixTimetableUrl(student))}>
                {t("presence.checkSix")}
              </RowLink>
            )}
            {health.state === "out" && (
              <RowLink
                icon={<Icons.Target className="size-3.5" />}
                aria-label={`${t("presence.changeTarget")}: ${course.code}`}
                onClick={() => context.onChangeTarget(course.code)}
              >
                {t("presence.changeTarget")}
              </RowLink>
            )}
          </>
        }
      >
        {t("presence.warn.out")}
      </Quiet>
    );
  // 4. No absences left, and the target hangs on a class that may not run.
  const needed = health.needsUncertain ? health.left.upcoming.find((m) => m.uncertain) : undefined;
  if (needed) return <Warning>{uncertainText(t, f, needed.start, context.events, health.target)}</Warning>;
  // 5. The next class clashes with another course's (unless today's clash card says it).
  const clash = item.clash;
  const onCard = zone.clashes.some((c) => c.a.course.code === course.code || c.b.course.code === course.code);
  if (clash && !onCard) {
    const mine = context.schedule.filter((s) => s.courseCode === course.code);
    const theirs = context.schedule.filter((s) => s.courseCode === clash.other);
    const time = f.timeRange(clash.from, clash.to);
    const head =
      onUsualSlot(clash.session, mine) && onUsualSlot(clash.with, theirs)
        ? t("presence.row.clashEvery", { code: clash.other, weekday: f.weekday(clash.from), time })
        : t("presence.row.clashOn", { code: clash.other, day: dayLabel(f, clash.from), time });
    const tail =
      clash.pick.pick === course.code
        ? t("presence.row.clashPicked")
        : clash.pick.pick === clash.other
          ? t("presence.row.clashOther", { code: clash.other })
          : t("presence.row.clashAsk");
    return <Warning>{`${head} ${tail}`}</Warning>;
  }
  // 6–7. What the next class's Edunex window asks, where Edunex keeps the count too.
  const next = health.left.next;
  if (nextWindow && (nextWindow.action.activity !== "course" || health.countedIn === "edunex")) {
    const label = actionLabel(nextWindow);
    const time = f.time(nextWindow.session.closesAt);
    if (health.countedIn === "both" && nextWindow.action.activity !== "course" && next && wibDay(nextWindow.session.opensAt) === wibDay(next.start))
      return <Quiet>{t("presence.record.bothDo", { action: label.charAt(0).toLowerCase() + label.slice(1), time })}</Quiet>;
    if (health.countedIn === "edunex") {
      const assignment = nextWindow.action.activity === "assignment";
      return (
        <Quiet>
          {t("presence.row.windowDo", {
            when: assignment ? dayLabel(f, nextWindow.session.closesAt) : windowWhen(t, f, nextWindow),
            action: assignment ? t("presence.row.byTime", { action: label, time }) : label,
          })}
        </Quiet>
      );
    }
  }
  // 8. The next class may not run (exam week, holiday), unless the note on top says it for every course.
  const first = health.left.upcoming[0];
  if (first?.uncertain && !(zone.week?.codes.includes(course.code) ?? false)) return <Warning>{uncertainText(t, f, first.start, context.events)}</Warning>;
  // 9. A lab next, in a course that also has lectures.
  if (
    at?.session &&
    /praktikum|tutorial/i.test(at.session.activity) &&
    context.schedule.some((s) => s.courseCode === course.code && /^kuliah$/i.test(s.activity))
  )
    return <Quiet>{t("presence.row.lab")}</Quiet>;
  return null;
}

/**
 * "Kam 15 Okt masuk masa UTS, …", naming the period from ITB's calendar.
 * `target`: the course's target hangs on that class running.
 */
function uncertainText(t: Translate, f: Format, start: number, events: readonly CalendarEvent[], target?: number): string {
  const date = dayLabel(f, start);
  const event = periodOf(events, start);
  if (event?.kind === "holiday") return target ? t("presence.warn.neededHoliday", { date, target }) : t("presence.warn.uncertainHoliday", { date });
  const period = t(event?.kind === "uts" ? "presence.period.uts" : event?.kind === "uas" ? "presence.period.uas" : "presence.period.off");
  return target ? t("presence.warn.needed", { date, period, target }) : t("presence.warn.uncertain", { date, period });
}

/** The exception's line, across the row: its words on one line where they fit, its actions at the row's end (under the words when both don't fit). */
function Line({ className, icon, action, children }: { className: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className={cx("mt-3 flex flex-wrap items-start gap-x-6 gap-y-1.5 text-small", className)}>
      <p className="flex min-w-0 items-start gap-2">
        {icon}
        <span className="min-w-0">{children}</span>
      </p>
      {action && <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">{action}</span>}
    </div>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <Line className="font-medium text-warning-fg" icon={<Icons.AlertTriangle className="mt-0.5 size-3.5 shrink-0" weight="bold" />}>
      {children}
    </Line>
  );
}

function Quiet({ icon, action, children }: { icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <Line className="text-muted" icon={icon} action={action}>
      {children}
    </Line>
  );
}

/** A row's own action, a link in blue above the row's button. */
function RowLink({ icon, children, ...rest }: { icon: ReactNode; children: ReactNode; onClick: () => void; "aria-label"?: string }) {
  return (
    <button
      type="button"
      className="focus-ring pointer-events-auto relative inline-flex items-center gap-1 rounded font-medium text-accent-fg hover:underline"
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- said once, under the groups

/** How attendance is recorded, and that later classes are estimated: once for every course. */
function Footer({ attendance }: { attendance: Attendance }) {
  const t = useT();
  const f = useFormat();
  const { lastDay, schedule } = attendance;
  const estimated = attendance.courses.some((c) => c.health.left.estimated);
  let dates: string;
  if (!lastDay) dates = t("presence.estimateNoDate");
  else if (!estimated || !schedule.length) dates = t("presence.estimateEnd", { date: dayLabel(f, noonOf(lastDay)) });
  else {
    // SIX's timetable comes a month at a time: it covers through the end of its last month.
    const [year, month] = wibDay(Math.max(...schedule.map((s) => s.start)))
      .slice(0, 7)
      .split("-")
      .map(Number);
    const covered = Date.UTC(year, month, 1) - 7 * HOUR - DAY / 2;
    dates = t("presence.estimate", { date: dayLabel(f, noonOf(lastDay)), day: f.dayMonth(covered) });
  }
  return (
    <div className="mt-8 space-y-1.5 text-small text-muted">
      <p className="flex items-start gap-2">
        <Icons.Hand className="mt-0.5 size-3.5 shrink-0" />
        {t("presence.footer")}
      </p>
      <p className="flex items-start gap-2">
        <Icons.Calendar className="mt-0.5 size-3.5 shrink-0" />
        {dates}
      </p>
    </div>
  );
}

function HowCounted({ lastDay }: { lastDay: string | null }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const student = useDataset("six.student");
  const date = lastDay ? dayLabel(f, noonOf(lastDay)) : "-";
  return (
    <details className="group mt-6">
      <summary className="focus-ring inline-flex cursor-pointer list-none items-center gap-1.5 rounded text-small font-medium text-muted transition-colors duration-150 select-none hover:text-fg [&::-webkit-details-marker]:hidden">
        <Icons.ChevronRight className="size-3.5 transition-transform duration-150 group-open:rotate-90" />
        {t("presence.how")}
      </summary>
      <div className="mt-3 max-w-[72ch] pl-5 text-small leading-[1.6] text-muted">
        <ul className="list-disc space-y-1 pl-4">
          <li>{t("presence.how.six")}</li>
          <li>{t("presence.how.left", { date })}</li>
          <li>{t("presence.how.uncertain")}</li>
          <li>{t("presence.how.edunex")}</li>
          <li>{t("presence.how.target")}</li>
          <li>{t("presence.how.check")}</li>
        </ul>
        {student && (
          <Button size="sm" className="mt-3" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(sixTimetableUrl(student))}>
            {t("presence.openSix")}
          </Button>
        )}
      </div>
    </details>
  );
}
