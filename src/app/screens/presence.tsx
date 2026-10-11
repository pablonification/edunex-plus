// Presensi (#85): am I in trouble anywhere? The header answers in one line
// ("3 mata kuliah perlu perhatianmu", "Semua aman"). Then any Edunex Presence
// window open now, action first, with a countdown. Then every course, worst
// first: its meetings (SIX's tally, and each meeting to come with its date),
// one big status sentence ("Boleh absen 2× lagi", "Jangan absen lagi", "80%
// tak terkejar") with the share small under it, and a note with the way back
// or what to do. The summary tiles filter the list. The target is the
// Student's, for every course.
import { type CSSProperties, type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { type AttendanceHealth, type AttendanceState, needsAttention, percent, type PresenceActivity, type UpcomingMeeting } from "../../core/attendance";
import { clashes } from "../../core/course-meetings";
import type { PresenceSession } from "../../core/models";
import { sixTimetableUrl } from "../../core/schedule";
import type { StringKey } from "../../core/strings";
import { type CourseAttendance, type OpenWindow, useAttendance } from "../attendance";
import { useOpenExternal } from "../hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { useCourseNames } from "../schedule-data";
import { useSignIn } from "../shell/source-status";
import { useBridge, useDataset, useSettings, useStatus } from "../store";
import { Button, IconButton } from "../ui/controls";
import { cx } from "../ui/cx";
import { CourseCode, EmptyState, LiveDot, Skeleton } from "../ui/display";
import { Icons } from "../ui/icons";
import { Page, PageHeader } from "../ui/layout";
import { CountdownBar, type MeterTone, ShareMeter } from "../ui/meter";
import { Popover, toast, Tooltip } from "../ui/overlays";

export const ready = true;

/** Courses at risk: one absence left or fewer, or the target out of reach. */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  const attendance = useAttendance();
  const value = attendance?.courses.filter((c) => needsAttention(c.health.state)).length ?? 0;
  return value > 0 ? { value, tone: "warning" } : null;
}

const ORDER: Record<AttendanceState, number> = { out: 0, none: 1, risk: 2, safe: 3, unknown: 4 };

export const STATE_TONE: Record<AttendanceState, string> = {
  out: "text-danger-fg",
  none: "text-warning-fg",
  risk: "text-warning-fg",
  safe: "text-success-fg",
  unknown: "text-faint",
};

const METER_TONE: Record<AttendanceState, MeterTone> = { out: "danger", none: "warning", risk: "warning", safe: "success", unknown: "neutral" };

type Filter = Exclude<AttendanceState, "unknown">;
const FILTERS: readonly Filter[] = ["out", "none", "risk", "safe"];

export function PresenceScreen() {
  const t = useT();
  const attendance = useAttendance();
  const [filter, setFilter] = useState<Filter | null>(null);
  if (!attendance) return <Loading />;
  const { courses, open, target } = attendance;
  const known = courses.some((c) => c.health.state !== "unknown");
  const count = (state: AttendanceState) => courses.filter((c) => c.health.state === state).length;
  const shown = [...courses].filter((c) => !filter || c.health.state === filter).sort((a, b) => ORDER[a.health.state] - ORDER[b.health.state]);

  return (
    <Page>
      <PageHeader title={t("nav.presence")} description={<Answer courses={courses} known={known} />} actions={<TargetControl target={target} />} />

      {open.length > 0 && (
        <section aria-label={t("presence.open.title")} className="mb-8 space-y-3">
          {open.map((window) => (
            <OpenPresence key={window.session.id} window={window} />
          ))}
        </section>
      )}

      {courses.length === 0 ? (
        <EmptyState icon={<Icons.Hand className="size-5" />} title={t("presence.empty")} />
      ) : (
        <>
          {known ? (
            <div role="group" aria-label={t("presence.filter")} className="mb-4 grid grid-cols-4 gap-3">
              {FILTERS.map((state) => (
                <SummaryTile key={state} state={state} value={count(state)} target={target} selected={filter === state} onToggle={() => setFilter(filter === state ? null : state)} />
              ))}
            </div>
          ) : (
            <NoSixCount primary={open.length === 0} />
          )}
          {filter && (
            <p className="mb-2 flex items-center justify-between text-small text-muted">
              <span>{t("presence.filtered", { count: shown.length, label: t(`presence.summary.${filter}`, { target }) })}</span>
              <Button size="sm" variant="ghost" onClick={() => setFilter(null)}>
                {t("presence.showAll", { count: courses.length })}
              </Button>
            </p>
          )}
          <ul aria-label={t("presence.courses")} className="overflow-hidden rounded-xl border border-edge bg-surface shadow-card [&>li+li]:border-t [&>li+li]:border-line">
            {shown.map((item, index) => (
              <CourseRow key={item.course.code} item={item} target={target} lastDay={attendance.lastDay} index={index} />
            ))}
          </ul>
        </>
      )}

      <HowCounted lastDay={attendance.lastDay} />
    </Page>
  );
}

function Loading() {
  return (
    <Page>
      <div aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-5 w-64" />
        <div className="mt-8 grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="mt-4 h-80 w-full rounded-xl" />
      </div>
    </Page>
  );
}

/** The answer, first: how many courses need the Student, or that all is well. */
function Answer({ courses, known }: { courses: CourseAttendance[]; known: boolean }) {
  const t = useT();
  if (!known) return <span>{t("presence.answer.noSix")}</span>;
  const attention = courses.filter((c) => needsAttention(c.health.state)).length;
  const out = courses.some((c) => c.health.state === "out");
  if (!attention)
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-success-fg">
        <Icons.CheckCircle className="size-4" weight="bold" />
        {t("presence.answer.fine")}
      </span>
    );
  return (
    <span className={cx("inline-flex items-center gap-1.5 font-medium", out ? "text-danger-fg" : "text-warning-fg")}>
      <Icons.AlertTriangle className="size-4" weight="bold" />
      {t("presence.answer.attention", { count: attention })}
    </span>
  );
}

// ---------------------------------------------------------------- the target

/** The Student's attendance target, 50–100% in steps of 5 (also in Settings). */
export function TargetStepper() {
  const t = useT();
  const bridge = useBridge();
  const { attendanceTarget: target } = useSettings();
  const set = (value: number) =>
    void bridge.invoke("settings.update", { attendanceTarget: Math.max(50, Math.min(100, value)) }).catch((error: unknown) => toast(t("error.action", { message: String(error) }), "danger"));
  return (
    <div className="inline-flex h-8 shrink-0 items-center rounded-lg border border-edge bg-surface">
      <IconButton size="sm" label={t("presence.target.lower")} disabled={target <= 50} onClick={() => set(target - 5)} className="rounded-r-none">
        <Icons.Minus className="size-3.5" />
      </IconButton>
      <span className="min-w-12 px-1 text-center text-small font-semibold tabular-nums" aria-live="polite">
        {target}%
      </span>
      <IconButton size="sm" label={t("presence.target.raise")} disabled={target >= 100} onClick={() => set(target + 5)} className="rounded-l-none">
        <Icons.Plus className="size-3.5" />
      </IconButton>
    </div>
  );
}

/** "Target kehadiran 80%": one target for every course, set here or in Settings, said to be global. */
function TargetControl({ target }: { target: number }) {
  const t = useT();
  const bridge = useBridge();
  return (
    <Popover
      label={t("settings.attendance.target")}
      align="end"
      className="w-[300px] p-4"
      trigger={
        <Button icon={<Icons.Target className="size-3.5" />}>
          {t("presence.target.button", { value: target })}
        </Button>
      }
    >
      <p className="text-title font-semibold">{t("settings.attendance.target")}</p>
      <p className="mt-1 text-small text-muted">{t("presence.target.global")}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <TargetStepper />
        {target !== 80 && (
          <Button size="sm" variant="ghost" onClick={() => void bridge.invoke("settings.update", { attendanceTarget: 80 }).catch(() => undefined)}>
            {t("presence.target.reset")}
          </Button>
        )}
      </div>
      <p className="mt-3 text-caption text-faint">{t("settings.attendance.targetHint")}</p>
    </Popover>
  );
}

// ---------------------------------------------------------------- a Presence window open now

const ACTION_KEY: Record<PresenceActivity, StringKey> = {
  course: "presence.action.course",
  module: "presence.action.module",
  thread: "presence.action.thread",
  assignment: "presence.action.assignment",
  exam: "presence.action.exam",
  vicon: "presence.action.vicon",
  crs: "presence.action.crs",
  other: "presence.action.other",
};

/** The action that counts in a Presence window, as a short instruction. */
export function useActionLabel(): (window: Pick<OpenWindow, "action">) => string {
  const t = useT();
  return ({ action }) =>
    action.activity === "assignment" && !action.task ? t("presence.action.assignmentUnknown") : t(ACTION_KEY[action.activity], { task: action.task?.title ?? "" });
}

const DO_KEY: Record<PresenceActivity, StringKey> = {
  course: "presence.do.course",
  module: "presence.do.module",
  thread: "presence.do.thread",
  assignment: "presence.do.assignment",
  exam: "presence.do.exam",
  vicon: "presence.do.vicon",
  crs: "presence.do.crs",
  other: "presence.do.other",
};

/** "Presensi PL3002 dibuka sampai 09:30" / what to do, and the way to do it, with the time left. Where only SIX counts,
 *  the same story as Beranda: being in class is enough, so the window is optional and its button quiet. */
function OpenPresence({ window }: { window: OpenWindow }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const open = useOpenExternal();
  const { go } = useNav();
  const { session, code, health, action } = window;
  const task = action.activity === "assignment" ? action.task : null;
  const noSix = health?.countedIn === "noSix";
  // Quiet where SIX counts (optional) and without SIX (worth doing just in case, but nobody can say it counts).
  // A Task to hand in keeps its own words: it's worth doing anyway.
  const optional = health?.countedIn === "six" || noSix;
  const what = noSix && !task
    ? t("presence.open.noSix")
    : optional && !noSix
    ? t("presence.open.optional")
    : action.activity === "assignment" && !task
      ? t("presence.do.assignmentUnknown")
      : t(DO_KEY[action.activity], { task: task?.title ?? "" });
  return (
    <div className="rounded-2xl border border-edge bg-raised px-5 py-4 shadow-raised">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-title font-semibold">
            <LiveDot />
            {t("presence.open.headline", { code, time: f.time(session.closesAt) })}
          </p>
          <p className="mt-1 text-body text-muted">
            {what}
          </p>
        </div>
        {task ? (
          <Button variant={optional ? "secondary" : "primary"} onClick={() => go({ screen: "task", taskId: task.id })}>
            {t("presence.open.task")}
            <Icons.ArrowRight className="size-3.5" />
          </Button>
        ) : (
          <Button variant={optional ? "secondary" : "primary"} icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(action.url)}>
            {t("presence.open.record")}
          </Button>
        )}
      </div>
      <CountdownBar className="mt-3" opensAt={session.opensAt} closesAt={session.closesAt} now={now} label={t("presence.open.left", { time: f.countdown(session.closesAt) })} />
    </div>
  );
}

// ---------------------------------------------------------------- the summary

function SummaryTile({ state, value, target, selected, onToggle }: { state: Filter; value: number; target: number; selected: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      aria-label={`${value} · ${t(`presence.summary.${state}`, { target })}`}
      aria-pressed={selected}
      disabled={value === 0}
      onClick={onToggle}
      className={cx(
        "focus-ring rounded-xl border px-4 py-3 text-left transition-colors duration-150 disabled:pointer-events-none",
        selected ? "border-accent bg-info-bg/50 shadow-card" : "border-edge bg-surface shadow-card hover:bg-hover",
        value === 0 && "border-dashed bg-transparent shadow-none",
      )}
    >
      <span className={cx("block text-[24px] leading-8 font-semibold tabular-nums", value > 0 ? STATE_TONE[state] : "text-faint")}>{value}</span>
      <span className={cx("block text-small font-medium", value > 0 ? "text-muted" : "text-faint")}>{t(`presence.summary.${state}`, { target })}</span>
    </button>
  );
}

/** Before SIX's count: no tallies to add up, so what SIX unlocks instead of four zeros. */
function NoSixCount({ primary }: { primary: boolean }) {
  const t = useT();
  const status = useStatus("six");
  const { signIn, busy } = useSignIn();
  if (status.state !== "signed-out") return null;
  return (
    <div className="mb-4 flex items-center gap-3.5 rounded-xl border border-edge bg-surface px-4 py-3.5 shadow-card">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-fill text-muted">
        <Icons.Lock className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold">{t("presence.noSix")}</p>
        <p className="mt-0.5 text-small text-muted">{t("presence.noSix.hint")}</p>
      </div>
      <Button variant={primary ? "primary" : "secondary"} busy={busy} onClick={() => void signIn("six")}>
        {t("presence.signInSix")}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- a course

export function budgetLabel(t: ReturnType<typeof useT>, health: AttendanceHealth, target: number): string {
  const best = percent(health.best ?? 0);
  switch (health.state) {
    case "unknown":
      return t("presence.budget.unknown");
    case "out":
      return t("presence.budget.out", { target, best });
    case "none":
      return t("presence.budget.none");
    default:
      return t("presence.budget.safe", { count: health.absencesLeft ?? 0 });
  }
}

/** The one big sentence: "Boleh absen 2× lagi", "Jangan absen lagi", "80% tak terkejar". */
function statusSentence(t: Translate, health: AttendanceHealth, target: number): string {
  switch (health.state) {
    case "out":
      return t("presence.status.out", { target });
    case "none":
      return t("presence.status.none");
    case "unknown":
      return t("presence.budget.unknown");
    default:
      return t("presence.status.left", { count: health.absencesLeft ?? 0 });
  }
}

function CourseRow({ item, target, lastDay, index }: { item: CourseAttendance; target: number; lastDay: string | null; index: number }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const name = useCourseNames();
  const { course, health, presence, exams } = item;
  const { attended, held } = health;
  const share = attended !== null && held ? percent(attended, held) : null;
  const best = health.best !== null ? percent(health.best) : null;
  const until = lastDay && (health.state === "safe" || health.state === "risk") ? f.dayMonth(Date.parse(`${lastDay}T12:00:00+07:00`)) : null;
  const notes = useNotes(item, target);
  // Signed out of SIX, with nothing of SIX's kept: the card above says once that the count is in SIX; no row
  // claims SIX has none ("Belum ada hitungan SIX") or repeats where it counts.
  const sixOut = useStatus("six").state === "signed-out" && held === null;
  const sentence = sixOut ? null : statusSentence(t, health, target);
  const label = [course.code, name(course.code, course.name), sentence].filter(Boolean).join(" · ");

  return (
    <li className="group relative motion-safe:stagger has-[>button:hover]:bg-hover" style={{ "--i": index } as CSSProperties}>
      {/* The whole row opens the course's meetings; the meeting squares sit above it. */}
      <button type="button" aria-label={label} onClick={() => go({ screen: "course", code: course.code, tab: "meetings" })} className="absolute inset-0 z-0 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-[-2px] focus-visible:outline-focus" />
      <div className="pointer-events-none relative grid grid-cols-[minmax(0,1fr)_auto_220px] items-center gap-x-6 px-5 py-4">
        <div className="min-w-0">
          <CourseCode code={course.code} color={course.color} className="text-small" />
          <p className="mt-0.5 line-clamp-2 text-body font-semibold">{name(course.code, course.name)}</p>
          <p className="mt-1 text-small text-muted">
            {!(sixOut && health.countedIn === "noSix") && <Where health={health} />}
            <Next health={health} />
          </p>
        </div>

        <div className="pointer-events-auto min-w-0">
          {attended !== null && held !== null && held > 0 ? (
            <MeetingStrip health={health} />
          ) : presence.length > 0 ? (
            <EdunexStrip presence={presence} />
          ) : null}
        </div>

        <div className="min-w-0 text-right">
          {sentence && (
            <p className={cx(health.state === "unknown" ? "text-small font-medium" : "text-title leading-snug font-semibold text-balance", STATE_TONE[health.state])}>
              {sentence}
            </p>
          )}
          {share !== null ? (
            <>
              <p className="mt-0.5 text-small text-muted tabular-nums">
                {health.state === "out"
                  ? t("presence.share.out", { share, best: best ?? 0 })
                  : until
                    ? t("presence.share.until", { share, attended: attended!, held: held!, date: until })
                    : t("presence.share", { share, attended: attended!, held: held! })}
              </p>
              <ShareMeter
                className="mt-2 ml-auto w-[150px]"
                share={share}
                best={best}
                target={target}
                tone={METER_TONE[health.state]}
                label={t("presence.meter", { share, target, best: best ?? share })}
              />
            </>
          ) : health.countedIn === "edunex" || (health.countedIn === "noSix" && health.edunexClosed > 0) ? (
            <p className="mt-0.5 text-small text-muted tabular-nums">{t("presence.edunexTally", { recorded: health.edunexRecorded, closed: health.edunexClosed })}</p>
          ) : null}
        </div>
      </div>
      {(notes.length > 0 || exams.length > 0) && (
        <ul className="pointer-events-none relative space-y-1 px-5 pb-3.5 pl-[42px] text-small leading-[1.5] text-muted">
          {notes.map((note) => (
            <li key={note.key} className={cx("flex items-start gap-2", note.tone === "bad" && "text-danger-fg", note.tone === "way" && "text-fg", note.tone === "clash" && "font-medium text-warning-fg")}>
              <span className="mt-[3px] shrink-0">{note.icon}</span>
              <span className="min-w-0">{note.text}</span>
              {note.action && <span className="pointer-events-auto ml-auto shrink-0">{note.action}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** "Dihitung di SIX": where the course's attendance counts, in words. */
function Where({ health }: { health: AttendanceHealth }) {
  const t = useT();
  return <span>{t(`presence.where.${health.countedIn}`)}</span>;
}

/** "· Berikutnya Kam, 15 Okt, 08:00 · R.SG PWK LT.6", saying so when SIX's next meeting falls in an exam week. */
function Next({ health }: { health: AttendanceHealth }) {
  const t = useT();
  const f = useFormat();
  const next = health.left.next;
  if (!next) return null;
  const uncertain = health.left.upcoming[0]?.uncertain && health.left.upcoming[0].session?.id === next.id;
  return (
    <>
      {" · "}
      {t("presence.next", { when: `${f.relativeDay(next.start)}, ${f.time(next.start)}` })}
      {next.room ? ` · ${next.room}` : ""}
      {uncertain && <span className="font-medium text-warning-fg"> · {t("presence.next.uncertain")}</span>}
    </>
  );
}

interface Note {
  key: string;
  text: ReactNode;
  icon: ReactNode;
  tone?: "bad" | "way" | "clash";
  action?: ReactNode;
}

/** What to know under a course: the way back to the target, what to do when it's out of reach, how Edunex's record relates to SIX's. */
function useNotes(item: CourseAttendance, target: number): Note[] {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const student = useDataset("six.student");
  const schedule = useDataset("six.schedule");
  const { health, presence, exams } = item;
  const { attended, held } = health;
  const notes: Note[] = [];
  const dot = (tone: "bad" | "info" | "way") => (
    <span aria-hidden className={cx("mt-[5px] block size-1.5 rounded-full", tone === "bad" ? "bg-danger-fg" : tone === "way" ? "bg-warning-fg" : "bg-faint")} />
  );
  // The next meeting overlaps another course's class: said first (it's a choice to make soon), in Jadwal's words, amber.
  const next = health.left.next;
  const clash = next ? clashes(next, next.courseCode, schedule ?? [])[0] : undefined;
  if (next && clash)
    notes.push({
      key: "clash",
      tone: "clash",
      icon: dot("way"),
      text: t("schedule.overlapWith", { code: clash.courseCode, from: f.time(Math.max(next.start, clash.start)), to: f.time(Math.min(next.end, clash.end)) }),
    });
  if (health.toRecover !== null && health.toRecover > 0) notes.push({ key: "recover", tone: "way", icon: dot("way"), text: t("presence.recover", { target, count: health.toRecover }) });
  if (health.state === "out")
    notes.push({
      key: "out",
      tone: "bad",
      icon: dot("bad"),
      text: t("presence.note.out", { target }),
      action: student ? (
        <Button size="sm" variant="ghost" className="-my-1 h-6 px-2 text-danger-fg" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(sixTimetableUrl(student))}>
          {t("presence.checkSix")}
        </Button>
      ) : null,
    });
  if (health.countedIn === "six" && health.edunexClosed > 0 && attended !== null && held !== null)
    notes.push({ key: "edunex", icon: dot("info"), text: t("presence.note.edunexUnused", { recorded: health.edunexRecorded, closed: health.edunexClosed, attended, held }) });
  if (presence.some((p) => p.countsBy.some((c) => c.kind === "assignment"))) notes.push({ key: "assignment", icon: dot("info"), text: t("presence.note.assignment") });
  for (const exam of exams) notes.push({ key: `exam${exam.id}`, icon: dot("info"), text: t("presence.note.exam", { activity: exam.activity, date: `${f.weekdayShort(exam.start)} ${f.dayMonth(exam.start)}` }) });
  return notes;
}

// ---------------------------------------------------------------- the meetings strip

/**
 * One square per meeting of the term. Past meetings carry SIX's tally,
 * attended then missed (SIX gives only the totals, never which meeting), so
 * they're grouped, not dated; each meeting to come shows its date, dashed
 * when it's the weekly slot carried on, hatched when it falls in an exam week.
 */
function MeetingStrip({ health }: { health: AttendanceHealth }) {
  const t = useT();
  const f = useFormat();
  const attended = health.attended ?? 0;
  const held = health.held ?? 0;
  const missed = held - attended;
  const upcoming = health.left.upcoming;
  const squares: Square[] = [
    ...Array.from({ length: attended }, (_, i) => ({ key: `a${i}`, kind: "attended" as const, tip: t("presence.square.attended", { attended, held }) })),
    ...Array.from({ length: missed }, (_, i) => ({ key: `m${i}`, kind: "missed" as const, tip: t("presence.square.missed", { missed, held }) })),
    ...upcoming.map((m, i) => ({ key: `u${i}`, kind: m.uncertain ? ("uncertain" as const) : m.estimated ? ("estimated" as const) : ("coming" as const), tip: upcomingTip(t, f, m) })),
  ];
  const label = t(health.left.estimated ? "presence.strip.about" : "presence.strip", { attended, missed, left: upcoming.length });
  return <Strip squares={squares} label={label} gapAfter={[attended - 1, held - 1]} />;
}

/** Without SIX's count: Edunex's Presence windows, each with its date and what Edunex recorded. */
function EdunexStrip({ presence }: { presence: readonly PresenceSession[] }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const sorted = [...presence].sort((a, b) => a.opensAt - b.opensAt);
  const squares: Square[] = sorted.map((p) => {
    const when = `${f.weekdayShort(p.opensAt)} ${f.dayMonth(p.opensAt)}`;
    if (p.recorded?.present) return { key: String(p.id), kind: "attended", tip: t("presence.square.edunexPresent", { when }) };
    if (p.closesAt <= now) return { key: String(p.id), kind: "unmarked", tip: t("presence.square.edunexUnmarked", { when }) };
    if (p.opensAt <= now) return { key: String(p.id), kind: "open", tip: t("presence.square.edunexOpen", { when, time: f.time(p.closesAt) }) };
    return { key: String(p.id), kind: "coming", tip: t("presence.square.edunexComing", { when }) };
  });
  const past = sorted.filter((p) => p.closesAt <= now).length;
  return <Strip squares={squares} label={t("presence.strip.edunex", { recorded: sorted.filter((p) => p.recorded?.present).length, closed: past, left: sorted.length - past })} gapAfter={[past - 1]} />;
}

function upcomingTip(t: Translate, f: Format, meeting: UpcomingMeeting): string {
  const when = `${f.weekdayShort(meeting.start)} ${f.dayMonth(meeting.start)}, ${f.time(meeting.start)}`;
  if (meeting.uncertain) return t("presence.square.uncertain", { when });
  if (meeting.estimated) return t("presence.square.estimated", { when });
  return meeting.session?.room ? t("presence.square.comingRoom", { when, room: meeting.session.room }) : t("presence.square.coming", { when });
}

interface Square {
  key: string;
  kind: "attended" | "missed" | "coming" | "estimated" | "uncertain" | "unmarked" | "open";
  tip: string;
}

const SQUARE: Record<Square["kind"], string> = {
  attended: "bg-live",
  missed: "bg-danger-fg",
  coming: "border border-track bg-surface",
  estimated: "border border-dashed border-track bg-surface",
  uncertain: "border border-dashed border-warning-fg/70 bg-warning-bg",
  unmarked: "bg-track",
  open: "bg-accent",
};

/** Squares with their own tooltip each, one tab stop: the arrow keys move along. */
function Strip({ squares, label, gapAfter }: { squares: Square[]; label: string; gapAfter: number[] }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const [focus, setFocus] = useState(0);
  const move = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "Home" ? -index : event.key === "End" ? squares.length - 1 - index : 0;
    if (!step) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(squares.length - 1, index + step));
    setFocus(next);
    refs.current[next]?.focus();
  };
  return (
    <div role="list" aria-label={label} className="flex max-w-[260px] flex-wrap gap-y-1">
      {squares.map((square, i) => (
        <Tooltip key={square.key} content={square.tip} side="top">
          <span
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="listitem"
            aria-label={square.tip}
            tabIndex={i === focus ? 0 : -1}
            onFocus={() => setFocus(i)}
            onKeyDown={(event) => move(event, i)}
            className={cx("focus-ring mr-[3px] h-3.5 w-3 shrink-0 rounded-[3px] transition-transform duration-150 hover:scale-125", SQUARE[square.kind], gapAfter.includes(i) && i < squares.length - 1 && "mr-2")}
          />
        </Tooltip>
      ))}
    </div>
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
    <section aria-labelledby="presence-how" className="mt-10 rounded-xl bg-sunken px-5 py-4 text-small leading-[1.6] text-muted">
      <h2 id="presence-how" className="text-body font-semibold text-fg">
        {t("presence.how")}
      </h2>
      <ul className="mt-1.5 list-disc space-y-1 pl-4">
        <li>{t("presence.how.six")}</li>
        <li>{t("presence.how.which")}</li>
        <li>{t("presence.how.left", { date })}</li>
        <li>{t("presence.how.target")}</li>
        <li>{t("presence.how.check")}</li>
      </ul>
      {student && (
        <Button size="sm" className="mt-3" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(sixTimetableUrl(student))}>
          {t("presence.openSix")}
        </Button>
      )}
    </section>
  );
}

