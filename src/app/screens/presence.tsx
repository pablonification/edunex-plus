// Presensi (#85): am I OK, and what do I need to do? The answer comes first,
// naming the courses and the action ("Jangan absen lagi di DK4073 dan
// PL3032."). Then an Edunex Presence window open now, only where filling it
// in counts, with its one action and the time left. Then every course, worst
// first, in at most three lines: the verdict ("Masih bisa absen 2× lagi"),
// the count and what's left ("Hadir 4 dari 6 · 8 pertemuan lagi sampai 4
// Des") with one meter against the course's target, and the next class with
// where it's recorded ("cukup hadir di kelas"); then one warning at most, and
// a window that's optional as a quiet line. How it's counted is a closed
// disclosure at the bottom. Nothing here is hidden by a snooze elsewhere.
import { type ReactNode, useState } from "react";
import { type AttendanceHealth, type AttendanceState, isExamActivity, needsAttention, percent } from "../../core/attendance";
import { attendanceAnswer } from "../../core/attendance-answer";
import { clashes, wibDay } from "../../core/course-meetings";
import type { ClassSession } from "../../core/models";
import { sixTimetableUrl } from "../../core/schedule";
import { type CourseAttendance, type OpenWindow, useAttendance } from "../attendance";
import { METER_TONE, STATE_TONE, useActionLabel, verdictLabel } from "../attendance-labels";
import { CourseTarget, DefaultTarget } from "../attendance-parts";
import { useOpenExternal } from "../hooks";
import { type Format, type Translate, useFormat, useLang, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { useCourseNames } from "../schedule-data";
import { useSignIn } from "../shell/source-status";
import { useDataset, useStatus } from "../store";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { CourseCode, EmptyState, LiveDot, Skeleton } from "../ui/display";
import { Icons } from "../ui/icons";
import { factsLabel, List, Meta, Page, PageHeader } from "../ui/layout";
import { CountdownBar, ShareMeter } from "../ui/meter";
import { Popover } from "../ui/overlays";

export const ready = true;

/** Courses that need the Student: no absences left, or the target out of reach. */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  const attendance = useAttendance();
  const value = attendance?.courses.filter((c) => needsAttention(c.health.state)).length ?? 0;
  return value > 0 ? { value, tone: "warning" } : null;
}

/** Worst first, as the answer on top says it; a course whose lectures are over after the ones still going. */
const ORDER: Record<AttendanceState, number> = { out: 0, missed: 1, none: 2, risk: 3, safe: 4, met: 5, unknown: 6 };

export function PresenceScreen() {
  const t = useT();
  const attendance = useAttendance();
  // While a row's target is being changed the rows hold still, so the one being changed doesn't move under the pointer.
  const [still, setStill] = useState<string[] | null>(null);
  if (!attendance) return <Loading />;
  const { courses, open, target, lastDay } = attendance;
  // A target judges SIX's count: before there is one, it's only in Settings.
  const counted = courses.some((c) => c.health.held);
  const rank = (c: CourseAttendance) => (still ? still.indexOf(c.course.code) : ORDER[c.health.state]);
  const sorted = [...courses].sort((a, b) => rank(a) - rank(b));
  const hold = (open: boolean) => setStill(open ? sorted.map((c) => c.course.code) : null);
  const counting = open.filter((window) => window.counts);
  // Where only SIX counts, the window is optional: a quiet line in its course's row, never on top.
  const optional = new Map(open.filter((window) => !window.counts).map((window) => [window.code, window]));

  return (
    <Page>
      <PageHeader
        className="items-start"
        title={t("nav.presence")}
        description={<Answer courses={courses} quiet={counting.length > 0} />}
        actions={counted ? <TargetControl target={target} /> : undefined}
      />

      {counting.length > 0 && (
        <section aria-label={t("presence.open.title")} className="mb-8 space-y-3">
          {counting.map((window) => (
            <OpenPresence key={window.session.id} window={window} />
          ))}
        </section>
      )}

      {courses.length === 0 ? (
        <EmptyState icon={<Icons.Hand className="size-5" />} title={t("presence.empty")} />
      ) : (
        <List label={t("presence.courses")} className="@container">
          {sorted.map((item) => (
            <CourseRow key={item.course.code} item={item} optional={optional.get(item.course.code)} lastDay={lastDay} onTargetOpen={hold} />
          ))}
        </List>
      )}

      <HowCounted lastDay={lastDay} />
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

// ---------------------------------------------------------------- the answer

const ANSWER_ICON = {
  danger: <Icons.AlertTriangle className="size-4 text-danger-fg" weight="bold" />,
  warning: <Icons.AlertTriangle className="size-4 text-warning-fg" weight="bold" />,
  success: <Icons.CheckCircle className="size-4 text-success-fg" weight="bold" />,
} as const;

/** The courses and the action, a line each, worst first; without SIX's count, where it comes from and the way in. */
function Answer({ courses, quiet }: { courses: CourseAttendance[]; quiet: boolean }) {
  const t = useT();
  const lang = useLang();
  const six = useStatus("six");
  const { signIn, busy } = useSignIn();
  const list = (items: string[]) => new Intl.ListFormat(lang, { type: "conjunction" }).format(items);
  const lines = attendanceAnswer(
    courses.map((c) => c.health),
    t,
    list,
  );
  if (!lines.length && six.state === "signed-out")
    return (
      <span className="block">
        <span className="block font-medium text-fg">{t("presence.answer.noSix")}</span>
        <span className="block text-small">{t("presence.noSix.hint")}</span>
        <Button className="mt-3" variant={quiet ? "secondary" : "primary"} busy={busy} onClick={() => void signIn("six")}>
          {t("presence.signInSix")}
        </Button>
      </span>
    );
  if (!lines.length) return <span>{t("presence.answer.noCount")}</span>;
  return (
    <span className="block space-y-1">
      {lines.map((line) => (
        <span key={line.text} className="flex items-start gap-2 font-medium text-fg">
          <span className="mt-[3px] shrink-0">{ANSWER_ICON[line.tone]}</span>
          {line.text}
        </span>
      ))}
    </span>
  );
}

/**
 * "Target semua mata kuliah: 80%": the default, for every course without its
 * own (also in Settings); a row's own "Target 80%" sets that course's alone.
 */
function TargetControl({ target }: { target: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t("settings.attendance.target")}
      align="end"
      className="w-[300px] p-4"
      trigger={<Button icon={<Icons.Target className="size-3.5" />}>{t("presence.target.button", { value: target })}</Button>}
    >
      <p className="text-title font-semibold">{t("settings.attendance.target")}</p>
      <p className="mt-1 text-small text-muted">{t("presence.target.global")}</p>
      <div className="mt-3">
        <DefaultTarget onReset={() => setOpen(false)} />
      </div>
    </Popover>
  );
}

// ---------------------------------------------------------------- a window open now that counts

/**
 * "Kumpulkan Tugas 02 Bab II sebelum 23:59", with the way to do it and the
 * time left. Without SIX nobody can say it counts: worth doing just in case,
 * so said calmly, its button quiet.
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
    <div className="rounded-2xl border border-edge bg-raised px-5 py-4 shadow-raised">
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
    </div>
  );
}

// ---------------------------------------------------------------- a course

function CourseRow({
  item,
  optional,
  lastDay,
  onTargetOpen,
}: {
  item: CourseAttendance;
  optional?: OpenWindow;
  lastDay: string | null;
  onTargetOpen: (open: boolean) => void;
}) {
  const t = useT();
  const { go } = useNav();
  const name = useCourseNames();
  const { course, health } = item;
  const counted = health.held !== null && health.held > 0;
  // Signed out of SIX with nothing of SIX's kept: the answer on top says once where the count is; no row repeats it.
  const sixOut = useStatus("six").state === "signed-out" && health.held === null;
  const verdict = sixOut ? null : verdictLabel(t, health);
  const facts = useFacts(health, lastDay);
  const upcoming = useNextClass(health);
  // The next Edunex window on the next class's day is said with that class, not on a line of its own.
  const withClass = Boolean(upcoming && item.nextWindow && quietWindow(item) && wibDay(item.nextWindow.session.opensAt) === wibDay(upcoming.session.start));
  const next = useNextLine(item, upcoming, withClass);
  const warning = useWarning(health);
  const quiet = useQuietLine(item, optional, withClass);
  const share = counted ? percent(health.attended ?? 0, health.held ?? 0) : 0;

  return (
    <li className="group relative has-[>button:hover]:bg-hover">
      {/* The whole row opens the course's meetings; its controls sit above it. */}
      <button
        type="button"
        aria-label={factsLabel(course.code, name(course.code, course.name), verdict)}
        onClick={() => go({ screen: "course", code: course.code, tab: "meetings" })}
        className="absolute inset-0 z-0 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
      />
      {/*
        Wide: the facts on the left, the verdict with its meter and target on the right. Narrow: the verdict, meter and target
        on one line under the name, so each fact keeps a line of its own. The markup is in reading order either way; the last
        row takes up what the verdict's column needs, so the facts stay close together.
      */}
      <div className="pointer-events-none relative grid grid-cols-1 px-5 py-4 @3xl:grid-cols-[minmax(0,1fr)_236px] @3xl:grid-rows-[auto_auto_auto_1fr] @3xl:gap-x-6">
        <p className="flex min-w-0 items-baseline gap-2 @3xl:col-start-1 @3xl:row-start-1">
          <CourseCode code={course.code} color={course.color} className="shrink-0 text-small" />
          <span className="line-clamp-2 min-w-0 text-body font-semibold">{name(course.code, course.name)}</span>
        </p>
        {(verdict || counted) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 @3xl:col-start-2 @3xl:row-[1/span_4] @3xl:mt-0 @3xl:flex-col @3xl:flex-nowrap @3xl:items-end @3xl:gap-y-0 @3xl:self-start @3xl:text-right">
            {verdict && (
              <p
                className={cx(
                  "min-w-0 grow @3xl:grow-0",
                  counted ? "text-title leading-snug font-semibold text-balance" : "text-small font-medium",
                  STATE_TONE[health.state],
                )}
              >
                {verdict}
              </p>
            )}
            {counted && (
              <>
                <ShareMeter
                  className="w-[120px] @3xl:mt-2 @3xl:w-full @3xl:max-w-[160px]"
                  share={share}
                  target={health.target}
                  tone={METER_TONE[health.state]}
                  label={t("presence.meter.target", { attended: health.attended ?? 0, held: health.held ?? 0, share, target: health.target })}
                />
                <CourseTarget code={course.code} className="pointer-events-auto relative @3xl:mt-1.5" onOpenChange={onTargetOpen} />
              </>
            )}
          </div>
        )}
        {facts && <p className="mt-1 text-small text-muted tabular-nums @3xl:col-start-1 @3xl:row-start-2">{facts}</p>}
        {next && <p className="mt-0.5 text-small text-muted @3xl:col-start-1 @3xl:row-start-3">{next}</p>}
        {quiet && <div className="@3xl:col-start-1 @3xl:row-start-4">{quiet}</div>}
      </div>
      {warning && <div className="pointer-events-none relative -mt-1.5 px-5 pb-3.5">{warning}</div>}
    </li>
  );
}

/** "Hadir 4 dari 6 · 66% · sekitar 8 pertemuan lagi sampai 4 Des", as the course page says it; out of reach, the best still possible; without SIX, Edunex's own tally. */
function useFacts(health: AttendanceHealth, lastDay: string | null): ReactNode {
  const t = useT();
  const f = useFormat();
  const { attended, held, left } = health;
  if (attended === null || !held)
    return health.edunexClosed > 0 && (health.countedIn === "edunex" || health.countedIn === "noSix")
      ? t("presence.edunexTally", { recorded: health.edunexRecorded, closed: health.edunexClosed })
      : null;
  const count = left.count;
  const rest =
    health.state === "out"
      ? t("presence.row.best", { best: percent(health.best ?? 0) })
      : count === 0
        ? t("presence.row.leftNone")
        : !lastDay
          ? t("presence.row.leftNoDate", { count })
          : t(left.estimated ? "presence.row.leftAbout" : "presence.row.left", { count, date: f.dayMonth(Date.parse(`${lastDay}T12:00:00+07:00`)) });
  return (
    <Meta>
      {t("presence.row.count", { attended, held, percent: percent(attended, held) })}
      {rest}
    </Meta>
  );
}

const RECORD = {
  six: "presence.record.six",
  both: "presence.record.both",
  edunex: "presence.record.edunex",
  // Nothing recorded anywhere yet: the verdict already says SIX has no count.
  unknown: null,
  noSix: null,
} as const;

/** The class going on now, else the next one on SIX's timetable. */
function useNextClass(health: AttendanceHealth): { session: ClassSession; live: boolean } | null {
  const now = useNow();
  const schedule = useDataset("six.schedule");
  const live = schedule?.find((s) => s.courseCode === health.code && s.start <= now && now < s.end && !isExamActivity(s.activity));
  if (live) return { session: live, live: true };
  return health.left.next ? { session: health.left.next, live: false } : null;
}

/** The next Edunex window, when it counts and asks for something particular (not just opening the course). */
const quietWindow = ({ health, nextWindow }: CourseAttendance) => nextWindow !== null && health.countedIn !== "six" && nextWindow.action.activity !== "course";

/**
 * "Berikutnya Hari ini, 16:00 · 9134 · cukup hadir di kelas", or the class
 * going on now: when, where, and what records it; with that day's Edunex
 * window when it asks for something ("hadir, lalu kumpulkan Tugas 02 Bab II
 * sebelum 23:59").
 */
function useNextLine(item: CourseAttendance, upcoming: { session: ClassSession; live: boolean } | null, withClass: boolean): ReactNode {
  const t = useT();
  const f = useFormat();
  const actionLabel = useActionLabel();
  if (!upcoming) return null;
  const { session, live } = upcoming;
  const { health, nextWindow } = item;
  const record = RECORD[health.countedIn];
  const label = nextWindow ? actionLabel(nextWindow) : "";
  // Mid-sentence, the action starts small: "hadir, lalu kumpulkan …".
  const action = label.charAt(0).toLowerCase() + label.slice(1);
  const what =
    withClass && nextWindow
      ? t(health.countedIn === "both" ? "presence.record.bothDo" : "presence.record.edunexDo", { action, time: f.time(nextWindow.session.closesAt) })
      : record
        ? t(record)
        : "";
  return (
    <Meta>
      {live
        ? t("presence.row.now", { time: f.time(session.end) })
        : t("presence.row.next", { when: `${f.relativeDay(session.start)}, ${f.time(session.start)}` })}
      {session.room ?? ""}
      {what}
    </Meta>
  );
}

/**
 * A quiet line: the Edunex window open now where only SIX counts (optional,
 * with the way to it anyway), else the next window that counts when it asks
 * for something particular and isn't on the next class's day ("Presensi
 * Edunex Jum, 16 Okt, 15:00–23:59: Kumpulkan Tugas 02 Bab II").
 */
function useQuietLine(item: CourseAttendance, optional: OpenWindow | undefined, withClass: boolean): ReactNode {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const actionLabel = useActionLabel();
  if (optional)
    return (
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-small text-muted">
        <span>{t("presence.row.optional", { time: f.time(optional.session.closesAt) })}</span>
        <Button
          size="sm"
          variant="ghost"
          className="pointer-events-auto relative -my-1 h-6 px-1.5"
          icon={<Icons.ArrowUpRight className="size-3.5" />}
          onClick={() => open(optional.action.url)}
        >
          {t("presence.open.record")}
        </Button>
      </p>
    );
  const { nextWindow } = item;
  if (!nextWindow || !quietWindow(item) || withClass) return null;
  const { session } = nextWindow;
  return (
    <p className="mt-0.5 text-small text-muted">
      {t("presence.row.window", {
        when: `${f.relativeDay(session.opensAt)}, ${f.timeRange(session.opensAt, session.closesAt)}`,
        action: actionLabel(nextWindow),
      })}
    </p>
  );
}

/**
 * One warning at most, the most pressing: the target hangs on a class that
 * may not run; the next class clashes with another; it may not run (exam
 * week, holiday); the target is out of reach (a meeting SIX missed is the one
 * thing left to fix); below the target now, the way back. Never "the way
 * back" next to "Jangan absen lagi".
 */
function useWarning(health: AttendanceHealth): ReactNode {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const schedule = useDataset("six.schedule");
  const calendar = useDataset("itb.calendar");
  const student = useDataset("six.student");
  const next = health.left.next;
  const needed = health.needsUncertain ? health.left.upcoming.find((m) => m.uncertain) : undefined;
  if (needed) return <Warning tone="warning">{uncertainText(t, f, needed.start, calendar?.events, health.target)}</Warning>;
  const clash = next ? clashes(next, next.courseCode, schedule ?? [])[0] : undefined;
  if (next && clash)
    return (
      <Warning tone="warning">
        {t("home.today.overlap", { course: clash.courseCode, time: f.timeRange(Math.max(next.start, clash.start), Math.min(next.end, clash.end)) })}
      </Warning>
    );
  const first = health.left.upcoming[0];
  if (next && first?.uncertain && first.session?.id === next.id) return <Warning tone="warning">{uncertainText(t, f, next.start, calendar?.events)}</Warning>;
  // Once lectures are over the verdict says it all, calmly: no warning under it.
  if (health.state === "out")
    return (
      <Warning
        tone="danger"
        action={
          student ? (
            <Button
              size="sm"
              variant="ghost"
              className="pointer-events-auto relative -my-1 h-6 px-1.5 text-danger-fg"
              icon={<Icons.ArrowUpRight className="size-3.5" />}
              onClick={() => open(sixTimetableUrl(student))}
            >
              {t("presence.checkSix")}
            </Button>
          ) : null
        }
      >
        {t("presence.warn.out")}
      </Warning>
    );
  if (health.state === "risk" && health.toRecover)
    return <Warning tone="warning">{t("presence.recover", { count: health.toRecover, target: health.target })}</Warning>;
  return null;
}

/**
 * "Kam 15 Okt masuk masa UTS, …", naming the period from ITB's calendar.
 * `target`: the course's target hangs on that class running.
 */
function uncertainText(
  t: Translate,
  f: Format,
  start: number,
  events: readonly { kind: string; firstDay: string; lastDay: string }[] = [],
  target?: number,
): string {
  const day = wibDay(start);
  const date = `${f.weekdayShort(start)} ${f.dayMonth(start)}`;
  const event = events.find((e) => (e.kind === "uts" || e.kind === "uas" || e.kind === "holiday") && e.firstDay <= day && day <= e.lastDay);
  if (event?.kind === "holiday") return target ? t("presence.warn.neededHoliday", { date, target }) : t("presence.warn.uncertainHoliday", { date });
  const period = t(event?.kind === "uts" ? "presence.period.uts" : event?.kind === "uas" ? "presence.period.uas" : "presence.period.off");
  return target ? t("presence.warn.needed", { date, period, target }) : t("presence.warn.uncertain", { date, period });
}

function Warning({ tone, action, children }: { tone: "warning" | "danger"; action?: ReactNode; children: ReactNode }) {
  return (
    <p className={cx("flex flex-wrap items-start gap-x-2 text-small font-medium", tone === "danger" ? "text-danger-fg" : "text-warning-fg")}>
      <Icons.AlertTriangle className="mt-0.5 size-3.5 shrink-0" weight="bold" />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </p>
  );
}

// ---------------------------------------------------------------- how it's counted

function HowCounted({ lastDay }: { lastDay: string | null }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const student = useDataset("six.student");
  const date = lastDay ? f.dayMonth(Date.parse(`${lastDay}T12:00:00+07:00`)) : "—";
  return (
    <details className="group mt-8">
      <summary className="focus-ring inline-flex cursor-pointer list-none items-center gap-1.5 rounded text-small font-medium text-muted transition-colors duration-150 select-none hover:text-fg [&::-webkit-details-marker]:hidden">
        <Icons.ChevronRight className="size-3.5 transition-transform duration-150 group-open:rotate-90" />
        {t("presence.how")}
      </summary>
      <div className="mt-3 max-w-[72ch] pl-5 text-small leading-[1.6] text-muted">
        <ul className="list-disc space-y-1 pl-4">
          <li>{t("presence.how.six")}</li>
          <li>{t("presence.how.which")}</li>
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
