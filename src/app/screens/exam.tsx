// Exams in one place (#77): the exam rows in Tugas & Ujian and on a course,
// and an exam's prep page. An exam merges what SIX (in class, with the room),
// Edunex (its exams, take-home Tasks, the course outline) and ITB's calendar
// (the exam weeks) each know, and says plainly, with a next step, when SIX and
// Edunex give a sitting different dates. A take-home due on another day than
// SIX's sitting is said calmly: two parts, not a conflict.
import { type ReactNode, useId, useState } from "react";
import { wibDay } from "../../core/course-meetings";
import { dueOn, type Exam, examAhead, examKind, examMarkKey, isExamWindow, takeHomeOf } from "../../core/exams";
import { edunexCourseUrl, sixTimetableUrl } from "../../core/links";
import type { CalendarEvent, Task } from "../../core/models";
import { edunexTaskUrl, isOpenStatus, taskStatus } from "../../core/tasks";
import type { PastExam, TodoItem } from "../../core/todo";
import { useAttendance } from "../attendance";
import { budgetLabel, STATE_TONE } from "../attendance-labels";
import { errorKey } from "../bridge";
import { type TermCourse, useTermCourses } from "../courses";
import { useExamMarkList, useExamMarks } from "../exam-marks";
import { useOpenExternal } from "../hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { useExams } from "../schedule-data";
import { refocus } from "../snooze-menu";
import { useDataset } from "../store";
import { Button, IconButton } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card, CourseDot, EmptyState, Skeleton, StatusChip, Tag } from "../ui/display";
import { Icons } from "../ui/icons";
import { List, Meta, Notice, Page, PageHeader, Row, Section } from "../ui/layout";
import { DisclosurePanel, disclosureTrigger } from "../ui/motion/disclosure";
import { PresenceItem } from "../ui/motion/presence-list";
import { Tooltip, toast } from "../ui/overlays";
import { ExportButton } from "./schedule";
import { DueWhen, LecturerFile } from "./tasks";

const DAY = 86_400_000;

/** UTS, UAS, Kuis: a quiet label; the date is what stands out. */
function KindLabel({ exam }: { exam: Pick<Exam, "kind"> }) {
  const t = useT();
  return <Tag>{t(`exam.kind.${exam.kind}`)}</Tag>;
}

/** Why a Task is the exam's take-home, in a few quiet words: "Edunex menandainya UTS", "Namanya diawali “Midex”". */
export function takeHomeWhy(t: Translate, task: Pick<Task, "kind" | "title">): string | null {
  const why = takeHomeOf(task);
  if (!why) return null;
  return why.by === "edunex" ? t("exam.takeHomeBy.edunex", { kind: why.kind }) : t("exam.takeHomeBy.name", { start: why.start });
}

/** "Masa UTS 12–16 Okt". */
const examWeekLabel = (t: Translate, f: Format, kind: "UTS" | "UAS", week: CalendarEvent) =>
  t("exam.week", { kind: t(kind === "UTS" ? "calendar.kind.uts" : "calendar.kind.uas"), range: f.dayRange(week.firstDay, week.lastDay) });
const dayLabel = (f: Format, at: number) => `${f.weekdayShort(at)} ${f.dayMonth(at)}`;

/** The days each source gives: SIX's sittings ("Kam 15 Okt"), Edunex's sittings, and the take-homes' deadlines ("Kam 22 Okt"). */
function sourceDays(f: Format, exam: Exam): { six: string; edunex: string; due: string } {
  const days = (times: number[]) => [...new Set(times.sort((a, b) => a - b).map((at) => dayLabel(f, at)))].join(", ");
  const sixDays = new Set(exam.six.map((s) => wibDay(s.start)));
  return {
    six: days(exam.six.map((s) => s.start)),
    edunex: days(exam.edunex.flatMap((e) => (e.start !== null ? [e.start] : []))),
    // Only the deadlines on another day than SIX's sittings.
    due: days(exam.tasks.flatMap((task) => (task.dueAt !== null && !dueOn(task.dueAt, sixDays) ? [task.dueAt] : []))),
  };
}

// ---------------------------------------------------------------- rows (Tugas & Ujian, a course's tab)

/** "UTS Komunikasi Pemasaran": the kind's quiet tag, then the course. */
function ExamTitle({ exam, name }: { exam: Exam; name: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <KindLabel exam={exam} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** The course's name as the sidebar has it, else SIX's for its sitting, else its code. */
function useExamCourse(exam: Exam): { course: TermCourse | undefined; name: string } {
  const course = useTermCourses()?.find((c) => c.code === exam.courseCode);
  return { course, name: course?.name ?? exam.six[0]?.courseName ?? exam.courseCode };
}

function CourseCode({ code, course }: { code: string; course: TermCourse | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-fg/80">
      <CourseDot color={course?.color ?? "var(--faint)"} className="size-2" />
      {code}
    </span>
  );
}

/**
 * Where focus goes when a row leaves with its whole list (the last row of its
 * group, or of Done's past exams): the next row on the screen, else the one
 * before, else the picked segment. Inside a list that stays, PresenceList
 * hands focus on itself, so this only catches focus that fell to the page.
 */
function focusAfterRow(control: HTMLElement): () => HTMLElement | null {
  const row = control.closest("li");
  const rows = [...document.querySelectorAll<HTMLElement>("main li > button")];
  const at = rows.findIndex((button) => row?.contains(button));
  const next = at < 0 ? undefined : (rows.slice(at + 1).find((b) => !row?.contains(b)) ?? rows.slice(0, at).reverse()[0]);
  return () => (next?.isConnected ? next : document.querySelector<HTMLElement>("main [role=radio][aria-checked=true]"));
}

/** "Kuis Komunikasi Pemasaran": the exam's name for a control's label. */
const examName = (t: Translate, exam: Exam, name: string) => `${t(`exam.kind.${exam.kind}`)} ${name}`;

/**
 * A sitting's day over its time range (a range means "be there"): amber
 * within a day, green "Sekarang / sampai 12:59" while it's on.
 */
function SittingWhen({ at, end }: { at: number; end: number | null }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const on = at <= now && (end ?? at) > now;
  const soon = !on && at > now && at - now < DAY;
  return (
    <span className={cx("w-[136px] text-right text-small whitespace-nowrap tabular-nums", on ? "text-success-fg" : soon && "text-warning-fg")}>
      <span className="block font-medium">{on ? t("home.now") : f.relativeDay(at)}</span>
      <span className={cx("block", !on && !soon && "text-faint")}>
        {on && end !== null ? t("exam.until", { time: f.time(end) }) : end !== null ? f.timeRange(at, end) : f.time(at)}
      </span>
    </span>
  );
}

/**
 * One part of an exam still ahead, at its moment: a sitting (in class or on
 * Edunex), an Edunex window open for days (with Mark as done once it's open,
 * the one thing the app can't see), or a take-home to hand in, which opens its
 * Task page. On a course's page the course goes without saying.
 */
export function ExamPartRow({
  item,
  inCourse = false,
  id,
  actions,
}: {
  item: Extract<TodoItem, { kind: "exam" }>;
  inCourse?: boolean;
  id?: string;
  /** A late take-home's "Ingatkan nanti", as for any late Task. */
  actions?: ReactNode;
}) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const marks = useExamMarks();
  const { exam, part } = item;
  const { course, name } = useExamCourse(exam);
  const days = sourceDays(f, exam);
  const code = inCourse ? "" : <CourseCode code={exam.courseCode} course={course} />;

  let facts: ReactNode[];
  let trailing: ReactNode;
  if (part?.kind === "takehome") {
    facts = [code, t("exam.takeHome"), part.task.title];
    trailing = (
      <span className="flex items-center gap-4">
        {part.status === "draft" && <StatusChip status={part.status} />}
        {part.at !== null ? (
          <DueWhen at={part.at} late={item.late} />
        ) : (
          <span className="w-[136px] text-right text-small text-faint">{t("task.noDeadline")}</span>
        )}
      </span>
    );
  } else if (part?.kind === "window") {
    // With only its close, Edunex doesn't say when it opens: nothing is said about it.
    const opens = part.opensAt === null ? "" : part.open ? t("exam.window.open") : t("task.opens", { when: f.dueLabel(part.opensAt) });
    facts = [code, t("exam.onEdunex"), part.edunex.title ?? "", opens];
    trailing = <DueWhen at={part.at} late={false} />;
  } else if (part?.kind === "sitting") {
    facts = [code, t(part.source === "six" ? "exam.inClass" : "exam.onEdunex"), part.source === "six" ? (part.room ?? "") : (part.title ?? "")];
    trailing = <SittingWhen at={part.at} end={part.end} />;
  } else {
    // No system dates it and ITB's calendar has no week for it.
    facts = [code, exam.inOutline ? t("exam.outlineOnly") : t("exam.noDate")];
  }

  const markDone = async (control: HTMLElement) => {
    if (part?.kind !== "window") return;
    const next = focusAfterRow(control);
    try {
      await marks.mark(part.edunex);
      toast(t("exam.marked"), "success", {
        label: t("action.undo"),
        onClick: () => void marks.unmark(part.edunex).catch((error: unknown) => toast(t(errorKey(error)), "danger")),
      });
      refocus(next);
    } catch (error) {
      toast(t(errorKey(error)), "danger");
    }
  };

  return (
    <Row
      id={id}
      onClick={() => go(part?.kind === "takehome" ? { screen: "task", taskId: part.task.id } : { screen: "exam", examId: exam.id })}
      title={<ExamTitle exam={exam} name={name} />}
      meta={<Meta truncate>{facts}</Meta>}
      trailing={trailing}
      actions={
        // Only a window of known length, open now: a quiz the Student may already have taken on Edunex.
        part?.kind === "window" && part.opensAt !== null && part.open ? (
          <Tooltip content={t("exam.markDone")}>
            <IconButton label={t("exam.markDoneFor", { title: examName(t, exam, name) })} size="sm" onClick={(event) => void markDone(event.currentTarget)}>
              <Icons.CheckCircle className="size-4" />
            </IconButton>
          </Tooltip>
        ) : (
          actions
        )
      }
    >
      {part?.kind === "takehome" && item.late && <span className="mt-1 block text-small text-muted">{t("home.need.task.overdue")}</span>}
      {part?.kind === "window" && part.moved && (
        <span className="mt-1 flex items-center gap-1.5 text-small font-medium text-warning-fg">
          <Icons.AlertTriangle className="size-3.5 shrink-0" />
          {t("exam.markChanged")}
        </span>
      )}
      {part?.kind === "sitting" && exam.disagree && (
        <span className="mt-1 flex items-center gap-1.5 text-small font-medium text-warning-fg">
          <Icons.AlertTriangle className="size-3.5 shrink-0" />
          <Meta>{t("exam.row.disagree", days)}</Meta>
        </span>
      )}
    </Row>
  );
}

/**
 * An exam period whose exams have no day yet: one quiet line where the
 * period falls, opening to list them. Closed while it's far off; open within
 * two weeks and while it's on.
 */
export function PeriodRow({ item, inCourse = false }: { item: Extract<TodoItem, { kind: "period" }>; inCourse?: boolean }) {
  const t = useT();
  const f = useFormat();
  const id = useId();
  const [toggled, setToggled] = useState(false);
  const open = toggled !== (item.state !== "far");
  const codes = item.exams.map((exam) => exam.courseCode);
  const fact = codes.length <= 2 ? t("exam.period.noDayFor", { codes: f.list(codes) }) : t("exam.period.noDayCount", { count: codes.length });
  const { week } = item;
  return (
    <PresenceItem>
      <button
        type="button"
        onClick={() => setToggled(!toggled)}
        {...disclosureTrigger(open, id)}
        className="focus-ring group flex w-full items-center gap-3.5 px-4 py-3 text-left hover:bg-hover focus-visible:-outline-offset-2 active:bg-selected"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-(--source-itb-bg) text-(--source-itb-fg)">
          <Icons.Calendar className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-medium">{t("exam.period", { kind: item.examKind })}</span>
          <span className="mt-0.5 block text-small text-muted">{inCourse ? t("exam.dayUnknown") : fact}</span>
        </span>
        <span className="w-[136px] shrink-0 text-right text-small whitespace-nowrap tabular-nums">
          <span className="block font-medium">
            {item.state === "during" ? t("exam.until", { time: f.dayMonth(week.end - 1) }) : f.dayRange(week.firstDay, week.lastDay)}
          </span>
          <span className="block text-faint">{f.fromNow(item.state === "during" ? week.end - 1 : week.start)}</span>
        </span>
        <Icons.ChevronDown className={cx("-mr-1 size-4 shrink-0 text-faint transition-transform duration-150", open && "rotate-180")} />
      </button>
      <DisclosurePanel open={open} id={id}>
        <ul className="border-t border-line bg-sunken [&>li+li]:border-t [&>li+li]:border-line">
          {item.exams.map((exam) => (
            <PeriodExam key={exam.id} exam={exam} />
          ))}
        </ul>
      </DisclosurePanel>
    </PresenceItem>
  );
}

function PeriodExam({ exam }: { exam: Exam }) {
  const t = useT();
  const { go } = useNav();
  const { course, name } = useExamCourse(exam);
  return (
    <Row
      onClick={() => go({ screen: "exam", examId: exam.id })}
      className="pl-[3.75rem]"
      title={<ExamTitle exam={exam} name={name} />}
      meta={
        <Meta truncate>
          <CourseCode code={exam.courseCode} course={course} />
          {t("exam.dayUnknown")}
        </Meta>
      }
    />
  );
}

/**
 * An exam behind the Student, in Done: where it was sat, or that its day was
 * never announced. A window the Student marked done says so, with the way
 * back to To do.
 */
export function PastExamRow({ past, inCourse = false }: { past: PastExam; inCourse?: boolean }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const marks = useExamMarks();
  const { exam } = past;
  const { course, name } = useExamCourse(exam);
  const code = inCourse ? "" : <CourseCode code={exam.courseCode} course={course} />;
  const [sitting] = exam.six;
  const online = exam.edunex.find((e) => e.start !== null);
  const [mark] = past.marks;
  let facts: ReactNode[];
  let main: string;
  let sub: string;
  if (sitting) {
    facts = [code, t("exam.inClass"), sitting.room ?? ""];
    main = f.relativeDay(sitting.start);
    sub = f.timeRange(sitting.start, sitting.end);
  } else if (online?.start != null) {
    facts = [code, t("exam.onEdunex"), online.title ?? ""];
    const window = isExamWindow(online);
    main = window && online.end !== null ? f.dueLabel(online.end) : f.relativeDay(online.start);
    sub = mark ? t("exam.markedOn", { date: f.dayMonth(mark.at) }) : online.end !== null ? f.timeRange(online.start, online.end) : f.time(online.start);
  } else {
    facts = [code, t("exam.neverAnnounced")];
    main = exam.week ? f.dayRange(exam.week.firstDay, exam.week.lastDay) : "";
    sub = exam.kind === "UTS" || exam.kind === "UAS" ? t("exam.period", { kind: exam.kind }) : "";
  }
  const unmark = async (control: HTMLElement) => {
    const marked = exam.edunex.filter((e) => past.marks.some((m) => m.id === examMarkKey(e).id));
    const next = focusAfterRow(control);
    try {
      for (const item of marked) await marks.unmark(item);
      toast(t("exam.unmarked"));
      refocus(next);
    } catch (error) {
      toast(t(errorKey(error)), "danger");
    }
  };
  return (
    <Row
      onClick={() => go({ screen: "exam", examId: exam.id })}
      title={<ExamTitle exam={exam} name={name} />}
      meta={<Meta truncate>{facts}</Meta>}
      trailing={
        <span className="w-[136px] text-right text-small whitespace-nowrap tabular-nums">
          <span className="block font-medium">{main}</span>
          <span className="block text-faint">{sub}</span>
        </span>
      }
      actions={
        mark ? (
          <Tooltip content={t("exam.unmark")}>
            <IconButton label={t("exam.unmarkFor", { title: examName(t, exam, name) })} size="sm" onClick={(event) => void unmark(event.currentTarget)}>
              <Icons.Undo className="size-4" />
            </IconButton>
          </Tooltip>
        ) : undefined
      }
    />
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
  return <ExamPage exam={exam} exams={exams} course={course} courses={courses ?? []} />;
}

function ExamPage({ exam, exams, course, courses }: { exam: Exam; exams: Exam[]; course: TermCourse | undefined; courses: TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const marks = useExamMarkList();
  const ahead = examAhead(exam, now, marks);
  // The ones still ahead first, each group in its own order (soonest first).
  const others = exams.filter((e) => e !== exam).sort((a, b) => Number(!examAhead(a, now, marks)) - Number(!examAhead(b, now, marks)));
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

  const links: { label: ReactNode; url: string }[] = [];
  if (exam.six.length > 0 && student) links.push({ label: t("examPage.seeSix"), url: sixTimetableUrl(student) });
  for (const task of exam.tasks)
    links.push({
      label:
        exam.tasks.length > 1 ? (
          <Meta>
            {t("examPage.seeTask")}
            {task.title}
          </Meta>
        ) : (
          t("examPage.seeTask")
        ),
      url: edunexTaskUrl(task.id),
    });
  if (!exam.tasks.length && course?.edunex) links.push({ label: t("examPage.seeCourse"), url: edunexCourseUrl(course.edunex.courseId) });

  return (
    <Page>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <KindLabel exam={exam} />
            <CourseDot color={course?.color ?? "var(--faint)"} className="size-2" />
            <span className="font-semibold text-fg/80">{exam.courseCode}</span>
          </span>
        }
        title={name}
        description={
          exam.at !== null ? (
            <Meta>
              {f.dateLong(exam.at)}
              {f.fromNow(exam.at)}
            </Meta>
          ) : exam.week && (exam.kind === "UTS" || exam.kind === "UAS") ? (
            // As its row says: the week is known, the day and time aren't; once the week is over, they never were.
            t(ahead ? "exam.dayUnknown" : "exam.neverAnnounced")
          ) : (
            t("exam.noDate")
          )
        }
        actions={<ExportButton />}
      />

      <Section id="exam-when" title={t("exam.when")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {exam.six.map((session) => (
            <Card key={session.id} variant="raised" className="px-5 py-4">
              <p className="text-small font-medium text-muted">{t("exam.inClass")}</p>
              <p className="mt-1 text-heading font-semibold tabular-nums">{dayLabel(f, session.start)}</p>
              <Meta className="mt-0.5 text-lead tabular-nums">
                {f.timeRange(session.start, session.end)}
                <span className="text-muted">{t("exam.length", { minutes: Math.round((session.end - session.start) / 60_000) })}</span>
              </Meta>
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
          {/* The header already says the day isn't known: here only what is, the exam week and where the exam is listed. */}
          {!dated && exam.week && (exam.kind === "UTS" || exam.kind === "UAS") ? (
            <Card className="px-5 py-4">
              <p className="text-heading font-semibold">{examWeekLabel(t, f, exam.kind, exam.week)}</p>
              {exam.inOutline && <p className="mt-1 text-small text-muted">{t("exam.outlineOnly")}</p>}
            </Card>
          ) : (
            !dated && exam.inOutline && <p className="text-body text-muted">{t("exam.outlineOnly")}</p>
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
        {/* The two cards say both parts; whether the class sitting happens is the lecturer's to announce. */}
        {exam.takeHomeApart !== null && !exam.disagree && (
          <button
            type="button"
            onClick={() => go({ screen: "course", code: exam.courseCode, tab: "announcements" })}
            className="focus-ring mt-3 flex w-fit items-center gap-0.5 rounded text-small font-medium text-accent-fg hover:underline"
          >
            {t("examPage.checkAnnouncements")}
            <Icons.ChevronRight className="size-3.5" />
          </button>
        )}
        {ahead && <BeforeExam code={exam.courseCode} />}
      </Section>

      <Study exam={exam} />

      {links.length > 0 && (
        <div className="mt-10 flex items-start gap-2 text-small text-muted">
          <span className="shrink-0">{t("examPage.official")}:</span>
          <Meta>
            {links.map((link) => (
              <button
                key={link.url}
                type="button"
                onClick={() => open(link.url)}
                className="focus-ring inline-flex items-center gap-0.5 rounded font-medium text-accent-fg hover:underline"
              >
                {link.label}
                <Icons.ArrowUpRight className="size-3.5 shrink-0" />
              </button>
            ))}
          </Meta>
        </div>
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
                  <CourseDot color={courses.find((c) => c.code === other.courseCode)?.color ?? "var(--faint)"} className="size-2" />
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
        {/* How the app knows it's the exam's take-home, said once where it's shown. */}
        <Meta>
          {t("exam.takeHome")}
          <span className="font-normal">{takeHomeWhy(t, task) ?? ""}</span>
        </Meta>
        {status !== "not_started" && <StatusChip status={status} />}
      </span>
      <span className="mt-1 text-heading font-semibold tabular-nums">{task.dueAt !== null ? dayLabel(f, task.dueAt) : t("exam.noDate")}</span>
      {task.dueAt !== null && <span className="mt-0.5 text-lead tabular-nums">{t("exam.due", { when: f.time(task.dueAt) })}</span>}
      <span className="mt-3 flex items-center gap-1 text-small font-medium text-accent-fg">
        <Meta truncate>
          {isOpenStatus(status) ? t("examPage.openTask") : task.title}
          {isOpenStatus(status) ? <span className="font-normal text-muted">{task.title}</span> : null}
        </Meta>
        <Icons.ChevronRight className="size-3.5 shrink-0" />
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
  const files = exam.tasks.flatMap((task) => task.files.map((file) => ({ file, taskId: task.id })));
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
            {files.map(({ file, taskId }) => (
              <li key={file.url}>
                <LecturerFile file={file} taskId={taskId} />
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
                trailing={
                  <span className="text-small text-faint">{count(module.id) ? t("examPage.items", { count: count(module.id) }) : t("examPage.noItems")}</span>
                }
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
    <div className="mt-3 flex items-center gap-3">
      <Icons.Hand className="size-4 shrink-0 text-muted" />
      <Meta className="flex-1 text-body">
        <span className="font-medium">{t("examPage.attendance")}</span>
        <span className="text-muted">{t("examPage.attendanceLine", { attended: health.attended ?? 0, held: health.held ?? 0 })}</span>
        <span className={cx("font-semibold", STATE_TONE[health.state])}>{budgetLabel(t, health)}</span>
      </Meta>
      <button
        type="button"
        onClick={() => go({ screen: "presence" })}
        className="focus-ring shrink-0 rounded text-small font-medium text-accent-fg hover:underline"
      >
        {t("examPage.seePresence")}
      </button>
    </div>
  );
}
