// Exam rows on the phone: src/app/screens/exam.tsx's ExamPartRow, PeriodRow and PastExamRow with
// the same facts. "Tandai selesai" (an Edunex window open now) and its way back from Done are an
// icon on the row, a swipe, and the row's long press, each answered with a toast and Undo.
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { errorKey } from "../../../../src/app/bridge";
import { type TermCourse, useTermCourses } from "../../../../src/app/courses";
import { useExamMarks } from "../../../../src/app/exam-marks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { wibDay } from "../../../../src/core/course-meetings";
import { dueOn, type Exam, examMarkKey, isExamWindow, takeHomeOf } from "../../../../src/core/exams";
import type { CalendarEvent, Task } from "../../../../src/core/models";
import type { PastExam, TodoItem } from "../../../../src/core/todo";
import { useNav } from "../../nav";
import { toast } from "../../swaps/overlays";
import { IconButton } from "../../ui/controls";
import { StatusChip } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Meta, Row } from "../../ui/layout";
import { ActionSheet } from "../../ui/sheet";
import { SwipeRow } from "../../ui/swipe";
import { Text, type TextTone } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseCodeMark, DateColumn, ExamTitle, useDueWhen } from "./rows";

const DAY = 86_400_000;

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

/** "Kuis Komunikasi Pemasaran": the exam's name for a control's label. */
const examName = (t: Translate, exam: Exam, name: string) => `${t(`exam.kind.${exam.kind}`)} ${name}`;

/** A sitting's day over its time range: amber within a day, green "Sekarang / sampai 12:59" while it's on. */
function useSittingWhen(): (at: number, end: number | null) => { main: string; sub: string; tone?: TextTone } {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  return (at, end) => {
    const on = at <= now && (end ?? at) > now;
    const soon = !on && at > now && at - now < DAY;
    return {
      main: on ? t("home.now") : f.relativeDay(at),
      sub: on && end !== null ? t("exam.until", { time: f.time(end) }) : end !== null ? f.timeRange(at, end) : f.time(at),
      tone: on ? "success" : soon ? "warning" : undefined,
    };
  };
}

/** Moves an open Edunex window to Done, with Undo. */
function useMarkDone() {
  const t = useT();
  const marks = useExamMarks();
  return async (exam: Parameters<typeof marks.mark>[0]) => {
    try {
      await marks.mark(exam);
      toast(t("exam.marked"), "success", {
        label: t("action.undo"),
        onClick: () => void marks.unmark(exam).catch((error: unknown) => toast(t(errorKey(error)), "danger")),
      });
    } catch (error) {
      toast(t(errorKey(error)), "danger");
    }
  };
}

/**
 * One part of an exam still ahead, at its moment: a sitting (in class or on Edunex), an Edunex
 * window open for days (with Mark as done once it's open), or a take-home to hand in, which opens
 * its Task page. On a course's page the course goes without saying.
 */
export function ExamPartRow({
  item,
  inCourse = false,
  actions,
  onLongPress,
}: {
  item: Extract<TodoItem, { kind: "exam" }>;
  inCourse?: boolean;
  /** A late take-home's "Ingatkan nanti", as for any late Task. */
  actions?: ReactNode;
  onLongPress?: () => void;
}) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const { go } = useNav();
  const due = useDueWhen();
  const sitting = useSittingWhen();
  const markDone = useMarkDone();
  const [menu, setMenu] = useState(false);
  const { exam, part } = item;
  const { name } = useExamCourse(exam);
  const days = sourceDays(f, exam);
  const code = inCourse ? "" : exam.courseCode;

  let facts: string[];
  let when: { main: string; sub?: string | null; tone?: TextTone } | null = null;
  let chip: ReactNode = null;
  if (part?.kind === "takehome") {
    facts = [code, t("exam.takeHome"), part.task.title];
    if (part.status === "draft") chip = <StatusChip status={part.status} />;
    when = part.at !== null ? due(part.at, item.late) : { main: t("task.noDeadline"), tone: "faint" };
  } else if (part?.kind === "window") {
    // With only its close, Edunex doesn't say when it opens: nothing is said about it.
    const opens = part.opensAt === null ? "" : part.open ? t("exam.window.open") : t("task.opens", { when: f.dueLabel(part.opensAt) });
    facts = [code, t("exam.onEdunex"), part.edunex.title ?? "", opens];
    when = due(part.at, false);
  } else if (part?.kind === "sitting") {
    facts = [code, t(part.source === "six" ? "exam.inClass" : "exam.onEdunex"), part.source === "six" ? (part.room ?? "") : (part.title ?? "")];
    when = sitting(part.at, part.end);
  } else facts = [code, exam.inOutline ? t("exam.outlineOnly") : t("exam.noDate")];

  // Only a window of known length, open now: a quiz the Student may already have taken on Edunex.
  const window = part?.kind === "window" && part.opensAt !== null && part.open ? part.edunex : null;
  const late = part?.kind === "takehome" && item.late;
  const moved = part?.kind === "window" && part.moved;
  const disagree = part?.kind === "sitting" && exam.disagree;
  const title = examName(t, exam, name);
  const label = factsLabel(
    title,
    ...facts,
    late ? t("home.need.task.overdue") : null,
    moved ? t("exam.markChanged") : null,
    disagree ? t("exam.row.disagree", days) : null,
    when?.main,
    when?.sub,
  );

  const row = (
    <Row
      // A take-home opens its Task, and is named as one: the exam's own row (its sitting) keeps the exam's id.
      testID={part?.kind === "takehome" ? `row.task.${part.task.id}` : `row.exam.${exam.id}`}
      label={label}
      onPress={() => go(part?.kind === "takehome" ? { screen: "task", taskId: part.task.id } : { screen: "exam", examId: exam.id })}
      onLongPress={window ? () => setMenu(true) : onLongPress}
      title={<ExamTitle kind={t(`exam.kind.${exam.kind}`)} name={name} />}
      meta={
        <Meta>
          {code ? <CourseCodeMark code={code} /> : ""}
          {facts.slice(1)}
        </Meta>
      }
      trailing={
        when || chip ? (
          <>
            {chip}
            {when && <DateColumn {...when} />}
          </>
        ) : undefined
      }
      actions={
        window ? (
          <IconButton label={t("exam.markDoneFor", { title })} onPress={() => void markDone(window)} testID="action.markDone">
            <Icons.CheckCircle size={20} color={theme.color.faint} />
          </IconButton>
        ) : (
          actions
        )
      }
    >
      {late && (
        <Text size="small" tone="muted" style={{ marginTop: space[1] }}>
          {t("home.need.task.overdue")}
        </Text>
      )}
      {(moved || disagree) && (
        <View style={{ marginTop: space[1], flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icons.AlertTriangle size={14} color={theme.color.warningFg} />
          <Text size="small" weight="medium" tone="warning" style={{ flexShrink: 1 }}>
            {moved ? t("exam.markChanged") : t("exam.row.disagree", days)}
          </Text>
        </View>
      )}
    </Row>
  );
  if (!window) return row;
  return (
    <>
      <SwipeRow
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
}

/**
 * An exam period whose exams have no day yet: one quiet line where the period falls, opening to
 * list them. Closed while it's far off; open within two weeks and while it's on.
 */
export function PeriodRow({ item, inCourse = false }: { item: Extract<TodoItem, { kind: "period" }>; inCourse?: boolean }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
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
      <Pressable
        testID={`row.period.${item.examKind}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={factsLabel(title, line, main, sub)}
        onPress={() => setToggled(!toggled)}
        android_ripple={{ color: theme.color.selected }}
        style={styles.period}
      >
        <View style={[styles.calendar, { backgroundColor: theme.color.sourceItbBg }]}>
          <Icons.Calendar size={16} color={theme.color.sourceItbFg} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="body" weight="medium">
            {title}
          </Text>
          <Text size="small" tone="muted" style={{ marginTop: 2 }}>
            {line}
          </Text>
        </View>
        <DateColumn main={main} sub={sub} />
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <Icons.ChevronDown size={16} color={theme.color.faint} />
        </View>
      </Pressable>
      {open && (
        <View style={{ backgroundColor: theme.color.sunken, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.line }}>
          {item.exams.map((exam, i) => (
            <View key={exam.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.line } : null}>
              <PeriodExam exam={exam} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function PeriodExam({ exam }: { exam: Exam }) {
  const t = useT();
  const { go } = useNav();
  const { name } = useExamCourse(exam);
  return (
    <View style={{ paddingLeft: 44 }}>
      <Row
        testID={`row.exam.${exam.id}`}
        label={factsLabel(examName(t, exam, name), exam.courseCode, t("exam.dayUnknown"))}
        onPress={() => go({ screen: "exam", examId: exam.id })}
        title={<ExamTitle kind={t(`exam.kind.${exam.kind}`)} name={name} />}
        meta={
          <Meta>
            <CourseCodeMark code={exam.courseCode} />
            {t("exam.dayUnknown")}
          </Meta>
        }
      />
    </View>
  );
}

/**
 * An exam behind the Student, in Done: where it was sat, or that its day was never announced. A
 * window the Student marked done says so, with the way back to To do.
 */
export function PastExamRow({ past, inCourse = false }: { past: PastExam; inCourse?: boolean }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const { go } = useNav();
  const marks = useExamMarks();
  const [menu, setMenu] = useState(false);
  const { exam } = past;
  const { name } = useExamCourse(exam);
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
      toast(t(errorKey(error)), "danger");
    }
  };
  const row = (
    <Row
      testID={`row.exam.${exam.id}`}
      label={factsLabel(title, ...facts, main, sub)}
      onPress={() => go({ screen: "exam", examId: exam.id })}
      onLongPress={mark ? () => setMenu(true) : undefined}
      title={<ExamTitle kind={t(`exam.kind.${exam.kind}`)} name={name} />}
      meta={
        <Meta>
          {code ? <CourseCodeMark code={code} /> : ""}
          {facts.slice(1)}
        </Meta>
      }
      trailing={main || sub ? <DateColumn main={main} sub={sub} /> : undefined}
      actions={
        mark ? (
          <IconButton label={t("exam.unmarkFor", { title })} onPress={() => void unmark()} testID="action.unmark">
            <Icons.Undo size={20} color={theme.color.faint} />
          </IconButton>
        ) : undefined
      }
    />
  );
  if (!mark) return row;
  return (
    <>
      <SwipeRow
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
}

const styles = StyleSheet.create({
  period: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingLeft: space[4],
    paddingRight: space[3],
    paddingVertical: space[3],
    minHeight: 56,
  },
  calendar: { width: 28, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center" },
});
