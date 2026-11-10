// Exam rows on the phone: src/app/screens/exam.tsx's ExamPartRow, PeriodRow and PastExamRow with the same facts, in
// v4's row (round 2): the course's tile, its name, one meta line (the kind, then when and where) and one status (the
// countdown within a day; "Sekarang" while it's on; a changed time over both). An exam SIX lists in both weeks of the
// exam period is one row with both days (src/core/exam-sittings.ts). "Tandai selesai" (an Edunex window open
// now) and its way back from Done are a swipe, the row's long press and TalkBack's actions, each answered with a
// snackbar and Undo; a failure is said in the list's banner (row-parts.tsx), never in a snackbar.
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import { errorKey } from "../../../../src/app/bridge";
import { type TermCourse, useTermCourses } from "../../../../src/app/courses";
import { useExamMarks } from "../../../../src/app/exam-marks";
import { type Format, type Translate, useT } from "../../../../src/app/i18n";
import { wibDay } from "../../../../src/core/course-meetings";
import { sittingsLine } from "../../../../src/core/exam-sittings";
import { dueOn, type Exam, examMarkKey, isExamWindow, takeHomeOf } from "../../../../src/core/exams";
import type { CalendarEvent, Task } from "../../../../src/core/models";
import type { PastExam, TodoItem } from "../../../../src/core/todo";
import { useNav } from "../../nav";
import { toast } from "../../swaps/overlays";
import { useB } from "../../ui/b";
import { LINE_INSET } from "../../ui/card-list";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { ActionSheet } from "../../ui/sheet";
import { SwipeRow } from "../../ui/swipe";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { shortName } from "../home/parts";
import { softOf } from "./flat";
import {
  countdown,
  FlatSlice,
  HeroCard,
  IconTile,
  inWorld,
  LEAF_INSET,
  type Quick,
  reportRowProblem,
  rowWhen,
  StatusPill,
  TaskLine,
  useRowWorld,
} from "./row-parts";

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

/** Whether a name already says its exam's kind ("UTS Markom" says UTS): the kind isn't said twice. */
export const namesKind = (title: string, kind: string) =>
  title
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .includes(kind.toLowerCase());

/** "Kuis Komunikasi Pemasaran": the exam's name, the course's whole, for a control's spoken label. */
const examLabel = (t: Translate, exam: Exam, name: string) => `${t(`exam.kind.${exam.kind}`)} ${name}`;

/**
 * The one name an exam has on every screen (Tugas, a Task's page, the exam's page, Ujian, search): its kind, then its
 * course's one short name: "UTS Komunikasi Pemasaran". Never a take-home's own title ("UTS Markom"): a course's two
 * exams are told apart by examNote's quiet word. `courseName`: the course list's name; without it SIX's, else the code.
 */
export const examName = (t: Translate, exam: Pick<Exam, "kind" | "courseCode" | "six">, courseName?: string): string =>
  `${t(`exam.kind.${exam.kind}`)} ${shortName(courseName ?? exam.six[0]?.courseName ?? exam.courseCode)}`;

/** What tells one course's exams apart, as a quiet word beside the one name: "Take-home", "Di Edunex", else nothing. */
export function examNote(t: Translate, part: { kind: string; source?: string } | null | undefined): string | null {
  if (part?.kind === "takehome") return t("exam.takeHome");
  if (part?.kind === "window" || (part?.kind === "sitting" && part.source === "edunex")) return t("exam.onEdunex");
  return null;
}
const examTitle = examName;

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
  hero = false,
}: {
  item: Extract<TodoItem, { kind: "exam" }>;
  inCourse?: boolean;
  /** Tugas's one big card when this exam is the nearest thing ahead (row-parts.tsx HeroCard): the same target and name. */
  hero?: boolean;
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
  const dayTime = (at: number) => f.dueLabel(at);
  // On Tugas the day leads the row (its leaf): the line keeps the weekday and the time. On a course's page, the whole date.
  // (The weekday is the leaf's too: it never trails the line.)
  const short = (at: number, time: boolean) => (inCourse ? rowWhen(f, at, time) : time ? f.time(at) : null);
  const { page } = useB();
  const moved = part?.kind === "window" && part.moved;
  const disagree = part?.kind === "sitting" && exam.disagree;

  // Every fact goes in the spoken name; the row shows the kind and when, in one line that fits in full (where it is,
  // the range and the rest are on the Exam's page), and one status. Not the course's code: the title names the course
  // (a take-home's, its tile, which the course chips over the list name), and the code is spoken.
  let facts: string[];
  let shown: (string | null)[];
  let when: string | null = null;
  let moment: number | null = null;
  let status: ReactNode = null;
  if (part?.kind === "takehome") {
    facts = [code, t("exam.takeHome"), part.task.title, part.status === "draft" ? t("taskStatus.draft") : ""];
    when = part.at !== null ? dayTime(part.at) : t("task.noDeadline");
    // The day alone beside the kind (its page and spoken name keep the time); not the kind when the name says it ("UTS Markom").
    // A take-home goes by its own name ("UTS Markom"): the line names its course, as every row of a Task does.
    // One name per exam: the title is the exam's, as its sitting's row; "Take-home" is the quiet word that tells them apart.
    shown = [t("exam.takeHome"), part.at === null ? t("task.noDeadline") : short(part.at, !inCourse)];
    moment = part.at;
  } else if (part?.kind === "window") {
    // With only its close, Edunex doesn't say when it opens: nothing is said about it.
    const opens = part.opensAt === null ? "" : part.open ? t("exam.window.open") : t("task.opens", { when: f.dayTimeWord(part.opensAt) });
    facts = [code, t("exam.onEdunex"), part.edunex.title ?? "", opens];
    when = f.dueLabel(part.at);
    shown = [short(part.at, !moved)];
    moment = part.at;
  } else if (part?.kind === "sitting" && item.sittings) {
    // SIX lists it in both weeks of the exam period: one row, both days ("Kam, 10 Des dan 17 Des, 11:00").
    facts = [code, t("exam.inClass"), part.room ?? ""];
    when = sittingsLine(f, item.sittings, { room: false });
    shown = [sittingsLine(f, item.sittings, { room: false, time: !disagree })];
    if (part.at <= now && (part.end ?? part.at) > now) status = <StatusPill tone="ok" text={t("home.now")} />;
    else moment = part.at;
  } else if (part?.kind === "sitting") {
    const place = part.source === "six" ? (part.room ?? "") : (part.title ?? "");
    facts = [code, t(part.source === "six" ? "exam.inClass" : "exam.onEdunex"), place];
    when = part.end !== null ? f.dayTimeRange(part.at, part.end) : dayTime(part.at);
    shown = [short(part.at, !disagree)];
    if (part.at <= now && (part.end ?? part.at) > now) status = <StatusPill tone="ok" text={t("home.now")} />;
    else moment = part.at;
  } else {
    facts = [code, t("exam.noDate")];
    shown = [t("exam.noDate")];
  }
  const away = moment !== null ? countdown(t, now, moment) : null;
  // The countdown only once it's within a day: a calm one's day says when on its own.
  if (away && !status && away.tone !== "neutral") status = <StatusPill tone={away.tone} text={away.text} />;

  // Only a window of known length, open now: a quiz the Student may already have taken on Edunex.
  const window = part?.kind === "window" && part.opensAt !== null && part.open ? part.edunex : null;
  const late = part?.kind === "takehome" && item.late;
  // A changed or disputed time is the one status worth more than the countdown: the Student checks it before going.
  if (moved || disagree)
    status = (
      <StatusPill
        tone="amber"
        icon={<Icons.AlertTriangle size={13} weight="bold" color={theme.v4.ambFg} />}
        text={t(moved ? "mobile.home.timeMoved" : "mobile.tasks.chip.disagree")}
      />
    );
  const title = examLabel(t, exam, name);
  const label = factsLabel(
    title,
    ...facts,
    late ? t("home.need.task.overdue") : null,
    moved ? t("exam.markChanged") : null,
    disagree ? t("exam.row.disagree", days) : null,
    when,
    moment !== null ? f.fromNow(moment) : null,
  );

  const testID = part?.kind === "takehome" ? `row.task.${part.task.id}` : `row.exam.${exam.id}`;
  const open = () => go(part?.kind === "takehome" ? { screen: "task", taskId: part.task.id } : { screen: "exam", examId: exam.id });
  if (hero && part && part.at !== null)
    return (
      <HeroCard
        testID={testID}
        label={label}
        onPress={open}
        onLongPress={onLongPress}
        quick={quick}
        code={exam.courseCode}
        at={part.at}
        date={f.dayMonth(part.at)}
        weekday={f.weekdayShort(part.at)}
        title={examTitle(t, exam, name)}
        // What it is, in a word ("Ujian", with its glyph), what tells it apart, and its time: the day is the leaf's.
        meta={[t("mobile.tasks.kindExam"), examNote(t, part), part.kind === "sitting" && part.end !== null ? f.timeRange(part.at, part.end) : f.time(part.at)]
          .filter(Boolean)
          .join(" · ")}
        kind="exam"
      />
    );
  const row = (
    <TaskLine
      // A take-home opens its Task, and is named as one: the exam's own row (its sitting) keeps the exam's id.
      testID={testID}
      label={label}
      onPress={open}
      onLongPress={window ? () => setMenu(true) : onLongPress}
      quick={window ? [{ label: t("exam.markDoneFor", { title }), onPress: () => void markDone(window) }] : quick}
      code={code || null}
      course={name}
      // What it is, every row the same: a take-home's own name, else the exam's ("UAS Komunikasi Pemasaran").
      title={examTitle(t, exam, name)}
      meta={shown.filter(Boolean).join(" · ") || t("mobile.tasks.kindExam")}
      status={status}
      date={inCourse ? undefined : part && part.at !== null ? f.dayMonth(part.at) : null}
      weekday={!inCourse && part && part.at !== null && !item.sittings ? f.weekdayShort(part.at) : null}
      kind="exam"
    />
  );
  if (!window) return row;
  return (
    <>
      <SwipeRow
        surface={inCourse ? undefined : page}
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

const NO_EXAMS: readonly Extract<TodoItem, { kind: "exam" }>[] = [];

/**
 * An exam period whose exams have no day yet: one row where the period falls ("Masa UTS", 12–16 Okt), opening to list
 * them. Closed while it's far off; open within two weeks and while it's on.
 */
export const PeriodRow = inWorld(function PeriodRow({
  item,
  inCourse = false,
  inside = NO_EXAMS,
}: {
  item: Extract<TodoItem, { kind: "period" }>;
  inCourse?: boolean;
  /** Tugas: the exams with a day in this period, in date order, drawn inside it. */
  inside?: readonly Extract<TodoItem, { kind: "exam" }>[];
}) {
  const t = useT();
  const theme = useTheme();
  const v = theme.v4;
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
  if (!inCourse)
    // On Tugas: a sub-heading where the period falls in date order, "Masa UTS" and its days, with its exams inside it
    // on one soft block: those with a day first, in date order, then those with none yet, which say so in words.
    return (
      <View
        testID={`row.period.${item.examKind}`}
        style={{
          backgroundColor: softOf(theme),
          borderRadius: 20,
          marginVertical: space[2],
          marginHorizontal: -space[2],
          paddingHorizontal: space[2],
          paddingTop: space[3],
          paddingBottom: space[1],
        }}
      >
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={factsLabel(title, main, sub)}
          style={{ flexDirection: "row", alignItems: "baseline", gap: space[2], paddingHorizontal: space[1] }}
        >
          <Text size="titleSmall" face="display" weight="bold" style={{ color: v.fg }}>
            {title}
          </Text>
          <Text size="bodyMedium" tabular style={{ flexShrink: 1, color: v.muted }}>
            {main}
          </Text>
        </View>
        {inside.map((exam, i) => (
          <FlatSlice key={exam.key} first={i === 0}>
            <ExamPartRow item={exam} />
          </FlatSlice>
        ))}
        {/* Far off: its exams with no day yet stay behind one line that says how many (they aren't counted in "Belum
            selesai" until the period is near, so the count over the list matches its rows). */}
        {item.state === "far" && item.exams.length > 0 && (
          <PressScale
            testID={`action.period.${item.examKind}`}
            accessibilityLabel={fact}
            accessibilityState={{ expanded: open }}
            onPress={() => setToggled(!toggled)}
            style={{ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 48, paddingHorizontal: space[1] }}
          >
            <Text size="bodyMedium" style={{ flex: 1, color: v.muted }}>
              {fact}
            </Text>
            <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
              <Icons.ChevronDown size={20} color={v.muted} />
            </View>
          </PressScale>
        )}
        {open &&
          item.exams.map((exam, i) => (
            <FlatSlice key={exam.id} first={i === 0 && inside.length === 0 && item.state !== "far"}>
              <PeriodExam exam={exam} inCourse={false} />
            </FlatSlice>
          ))}
      </View>
    );
  return (
    <View>
      <TaskLine
        testID={`row.period.${item.examKind}`}
        label={factsLabel(title, line, main, sub)}
        onPress={() => setToggled(!toggled)}
        expanded={open}
        flat={!inCourse}
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
            <View pointerEvents="none" style={{ height: 1, marginLeft: inCourse ? LINE_INSET : LEAF_INSET, backgroundColor: v.line }} />
            <PeriodExam exam={exam} inCourse={inCourse} />
          </View>
        ))}
    </View>
  );
});

function PeriodExam({ exam, inCourse }: { exam: Exam; inCourse: boolean }) {
  const t = useT();
  const { go } = useNav();
  const world = useRowWorld();
  const name = examCourse(world.courses, exam);
  return (
    <TaskLine
      testID={`row.exam.${exam.id}`}
      label={factsLabel(examLabel(t, exam, name), exam.courseCode, t("exam.dayUnknown"))}
      onPress={() => go({ screen: "exam", examId: exam.id })}
      code={exam.courseCode}
      course={name}
      title={examTitle(t, exam, name)}
      // Every exam row says when, this one too: no day yet.
      meta={t("exam.noDate")}
      date={inCourse ? undefined : null}
      kind="exam"
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
  const { page } = useB();
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
  // Its day in the meta line, as the rows ahead say it ("Kam 15 Okt"); the time is in its name and on its page.
  const at = sitting ? sitting.start : (online?.end ?? online?.start ?? null);
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
      title={examTitle(t, exam, name)}
      // The title names the course: the line is when.
      meta={at !== null ? (code ? f.weekdayShort(at) : rowWhen(f, at, false)) : main || t("exam.neverAnnounced")}
      date={code ? (at !== null ? f.dayMonth(at) : null) : undefined}
      kind="exam"
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
        surface={inCourse ? undefined : page}
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
