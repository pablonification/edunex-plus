// What a block on Jadwal says when the Student clicks it, in a popover over
// the grid instead of leaving the screen: when and where, who teaches it,
// what's unusual about it, where attendance counts, a Presence window open
// now, the join link, and the way to the course, exam or Task.
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { type AttendanceHealth, presenceAction } from "../../../core/attendance";
import { wibDay } from "../../../core/course-meetings";
import type { PresenceSession, Task } from "../../../core/models";
import { clockOf, type EdunexMeeting, type OutsideMeeting, type ScheduledClass, type TaskWindow, weekDays } from "../../../core/schedule";
import { isOpenStatus, taskStatus } from "../../../core/tasks";
import { useAttendance } from "../../attendance";
import { budgetLabel, STATE_TONE } from "../../attendance-labels";
import { useTermCourses } from "../../courses";
import { useOpenExternal } from "../../hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../i18n";
import { useNav } from "../../nav";
import { useCourseNames, useExamIds } from "../../schedule-data";
import { useDataset } from "../../store";
import { Button } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { CourseDot, LiveDot, StatusChip } from "../../ui/display";
import { Icons } from "../../ui/icons";

/** What every block on the screen reads besides its own item. */
export interface ScheduleWorld {
  now: number;
  color(code: string): string;
  name(code: string, fallback?: string): string;
  lecturer(code: string): string | null;
  health(code: string): AttendanceHealth | undefined;
  presence(code: string): readonly PresenceSession[];
  tasks: readonly Task[];
  examId(sessionId: string): string | undefined;
}

const WorldContext = createContext<ScheduleWorld | null>(null);

export function ScheduleWorldProvider({ children }: { children: ReactNode }) {
  const courses = useTermCourses();
  const names = useCourseNames();
  const outline = useDataset("edunex.outline");
  const attendance = useAttendance();
  const presence = useDataset("edunex.presence");
  const tasks = useDataset("edunex.tasks");
  const examIds = useExamIds();
  const now = useNow();
  const world = useMemo<ScheduleWorld>(() => {
    const colors = new Map((courses ?? []).map((c) => [c.code, c.color]));
    const health = new Map((attendance?.courses ?? []).map((c) => [c.course.code, c.health]));
    return {
      now,
      color: (code) => colors.get(code) ?? "var(--faint)",
      name: names,
      lecturer: (code) => outline?.[code]?.lecturer ?? null,
      health: (code) => health.get(code),
      presence: (code) => presence?.[code] ?? [],
      tasks: tasks ?? [],
      examId: (id) => examIds.get(id),
    };
  }, [courses, names, outline, attendance, presence, tasks, examIds, now]);
  return <WorldContext.Provider value={world}>{children}</WorldContext.Provider>;
}

export function useWorld(): ScheduleWorld {
  const world = useContext(WorldContext);
  if (!world) throw new Error("ScheduleWorldProvider is missing");
  return world;
}

/** SIX's end time as it is ("12:59"); the grid draws the block to the next 5 minutes. */
export const timeRange = (f: Format, start: number, end: number) => f.timeRange(start, end);

/** The Edunex Presence window of the course open now, that hasn't recorded the Student yet, on the day of `start`. */
function openWindow(world: ScheduleWorld, code: string, start: number): PresenceSession | null {
  return (
    world.presence(code).find((p) => wibDay(p.opensAt) === wibDay(start) && p.opensAt <= world.now && world.now < p.closesAt && !p.recorded?.present) ?? null
  );
}

// ---------------------------------------------------------------- parts

function Head({ code, kind, title, world }: { code: string; kind: string; title: string; world: ScheduleWorld }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-caption font-semibold text-muted">
        <CourseDot color={world.color(code)} className="size-2" />
        <span className="text-fg tabular-nums">{code}</span>
        <span aria-hidden className="text-faint">
          ·
        </span>
        <span>{kind}</span>
      </p>
      <p className="mt-1 text-title leading-snug font-semibold text-balance">{title}</p>
    </div>
  );
}

function Fact({ icon, tone, children }: { icon: ReactNode; tone?: string; children: ReactNode }) {
  return (
    <li className={cx("flex items-start gap-2", tone)}>
      <span className="mt-0.5 flex w-4 shrink-0 justify-center opacity-80">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return <ul className="mt-3 space-y-1.5 text-small">{children}</ul>;
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap items-center justify-end gap-2">{children}</div>;
}

/** Where the course's attendance counts, and what's left: "Kehadiran dihitung di SIX · Boleh absen 2× lagi". */
function AttendanceFact({ code, world }: { code: string; world: ScheduleWorld }) {
  const t = useT();
  const health = world.health(code);
  if (!health || health.countedIn === "unknown") return null;
  return (
    <Fact icon={<Icons.Hand className="size-3.5" />}>
      {t(`schedule.countedIn.${health.countedIn}`)}
      {health.state !== "unknown" && (
        <>
          {" · "}
          <span className={cx("font-semibold", STATE_TONE[health.state])}>{budgetLabel(t, health)}</span>
        </>
      )}
    </Fact>
  );
}

/** An Edunex Presence window open now: until when, and the button that opens the place in Edunex where it counts. */
function OpenPresence({ code, start, world }: { code: string; start: number; world: ScheduleWorld }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const window = openWindow(world, code, start);
  if (!window) return null;
  const action = presenceAction(window, world.tasks);
  return (
    <div className="mt-3 rounded-lg bg-success-bg px-3 py-2.5 text-small text-success-fg">
      <p className="flex items-center gap-2 font-semibold">
        <LiveDot />
        {t("schedule.presenceOpen", { time: f.time(window.closesAt) })}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-caption opacity-90">{t("schedule.presenceOpen.closes", { time: f.countdown(window.closesAt) })}</span>
        <Button size="sm" variant="primary" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(action.url)}>
          {t("schedule.record")}
        </Button>
      </div>
    </div>
  );
}

function JoinButton({ link, primary = false }: { link: string; primary?: boolean }) {
  const t = useT();
  const open = useOpenExternal();
  return (
    <Button size="sm" variant={primary ? "primary" : "secondary"} icon={<Icons.Video className="size-3.5" />} onClick={() => open(link)}>
      {t("schedule.join")}
    </Button>
  );
}

function OpenCourse({ code, primary = false }: { code: string; primary?: boolean }) {
  const t = useT();
  const { go } = useNav();
  return (
    <Button size="sm" variant={primary ? "primary" : "secondary"} onClick={() => go({ screen: "course", code })}>
      {t("schedule.openCourse")}
      <Icons.ArrowRight className="size-3.5" />
    </Button>
  );
}

// ---------------------------------------------------------------- what each block says

/** A class or an exam session on SIX's timetable. */
export function ClassDetails({ item }: { item: ScheduledClass }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const { go } = useNav();
  const { session, exam, moved, extra, overlaps, uncertain } = item;
  const code = session.courseCode;
  const live = session.start <= world.now && world.now < session.end;
  const lecturer = world.lecturer(code);
  const examId = exam ? world.examId(session.id) : undefined;
  const presenceOpen = openWindow(world, code, session.start) !== null;
  return (
    <>
      <Head code={code} kind={session.activity} title={world.name(code, session.courseName)} world={world} />
      <Facts>
        <Fact icon={<Icons.Clock className="size-3.5" />}>
          <span className="tabular-nums">
            {f.dateLong(session.start)} · {timeRange(f, session.start, session.end)}
          </span>
          {exam && <span className="text-muted"> · {t("exam.length", { minutes: Math.round((session.end - session.start) / 60_000) })}</span>}
          {live && <span className="block font-semibold text-success-fg">{t("schedule.live")}</span>}
        </Fact>
        <Fact icon={<Icons.MapPin className="size-3.5" />}>
          {session.room ? (
            <span className={cx(exam && "text-title font-semibold")}>{session.room}</span>
          ) : (
            <span className="text-muted">{t("schedule.room.none")}</span>
          )}
        </Fact>
        {lecturer && <Fact icon={<Icons.User className="size-3.5" />}>{lecturer}</Fact>}
        {uncertain && (
          <Fact icon={<Icons.Info className="size-3.5" />} tone="text-warning-fg">
            <span className="font-semibold">{t("schedule.uncertain.during", { period: periodName(t, uncertain) })}</span> {t("schedule.uncertain.check")}
          </Fact>
        )}
        {moved && <MovedFacts item={item} />}
        {extra && (
          <Fact icon={<Icons.Plus className="size-3.5" />} tone="text-warning-fg">
            {t("schedule.extra")}
          </Fact>
        )}
        {overlaps.map((o) => (
          <Fact key={o.code} icon={<Icons.Overlap className="size-3.5" />} tone="text-warning-fg">
            <span className="font-semibold">{t("schedule.overlapWith", { code: o.code, from: f.time(o.from), to: f.time(o.to) })}</span>
          </Fact>
        ))}
        {!exam && <AttendanceFact code={code} world={world} />}
      </Facts>
      {!exam && <OpenPresence code={code} start={session.start} world={world} />}
      <Actions>
        {exam && examId && (
          <Button size="sm" variant="primary" onClick={() => go({ screen: "exam", examId })}>
            {t("schedule.openExam")}
            <Icons.ArrowRight className="size-3.5" />
          </Button>
        )}
        <OpenCourse code={code} primary={!exam && !presenceOpen} />
      </Actions>
    </>
  );
}

function MovedFacts({ item }: { item: ScheduledClass }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const moved = item.moved!;
  const usual = `${clockOf(moved.usual.start)}–${clockOf(moved.usual.end)}`;
  // Noon WIB of that weekday this week: the same weekday in any time zone.
  const day = f.weekday(Date.parse(`${weekDays(world.now)[moved.usual.weekday]}T12:00:00+07:00`));
  return (
    <>
      {moved.kinds.includes("time") && (
        <Fact icon={<Icons.History className="size-3.5" />} tone="text-warning-fg">
          {t("schedule.moved.time", { usual })}
        </Fact>
      )}
      {moved.kinds.includes("day") && (
        <Fact icon={<Icons.History className="size-3.5" />} tone="text-warning-fg">
          {t("schedule.moved.day", { day, usual })}
        </Fact>
      )}
      {moved.kinds.includes("room") && moved.usual.room && (
        <Fact icon={<Icons.MapPin className="size-3.5" />} tone="text-warning-fg">
          {t("schedule.moved.room", { room: moved.usual.room })}
        </Fact>
      )}
    </>
  );
}

/** A meeting Edunex knows: announced only in Edunex (SIX's timetable for that month doesn't list it), or, without SIX, any. */
export function MeetingDetails({ meeting, notInSix }: { meeting: OutsideMeeting | EdunexMeeting; notInSix: boolean }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const kind = meeting.number !== null ? t("schedule.meeting", { n: meeting.number }) : t("schedule.meetingEdunex");
  const lecturer = world.lecturer(meeting.code);
  return (
    <>
      <Head code={meeting.code} kind={kind} title={world.name(meeting.code)} world={world} />
      <Facts>
        <Fact icon={<Icons.Clock className="size-3.5" />}>
          <span className="tabular-nums">
            {f.dateLong(meeting.start)} · {timeRange(f, meeting.start, meeting.end)}
          </span>
        </Fact>
        <Fact icon={meeting.online ? <Icons.Video className="size-3.5" /> : <Icons.MapPin className="size-3.5" />}>
          {meeting.online ? t("schedule.online") : <span className="text-muted">{notInSix ? t("schedule.room.none") : t("schedule.room.fromSix")}</span>}
        </Fact>
        {lecturer && <Fact icon={<Icons.User className="size-3.5" />}>{lecturer}</Fact>}
        {notInSix && (
          <Fact icon={<Icons.Info className="size-3.5" />} tone="text-warning-fg">
            {t("schedule.notInSix.long")}
          </Fact>
        )}
        <AttendanceFact code={meeting.code} world={world} />
      </Facts>
      <OpenPresence code={meeting.code} start={meeting.start} world={world} />
      <Actions>
        {meeting.link && <JoinButton link={meeting.link} primary />}
        <OpenCourse code={meeting.code} primary={!meeting.link} />
      </Actions>
    </>
  );
}

/** Presence by handing in a Task: hand it in inside the window to be counted present. */
export function WindowDetails({ window }: { window: TaskWindow }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const { go } = useNav();
  const { presence, task, six, code } = window;
  const status = task ? taskStatus(task, world.now) : null;
  return (
    <>
      <Head code={code} kind={t("schedule.window.kind")} title={handInLabel(t, f, window)} world={world} />
      <Facts>
        <Fact icon={<Icons.Clock className="size-3.5" />}>
          <span className="tabular-nums">
            {f.dateLong(presence.opensAt)} · {timeRange(f, presence.opensAt, presence.closesAt)}
          </span>
          <span className="block text-muted">{t("schedule.window.only")}</span>
        </Fact>
        {six && (
          <Fact icon={<Icons.Calendar className="size-3.5" />} tone="text-muted">
            {t("schedule.window.six", { time: timeRange(f, six.start, six.end) })}
          </Fact>
        )}
        {presence.recorded?.present && (
          <Fact icon={<Icons.CheckCircle className="size-3.5" />} tone="text-success-fg">
            {t("schedule.window.recorded")}
          </Fact>
        )}
        {status && !presence.recorded?.present && (
          <Fact icon={<Icons.Upload className="size-3.5" />}>
            <StatusChip status={status} />
          </Fact>
        )}
      </Facts>
      <Actions>
        {task && (
          <Button size="sm" variant={isOpenStatus(status!) ? "primary" : "secondary"} onClick={() => go({ screen: "task", taskId: task.id })}>
            {t("schedule.openTask")}
            <Icons.ArrowRight className="size-3.5" />
          </Button>
        )}
        <OpenCourse code={code} primary={!task} />
      </Actions>
    </>
  );
}

/** "Kumpulkan Tugas 02 Bab II sebelum 23:59 untuk hadir". */
export function handInLabel(t: Translate, f: Format, window: TaskWindow): string {
  const time = f.time(window.presence.closesAt);
  return window.task ? t("schedule.handIn", { task: window.task.title, time }) : t("schedule.handIn.unknown", { time });
}

/** A Task's deadline. */
export function DueDetails({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const world = useWorld();
  const { go } = useNav();
  const status = taskStatus(task, world.now);
  return (
    <>
      <Head code={task.courseCode} kind={t("schedule.due.kind")} title={task.title} world={world} />
      <Facts>
        <Fact icon={<Icons.Clock className="size-3.5" />}>
          <span className="tabular-nums">{f.dueLabel(task.dueAt!)}</span>
          <span className="text-muted"> · {f.fromNow(task.dueAt!)}</span>
        </Fact>
        <Fact icon={<Icons.BookOpen className="size-3.5" />}>{world.name(task.courseCode)}</Fact>
        {status !== "not_started" && (
          <Fact icon={<Icons.Upload className="size-3.5" />}>
            <StatusChip status={status} />
          </Fact>
        )}
      </Facts>
      <Actions>
        <Button size="sm" variant="primary" onClick={() => go({ screen: "task", taskId: task.id })}>
          {t("schedule.openTask")}
          <Icons.ArrowRight className="size-3.5" />
        </Button>
      </Actions>
    </>
  );
}

/** "Masa UTS", "Libur Natal": the period a day falls in, in a few words. */
export function periodName(t: Translate, event: { kind: string; title: string }): string {
  switch (event.kind) {
    case "uts":
    case "uas":
    case "lecture-start":
    case "lecture-end":
    case "drs":
    case "urs":
      return t(`calendar.kind.${event.kind}` as "calendar.kind.uts");
    case "holiday":
      return holidayName(event.title);
    default:
      return event.title;
  }
}

/** "Libur Kuliah dalam rangka Hari Raya Natal" → "Libur Hari Raya Natal": ITB's titles are long. */
function holidayName(title: string): string {
  const match = /^Libur(?:\s+Kuliah)?\s+(?:dalam\s+rangka\s+)?(.+?)\s*\**\)?$/i.exec(title.trim());
  return match ? `Libur ${match[1].replace(/\*+\)?$/, "").trim()}` : title;
}
