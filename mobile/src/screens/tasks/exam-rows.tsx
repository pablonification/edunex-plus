// Exam rows on the phone: src/app/screens/exam.tsx's ExamPartRow, PeriodRow and PastExamRow with the same facts, in
// v4's row (round 2): the course's tile, its name, one meta line (the kind, then when and where) and one status (the
// countdown; "Sekarang" while it's on; a changed time over both). "Tandai selesai" (an Edunex window open now) and its
// way back from Done are a swipe, the row's long press and TalkBack's actions, each answered with a snackbar and Undo;
// a failure is said in the list's banner (row-parts.tsx), never in a snackbar.
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import { errorKey } from "../../../../src/app/bridge";
import { type TermCourse, useTermCourses } from "../../../../src/app/courses";
import { useExamMarks } from "../../../../src/app/exam-marks";
import { type Format, type Translate, useT } from "../../../../src/app/i18n";
import { wibDay } from "../../../../src/core/course-meetings";
import { dueOn, type Exam, examMarkKey, isExamWindow, takeHomeOf } from "../../../../src/core/exams";
import type { CalendarEvent, Task } from "../../../../src/core/models";
import type { PastExam, TodoItem } from "../../../../src/core/todo";
import { useNav } from "../../nav";
import { toast } from "../../swaps/overlays";
import { LINE_INSET } from "../../ui/card-list";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { ActionSheet } from "../../ui/sheet";
import { SwipeRow } from "../../ui/swipe";
import { useTheme } from "../../ui/theme";
import { countdown, IconTile, inWorld, type Quick, reportRowProblem, StatusPill, TaskLine, useRowWorld } from "./row-parts";

/** Why a Task is the exam's take-home, in a few quiet words: "Edunex menandainya UTS", "Namanya diawali “Midex”". */
export function takeHomeWhy(t: Translate, task: Pick<Task, "kind" | "title">): string | null {
  const why = takeHomeOf(task);
  if (!why) return null;
  return why.by === "edunex" ? t("exam.takeHomeBy.edunex", { kind: why.kind }) : t("exam.takeHomeBy.name", { start: why.start });
}

/** "Masa UTS 12–16 Okt". */
export const examWeekLabel = (t: Translate, f: Format, kind: "UTS" | "UAS", week: CalendarEvent) =>
  t("exam.week", { kind: t(kind === "UTS" ? "calendar.kind.uts" : "calendar.kind.uas"), range: f.dayRange(week.firstDay, week.lastDay) });
export const dayLabel = (f: Format, at: number) => `${f.weekdayShort(at)} ${f.dayMonth(at)}`;

/** The days each source gives: SIX's sittings ("Kam 15 Okt"), Edunex's sittings, and the take-homes' deadlines ("Kam 22 Okt"). */
export function sourceDays(f: Format, exam: Exam): { six: string; edunex: string; due: string } {
  const days = (times: number[]) => [...new Set(times.sort((a, b) => a - b).map((at) => dayLabel(f, at)))].join(", ");
  const sixDays = new Set(exam.six.map((s) => wibDay(s.start)));
  return {
    six: days(exam.six.map((s) => s.start)),
    edunex: days(exam.edunex.flatMap((e) => (e.start !== null ? [e.start] : []))),
    due: days(exam.tasks.flatMap((task) => (task.dueAt !== null && !dueOn(task.dueAt, sixDays) ? [task.dueAt] : []))),
  };
}

/** The course's name as the course list has it, else SIX's for its sitting, else its code. */
export function useExamCourse(exam: Exam): { course: TermCourse | undefined; name: string } {
  const course = useTermCourses()?.find((c) => c.code === exam.courseCode);
  return { course, name: course?.name ?? exam.six[0]?.courseName ?? exam.courseCode };
}

/** The same, from the rows' shared world. */
function examCourse(courses: readonly TermCourse[] | undefined, exam: Exam): string {
  return courses?.find((c) => c.code === exam.courseCode)?.name ?? exam.six[0]?.courseName ?? exam.courseCode;
}

/** "Kuis Komunikasi Pemasaran": the exam's name for a control's label. */
const examName = (t: Translate, exam: Exam, name: string) => `${t(`exam.kind.${exam.kind}`)} ${name}`;

/** Moves an open Edunex window to Done, with Undo; a failure goes to the list's banner. */
function useMarkDone() {
  const t = useT();
  const marks = useExamMarks();
  return async (exam: Parameters<typeof marks.mark>[0]) => {
    try {
      await marks.mark(exam);
      toast(t("exam.marked"), "success", {
        label: t("action.undo"),
        onClick: () => void marks.unmark(exam).catch((error: unknown) => reportRowProblem(t(errorKey(error)))),
      });
    } catch (error) {
      reportRowProblem(t(errorKey(error)));
    }
  };
}

/**
 * One part of an exam still ahead, at its moment: a sitting (in class or on Edunex), an Edunex window open for days
 * (with Tandai selesai once it's open), or a take-home to hand in, which opens its Task page. On a course's page the
 * course goes without saying.
 */
export const ExamPartRow = inWorld(function ExamPartRow({
  item,
  inCourse = false,
  quick,
  onLongPress,
}: {
  item: Extract<TodoItem, { kind: "exam" }>;
  inCourse?: boolean;
  /** A late take-home's "Ingatkan nanti", as for any late Task. */
  quick?: Quick;
  onLongPress?: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const { go } = useNav();
  const world = useRowWorld();
  const { f, now } = world;
  const markDone = useMarkDone();
  const [menu, setMenu] = useState(false);
  const { exam, part } = item;
  const name = examCourse(world.courses, exam);
  const days = sourceDays(f, exam);
  const code = inCourse ? "" : exam.courseCode;
  const kind = t(`exam.kind.${exam.kind}`);
  const dayTime = (at: number) => `${f.relativeDay(at)}, ${f.time(at)}`;

  // Every fact goes in the spoken name; the row shows the kind, when (and where), and one status.
  let facts: string[];
  let shown: string[];
  let when: string | null = null;
  let moment: number | null = null;
  let status: ReactNode = null;
  if (part?.kind === "takehome") {
    facts = [code, t("exam.takeHome"), part.task.title, part.status === "draft" ? t("taskStatus.draft") : ""];
    when = part.at !== null ? dayTime(part.at) : t("task.noDeadline");
    shown = [`${kind} ${t("exam.takeHome")}`, when];
    moment = part.at;
  } else if (part?.kind === "window") {
    // With only its close, Edunex doesn't say when it opens: nothing is said about it.
    const opens = part.opensAt === null ? "" : part.open ? t("exam.window.open") : t("task.opens", { when: f.dayTimeWord(part.opensAt) });
    facts = [code, t("exam.onEdunex"), part.edunex.title ?? "", opens];
    when = f.dueLabel(part.at);
    shown = [kind, t("exam.onEdunex"), when];
    moment = part.at;
  } else if (part?.kind === "sitting") {
    const place = part.source === "six" ? (part.room ?? "") : (part.title ?? "");
    facts = [code, t(part.source === "six" ? "exam.inClass" : "exam.onEdunex"), place];
    when = part.end !== null ? `${f.relativeDay(part.at)}, ${f.timeRange(part.at, part.end)}` : dayTime(part.at);
    shown = [kind, when, part.source === "six" ? place : t("exam.onEdunex")];
    if (part.at <= now && (part.end ?? part.at) > now) status = <StatusPill tone="ok" text={t("home.now")} />;
    else moment = part.at;
  } else {
    facts = [code, exam.inOutline ? t("exam.outlineOnly") : t("exam.noDate")];
    shown = [kind, t("exam.noDate")];
  }
  const away = moment !== null ? countdown(t, now, moment) : null;
  if (away && !status) status = <StatusPill tone={away.tone} text={away.text} />;

  // Only a window of known length, open now: a quiz the Student may already have taken on Edunex.
  const window = part?.kind === "window" && part.opensAt !== null && part.open ? part.edunex : null;
  const late = part?.kind === "takehome" && item.late;
  const moved = part?.kind === "window" && part.moved;
  const disagree = part?.kind === "sitting" && exam.disagree;
  // A changed or disputed time is the one status worth more than the countdown: the Student checks it before going.
  if (moved || disagree)
    status = (
      <StatusPill
        tone="amber"
        icon={<Icons.AlertTriangle size={13} weight="bold" color={theme.v4.ambFg} />}
        text={t(moved ? "mobile.home.timeMoved" : "mobile.tasks.chip.disagree")}
      />
    );
  const title = examName(t, exam, name);
  const label = factsLabel(
    title,
    ...facts,
    late ? t("home.need.task.overdue") : null,
    moved ? t("exam.markChanged") : null,
    disagree ? t("exam.row.disagree", days) : null,
    when,
    moment !== null ? f.fromNow(moment) : null,
  );

  const row = (
    <TaskLine
      // A take-home opens its Task, and is named as one: the exam's own row (its sitting) keeps the exam's id.
      testID={part?.kind === "takehome" ? `row.task.${part.task.id}` : `row.exam.${exam.id}`}
      label={label}
      onPress={() => go(part?.kind === "takehome" ? { screen: "task", taskId: part.task.id } : { screen: "exam", examId: exam.id })}
      onLongPress={window ? () => setMenu(true) : onLongPress}
      quick={window ? [{ label: t("exam.markDoneFor", { title }), onPress: () => void markDone(window) }] : quick}
      code={code || null}
      course={name}
      title={name}
      meta={shown.filter(Boolean).join(" · ")}
      status={status}
    />
  );
  if (!window) return row;
  return (
    <>
      <SwipeRow
        surface={inCourse ? undefined : theme.v4.card}
        actions={[
          {
            label: t("exam.markDone"),
            tone: "success",
            icon: <Icons.CheckCircle size={20} color={theme.color.successFg} />,
            onPress: () => void markDone(window),
            testID: "swipe.markDone",
          },
        ]}
      >
        {row}
      </SwipeRow>
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={title}
        choices={[{ label: t("exam.markDone"), icon: <Icons.CheckCircle size={20} />, onPress: () => void markDone(window), testID: "menu.markDone" }]}
      />
    </>
  );
});

/**
 * An exam period whose exams have no day yet: one row where the period falls ("Masa UTS", 12–16 Okt), opening to list
 * them. Closed while it's far off; open within two weeks and while it's on.
 */
export const PeriodRow = inWorld(function PeriodRow({ item, inCourse = false }: { item: Extract<TodoItem, { kind: "period" }>; inCourse?: boolean }) {
  const t = useT();
  const v = useTheme().v4;
  const { f } = useRowWorld();
  const [toggled, setToggled] = useState(false);
  const open = toggled !== (item.state !== "far");
  const codes = item.exams.map((exam) => exam.courseCode);
  const fact = codes.length <= 2 ? t("exam.period.noDayFor", { codes: f.list(codes) }) : t("exam.period.noDayCount", { count: codes.length });
  const { week } = item;
  const title = t("exam.period", { kind: item.examKind });
  const main = item.state === "during" ? t("exam.until", { time: f.dayMonth(week.end - 1) }) : f.dayRange(week.firstDay, week.lastDay);
  const sub = f.fromNow(item.state === "during" ? week.end - 1 : week.start);
  const line = inCourse ? t("exam.dayUnknown") : fact;
  return (
    <View>
      <TaskLine
        testID={`row.period.${item.examKind}`}
        label={factsLabel(title, line, main, sub)}
        onPress={() => setToggled(!toggled)}
        expanded={open}
        leading={
          <IconTile>
            <Icons.Calendar size={22} color={v.brandInk} />
          </IconTile>
        }
        title={title}
        meta={main}
        status={
          <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
            <Icons.ChevronDown size={20} color={v.muted} />
          </View>
        }
      />
      {open &&
        item.exams.map((exam) => (
          <View key={exam.id}>
            <View pointerEvents="none" style={{ height: 1, marginLeft: LINE_INSET, backgroundColor: v.line }} />
            <PeriodExam exam={exam} />
          </View>
        ))}
    </View>
  );
});

function PeriodExam({ exam }: { exam: Exam }) {
  const t = useT();
  const { go } = useNav();
  const world = useRowWorld();
  const name = examCourse(world.courses, exam);
  return (
    <TaskLine
      testID={`row.exam.${exam.id}`}
      label={factsLabel(examName(t, exam, name), exam.courseCode, t("exam.dayUnknown"))}
      onPress={() => go({ screen: "exam", examId: exam.id })}
      code={exam.courseCode}
      course={name}
      title={name}
      meta={`${t(`exam.kind.${exam.kind}`)} · ${t("exam.noDate")}`}
    />
  );
}

/**
 * An exam behind the Student, in Done: where it was sat, or that its day was never announced. A window the Student
 * marked done says so, with the way back to To do (a swipe, the long press, TalkBack's actions).
 */
export const PastExamRow = inWorld(function PastExamRow({ past, inCourse = false }: { past: PastExam; inCourse?: boolean }) {
  const t = useT();
  const theme = useTheme();
  const { go } = useNav();
  const world = useRowWorld();
  const { f } = world;
  const marks = useExamMarks();
  const [menu, setMenu] = useState(false);
  const { exam } = past;
  const name = examCourse(world.courses, exam);
  const code = inCourse ? "" : exam.courseCode;
  const [sitting] = exam.six;
  const online = exam.edunex.find((e) => e.start !== null || e.end !== null);
  const [mark] = past.marks;
  let facts: string[];
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
  } else if (online?.end != null) {
    facts = [code, t("exam.onEdunex"), online.title ?? ""];
    main = f.dueLabel(online.end);
    sub = f.fromNow(online.end);
  } else {
    facts = [code, t("exam.neverAnnounced")];
    main = exam.week ? f.dayRange(exam.week.firstDay, exam.week.lastDay) : "";
    sub = exam.kind === "UTS" || exam.kind === "UAS" ? t("exam.period", { kind: exam.kind }) : "";
  }
  const title = examName(t, exam, name);
  const unmark = async () => {
    const marked = exam.edunex.filter((e) => past.marks.some((m) => m.id === examMarkKey(e).id));
    try {
      for (const item of marked) await marks.unmark(item);
      toast(t("exam.unmarked"));
    } catch (error) {
      reportRowProblem(t(errorKey(error)));
    }
  };
  const row = (
    <TaskLine
      testID={`row.exam.${exam.id}`}
      label={factsLabel(title, ...facts, main, sub)}
      onPress={() => go({ screen: "exam", examId: exam.id })}
      onLongPress={mark ? () => setMenu(true) : undefined}
      quick={mark ? [{ label: t("exam.unmarkFor", { title }), onPress: () => void unmark() }] : undefined}
      code={code || null}
      course={name}
      title={name}
      meta={[t(`exam.kind.${exam.kind}`), main || t("exam.neverAnnounced")].join(" · ")}
      status={
        mark ? (
          <StatusPill tone="ok" icon={<Icons.Check size={13} weight="bold" color={theme.v4.okFg} />} text={t("exam.markedOn", { date: f.dayMonth(mark.at) })} />
        ) : null
      }
    />
  );
  if (!mark) return row;
  return (
    <>
      <SwipeRow
        surface={inCourse ? undefined : theme.v4.card}
        actions={[{ label: t("exam.unmark"), tone: "neutral", icon: <Icons.Undo size={20} color={theme.color.neutralFg} />, onPress: () => void unmark() }]}
      >
        {row}
      </SwipeRow>
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={title}
        choices={[{ label: t("exam.unmark"), icon: <Icons.Undo size={20} />, onPress: () => void unmark() }]}
      />
    </>
  );
});
