// The Task page on the phone (S3): src/app/screens/tasks.tsx's TaskPage in one column, in v4 (round 2). The title is
// the bar's (./task-bar.tsx, round 3: no big title on the page) with the course's short name and module as its one small
// line, the way up; then the deadline as the page's one big card (the course's tint, the countdown large, the day and
// time, and the Presensi window as one line whose why is a sheet away), the exam it's part of, what Edunex doesn't say
// (attendance, a short window, a lecturer's edit), then white cards: the instructions (a long one folded to its first
// lines, so the answer box shows on the first screen: ./folded.tsx), the lecturer's files, the answer,
// its comments (./thread.tsx), History. Kumpulkan stays at the bottom of the screen, the screen's one filled button,
// with Simpan draf beside it while there's something to save.
import { type ComponentRef, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Pressable, type ScrollView, StyleSheet, View } from "react-native";
import { useTermCourses } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Format, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useExams } from "../../../../src/app/schedule-data";
import { useDone } from "../../../../src/app/snoozes";
import { useDataset } from "../../../../src/app/store";
import { introModule } from "../../../../src/core/course-materials";
import { taskDoneKey } from "../../../../src/core/done";
import type { Task, TaskChange, TaskFile, TaskStatus } from "../../../../src/core/models";
import { editView, titleOnly } from "../../../../src/core/task-edits";
import {
  attendanceResult,
  attendanceSession,
  edunexTaskUrl,
  isOpenStatus,
  notOpenYet,
  shortWindow,
  submittedAt,
  taskHistory,
  taskStatus,
} from "../../../../src/core/tasks";
import { useNav } from "../../nav";
import { dayAt, dayWord } from "../../parts/day-word";
import { LecturerFile } from "../../parts/files";
import { plainText } from "../../parts/html";
import { LecturerHtml } from "../../parts/lecturer-html";
import { useMarkDone } from "../../parts/snooze";
import { usePerfDrawn } from "../../perf";
import { usePullToRefresh } from "../../shell/source-status";
import { SectionTitle } from "../../ui/card-list";
import { Celebration } from "../../ui/celebrate";
import { Button } from "../../ui/controls";
import { EmptyState } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Page } from "../../ui/layout";
import { Appear } from "../../ui/moves";
import { PressScale } from "../../ui/press";
import { Sheet } from "../../ui/sheet";
import { LINK_SLOP } from "../../ui/sizes";
import { Text } from "../../ui/text";
import { shape, space, useTheme } from "../../ui/theme";
import { useCourseTile } from "../../ui/tile";
import { TopBar } from "../../ui/top-bar";
import { shortName } from "../home/parts";
import { AfterHandIn } from "./after-hand-in";
import { examName, takeHomeWhy } from "./exam-rows";
import { Flat as Panel, pageOf, softOf } from "./flat";
import { Folded } from "./folded";
import { HandInBar, HandInCard, useHandIn } from "./hand-in";
import { withoutTitleLine } from "./instructions";
import { NoTasksYet } from "./list";
import { countdown } from "./row-parts";
import { moduleLabel } from "./rows";
import { TaskBar } from "./task-bar";
import { Thread } from "./thread";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function TaskScreen({ taskId }: { taskId: number }) {
  const t = useT();
  const theme = useTheme();
  const { go } = useNav();
  const tasks = useDataset("edunex.tasks");
  const task = tasks?.find((item) => item.id === taskId);
  // Drawn with its data: the Task, or the word that it's gone.
  usePerfDrawn(tasks !== undefined);
  if (task) return <TaskPage key={task.id} task={task} />;
  return (
    <Page testID="screen.task" header={<TopBar title={t("nav.tasks")} />} background={pageOf(theme)}>
      {tasks ? (
        <EmptyState icon={<Icons.ListChecks size={20} color={theme.color.muted} />} title={t("task.notFound")}>
          <Button size="sm" onPress={() => go({ screen: "tasks" })}>
            {t("task.backToTasks")}
          </Button>
        </EmptyState>
      ) : (
        <NoTasksYet />
      )}
    </Page>
  );
}

function TaskPage({ task }: { task: Task }) {
  const t = useT();
  // The bar already names the Task: the instructions' first line goes when it's that name again.
  const instructions = useMemo(() => withoutTitleLine(task.instructions, task.title), [task.instructions, task.title]);
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const { go } = useNav();
  const pull = usePullToRefresh();
  const v = theme.v4;
  const course = useTermCourses()?.find((c) => c.code === task.courseCode);
  const sentAt = submittedAt(task);
  const exam = useExams()?.find((e) => e.tasks.some((item) => item.id === task.id));
  const status = taskStatus(task, now);
  const late = status === "overdue" || status === "closed";
  const soon = !late && isOpenStatus(status) && task.dueAt !== null && task.dueAt - now < DAY;
  const where = moduleLabel(t, task.module);
  const handIn = useHandIn(task, status);
  // Handed in on this visit: the page's end leads on (./after-hand-in.tsx) for as long as it stays open.
  const [finished, setFinished] = useState(false);
  if (handIn.justDone === "submit" && !finished) setFinished(true);
  const presence = usePresence(task);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const historyAt = useRef(0);
  const answerAt = useRef(0);
  // Typing the answer: the box comes up into view, clear of the bar and the keyboard over it.
  const showAnswer = useCallback(() => {
    const to = () => scroll.current?.scrollTo({ y: Math.max(0, answerAt.current - space[2]), animated: true });
    to();
    const shown = Keyboard.addListener("keyboardDidShow", () => {
      shown.remove();
      to();
    });
    setTimeout(() => shown.remove(), 1000);
  }, []);
  /** "Lihat perubahannya" asks History to open its newest edit: which, and how many times asked. */
  const [reveal, setReveal] = useState<{ at: number; asked: number } | null>(null);
  useEffect(() => {
    if (reveal) scroll.current?.scrollTo({ y: Math.max(0, historyAt.current - space[4]), animated: true });
  }, [reveal]);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: pageOf(theme) }}>
      {/* One title, the Task's own, in the bar from the start: nothing big on the page under it. */}
      <Page
        testID="screen.task"
        header={
          <TaskBar
            title={task.title}
            crumb={factsLabel(course ? shortName(course.name) : task.courseCode, task.module ? t("task.module", { n: task.module.index }) : null)}
            crumbLabel={factsLabel(task.courseCode, course?.name, where)}
            onCrumb={() =>
              go(
                where
                  ? { screen: "course", code: task.courseCode, tab: "modules", module: task.moduleId ?? introModule(task.courseId) }
                  : { screen: "course", code: task.courseCode },
              )
            }
          />
        }
        scrollRef={scroll}
        background={pageOf(theme)}
        {...pull}
      >
        {/* By when, and where the Student stands: the first thing to read after the name, the page's one big card. */}
        <StatusLine task={task} status={status} late={late} soon={soon} presence={presence} />

        {exam && (
          // The exam it's part of, by the one name every screen calls it: one row that opens it. How the app knows is spoken.
          <PressScale
            accessibilityRole="link"
            accessibilityLabel={factsLabel(t("task.partOfExam", { kind: t(`exam.kind.${exam.kind}`), code: exam.courseCode }), takeHomeWhy(t, task))}
            onPress={() => go({ screen: "exam", examId: exam.id })}
            style={styles.examLink}
            testID="action.exam"
          >
            <Icons.GraduationCap size={24} color={v.fg2} />
            <Text size="bodyLarge" weight="medium" style={{ flex: 1, color: v.fg }}>
              {examName(t, exam, course?.name)}
            </Text>
            <Icons.ChevronRight size={20} color={v.muted} />
          </PressScale>
        )}

        <EditRow task={task} onSee={(at) => setReveal((was) => ({ at, asked: (was?.asked ?? 0) + 1 }))} />

        <View testID="section.instructions">
          <SectionTitle title={t("task.instructions")} />
          <Panel>
            {plainText(task.instructions) ? (
              <Folded>
                <LecturerHtml html={instructions} size="bodyLarge" />
              </Folded>
            ) : (
              <Text size="bodyLarge" style={{ color: v.muted }}>
                {t("task.noInstructions")}
              </Text>
            )}
          </Panel>
        </View>

        {task.files.length > 0 && (
          <View testID="section.files">
            <SectionTitle title={t("task.lecturerFiles")} count={task.files.length} />
            <Panel style={{ gap: space[2] }}>
              {task.files.map((file, i) => (
                <LecturerFile key={file.url} file={file} edunexUrl={edunexTaskUrl(task.id)} testID={`row.file.${i}`} />
              ))}
            </Panel>
          </View>
        )}

        <View
          testID="section.answer"
          onLayout={(event) => {
            answerAt.current = event.nativeEvent.layout.y;
          }}
        >
          <SectionTitle title={t("handIn.yourAnswer")} />
          <HandInCard h={handIn} onAnswerFocus={showAnswer} statusAbove />
        </View>
        <Thread key={`thread:${task.id}`} task={task} />
        <View
          onLayout={(event) => {
            historyAt.current = event.nativeEvent.layout.y;
          }}
        >
          <History task={task} reveal={reveal} />
        </View>
      </Page>
      <HandInBar h={handIn} />
      {finished && <AfterHandIn taskId={task.id} />}
      {handIn.justDone === "submit" && (
        <Celebration title={t("mobile.tasks.handedIn")} detail={sentAt !== null ? t("handIn.recorded", { when: f.dayTimeWord(sentAt) }) : undefined} />
      )}
    </KeyboardAvoidingView>
  );
}

/** A small fact under the status line: a glyph and a word or two, its sentence a tap away. */
type Mark = { key: string; icon: "hand" | "zap" | "lock"; word: string; color: string; why?: { title: string; body: string }; testID?: string };

/**
 * Where the Task stands, in one line a Student reads in a second: "Terkumpul 18 Sep" with a check once it's handed in,
 * else "Tenggat Jum, 25 Sep, 23:59" with the time left at its end (amber within a day, red with a warning sign once
 * late: never the colour alone). No box: the page's first line, on the page. Under it only marks (Presensi's window or
 * whether the hand-in counted as present, a short window, when it opens), each a glyph and a word whose sentence is a
 * sheet away. Every fact once: Jawabanmu no longer says "Terkumpul" again (./hand-in.tsx, `statusAbove`).
 */
function StatusLine({ task, status, late, soon, presence }: { task: Task; status: TaskStatus; late: boolean; soon: boolean; presence: Presence }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const [why, setWhy] = useState<{ title: string; body: string } | null>(null);
  const { ink } = useCourseTile()(task.courseCode);
  const sentAt = submittedAt(task);
  const away = sentAt === null && task.dueAt !== null && isOpenStatus(status) ? countdown(t, now, task.dueAt) : null;
  const tone = sentAt !== null ? v.okFg : late ? v.redFg : soon ? v.ambFg : ink;
  const sentLate = sentAt !== null && task.dueAt !== null && sentAt > task.dueAt;
  const head =
    sentAt !== null
      ? t("mobile.tasks.handedInOn", { date: f.dayMonth(sentAt) })
      : task.dueAt === null
        ? t("task.noDeadline")
        : t("task.due", { when: f.dueLabel(task.dueAt) });
  // Whether late is still taken: said to TalkBack only.
  const lateRule = away ? (task.lateAllowed ? t("handIn.lateAllowed") : t("handIn.lateNotAllowed")) : null;
  const spoken = factsLabel(
    sentAt !== null ? t("handIn.recorded", { when: f.dayTimeWord(sentAt) }) : task.dueAt === null ? head : t("task.due", { when: f.dayTimeWord(task.dueAt) }),
    away && task.dueAt !== null ? f.fromNow(task.dueAt) : null,
    sentLate ? t("mobile.tasks.handedInLate") : null,
    lateRule,
  );
  const marks = useMarks(task, presence);
  return (
    <View testID="card.due" style={{ gap: space[1], paddingTop: space[1] }}>
      <View accessible accessibilityLabel={spoken} style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48 }}>
        {sentAt !== null ? (
          <Icons.CheckCircle size={24} weight="fill" color={tone} />
        ) : late ? (
          <Icons.AlertTriangle size={24} weight="bold" color={tone} />
        ) : (
          <Icons.Clock size={24} color={tone} />
        )}
        <Text size="titleMedium" face="display" weight="bold" tabular style={{ flex: 1, color: v.fg }}>
          {head}
          {sentLate && (
            <Text size="bodyMedium" weight="regular" style={{ color: v.ambFg }}>
              {`  ${t("mobile.tasks.handedInLate")}`}
            </Text>
          )}
        </Text>
        {away && (
          <Text size="bodyLarge" weight="semibold" tabular style={{ color: away.late ? v.redFg : soon ? v.ambFg : v.fg2 }}>
            {away.text}
          </Text>
        )}
      </View>
      {marks.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space[5], rowGap: space[2], paddingLeft: 24 + space[3] }}>
          {marks.map((mark) => {
            const Icon = mark.icon === "zap" ? Icons.Zap : mark.icon === "lock" ? Icons.Lock : Icons.Hand;
            const body = (
              <>
                <Icon size={16} color={mark.color} />
                <Text size="bodyMedium" weight="medium" tabular style={{ flexShrink: 1, color: mark.color }}>
                  {mark.word}
                </Text>
              </>
            );
            const why = mark.why;
            return why ? (
              <Pressable
                key={mark.key}
                testID={mark.testID}
                accessibilityRole="button"
                accessibilityLabel={factsLabel(mark.word, why.body)}
                onPress={() => setWhy(why)}
                hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                style={styles.mark}
              >
                {body}
                <Icons.Info size={16} color={v.muted} />
              </Pressable>
            ) : (
              <View key={mark.key} style={styles.mark}>
                {body}
              </View>
            );
          })}
        </View>
      )}
      <Sheet open={why !== null} onClose={() => setWhy(null)} title={why?.title} background={v.card} testID="sheet.presence">
        <Text size="bodyLarge" style={{ color: v.fg, paddingBottom: space[4] }}>
          {why?.body}
        </Text>
      </Sheet>
    </View>
  );
}

type Presence = ReturnType<typeof usePresence>;

/**
 * The Task's Presensi, read once for the due card and Notes: how a hand-in counted, the session still to come. `due`:
 * while handing it in can still count as present, its window as the due card's line says it (the time alone on the
 * deadline's own day, "15:00–23:59", else with its day, "Kam, 12 Nov, 15:00–23:59"), and the day and time a sentence
 * says it with. Edunex's window as last read: a change there shows here.
 */
function usePresence(task: Task) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const presence = useDataset("edunex.presence");
  const sessions = presence?.[task.courseCode] ?? [];
  const result = attendanceResult(task, sessions, now);
  const session = isOpenStatus(taskStatus(task, now)) ? attendanceSession(task, sessions, now) : null;
  let due: { line: string; date: string; time: string } | null = null;
  if (!result && session && session.closesAt > now) {
    const time = f.timeRange(session.opensAt, session.closesAt);
    const sameDay = task.dueAt !== null && f.dayOffset(session.opensAt) === f.dayOffset(task.dueAt);
    due = { line: sameDay ? time : f.dayTimeRange(session.opensAt, session.closesAt), date: dayWord(f, t, session.opensAt), time };
  }
  return { now, result, session, due };
}

/**
 * What Edunex doesn't say on its Task page, as marks under the status line (never a sentence on the page): Presensi
 * still ahead ("Presensi 15:00–23:59"), whether a hand-in counted ("Hadir", "Tidak hadir"), one missed, a short
 * window, when it opens. No system says whether the lecturer uses Edunex's Presence where SIX counts too, so it's
 * never called optional.
 */
function useMarks(task: Task, presence: Presence): Mark[] {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const { now, result, session, due } = presence;
  const marks: Mark[] = [];
  const title = t("mobile.tasks.presenceWhy");
  const range = (opensAt: number, closesAt: number) => dayAt(dayWord(f, t, opensAt), f.timeRange(opensAt, closesAt));
  if (task.opensAt !== null && notOpenYet(task, now))
    marks.push({ key: "opens", icon: "lock", word: t("task.opens", { when: f.dayTimeWord(task.opensAt) }), color: v.fg2 });
  if (due)
    marks.push({
      key: "presence",
      icon: "hand",
      word: t("task.attendanceLine", { when: due.line }),
      color: v.fg2,
      why: { title, body: t("mobile.tasks.presenceWhyBody", { date: due.date, time: due.time }) },
      testID: "line.presence",
    });
  else if (result)
    marks.push(
      result.outcome === "counted"
        ? {
            key: "present",
            icon: "hand",
            word: t("mobile.tasks.present"),
            color: v.okFg,
            why: { title, body: t("task.note.attendanceCounted", { when: range(result.session.opensAt, result.session.closesAt) }) },
            testID: "line.presence",
          }
        : {
            key: "absent",
            icon: "hand",
            word: t("mobile.tasks.notPresent"),
            color: v.redFg,
            why: { title, body: t("task.note.attendanceOutside", { when: range(result.session.opensAt, result.session.closesAt) }) },
            testID: "line.presence",
          },
    );
  else if (session && session.closesAt <= now && !session.recorded?.present)
    marks.push({
      key: "missed",
      icon: "hand",
      word: t("mobile.tasks.presenceMissed"),
      color: v.fg2,
      why: { title, body: t("task.note.attendanceMissed", { when: range(session.opensAt, session.closesAt) }) },
      testID: "line.presence",
    });
  const window = shortWindow(task);
  if (window !== null && task.opensAt !== null && task.dueAt !== null) {
    const duration =
      window >= HOUR ? t("task.duration.hours", { count: Math.round(window / HOUR) }) : t("task.duration.minutes", { count: Math.round(window / MINUTE) });
    marks.push({
      key: "short",
      icon: "zap",
      word: t("mobile.tasks.shortWindow", { duration }),
      color: v.fg2,
      why: { title: t("mobile.tasks.shortWindow", { duration }), body: t("task.note.shortWindow", { duration, range: f.timeRange(task.opensAt, task.dueAt) }) },
    });
  }
  return marks;
}

const BEFORE_FOR = 14 * DAY;

/**
 * A lecturer's edit, as one row: "Diubah dosen 22 Sep", an info button with the why behind it (what it means for a
 * handed-in answer, and the way to what changed in History), and its one action, "Sudah kucek" (48 dp). Amber after
 * hand-in or when the deadline was pulled in to within a day, quiet otherwise. After hand-in it stays until checked;
 * before hand-in, for two weeks or until checked, and not for a new title alone. An edit where nothing compared
 * changed is History's line only. Once checked here, one quiet line with Undo until the page is left.
 */
function EditRow({ task, onSee }: { task: Task; onSee: (at: number) => void }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const v = theme.v4;
  const [why, setWhy] = useState(false);
  const { entries, unmark } = useDone();
  const view = editView(task, useDataset("edunex.taskEdits"), entries);
  const shownAt = useRef(now);
  const at = view?.record?.at ?? task.editedAt ?? 0;
  const put = useMarkDone(view && task.editedAt !== null ? taskDoneKey(task, "edited", at) : null, "checked", t("done.toast.checked"));
  if (!view || task.editedAt === null) return null;
  const sentAt = submittedAt(task);
  const age = now - at;
  const edited = f.dayMonth(at);
  if (view.checked) {
    const checked = view.checked;
    if (checked.at < shownAt.current) return null;
    const line = t("done.line.checked", { when: f.dayTimeWord(checked.at) });
    return (
      <Appear style={{ marginTop: space[2], flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[2], minHeight: 48 }}>
        <Icons.Check size={16} weight="bold" color={v.okFg} />
        <Text size="bodyMedium" style={{ flexShrink: 1, color: v.muted }}>
          {line}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("done.undoFor", { what: line })}
          onPress={() => void unmark(checked.id).catch(() => undefined)}
          hitSlop={LINK_SLOP}
          testID="action.undo"
        >
          <Text size="bodyMedium" weight="semibold" tone="accent">
            {t("action.undo")}
          </Text>
        </Pressable>
      </Appear>
    );
  }
  const after = view.afterSubmit && sentAt !== null;
  if (view.state === "unknown" && !after) return null;
  if (view.state === "none") return null;
  if (view.state !== "unknown" && !view.afterSubmit && (titleOnly(view.changes) || age >= BEFORE_FOR)) return null;
  const known = view.state !== "unknown";
  const pulledIn = known && view.changes.some((c) => c.kind === "deadline" && c.from !== null && c.to !== null && c.to < c.from && c.to - now <= DAY);
  const warn = view.afterSubmit || pulledIn;
  const [bg, fg] = warn ? [v.ambBg, v.ambFg] : [softOf(theme), v.fg];
  const head = t("mobile.tasks.editedOn", { date: edited });
  const sentence = !known
    ? t("task.note.editedAfterSubmit", { edited, sent: f.dayMonth(sentAt ?? at) })
    : after
      ? t("task.change.afterSubmit", { edited, sent: f.dayMonth(sentAt ?? at) })
      : t("task.change.before", { edited });
  const more = !known ? t("task.change.unknown") : after ? t("task.change.whatToDo") : null;
  return (
    <View testID="row.edited" style={[styles.edited, { backgroundColor: bg }]}>
      <Icons.PenLine size={20} weight="bold" color={fg} />
      <Text size="bodyLarge" weight="semibold" style={{ flex: 1, color: fg }}>
        {head}
      </Text>
      <Pressable
        testID="action.editedWhy"
        accessibilityRole="button"
        accessibilityLabel={factsLabel(t("mobile.tasks.editedWhy"), sentence)}
        onPress={() => setWhy(true)}
        hitSlop={4}
        style={{ width: 40, height: 48, alignItems: "center", justifyContent: "center" }}
      >
        <Icons.Info size={20} color={fg} />
      </Pressable>
      <PressScale
        testID="action.done"
        accessibilityRole="button"
        accessibilityLabel={t("done.checkedFor", { title: factsLabel(task.title, task.courseCode) })}
        onPress={put}
        style={[styles.checked, { borderColor: fg }]}
      >
        <Icons.Check size={16} weight="bold" color={fg} />
        <Text size="bodyMedium" weight="semibold" style={{ color: fg }}>
          {t("done.checked")}
        </Text>
      </PressScale>
      <Sheet
        open={why}
        onClose={() => setWhy(false)}
        title={head}
        background={v.card}
        testID="sheet.edited"
        footer={
          known ? (
            <Button
              variant="primary"
              size="lg"
              testID="action.seeChange"
              onPress={() => {
                setWhy(false);
                onSee(at);
              }}
            >
              {t("task.change.see")}
            </Button>
          ) : undefined
        }
      >
        <View style={{ gap: space[3], paddingBottom: space[4] }}>
          <Text size="bodyLarge" style={{ color: v.fg }}>
            {sentence}
          </Text>
          {more && (
            <Text size="bodyLarge" style={{ color: v.fg2 }}>
              {more}
            </Text>
          )}
        </View>
      </Sheet>
    </View>
  );
}

/** A date the way the whole app says it: "Jum, 9 Okt, 23:59". */
const stamp = (f: Format, at: number) => f.dueLabel(at);

function History({ task, reveal }: { task: Task; reveal: { at: number; asked: number } | null }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const c = theme.color;
  const v = theme.v4;
  const open = useOpenExternal();
  const edits = useDataset("edunex.taskEdits");
  const steps = taskHistory(task, edits);
  const sentAt = submittedAt(task);
  const [opened, setOpened] = useState<number | null>(null);
  const [compare, setCompare] = useState<{ change: Extract<TaskChange, { kind: "instructions" }>; at: number } | null>(null);
  useEffect(() => {
    if (reveal) setOpened(reveal.at);
  }, [reveal]);
  return (
    <View>
      {steps.length >= 2 && (
        <>
          <SectionTitle title={t("history.title")} />
          <Panel>
            <View style={{ marginLeft: 4, borderLeftWidth: StyleSheet.hairlineWidth * 2, borderLeftColor: v.line, paddingLeft: space[4], gap: space[3] }}>
              {steps.map((step) => {
                const afterSubmit = step.kind === "edited" && sentAt !== null && step.at > sentAt;
                const known = step.kind === "edited" && step.edit && step.edit.changes.length > 0 ? step.edit : null;
                const isOpen = opened === step.at;
                const dot =
                  step.kind === "submitted"
                    ? { backgroundColor: c.live }
                    : afterSubmit
                      ? { backgroundColor: c.meterWarning }
                      : step.at > now && step.kind !== "draft"
                        ? { backgroundColor: v.card, borderWidth: 1, borderColor: c.faint }
                        : // The desktop's faint at 60%: seen on the line in light and dark.
                          { backgroundColor: `${c.faint}99` };
                return (
                  <View key={`${step.kind}:${step.at}`}>
                    <View style={[styles.dot, dot, { borderColor: (dot as { borderColor?: string }).borderColor ?? v.card }]} />
                    {known ? (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded: isOpen }}
                          onPress={() => setOpened(isOpen ? null : step.at)}
                          hitSlop={{ top: 2, bottom: 2 }}
                          style={{ flexDirection: "row", alignItems: "flex-start", gap: space[1], minHeight: 44 }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text size="small" weight="medium">
                              {t("history.edited")}
                            </Text>
                            <Text size="small" tone="faint" tabular>
                              {f.dueLabel(step.at)}
                            </Text>
                          </View>
                          <View style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }], marginTop: 2 }}>
                            <Icons.ChevronDown size={14} color={c.faint} />
                          </View>
                        </Pressable>
                        {isOpen && (
                          <View style={{ paddingTop: space[1.5], gap: space[2] }}>
                            <ChangeList changes={known.changes} onCompare={(change) => setCompare({ change, at: step.at })} />
                            {afterSubmit && (
                              <Text size="small" tone="muted">
                                {t("task.change.whatToDo")}
                              </Text>
                            )}
                          </View>
                        )}
                      </>
                    ) : (
                      <>
                        <Text size="small" weight="medium">
                          {t(`history.${step.kind}`)}
                        </Text>
                        <Text size="small" tone="faint" tabular>
                          {f.dueLabel(step.at)}
                        </Text>
                        {step.kind === "edited" && (
                          <Text size="small" tone="muted">
                            {t(step.edit ? "change.none" : "change.unknown")}
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          </Panel>
        </>
      )}
      <PressScale
        accessibilityRole="link"
        onPress={() => open(edunexTaskUrl(task.id))}
        testID="action.openInEdunex"
        style={[styles.openIn, { borderColor: v.line }]}
      >
        <Icons.ArrowUpRight size={20} color={v.fg2} />
        <Text size="bodyLarge" weight="semibold" style={{ color: v.fg }}>
          {t("action.openInEdunex")}
        </Text>
      </PressScale>
      {compare && <InstructionsCompare change={compare.change} at={compare.at} onClose={() => setCompare(null)} />}
    </View>
  );
}

/** One edit's changes, one plain line each: "Tenggat: Jum, 9 Okt, 23:59 → Sen, 12 Okt, 23:59", "Berkas baru: brief-v2.pdf". */
function ChangeList({ changes, onCompare }: { changes: readonly TaskChange[]; onCompare: (change: Extract<TaskChange, { kind: "instructions" }>) => void }) {
  const t = useT();
  const f = useFormat();
  const kind = (k: Task["kind"]) => (k === "task" ? "" : k.toUpperCase());
  const fromTo = (label: string, from: string, to: string) => (
    <Text size="small" accessibilityLabel={`${label} ${t("change.fromTo", { from, to })}`}>
      {`${label}: ${from} → ${to}`}
    </Text>
  );
  const names = (files: readonly TaskFile[]) => f.list(files.map((file) => file.name));
  const line = (change: TaskChange): ReactNode => {
    switch (change.kind) {
      case "deadline":
        return fromTo(
          t("change.deadline"),
          change.from === null ? t("change.none.value") : stamp(f, change.from),
          change.to === null ? t("change.none.value") : stamp(f, change.to),
        );
      case "opens":
        return fromTo(
          t("change.opens"),
          change.from === null ? t("change.rightAway") : stamp(f, change.from),
          change.to === null ? t("change.rightAway") : stamp(f, change.to),
        );
      case "title":
        return fromTo(t("change.title"), change.from, change.to);
      case "instructions":
        return (
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[2] }}>
            <Text size="small">{t("change.instructions")}</Text>
            <Pressable accessibilityRole="button" onPress={() => onCompare(change)} hitSlop={LINK_SLOP}>
              <Text size="small" weight="medium" tone="accent">
                {t("change.instructions.show")}
              </Text>
            </Pressable>
          </View>
        );
      case "files": {
        const replaced = change.added.filter((file) => change.removed.some((old) => old.name === file.name));
        const added = change.added.filter((file) => !replaced.includes(file));
        const removed = change.removed.filter((file) => !replaced.some((r) => r.name === file.name));
        return (
          <View>
            {replaced.length > 0 && <Text size="small">{t("change.fileReplaced", { files: names(replaced), count: replaced.length })}</Text>}
            {added.length > 0 && <Text size="small">{t("change.filesAdded", { files: names(added), count: added.length })}</Text>}
            {removed.length > 0 && <Text size="small">{t("change.filesRemoved", { files: names(removed), count: removed.length })}</Text>}
          </View>
        );
      }
      case "lateAllowed":
        return <Text size="small">{t(change.to ? "change.lateOn" : "change.lateOff")}</Text>;
      case "fileRequired":
        return <Text size="small">{t(change.to ? "change.fileRequiredOn" : "change.fileRequiredOff")}</Text>;
      case "group":
        return <Text size="small">{t(change.to ? "change.groupOn" : "change.groupOff")}</Text>;
      case "examKind":
        return (
          <Text size="small">
            {change.to === "task" ? t("change.examKindOff", { kind: kind(change.from) }) : t("change.examKind", { kind: kind(change.to) })}
          </Text>
        );
    }
  };
  return (
    <View style={{ gap: space[1] }}>
      {changes.map((change) => (
        <View key={change.kind}>{line(change)}</View>
      ))}
    </View>
  );
}

/**
 * The instructions as they are now and as they were before an edit, each whole, one under the
 * other. A paragraph that's new or changed gets a quiet edge in "Sekarang", said to screen readers too.
 */
function InstructionsCompare({ change, at, onClose }: { change: Extract<TaskChange, { kind: "instructions" }>; at: number; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const lines = (text: string) => text.split("\n").filter((line) => line.trim() !== "");
  const before = lines(change.before);
  const had = new Set(before);
  const side = (title: string, paragraphs: string[], marks: boolean) => (
    <View style={{ gap: space[2] }}>
      <Text size="small" weight="semibold" tone="muted" accessibilityRole="header">
        {title}
      </Text>
      {paragraphs.length ? (
        paragraphs.map((paragraph, i) =>
          marks && !had.has(paragraph) ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: the same paragraph can repeat; its place is its identity
            <View key={i} style={{ borderLeftWidth: 2, borderLeftColor: theme.color.infoFg, paddingLeft: space[3] }}>
              <Text size="body" selectable accessibilityLabel={`${t("task.instructions.changedPart")} ${paragraph}`}>
                {paragraph}
              </Text>
            </View>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: as above
            <Text key={i} size="body" selectable>
              {paragraph}
            </Text>
          ),
        )
      ) : (
        <Text size="body" tone="muted">
          {t("task.instructions.empty")}
        </Text>
      )}
    </View>
  );
  return (
    <Sheet open onClose={onClose} title={t("task.instructions.compare", { date: f.dayMonth(at) })} testID="sheet.compare">
      <View style={{ gap: space[6], paddingBottom: space[4] }}>
        {side(t("task.instructions.now"), lines(change.after), true)}
        {side(t("task.instructions.before"), before, false)}
        {change.cut && (
          <Text size="small" tone="muted">
            {t("task.instructions.cut")}
          </Text>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  dot: { position: "absolute", left: -space[4] - 5, top: 4, width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  mark: { flexDirection: "row", alignItems: "center", gap: space[1], minHeight: 24 },
  edited: {
    marginTop: space[3],
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    minHeight: 64,
    borderRadius: shape.lg,
    paddingLeft: space[4],
    paddingRight: space[2],
    paddingVertical: space[2],
  },
  checked: { flexDirection: "row", alignItems: "center", gap: space[1], minHeight: 48, borderRadius: 24, borderWidth: 1, paddingHorizontal: space[4] },
  examLink: { marginTop: space[2], flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56 },
  openIn: {
    marginTop: space[6],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: space[5],
  },
});
