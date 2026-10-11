// Presensi (#85): where each course's attendance counts and what's left. On
// top, every EduNex Presence window open now, with the one action that counts
// and a button that opens that place in EduNex (the app never records
// presence itself). Then one card per course, worst first: where it counts,
// SIX's exact count against the target, absences left, the best share still
// reachable, and the next meeting.
import type { ReactNode } from "react";
import { type AttendanceHealth, type AttendanceState, needsAttention, type PresenceActivity } from "../../core/attendance";
import type { StringKey } from "../../core/strings";
import { type CourseAttendance, type OpenWindow, useAttendance } from "../attendance";
import { useOpenExternal } from "../hooks";
import { useFormat, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { useSignIn } from "../shell/source-status";
import { useBridge, useSettings, useStatus } from "../store";
import { Button, IconButton } from "../ui/controls";
import { cx } from "../ui/cx";
import { Bar, Card, CourseCode, EmptyState, LiveDot, Skeleton, SourceTag } from "../ui/display";
import { Icons } from "../ui/icons";
import { toast } from "../ui/overlays";

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

export function PresenceScreen() {
  const t = useT();
  const attendance = useAttendance();
  if (!attendance)
    return (
      <div className="mx-auto max-w-[1000px] px-10 pt-7" aria-busy="true">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-6 h-24 w-full" />
        <Skeleton className="mt-3 h-24 w-full" />
      </div>
    );
  const { courses, open, target } = attendance;
  const count = (state: AttendanceState) => courses.filter((c) => c.health.state === state).length;
  const sorted = [...courses].sort((a, b) => ORDER[a.health.state] - ORDER[b.health.state]);
  return (
    <div className="mx-auto max-w-[1000px] px-10 pt-7 pb-20">
      <header className="flex items-center justify-between gap-6">
        <h1 className="text-display leading-[1.15] font-semibold tracking-[-0.02em]">{t("nav.presence")}</h1>
        <TargetStepper />
      </header>

      {open.length > 0 && (
        <ul className="mt-6 space-y-3">
          {open.map((window) => (
            <OpenPresence key={window.session.id} window={window} />
          ))}
        </ul>
      )}

      {courses.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<Icons.Hand className="size-5" />} title={t("presence.empty")} />
        </div>
      ) : (
        <>
          {courses.some((c) => c.health.state !== "unknown") ? (
            <div className="mt-6 grid grid-cols-4 gap-3">
              <Summary value={count("out")} tone="out" label={t("presence.summary.out", { target })} />
              <Summary value={count("none")} tone="none" label={t("presence.summary.none")} />
              <Summary value={count("risk")} tone="risk" label={t("presence.summary.risk")} />
              <Summary value={count("safe")} tone="safe" label={t("presence.summary.safe")} />
            </div>
          ) : (
            <NoSixCount />
          )}
          <ul className="mt-6 space-y-3">
            {sorted.map((item) => (
              <CourseRow key={item.course.code} item={item} target={target} />
            ))}
          </ul>
        </>
      )}

      <HowCounted lastDay={attendance.lastDay} />
    </div>
  );
}

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
        <span aria-hidden className="text-body font-semibold">−</span>
      </IconButton>
      <span className="inline-flex items-center gap-1.5 px-1.5 text-small font-semibold tabular-nums" aria-live="polite">
        <Icons.Target className="size-3.5 text-muted" />
        {t("presence.target", { value: target })}
      </span>
      <IconButton size="sm" label={t("presence.target.raise")} disabled={target >= 100} onClick={() => set(target + 5)} className="rounded-l-none">
        <span aria-hidden className="text-body font-semibold">+</span>
      </IconButton>
    </div>
  );
}

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

function OpenPresence({ window }: { window: OpenWindow }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const open = useOpenExternal();
  const label = useActionLabel();
  const { session, course, code, health } = window;
  const color = course?.color ?? "var(--muted)";
  const notes = [
    window.action.activity === "assignment" ? session.note : null,
    health?.countedIn === "six" ? t("presence.open.alsoSix") : null,
    window.action.activity === "course" ? t("presence.open.copy") : null,
  ].filter((note) => note !== null);
  return (
    <li className="rounded-xl border border-line bg-fill/60 px-5 py-4" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex items-center gap-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning-bg text-warning-fg">
          <Icons.Hand className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small font-semibold">
            <LiveDot />
            <span>{t("presence.open")}</span>
            <span className="text-faint">·</span>
            <CourseCode code={code} color={color} />
            {session.topic && <span className="truncate font-normal text-muted">· {session.topic}</span>}
          </p>
          <p className="mt-1 text-lead font-semibold">{label(window)}</p>
          {notes.length > 0 && <p className="mt-0.5 text-small text-muted">{notes.join(" ")}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Button variant="primary" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(window.action.url)}>
            {t("presence.openInEdunex")}
          </Button>
          <span className="text-caption text-muted tabular-nums">
            {f.time(session.closesAt)} · {t("course.closesIn", { time: f.countdown(session.closesAt) })}
          </span>
        </div>
      </div>
      <Bar className="mt-3" value={(now - session.opensAt) / Math.max(1, session.closesAt - session.opensAt)} color={color} label={t("presence.open")} />
    </li>
  );
}

/** Before SIX's count: no tallies to add up, so where they come from instead of four zeros. */
function NoSixCount() {
  const t = useT();
  const status = useStatus("six");
  const { signIn, busy } = useSignIn();
  if (status.state !== "signed-out") return null;
  return (
    <Card className="mt-6 flex items-center gap-3.5 px-4 py-3.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-fill text-muted">
        <Icons.Target className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold">{t("presence.noSix")}</p>
        <p className="mt-0.5 text-small text-muted">{t("presence.noSix.hint")}</p>
      </div>
      <Button variant="primary" busy={busy} onClick={() => void signIn("six")}>
        {t("action.signIn")}
      </Button>
    </Card>
  );
}

function Summary({ value, label, tone }: { value: number; label: string; tone: AttendanceState }) {
  return (
    <Card className="px-4 py-3.5">
      <p className={cx("text-[24px] leading-8 font-semibold tabular-nums", value > 0 ? STATE_TONE[tone] : "text-faint")}>{value}</p>
      <p className="text-small font-medium text-muted">{label}</p>
    </Card>
  );
}

export function budgetLabel(t: ReturnType<typeof useT>, health: AttendanceHealth, target: number): string {
  const best = Math.round((health.best ?? 0) * 100);
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

function CourseRow({ item, target }: { item: CourseAttendance; target: number }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const { course, health, presence, exams } = item;
  const { attended, held, left } = health;
  const missed = attended !== null && held !== null ? held - attended : 0;
  const share = attended !== null && held ? Math.round((attended / held) * 100) : null;
  const next = left.next;

  const notes: { tone: "info" | "bad"; text: string }[] = [];
  if (health.countedIn === "six" && health.edunexClosed > 0 && attended !== null && held !== null)
    notes.push({ tone: "info", text: t("presence.note.edunexUnused", { recorded: health.edunexRecorded, closed: health.edunexClosed, attended, held }) });
  if (health.countedIn === "edunex") notes.push({ tone: "info", text: t("presence.note.edunexOnly", { recorded: health.edunexRecorded, closed: health.edunexClosed }) });
  if (presence.some((p) => p.countsBy.some((c) => c.kind === "assignment"))) notes.push({ tone: "info", text: t("presence.note.assignment") });
  for (const exam of exams) notes.push({ tone: "info", text: t("presence.note.exam", { activity: exam.activity, date: `${f.weekdayShort(exam.start)} ${f.dayMonth(exam.start)}` }) });
  if (health.state === "out") notes.push({ tone: "bad", text: t("presence.note.out", { target }) });

  return (
    <li>
      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => go({ screen: "course", code: course.code, tab: "meetings" })}
          className="focus-ring grid w-full grid-cols-[minmax(0,1fr)_240px_200px] items-center gap-6 rounded-xl px-5 py-4 text-left transition-colors duration-150 hover:bg-hover"
        >
          <span className="min-w-0">
            <CourseCode code={course.code} color={course.color} className="text-small" />
            <span className="mt-1 block truncate text-body font-semibold">{course.name}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
              {health.countedIn === "unknown" ? (
                <span>{t("presence.countedIn.unknown")}</span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  {t("presence.countedIn")}
                  {health.countedIn !== "edunex" && <SourceTag source="six" />}
                  {health.countedIn !== "six" && <SourceTag source="edunex" />}
                </span>
              )}
              {next && (
                <span className="truncate">
                  · {t("presence.next", { when: `${f.relativeDay(next.start)}, ${f.time(next.start)}` })}
                  {next.room ? ` · ${next.room}` : ""}
                </span>
              )}
            </span>
          </span>

          <span>
            {attended !== null && held !== null ? (
              <>
                <Dots attended={attended} missed={missed} left={left.count} estimated={left.estimated} />
                <span className="mt-1.5 block text-caption text-muted tabular-nums">
                  {t(left.estimated ? "presence.tallyAbout" : "presence.tally", { attended, missed, left: left.count })}
                </span>
              </>
            ) : null}
          </span>

          <span className="text-right">
            {share !== null && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <SourceTag source="six" />
                  <span className="text-[20px] leading-7 font-semibold tabular-nums">{share}%</span>
                </span>
                <TargetBar share={share} target={target} color={course.color} label={t("presence.share", { value: share, target })} />
              </>
            )}
            <span className={cx("block text-small font-semibold", share !== null && "mt-1", STATE_TONE[health.state])}>{budgetLabel(t, health, target)}</span>
            {health.state !== "out" && health.state !== "unknown" && health.best !== null && (
              <span className="block text-caption text-faint">{t("presence.best", { value: Math.round(health.best * 100) })}</span>
            )}
            {health.toRecover !== null && health.toRecover > 0 && (
              <span className="block text-caption text-faint">{t("presence.recover", { target, count: health.toRecover })}</span>
            )}
          </span>
        </button>
        {notes.length > 0 && (
          <ul className="space-y-1.5 border-t border-line px-5 py-3 text-small leading-[1.5]">
            {notes.map((note) => (
              <li key={note.text} className="flex items-start gap-2">
                <span aria-hidden className={cx("mt-[7px] size-1.5 shrink-0 rounded-full", note.tone === "bad" ? "bg-danger-fg" : "bg-faint")} />
                <span className="text-muted">{note.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </li>
  );
}

/** One mark per meeting: attended (square), not counted (round), still to come (outline, dashed when estimated). */
function Dots({ attended, missed, left, estimated }: { attended: number; missed: number; left: number; estimated: boolean }) {
  const t = useT();
  const marks: ReactNode[] = [];
  for (let i = 0; i < attended; i++) marks.push(<span key={`a${i}`} className="h-3 w-2.5 rounded-[3px] bg-live" />);
  for (let i = 0; i < missed; i++) marks.push(<span key={`m${i}`} className="h-3 w-2.5 rounded-full bg-danger-fg" />);
  for (let i = 0; i < left; i++) marks.push(<span key={`l${i}`} className={cx("h-3 w-2.5 rounded-[3px] border border-track", estimated && "border-dashed")} />);
  return (
    <span role="img" aria-label={t("presence.meetings")} className="flex flex-wrap gap-[3px]">
      {marks}
    </span>
  );
}

/** SIX's share with a marker at the target. */
function TargetBar({ share, target, color, label }: { share: number; target: number; color: string; label: string }) {
  return (
    <span className="relative mt-1 ml-auto block w-[120px]">
      <Bar value={share / 100} color={color} label={label} />
      <span aria-hidden className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-fg" style={{ left: `calc(${target}% - 1px)` }} />
    </span>
  );
}

function HowCounted({ lastDay }: { lastDay: string | null }) {
  const t = useT();
  const f = useFormat();
  const date = lastDay ? f.dayMonth(Date.parse(`${lastDay}T12:00:00+07:00`)) : "—";
  return (
    <section className="mt-8 rounded-xl bg-fill px-5 py-4 text-small leading-[1.6] text-muted">
      <h2 className="font-semibold text-fg">{t("presence.how")}</h2>
      <ul className="mt-1.5 list-disc space-y-1 pl-4">
        <li>{t("presence.how.six")}</li>
        <li>{t("presence.how.left", { date })}</li>
        <li>{t("presence.how.target")}</li>
        <li>{t("presence.how.check")}</li>
      </ul>
    </section>
  );
}
