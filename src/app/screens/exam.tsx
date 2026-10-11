// Exams in one place (#77): the exam rows in Tugas & Ujian and on a course,
// and an exam's prep page. An exam merges what SIX (in class, with the room),
// Edunex (its exams, take-home UTS Tasks, the course outline) and ITB's
// calendar (the exam weeks) each know, and says plainly, with a next step,
// when SIX and Edunex give different dates.
import { type Exam, examKind, examPassed } from "../../core/exams";
import { edunexCourseUrl } from "../../core/links";
import type { CalendarEvent, Task } from "../../core/models";
import { dayStart, sixTimetableUrl } from "../../core/schedule";
import { edunexTaskUrl, isOpenStatus, taskStatus } from "../../core/tasks";
import { useAttendance } from "../attendance";
import { type TermCourse, useTermCourses } from "../courses";
import { useOpenExternal } from "../hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { useExams } from "../schedule-data";
import { useDataset } from "../store";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card, CourseDot, EmptyState, Skeleton, StatusChip } from "../ui/display";
import { Icons } from "../ui/icons";
import { List, Notice, Page, PageHeader, Row, Section } from "../ui/layout";
import { toast } from "../ui/overlays";
import { budgetLabel, STATE_TONE } from "./presence";
import { ExportButton } from "./schedule";
import { LecturerFile } from "./tasks";

export const ready = true;

/** UTS, UAS, Kuis: a quiet label; the date is what stands out. */
function KindLabel({ exam, className }: { exam: Pick<Exam, "kind">; className?: string }) {
  const t = useT();
  return (
    <span className={cx("inline-grid h-5 shrink-0 place-items-center rounded-[5px] bg-neutral-bg px-1.5 text-caption font-semibold text-neutral-fg", className)}>
      {t(`exam.kind.${exam.kind}`)}
    </span>
  );
}

/** "Masa UTS 12–16 Okt". */
export const examWeekLabel = (t: Translate, f: Format, kind: "UTS" | "UAS", week: CalendarEvent) =>
  t("exam.week", { kind: t(kind === "UTS" ? "calendar.kind.uts" : "calendar.kind.uas"), range: f.dayRange(week.firstDay, week.lastDay) });
const dayLabel = (f: Format, at: number) => `${f.weekdayShort(at)} ${f.dayMonth(at)}`;

/** The day each source gives: "Kam 15 Okt" (SIX) and "Kam 22 Okt" (Edunex). */
function sourceDays(f: Format, exam: Exam): { six: string; edunex: string } {
  const edunex = [...exam.edunex.flatMap((e) => (e.start !== null ? [e.start] : [])), ...exam.tasks.flatMap((task) => (task.dueAt !== null ? [task.dueAt] : []))];
  return {
    six: [...new Set(exam.six.map((s) => dayLabel(f, s.start)))].join(", "),
    edunex: [...new Set(edunex.sort((a, b) => a - b).map((at) => dayLabel(f, at)))].join(", "),
  };
}

// ---------------------------------------------------------------- rows (Tugas & Ujian, a course's tab)

/** Exams as rows, each opening its prep page. */
export function ExamRows({ exams }: { exams: readonly Exam[] }) {
  const t = useT();
  return (
    <List label={t("exams.title")}>
      {exams.map((exam, index) => (
        <ExamRow key={exam.id} exam={exam} index={index} />
      ))}
    </List>
  );
}

/** One exam: the date first, then the course, where, and its take-home folded in. */
export function ExamRow({ exam, index }: { exam: Exam; index?: number }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const course = useTermCourses()?.find((c) => c.code === exam.courseCode);
  const [inClass] = exam.six;
  const online = exam.edunex.find((e) => e.start !== null);
  const days = sourceDays(f, exam);
  const when =
    inClass !== undefined
      ? t("exam.row.inClass", { time: [f.timeRange(inClass.start, inClass.end), inClass.room].filter(Boolean).join(" · ") })
      : online?.start != null
        ? `${t("exam.onEdunex")} · ${f.time(online.start)}`
        : exam.at === null && exam.week && (exam.kind === "UTS" || exam.kind === "UAS")
          ? t("exam.dayUnknown")
          : exam.at === null
            ? t("exam.noDate")
            : "";
  return (
    <Row
      index={index}
      onClick={() => go({ screen: "exam", examId: exam.id })}
      leading={<DateTile at={exam.at} week={exam.week} kind={exam.kind} />}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <KindLabel exam={exam} />
          <span className="truncate">{course?.name ?? inClass?.courseName ?? exam.courseCode}</span>
        </span>
      }
      meta={
        <span className="flex min-w-0 items-center gap-1.5">
          <CourseDot color={course?.color ?? "#888"} className="size-2" />
          <span className="shrink-0 font-medium text-fg/80">{exam.courseCode}</span>
          {when && <span className="truncate">· {when}</span>}
        </span>
      }
      trailing={
        exam.at !== null && !examPassed(exam, now) ? (
          <span className="text-small text-muted tabular-nums">{f.fromNow(exam.at)}</span>
        ) : undefined
      }
    >
      {exam.tasks.map((task) => (
        <TakeHomeLine key={task.id} task={task} />
      ))}
      {exam.disagree && (
        <span className="mt-1 flex items-center gap-1.5 text-small font-medium text-warning-fg">
          <Icons.AlertTriangle className="size-3.5 shrink-0" />
          {t("exam.row.disagree", days)}
        </span>
      )}
    </Row>
  );
}

function TakeHomeLine({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const status = taskStatus(task, now);
  return (
    <span className="mt-1 flex min-w-0 items-center gap-2 text-small text-muted">
      <Icons.Upload className="size-3.5 shrink-0" />
      <span className="truncate">{task.dueAt !== null ? t("exam.row.takeHome", { title: task.title, when: f.dueLabel(task.dueAt) }) : task.title}</span>
      {(status === "draft" || status === "overdue" || status === "submitted") && <StatusChip status={status} />}
    </span>
  );
}

/** "KAM / 15 / Okt": the exam's day, the strongest thing in its row; without a day yet, its exam week ("12–16 / Okt"). */
// An exam week leads with its own name ("UTS"), never "Minggu": that reads as Sunday next to "KAM 15".
function DateTile({ at, week, kind }: { at: number | null; week?: Exam["week"]; kind: Exam["kind"] }) {
  const t = useT();
  const f = useFormat();
  return (
    <span className="flex w-12 flex-col items-center rounded-lg border border-edge bg-surface py-1 leading-none tabular-nums">
      {at === null && week ? (
        <>
          <span className="text-micro font-semibold text-muted uppercase">{t(`exam.kind.${kind}`)}</span>
          <span className="mt-1 text-caption font-semibold">
            {new Date(dayStart(week.firstDay)).getDate()}–{new Date(dayStart(week.lastDay)).getDate()}
          </span>
          <span className="mt-0.5 text-micro text-muted">{f.dayMonth(dayStart(week.lastDay)).replace(/^\d+\s*/, "")}</span>
        </>
      ) : at === null ? (
        <span className="py-2 text-body text-faint">?</span>
      ) : (
        <>
          <span className="text-micro font-semibold text-muted uppercase">{f.weekdayShort(at)}</span>
          <span className="mt-0.5 text-title font-semibold">{new Date(at).getDate()}</span>
          <span className="mt-0.5 text-micro text-muted">{f.dayMonth(at).replace(/^\d+\s*/, "")}</span>
        </>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- the exam page

export function ExamScreen({ examId }: { examId: string }) {
  const t = useT();
  const exams = useExams();
  const courses = useTermCourses();
  if (!exams)
    return (
      <Page>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-8 w-80" />
        <Skeleton className="mt-8 h-32 w-full" />
      </Page>
    );
  const exam = exams.find((e) => e.id === examId);
  if (!exam)
    return (
      <Page>
        <EmptyState icon={<Icons.GraduationCap className="size-5" />} title={t("exam.notFound")} />
      </Page>
    );
  const course = courses?.find((c) => c.code === exam.courseCode);
  return <ExamPage exam={exam} others={exams.filter((e) => e !== exam)} course={course} courses={courses ?? []} />;
}

function ExamPage({ exam, others, course, courses }: { exam: Exam; others: Exam[]; course: TermCourse | undefined; courses: TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const open = useOpenExternal();
  const student = useDataset("six.student");
  const name = course?.name ?? exam.six[0]?.courseName ?? exam.courseCode;
  const dated = exam.six.length > 0 || exam.tasks.some((task) => task.dueAt !== null) || exam.edunex.some((e) => e.start !== null);
  const days = sourceDays(f, exam);

  const copyQuestion = async () => {
    // Greeted for the time it's copied ("Selamat pagi" at 8): it's usually pasted right away.
    const text = t("examPage.question", { greeting: f.greeting(), kind: t(`exam.kind.${exam.kind}`), code: exam.courseCode, name, ...days });
    try {
      await navigator.clipboard.writeText(text);
      toast(t("examPage.copied"), "success");
    } catch {
      toast(text);
    }
  };

  const links: { label: string; url: string }[] = [];
  if (exam.six.length > 0 && student) links.push({ label: t("examPage.seeSix"), url: sixTimetableUrl(student) });
  for (const task of exam.tasks) links.push({ label: exam.tasks.length > 1 ? `${t("examPage.seeTask")} · ${task.title}` : t("examPage.seeTask"), url: edunexTaskUrl(task.id) });
  if (!exam.tasks.length && course?.edunex) links.push({ label: t("examPage.seeCourse"), url: edunexCourseUrl(course.edunex.courseId) });

  return (
    <Page>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <KindLabel exam={exam} />
            <CourseDot color={course?.color ?? "#888"} className="size-2" />
            <span className="font-semibold text-fg/80">{exam.courseCode}</span>
          </span>
        }
        title={name}
        description={exam.at !== null ? `${f.dateLong(exam.at)} · ${exam.at > now ? f.fromNow(exam.at) : f.relativeDay(exam.at)}` : t("exam.noDate")}
        actions={<ExportButton />}
      />

      <Section id="exam-when" title={t("exam.when")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {exam.six.map((session) => (
            <Card key={session.id} variant="raised" className="px-5 py-4">
              <p className="text-small font-medium text-muted">{t("exam.inClass")}</p>
              <p className="mt-1 text-heading font-semibold tabular-nums">{dayLabel(f, session.start)}</p>
              <p className="mt-0.5 text-lead tabular-nums">
                {f.timeRange(session.start, session.end)} <span className="text-muted">· {t("exam.length", { minutes: Math.round((session.end - session.start) / 60_000) })}</span>
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-lead font-semibold">
                <Icons.MapPin className="size-4 shrink-0 text-muted" />
                {session.room ?? <span className="font-normal text-muted">{t("exam.noRoom")}</span>}
              </p>
            </Card>
          ))}
          {exam.edunex.map((e) => (
            <Card key={e.id} className="px-5 py-4">
              <p className="text-small font-medium text-muted">{t("exam.onEdunex")}</p>
              <p className="mt-1 text-heading font-semibold tabular-nums">{e.start !== null ? dayLabel(f, e.start) : t("exam.noDate")}</p>
              {e.start !== null && <p className="mt-0.5 text-lead tabular-nums">{e.end !== null ? f.timeRange(e.start, e.end) : f.time(e.start)}</p>}
              {e.title && <p className="mt-2 text-body text-muted">{e.title}</p>}
            </Card>
          ))}
          {exam.tasks.map((task) => (
            <TakeHomeCard key={task.id} task={task} />
          ))}
          {!dated && (
            <Card className="px-5 py-4">
              <p className="text-small font-medium text-muted">{t("exam.notScheduled")}</p>
              <p className="mt-1 text-heading font-semibold">
                {exam.week && (exam.kind === "UTS" || exam.kind === "UAS") ? examWeekLabel(t, f, exam.kind, exam.week) : t("exam.noDate")}
              </p>
              {exam.inOutline && <p className="mt-1 text-small text-muted">{t("exam.outlineOnly")}</p>}
            </Card>
          )}
        </div>
        {exam.disagree && (
          <Notice
            tone="warning"
            className="mt-3"
            title={t("examPage.disagreeTitle")}
            action={
              <span className="flex flex-col items-end gap-1.5">
                <Button size="sm" icon={<Icons.ClipboardCheck className="size-3.5" />} onClick={() => void copyQuestion()}>
                  {t("examPage.copyQuestion")}
                </Button>
                <button
                  type="button"
                  onClick={() => go({ screen: "course", code: exam.courseCode, tab: "announcements" })}
                  className="focus-ring rounded text-small font-medium underline-offset-2 hover:underline"
                >
                  {t("examPage.announcements")}
                </button>
              </span>
            }
          >
            {t("examPage.disagreeBody", days)}
          </Notice>
        )}
        <BeforeExam code={exam.courseCode} />
      </Section>

      <Study exam={exam} />

      {links.length > 0 && (
        <p className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
          <span>{t("examPage.official")}:</span>
          {links.map((link, i) => (
            <span key={link.url} className="inline-flex items-center gap-2">
              {i > 0 && <span aria-hidden className="text-faint">·</span>}
              <button type="button" onClick={() => open(link.url)} className="focus-ring inline-flex items-center gap-0.5 rounded font-medium text-accent-fg hover:underline">
                {link.label}
                <Icons.ArrowUpRight className="size-3.5" />
              </button>
            </span>
          ))}
        </p>
      )}

      {others.length > 0 && (
        <Section id="exam-others" title={t("exam.others")}>
          <ul className="flex flex-wrap gap-2">
            {others.map((other) => (
              <li key={other.id}>
                <button
                  type="button"
                  onClick={() => go({ screen: "exam", examId: other.id })}
                  className="focus-ring inline-flex h-8 items-center gap-2 rounded-lg border border-edge bg-surface px-3 text-small font-medium shadow-card transition-colors duration-150 hover:bg-hover"
                >
                  <KindLabel exam={other} />
                  <CourseDot color={courses.find((c) => c.code === other.courseCode)?.color ?? "#888"} className="size-2" />
                  {other.courseCode}
                  <span className="text-faint">
                    {other.at !== null
                      ? f.dayMonth(other.at)
                      : other.week && (other.kind === "UTS" || other.kind === "UAS")
                        ? examWeekLabel(t, f, other.kind, other.week)
                        : t("exam.noDate")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}

function TakeHomeCard({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const status = taskStatus(task, now);
  return (
    <button
      type="button"
      onClick={() => go({ screen: "task", taskId: task.id })}
      className="focus-ring group flex flex-col rounded-xl border border-edge bg-surface px-5 py-4 text-left shadow-card transition-colors duration-150 hover:bg-hover"
    >
      <span className="flex items-center justify-between gap-2 text-small font-medium text-muted">
        {t("exam.takeHome")}
        {status !== "not_started" && <StatusChip status={status} />}
      </span>
      <span className="mt-1 text-heading font-semibold tabular-nums">{task.dueAt !== null ? dayLabel(f, task.dueAt) : t("exam.noDate")}</span>
      {task.dueAt !== null && <span className="mt-0.5 text-lead tabular-nums">{t("exam.due", { when: f.time(task.dueAt) })}</span>}
      <span className="mt-3 flex items-center gap-1 text-small font-medium text-accent-fg">
        <span className="truncate">
          {isOpenStatus(status) ? t("examPage.openTask") : task.title}
          {isOpenStatus(status) && <span className="font-normal text-muted"> · {task.title}</span>}
        </span>
        <Icons.ChevronRight className="size-3.5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

/**
 * Something real to study: the lecturer's files (on the take-home Task), and
 * the course's modules before the exam, each with how much is in it.
 */
function Study({ exam }: { exam: Exam }) {
  const t = useT();
  const { go } = useNav();
  const outline = useDataset("edunex.outline")?.[exam.courseCode];
  const materials = useDataset("edunex.materials")?.[exam.courseCode] ?? [];
  const files = exam.tasks.flatMap((task) => task.files);
  // Modules up to the exam's own (UTS: the first half; UAS: everything before it).
  const modules = outline?.modules ?? [];
  const examAt = modules.findIndex((m) => examKind(m.title) === exam.kind);
  const before = (examAt >= 0 ? modules.slice(0, examAt) : exam.kind === "UTS" || exam.kind === "UAS" ? modules : []).filter((m) => examKind(m.title) === null);
  if (!files.length && !before.length) return null;
  const count = (id: number) => materials.filter((m) => m.moduleId === id).length;
  return (
    <Section id="exam-study" title={t("examPage.study")}>
      {files.length > 0 && (
        <>
          <p className="mb-2 text-small font-medium text-muted">{t("examPage.lecturerFiles")}</p>
          <ul className="mb-6 grid gap-2 sm:grid-cols-2">
            {files.map((file) => (
              <li key={file.url}>
                <LecturerFile file={file} />
              </li>
            ))}
          </ul>
        </>
      )}
      {before.length > 0 && (
        <>
          <div className="mb-2 flex items-center justify-between gap-4">
            <p className="text-small font-medium text-muted">{t("examPage.modulesBefore", { kind: t(`exam.kind.${exam.kind}`) })}</p>
            <button
              type="button"
              onClick={() => go({ screen: "course", code: exam.courseCode, tab: "modules" })}
              className="focus-ring inline-flex items-center gap-0.5 rounded text-small font-medium text-accent-fg hover:underline"
            >
              {t("examPage.openModules")}
              <Icons.ChevronRight className="size-3.5" />
            </button>
          </div>
          <List label={t("examPage.modulesBefore", { kind: t(`exam.kind.${exam.kind}`) })}>
            {before.map((module, i) => (
              <Row
                key={module.id}
                onClick={() => go({ screen: "course", code: exam.courseCode, tab: "modules" })}
                leading={<span className="grid size-6 place-items-center rounded-md bg-fill text-caption font-semibold text-muted tabular-nums">{i + 1}</span>}
                title={module.title}
                trailing={<span className="text-small text-faint">{count(module.id) ? t("examPage.items", { count: count(module.id) }) : t("examPage.noItems")}</span>}
              />
            ))}
          </List>
        </>
      )}
    </Section>
  );
}

function BeforeExam({ code }: { code: string }) {
  const t = useT();
  const { go } = useNav();
  const attendance = useAttendance();
  const entry = attendance?.courses.find((c) => c.course.code === code);
  if (!entry || entry.health.attended === null) return null;
  const { health } = entry;
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-edge bg-surface px-4 py-3 shadow-card">
      <Icons.Hand className="size-4 shrink-0 text-muted" />
      <p className="min-w-0 flex-1 text-body">
        <span className="font-medium">{t("examPage.attendance")}</span>
        <span className="text-muted"> · {t("examPage.attendanceLine", { attended: health.attended ?? 0, held: health.held ?? 0 })} · </span>
        <span className={cx("font-semibold", STATE_TONE[health.state])}>{budgetLabel(t, health, attendance!.target)}</span>
      </p>
      <button type="button" onClick={() => go({ screen: "presence" })} className="focus-ring shrink-0 rounded text-small font-medium text-accent-fg hover:underline">
        {t("examPage.seePresence")}
      </button>
    </div>
  );
}

