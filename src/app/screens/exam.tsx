// Exams in one place (#77): the exam list in Tugas & Ujian and an exam's prep
// page. An exam merges what SIX (in class, with the room), EduNex (its exams,
// take-home UTS Tasks, the course outline) and ITB's calendar (the exam
// weeks) each know, and warns when SIX and EduNex give different dates.
import type { ReactNode } from "react";
import { type Exam, examPassed } from "../../core/exams";
import { edunexCourseUrl } from "../../core/links";
import type { CalendarEvent, Task } from "../../core/models";
import { dayStart, sixTimetableUrl } from "../../core/schedule";
import { edunexTaskUrl, moduleName, taskStatus } from "../../core/tasks";
import { useAttendance } from "../attendance";
import { type TermCourse, useTermCourses } from "../courses";
import { useOpenExternal } from "../hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { useExams } from "../schedule-data";
import { useDataset } from "../store";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card, CourseCode, EmptyState, Skeleton, SourceTag, StatusChip } from "../ui/display";
import { Icons } from "../ui/icons";
import { RichText } from "../ui/rich-text";
import { budgetLabel, STATE_TONE } from "./presence";
import { ExportButton } from "./schedule";

export const ready = true;

function KindBadge({ exam, className }: { exam: Pick<Exam, "kind">; className?: string }) {
  const t = useT();
  return (
    <span className={cx("inline-grid h-6 shrink-0 place-items-center rounded-md bg-danger-bg px-1.5 text-caption font-bold text-danger-fg", className)}>
      {t(`exam.kind.${exam.kind}`)}
    </span>
  );
}

const weekRange = (f: Format, week: CalendarEvent) => `${f.dayMonth(dayStart(week.firstDay))}–${f.dayMonth(dayStart(week.lastDay))}`;
const weekLabel = (t: Translate, f: Format, kind: "UTS" | "UAS", week: CalendarEvent) =>
  t("exam.week", { kind: t(kind === "UTS" ? "calendar.kind.uts" : "calendar.kind.uas"), from: f.dayMonth(dayStart(week.firstDay)), to: f.dayMonth(dayStart(week.lastDay)) });
const dateTime = (f: Format, start: number, end: number) => `${f.weekdayShort(start)} ${f.dayMonth(start)}, ${f.timeRange(start, end)}`;

// ---------------------------------------------------------------- the list (Tugas & Ujian)

/** Exams still to come (or, with `past`, the ones behind the Student), with ITB's exam weeks under them. */
export function ExamList({ past }: { past: boolean }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const exams = useExams();
  if (!exams) return null;
  const shown = exams.filter((exam) => examPassed(exam, now) === past);
  const weeks = (["UTS", "UAS"] as const).flatMap((kind) => {
    const week = exams.find((e) => e.kind === kind && e.week)?.week;
    return week && week.end > now ? [weekLabel(t, f, kind, week)] : [];
  });
  return (
    <section aria-label={t("exams.title")} className="mt-8">
      <h2 className="mb-2 text-small font-semibold text-muted">
        {t("exams.title")} <span className="text-faint tabular-nums">{shown.length}</span>
      </h2>
      {shown.length ? (
        <ExamRows exams={shown} />
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-small text-muted">{t(past ? "exams.nonePast" : "exams.none")}</p>
      )}
      {!past && weeks.length > 0 && (
        <p className="mt-2 flex items-center gap-2 text-caption text-muted">
          <SourceTag source="itb" />
          {weeks.join(" · ")}
        </p>
      )}
    </section>
  );
}

/** Exams as rows, each opening its prep page (in Tugas & Ujian, and on a course's page). */
export function ExamRows({ exams }: { exams: readonly Exam[] }) {
  const courses = useTermCourses();
  return (
    <Card>
      <ul>
        {exams.map((exam, i) => (
          <ExamRow key={exam.id} exam={exam} course={courses?.find((c) => c.code === exam.courseCode)} first={i === 0} last={i === exams.length - 1} />
        ))}
      </ul>
    </Card>
  );
}

function ExamRow({ exam, course, first, last }: { exam: Exam; course: TermCourse | undefined; first: boolean; last: boolean }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const [inClass] = exam.six;
  const [takeHome] = exam.tasks;
  const online = exam.edunex.find((e) => e.start !== null);
  return (
    <li className={cx(!first && "border-t border-line")}>
      <button
        type="button"
        onClick={() => go({ screen: "exam", examId: exam.id })}
        className={cx(
          "focus-ring grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-start gap-4 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-hover",
          first && "rounded-t-xl",
          last && "rounded-b-xl",
        )}
      >
        <KindBadge exam={exam} />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2 text-lead font-medium">
            <CourseCode code={exam.courseCode} color={course?.color ?? "#888"} />
            <span className="truncate">{course?.name ?? inClass?.courseName}</span>
          </span>
          <span className="mt-1 block space-y-0.5 text-small text-muted">
            {inClass && (
              <Line source="six">
                {t("exam.inClass")} · {dateTime(f, inClass.start, inClass.end)}
                {inClass.room && ` · ${inClass.room}`}
              </Line>
            )}
            {takeHome && takeHome.dueAt !== null && (
              <Line source="edunex">
                {t("exam.takeHome")} · {t("exam.due", { when: f.dueLabel(takeHome.dueAt) })}
              </Line>
            )}
            {online && online.start !== null && (
              <Line source="edunex">
                {t("exam.onEdunex")} · {f.dueLabel(online.start)}
              </Line>
            )}
            {exam.at === null && (exam.inOutline || exam.edunex.length > 0) && (
              <Line source="edunex">
                {t("exam.outlineOnly")}
                {exam.week && <span className="text-faint"> · {weekRange(f, exam.week)}</span>}
              </Line>
            )}
            {exam.disagree && (
              <span className="flex items-center gap-1.5 font-semibold text-warning-fg">
                <Icons.AlertTriangle className="size-3.5 shrink-0" />
                {t("exam.disagree")}
              </span>
            )}
          </span>
        </span>
        <span className="pt-0.5 text-right text-caption whitespace-nowrap">
          {exam.at !== null ? <span className="font-medium">{f.fromNow(exam.at)}</span> : <span className="text-faint">{t("exam.noDate")}</span>}
          <span className="mt-1 flex items-center justify-end gap-1 font-medium text-accent-fg">
            {t("exam.prepare")}
            <Icons.ChevronRight className="size-3.5" />
          </span>
        </span>
      </button>
    </li>
  );
}

function Line({ source, children }: { source: "six" | "edunex"; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <SourceTag source={source} className="shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------- the exam page

export function ExamScreen({ examId }: { examId: string }) {
  const t = useT();
  const { go } = useNav();
  const exams = useExams();
  const courses = useTermCourses();
  const back = (
    <button type="button" onClick={() => go({ screen: "tasks" })} className="focus-ring flex items-center gap-1.5 rounded text-small font-medium text-muted hover:text-fg">
      <Icons.ChevronLeft className="size-3.5" />
      {t("nav.tasks")}
    </button>
  );
  if (!exams)
    return (
      <div className="mx-auto max-w-[1080px] px-10 pt-7" aria-busy="true">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="mt-6 h-28 w-full" />
      </div>
    );
  const exam = exams.find((e) => e.id === examId);
  if (!exam)
    return (
      <div className="mx-auto max-w-[1080px] px-10 pt-7">
        {back}
        <div className="mt-6">
          <EmptyState icon={<Icons.GraduationCap className="size-5" />} title={t("exam.notFound")} />
        </div>
      </div>
    );
  const course = courses?.find((c) => c.code === exam.courseCode);
  return <ExamPage exam={exam} others={exams.filter((e) => e !== exam)} course={course} courses={courses ?? []} back={back} />;
}

function ExamPage({ exam, others, course, courses, back }: { exam: Exam; others: Exam[]; course: TermCourse | undefined; courses: TermCourse[]; back: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const open = useOpenExternal();
  const student = useDataset("six.student");
  const color = course?.color ?? "#888";
  const dated = exam.six.length > 0 || exam.tasks.some((task) => task.dueAt !== null) || exam.edunex.some((e) => e.start !== null);

  return (
    <div className="mx-auto grid max-w-[1080px] grid-cols-[minmax(0,1fr)_300px] gap-10 px-10 pt-7 pb-20">
      <article className="min-w-0">
        {back}
        <p className="mt-3 flex items-center gap-2 text-small font-semibold">
          <KindBadge exam={exam} />
          <CourseCode code={exam.courseCode} color={color} />
        </p>
        <h1 className="mt-2 text-display leading-tight font-semibold tracking-[-0.02em]">{course?.name ?? exam.six[0]?.courseName ?? exam.courseCode}</h1>
        <p className="mt-1.5 text-body text-muted">
          {exam.at !== null ? `${f.dateLong(exam.at)} · ${exam.at > now ? f.fromNow(exam.at) : f.relativeDay(exam.at)}` : t("exam.noDate")}
        </p>

        <section className="mt-7" aria-label={t("exam.when")}>
          <h2 className="mb-2.5 text-small font-semibold text-muted">{t("exam.when")}</h2>
          <div className="grid grid-cols-2 gap-3">
            {exam.six.map((session) => (
              <Card key={session.id} className="px-4 py-3.5">
                <CardHead label={t("exam.inClass")} source="six" />
                <p className="mt-1.5 text-title font-semibold tabular-nums">{dateTime(f, session.start, session.end)}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-body text-muted">
                  <Icons.MapPin className="size-3.5 shrink-0" />
                  {session.room ?? t("exam.noRoom")} · {t("exam.length", { minutes: Math.round((session.end - session.start) / 60_000) })}
                </p>
                {session.start > now && <p className="mt-1 text-small text-faint">{f.fromNow(session.start)}</p>}
              </Card>
            ))}
            {exam.edunex.map((e) => (
              <Card key={e.id} className="px-4 py-3.5">
                <CardHead label={t("exam.onEdunex")} source="edunex" />
                <p className="mt-1.5 text-title font-semibold tabular-nums">
                  {e.start !== null ? (e.end !== null ? dateTime(f, e.start, e.end) : f.dueLabel(e.start)) : t("exam.noDate")}
                </p>
                {e.title && <p className="mt-0.5 text-body text-muted">{e.title}</p>}
              </Card>
            ))}
            {exam.tasks.map((task) => (
              <TakeHomeCard key={task.id} task={task} />
            ))}
            {!dated && (
              <Card className="px-4 py-3.5">
                <CardHead label={t("exam.notScheduled")} source={exam.week ? "itb" : "edunex"} />
                <p className="mt-1.5 text-title font-semibold">
                  {exam.week && (exam.kind === "UTS" || exam.kind === "UAS") ? weekLabel(t, f, exam.kind, exam.week) : t("exam.noDate")}
                </p>
                {exam.inOutline && <p className="mt-0.5 text-small text-muted">{t("exam.outlineOnly")}</p>}
              </Card>
            )}
          </div>
          {exam.disagree && (
            <p role="note" className="mt-3 flex items-start gap-2.5 rounded-lg bg-warning-bg px-3.5 py-2.5 text-body text-warning-fg">
              <Icons.AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {t("exam.disagree.long")}
            </p>
          )}
        </section>

        <Covers exam={exam} />

        <section className="mt-8" aria-label={t("exam.official")}>
          <h2 className="mb-2.5 text-small font-semibold text-muted">{t("exam.official")}</h2>
          <div className="flex flex-wrap gap-2">
            {exam.six.length > 0 && student && (
              <Button icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(sixTimetableUrl(student))}>
                {t("exam.openTimetable")}
              </Button>
            )}
            {exam.tasks.map((task) => (
              <Button key={task.id} icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(edunexTaskUrl(task.id))}>
                {exam.tasks.length > 1 ? `${t("exam.openTask")} · ${task.title}` : t("exam.openTask")}
              </Button>
            ))}
            {course?.edunex && (
              <Button icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(edunexCourseUrl(course.edunex!.courseId))}>
                {t("action.openInEdunex")}
              </Button>
            )}
          </div>
        </section>

        {others.length > 0 && (
          <section className="mt-8" aria-label={t("exam.others")}>
            <h2 className="mb-2.5 text-small font-semibold text-muted">{t("exam.others")}</h2>
            <ul className="flex flex-wrap gap-2">
              {others.map((other) => (
                <li key={other.id}>
                  <button
                    type="button"
                    onClick={() => go({ screen: "exam", examId: other.id })}
                    className="focus-ring inline-flex h-8 items-center gap-2 rounded-lg border border-edge bg-surface px-3 text-small font-medium transition-colors duration-150 hover:bg-hover"
                  >
                    <span className="font-bold text-danger-fg">{t(`exam.kind.${other.kind}`)}</span>
                    <CourseCode code={other.courseCode} color={courses.find((c) => c.code === other.courseCode)?.color ?? "#888"} />
                    <span className="text-faint">{other.at !== null ? f.dayMonth(other.at) : t("exam.noDate")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <aside className="space-y-4 self-start">
        <BeforeExam code={exam.courseCode} />
        <ExportButton className="w-full" />
      </aside>
    </div>
  );
}

function CardHead({ label, source }: { label: string; source: "six" | "edunex" | "itb" }) {
  return (
    <p className="flex items-center justify-between gap-2 text-caption font-semibold">
      {label}
      <SourceTag source={source} />
    </p>
  );
}

function TakeHomeCard({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  return (
    <button
      type="button"
      onClick={() => go({ screen: "task", taskId: task.id })}
      className="focus-ring rounded-xl border border-edge bg-surface px-4 py-3.5 text-left transition-colors duration-150 hover:bg-hover"
    >
      <CardHead label={t("exam.takeHome")} source="edunex" />
      <p className="mt-1.5 text-title font-semibold tabular-nums">{task.dueAt !== null ? t("exam.due", { when: f.dueLabel(task.dueAt) }) : t("exam.noDate")}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-small text-muted">
        <StatusChip status={taskStatus(task, now)} />
        <span className="truncate">{task.title}</span>
      </p>
    </button>
  );
}

/** What EduNex says the exam covers: the take-home Task's module and instructions, and the EduNex exams' names. */
function Covers({ exam }: { exam: Exam }) {
  const t = useT();
  const open = useOpenExternal();
  const said = exam.tasks.filter((task) => task.module || task.instructions.trim());
  const named = exam.edunex.filter((e) => e.title);
  return (
    <section className="mt-8" aria-label={t("exam.covers")}>
      <h2 className="mb-2.5 flex items-center justify-between text-small font-semibold text-muted">
        {t("exam.covers")}
        <SourceTag source="edunex" />
      </h2>
      {said.length || named.length ? (
        <Card className="divide-y divide-line">
          {said.map((task) => (
            <div key={task.id} className="px-4 py-3.5">
              {task.module && (
                <p className="text-small font-semibold">
                  {t("task.module", { n: task.module.index })}
                  {moduleName(task.module) && ` · ${moduleName(task.module)}`}
                </p>
              )}
              {task.instructions.trim() && <RichText html={task.instructions} onOpenLink={open} className="mt-1.5" />}
            </div>
          ))}
          {named.map((e) => (
            <p key={e.id} className="px-4 py-3 text-body">
              {e.title}
            </p>
          ))}
        </Card>
      ) : (
        <p className="rounded-xl bg-fill px-4 py-3.5 text-body text-muted">{t("exam.coversUnknown")}</p>
      )}
    </section>
  );
}

function BeforeExam({ code }: { code: string }) {
  const t = useT();
  const attendance = useAttendance();
  const entry = attendance?.courses.find((c) => c.course.code === code);
  if (!entry || entry.health.attended === null) return null;
  const { health } = entry;
  return (
    <Card className="px-4 py-3.5">
      <p className="text-caption font-semibold">{t("exam.before")}</p>
      <p className="mt-3 flex items-start gap-2.5 text-small">
        <Icons.Hand className="mt-0.5 size-4 shrink-0 text-muted" />
        <span>
          <span className="block font-medium">{t("exam.attendance", { attended: health.attended ?? 0, held: health.held ?? 0 })}</span>
          <span className={cx("block font-semibold", STATE_TONE[health.state])}>{budgetLabel(t, health, attendance!.target)}</span>
        </span>
      </p>
    </Card>
  );
}
