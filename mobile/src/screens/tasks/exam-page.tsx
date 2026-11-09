// The exam page on the phone (S4): src/app/screens/exam.tsx's ExamPage in one column, with the same
// facts, in v4 (round 2): one date card (the day, the time and the room big on the course's tint), then one group of
// rows (the take-home Task, the attendance before it), what to do when SIX and Edunex disagree, what to study, the
// other exams. The phone's calendar, the lecturer's announcements and the official pages are under ⋮.
// An Edunex window open now can be marked done here too, with Undo (Tandai selesai).
import * as Clipboard from "expo-clipboard";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import { Linking, Text as NativeText, Pressable, StyleSheet, View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { budgetLabel } from "../../../../src/app/attendance-labels";
import { errorKey } from "../../../../src/app/bridge";
import { type TermCourse, useTermCourses } from "../../../../src/app/courses";
import { useExamMarkList, useExamMarks } from "../../../../src/app/exam-marks";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useLang, useNow, useT } from "../../../../src/app/i18n";
import { useExams } from "../../../../src/app/schedule-data";
import { useDataset, useStore } from "../../../../src/app/store";
import { sittingsLine } from "../../../../src/core/exam-sittings";
import { type Exam, examAhead, examKind, examMarkOn, examParts } from "../../../../src/core/exams";
import { edunexCourseUrl, sixTimetableUrl } from "../../../../src/core/links";
import type { ClassSession, TaskStatus } from "../../../../src/core/models";
import { phoneItems } from "../../../../src/core/phone-calendar";
import { edunexTaskUrl, taskStatus } from "../../../../src/core/tasks";
import { useNav } from "../../nav";
import { LecturerFile } from "../../parts/files";
import { usePerfDrawn } from "../../perf";
import { usePullToRefresh } from "../../shell/source-status";
import { toast } from "../../swaps/overlays";
import { absenceName, absenceTone } from "../../ui/absence";
import { BigButton } from "../../ui/big-button";
import { CardList, Panel, SectionTitle } from "../../ui/card-list";
import { Button } from "../../ui/controls";
import { EmptyState, Skeleton } from "../../ui/display";
import { Group, GroupRow, IconTile, Pill } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel, Notice, Page, Row } from "../../ui/layout";
import { OverflowMenu } from "../../ui/menu";
import { PressScale } from "../../ui/press";
import type { SheetChoice } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { radius, shape, space, useTheme } from "../../ui/theme";
import { CourseTile, useCourseTile } from "../../ui/tile";
import { TopBar } from "../../ui/top-bar";
import { addToPhoneCalendar, shareIcs } from "../schedule/phone-calendar";
import { examCalendarItems } from "./exam-calendar";
import { dayLabel, examWeekLabel, sourceDays } from "./exam-rows";

export function ExamScreen({ examId }: { examId: string }) {
  const t = useT();
  const theme = useTheme();
  const exams = useExams();
  const courses = useTermCourses();
  // Drawn with its data: the exam, or the word that it's gone.
  usePerfDrawn(exams !== undefined);
  if (!exams)
    return (
      <Page testID="screen.exam" header={<TopBar title={t("nav.tasks")} />} background={theme.v4.page}>
        <Skeleton width={96} />
        <Skeleton width="80%" height={32} style={{ marginTop: space[3] }} />
        <Skeleton height={128} style={{ marginTop: space[8] }} />
      </Page>
    );
  const exam = exams.find((e) => e.id === examId);
  if (!exam)
    return (
      <Page testID="screen.exam" header={<TopBar title={t("nav.tasks")} />} background={theme.v4.page}>
        <EmptyState icon={<Icons.GraduationCap size={20} color={theme.color.muted} />} title={t("exam.notFound")} />
      </Page>
    );
  const course = courses?.find((c) => c.code === exam.courseCode);
  return <ExamPage exam={exam} exams={exams} course={course} />;
}

function ExamPage({ exam, exams, course }: { exam: Exam; exams: Exam[]; course: TermCourse | undefined }) {
  const courses = useTermCourses();
  const courseOf = (code: string) => courses?.find((c) => c.code === code)?.name;
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const c = theme.color;
  const v = theme.v4;
  const { ink, tint } = useCourseTile()(exam.courseCode);
  const pull = usePullToRefresh();
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
  // SIX's sittings as cards: one for all of them when they share the time and the room (both weeks of the exam period).
  const sixCards = useMemo(() => {
    const [first] = exam.six;
    const same = first && exam.six.every((s) => f.timeRange(s.start, s.end) === f.timeRange(first.start, first.end) && s.room === first.room);
    return same && exam.six.length > 1 ? [exam.six] : exam.six.map((s) => [s]);
  }, [exam, f]);

  const copyQuestion = async () => {
    // Greeted for the time it's copied ("Selamat pagi" at 8): it's usually pasted right away.
    const text = t("examPage.question", { greeting: f.greeting(), kind: t(`exam.kind.${exam.kind}`), code: exam.courseCode, name, ...days });
    try {
      await Clipboard.setStringAsync(text);
      toast(t("examPage.copied"), "success");
    } catch {
      toast(text);
    }
  };

  // The rare ways out, under ⋮: the phone's calendar, the lecturer's announcements, the official pages.
  const calendar = useExamCalendar(exam);
  const menu: SheetChoice[] = [];
  if (calendar.choice) menu.push(calendar.choice);
  menu.push({
    label: t("examPage.checkAnnouncements"),
    icon: <Icons.Megaphone size={20} color={c.onSurfaceVariant} />,
    onPress: () => go({ screen: "course", code: exam.courseCode, tab: "announcements" }),
    testID: "action.announcements",
  });
  const external = (label: string, url: string, key: string): SheetChoice => ({
    label,
    icon: <Icons.ArrowUpRight size={20} color={c.onSurfaceVariant} />,
    onPress: () => open(url),
    testID: `action.official.${key}`,
  });
  if (exam.six.length > 0 && student) menu.push(external(t("examPage.seeSix"), sixTimetableUrl(student), "six"));
  for (const task of exam.tasks)
    menu.push(
      external(exam.tasks.length > 1 ? factsLabel(t("examPage.seeTask"), task.title) : t("examPage.seeTask"), edunexTaskUrl(task.id), `task.${task.id}`),
    );
  if (!exam.tasks.length && course?.edunex) menu.push(external(t("examPage.seeCourse"), edunexCourseUrl(course.edunex.courseId), "course"));
  // The date card says the day; the line under the name only when there's no card to say it (an exam week's card too).
  const weekCard = !dated && exam.week !== null && exam.week !== undefined && (exam.kind === "UTS" || exam.kind === "UAS");
  const card = exam.six.length > 0 || exam.edunex.length > 0 || weekCard;

  return (
    // One title: the exam's own, on the page; the bar carries Back and ⋮.
    <Page testID="screen.exam" header={<TopBar actions={<OverflowMenu choices={menu} testID="action.examMenu" />} />} background={v.page} {...pull}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <KindPill kind={t(`exam.kind.${exam.kind}`)} />
        <CourseTile code={exam.courseCode} name={course?.name} size={24} />
        <Text size="labelLarge" tabular style={{ color: v.fg2 }}>
          {exam.courseCode}
        </Text>
      </View>
      <Text size="headlineSmall" face="display" weight="bold" accessibilityRole="header" style={{ marginTop: space[2], color: v.fg, letterSpacing: -0.3 }}>
        {name}
      </Text>
      {!card && (
        <Text size="bodyMedium" style={{ marginTop: space[1], color: v.muted }}>
          {exam.at !== null ? factsLabel(f.dateLong(exam.at), f.fromNow(exam.at)) : t("exam.noDate")}
        </Text>
      )}

      <View testID="section.when">
        <SectionTitle title={t("exam.when")} />
        <View style={{ gap: space[3] }}>
          {sixCards.map((group) => {
            // SIX's sitting: the day, the time and the room, big, on the course's tint (the page's one big card). Listed in
            // both weeks of the exam period at the same time and room: one card with both days, a day behind the Student muted.
            const session = group.find((one) => one.end > now) ?? group[0]!;
            return (
              <View key={session.id} style={[styles.card, { backgroundColor: tint, borderRadius: 24 }]} testID={`card.sitting.${session.id}`}>
                <Text size="labelLarge" weight="semibold" style={{ color: ink }}>
                  {factsLabel(t("exam.inClass"), session.start > now && f.fromNow(session.start))}
                </Text>
                <Text
                  face="display"
                  weight="extrabold"
                  tabular
                  accessibilityLabel={group.length > 1 ? sittingsLine(f, group, { time: false, room: false }) : undefined}
                  style={{ marginTop: space[1], color: v.fg, fontSize: 28, lineHeight: 36, letterSpacing: -0.5 }}
                >
                  {group.length > 1 ? <SittingDays sittings={group} now={now} muted={v.muted} /> : dayLabel(f, session.start)}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: space[2] }}>
                  <Text size="titleLarge" face="display" weight="bold" tabular style={{ color: v.fg }}>
                    {f.timeRange(session.start, session.end)}
                  </Text>
                  <Text size="bodyMedium" style={{ color: v.fg2 }}>
                    {t("exam.length", { minutes: Math.round((session.end - session.start) / 60_000) })}
                  </Text>
                </View>
                {/* The room on the same tint: no box inside the card. */}
                <View style={styles.room}>
                  <Icons.MapPin size={20} weight="fill" color={session.room ? ink : v.muted} />
                  {session.room ? (
                    <Text size="titleMedium" face="display" weight="bold" style={{ flexShrink: 1, color: v.fg }}>
                      {session.room}
                    </Text>
                  ) : (
                    <Text size="bodyLarge" style={{ color: v.fg2 }}>
                      {t("exam.noRoom")}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
          {exam.edunex.map((e, i) => (
            <EdunexCard key={e.id} exam={exam} edunex={e} lead={exam.six.length === 0 && i === 0} />
          ))}
          {/* The one place the page says when: the exam week, and that its day isn't out yet (or never was). */}
          {weekCard && exam.week && (exam.kind === "UTS" || exam.kind === "UAS") && (
            <View style={[styles.card, { backgroundColor: tint, borderRadius: 24 }]} testID="card.examWeek">
              <Text size="titleLarge" face="display" weight="bold" style={{ color: v.fg }}>
                {examWeekLabel(t, f, exam.kind, exam.week)}
              </Text>
              <Text size="bodyMedium" style={{ marginTop: space[1], color: v.fg2 }}>
                {t(ahead ? "exam.dayUnknown" : "exam.neverAnnounced")}
              </Text>
            </View>
          )}
          <ExamRows exam={exam} ahead={ahead} />
        </View>
        {exam.disagree && (
          <View style={{ marginTop: space[3] }}>
            <Notice
              tone="warning"
              title={t("examPage.disagreeTitle")}
              action={
                <>
                  <Button size="sm" icon={<Icons.ClipboardCheck size={14} />} onPress={() => void copyQuestion()} testID="action.copyQuestion">
                    {t("examPage.copyQuestion")}
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => go({ screen: "course", code: exam.courseCode, tab: "announcements" })}>
                    {t("examPage.announcements")}
                  </Button>
                </>
              }
            >
              {t("examPage.disagreeBody", days)}
            </Notice>
          </View>
        )}
        {calendar.problem}
      </View>

      <Study exam={exam} />

      {others.length > 0 && (
        <View>
          <SectionTitle title={t("exam.others")} count={others.length} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {others.map((other) => (
              <PressScale
                key={other.id}
                testID={`row.exam.${other.id}`}
                accessibilityRole="button"
                onPress={() => go({ screen: "exam", examId: other.id })}
                style={[styles.other, { backgroundColor: v.card }]}
              >
                <KindPill kind={t(`exam.kind.${other.kind}`)} />
                <CourseTile code={other.courseCode} name={courseOf(other.courseCode)} size={24} />
                <Text size="labelLarge" style={{ color: v.fg }}>
                  {other.courseCode}
                </Text>
                <Text size="bodyMedium" style={{ color: v.muted }}>
                  {other.at !== null
                    ? f.dayMonth(other.at)
                    : other.week && (other.kind === "UTS" || other.kind === "UAS")
                      ? examWeekLabel(t, f, other.kind, other.week)
                      : t("exam.noDate")}
                </Text>
              </PressScale>
            ))}
          </View>
        </View>
      )}
    </Page>
  );
}

/** "UTS", "UAS", "Kuis": the kind in the brand's ink on its tint. */
function KindPill({ kind }: { kind: string }) {
  const v = useTheme().v4;
  return (
    <View style={{ backgroundColor: v.brandTint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text size="labelMedium" weight="semibold" style={{ color: v.brandInk }}>
        {kind}
      </Text>
    </View>
  );
}

/**
 * "Tambahkan ke kalender HP", as a ⋮ choice: this exam's sittings and take-home deadlines into the phone's "Edunex
 * Plus" calendar, as Jadwal's sheet puts them there (adding again updates them). Only while the exam has a date
 * somewhere. What went wrong is said on the page under the dates, with its one fix.
 */
function useExamCalendar(exam: Exam): { choice: SheetChoice | null; problem: ReactNode } {
  const t = useT();
  const lang = useLang();
  const now = useNow();
  const store = useStore();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; fix?: "settings" | "share" } | null>(null);
  // The exam is worked out from the same datasets: a new one comes with it.
  const items = useMemo(
    () =>
      examCalendarItems(
        phoneItems((name) => store.dataset(name)?.value as never, lang, now),
        exam,
      ),
    [store, lang, now, exam],
  );
  if (items.length === 0) return { choice: null, problem: null };
  const share = () => {
    setProblem(null);
    void shareIcs(items, now).catch(() => setProblem({ text: t("mobile.calendar.shareFailed") }));
  };
  const add = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      // Nothing else in the calendar is touched: no span to tidy, only these events put in or updated.
      const result = await addToPhoneCalendar(items, new Set(), { from: 0, until: 0 });
      if (result.kind === "added") toast(t("mobile.calendar.added", { count: result.events }), "success");
      else setProblem({ text: t("mobile.exam.calendarDenied"), fix: "settings" });
    } catch {
      setProblem({ text: t("mobile.calendar.failed"), fix: "share" });
    } finally {
      setBusy(false);
    }
  };
  return {
    choice: {
      label: t("schedule.export"),
      icon: <Icons.Smartphone size={20} color={theme.color.onSurfaceVariant} />,
      onPress: () => void add(),
      testID: "action.examToCalendar",
    },
    problem: problem && (
      // Said where it happened, with its one fix (a snackbar is gone before it's read).
      <View style={{ marginTop: space[3] }}>
        <Notice
          tone="danger"
          title={problem.text}
          testID="notice.examToCalendar"
          action={
            problem.fix === "settings" ? (
              <Button size="sm" variant="tonal" onPress={() => void Linking.openSettings()}>
                {t("mobile.calendar.settings")}
              </Button>
            ) : problem.fix === "share" ? (
              <Button size="sm" variant="tonal" onPress={share}>
                {t("mobile.calendar.share")}
              </Button>
            ) : undefined
          }
        />
      </View>
    ),
  };
}

/**
 * Edunex's own exam: its day and time, and its title. A window open now (a quiz open for days) has
 * Tandai selesai under it, the one thing about it the app can't see; once marked, the way back. With no SIX sitting
 * (`lead`) it is the page's date card, on the course's tint with how far off it is.
 */
function EdunexCard({ exam, edunex, lead }: { exam: Exam; edunex: Exam["edunex"][number]; lead: boolean }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const { ink, tint } = useCourseTile()(exam.courseCode);
  const marks = useExamMarks();
  const list = useExamMarkList();
  const part = examParts(exam, now, list).find((p) => p.kind === "window" && p.edunex.id === edunex.id);
  const window = part?.kind === "window" && part.opensAt !== null && part.open ? part : null;
  const mark = examMarkOn(edunex, list);
  const name = `${t(`exam.kind.${exam.kind}`)} ${exam.courseCode}`;
  // What went wrong, said on the card it happened on (a snackbar is gone before it's read).
  const [failed, setFailed] = useState<string | null>(null);
  const markDone = async () => {
    setFailed(null);
    try {
      await marks.mark(edunex);
      toast(t("exam.marked"), "success", {
        label: t("action.undo"),
        onClick: () => void marks.unmark(edunex).catch((error: unknown) => setFailed(t(errorKey(error)))),
      });
    } catch (error) {
      setFailed(t(errorKey(error)));
    }
  };
  const unmark = async () => {
    setFailed(null);
    try {
      await marks.unmark(edunex);
      toast(t("exam.unmarked"));
    } catch (error) {
      setFailed(t(errorKey(error)));
    }
  };
  return (
    <Panel style={lead ? { borderRadius: 24, backgroundColor: tint } : undefined}>
      <Text size="labelLarge" weight="semibold" style={{ color: lead ? ink : v.muted }}>
        {factsLabel(t("exam.onEdunex"), lead && edunex.start !== null && edunex.start > now && f.fromNow(edunex.start))}
      </Text>
      <Text face="display" weight="extrabold" tabular style={{ marginTop: space[1], color: v.fg, fontSize: 24, lineHeight: 32, letterSpacing: -0.4 }}>
        {edunex.start !== null ? dayLabel(f, edunex.start) : t("exam.noDate")}
      </Text>
      {edunex.start !== null && (
        <Text size="titleLarge" face="display" weight="bold" tabular style={{ color: v.fg }}>
          {edunex.end !== null ? f.timeRange(edunex.start, edunex.end) : f.time(edunex.start)}
        </Text>
      )}
      {edunex.title ? (
        <Text size="bodyMedium" style={{ marginTop: space[2], color: v.fg2 }}>
          {edunex.title}
        </Text>
      ) : null}
      {window && (
        <View style={{ marginTop: space[4], alignItems: "stretch" }}>
          <BigButton
            icon={<Icons.CheckCircle size={20} weight="bold" color={v.onBrand} />}
            label={t("exam.markDoneFor", { title: name })}
            onPress={() => void markDone()}
            testID="action.markDone"
          >
            {t("exam.markDone")}
          </BigButton>
        </View>
      )}
      {failed && (
        <View style={{ marginTop: space[3] }}>
          <Notice tone="danger" title={failed} testID="notice.markDone" />
        </View>
      )}
      {!window && mark && (
        <View style={{ marginTop: space[3], flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[2] }}>
          <Text size="small" tone="muted">
            {t("exam.markedOn", { date: f.dayMonth(mark.at) })}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            icon={<Icons.Undo size={14} />}
            label={t("exam.unmarkFor", { title: name })}
            onPress={() => void unmark()}
            testID="action.unmark"
          >
            {t("exam.unmark")}
          </Button>
        </View>
      )}
    </Panel>
  );
}

const TASK_PILL: Partial<Record<TaskStatus, "red" | "amber" | "ok" | "brand" | "plain">> = {
  draft: "brand",
  submitted: "ok",
  in_review: "ok",
  overdue: "red",
  closed: "plain",
  returned: "amber",
};

/**
 * What to do before the exam, as rows in one card: each take-home Task (its name, when it's due, its status once it
 * has one) and the attendance before it (opens Presensi). One target each, no links of their own.
 */
function ExamRows({ exam, ahead }: { exam: Exam; ahead: boolean }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const { go } = useNav();
  const attendance = useAttendance();
  const entry = ahead ? attendance?.courses.find((c) => c.course.code === exam.courseCode) : undefined;
  const health = entry && entry.health.attended !== null ? entry.health : null;
  if (!exam.tasks.length && !health) return null;
  const tone = health ? absenceTone(health.state) : null;
  return (
    <Group testID="group.examRows">
      {exam.tasks.map((task, i) => {
        const status = taskStatus(task, now);
        const pill = TASK_PILL[status];
        return (
          <GroupRow
            key={task.id}
            first={i === 0}
            testID={`row.task.${task.id}`}
            accessibilityRole="button"
            onPress={() => go({ screen: "task", taskId: task.id })}
            leading={<IconTile icon={(color) => <Icons.FileText size={22} color={color} />} />}
            title={task.title}
            meta={factsLabel(t("exam.takeHome"), task.dueAt !== null ? f.dueLabel(task.dueAt) : t("exam.noDate"))}
            trailing={pill ? <Pill tone={pill}>{t(`taskStatus.${status}`)}</Pill> : undefined}
          />
        );
      })}
      {health && (
        <GroupRow
          first={!exam.tasks.length}
          testID="row.examAttendance"
          accessibilityRole="button"
          onPress={() => go({ screen: "presence" })}
          leading={<IconTile tone={tone ?? "plain"} icon={(color) => <Icons.Hand size={22} color={color} />} />}
          title={t("examPage.attendance", { attended: health.attended ?? 0, held: health.held ?? 0 })}
          // None left or over the limit by the name it has on every tab ("Jatah absen habis"); the rest in the desktop's words.
          trailing={tone ? <Pill tone={tone}>{absenceName(t, health) ?? budgetLabel(t, health)}</Pill> : undefined}
        >
          {/* Past the limit the pill names it; the desktop's words say what that costs ("Tak bisa lagi capai 80%"), in red. */}
          {(!tone || health.state === "out") && (
            <Text size="bodyMedium" style={{ color: health.state === "out" ? v.redFg : v.muted }}>
              {budgetLabel(t, health)}
            </Text>
          )}
        </GroupRow>
      )}
    </Group>
  );
}

/** Something real to study: the lecturer's files (on the take-home Task), and the course's modules before the exam. */
function Study({ exam }: { exam: Exam }) {
  const t = useT();
  const { go } = useNav();
  const theme = useTheme();
  const outline = useDataset("edunex.outline")?.[exam.courseCode];
  const materials = useDataset("edunex.materials")?.[exam.courseCode] ?? [];
  const files = exam.tasks.flatMap((task) => task.files.map((file) => ({ file, taskId: task.id })));
  const modules = outline?.modules ?? [];
  const examAt = modules.findIndex((m) => examKind(m.title) === exam.kind);
  const before = (examAt >= 0 ? modules.slice(0, examAt) : exam.kind === "UTS" || exam.kind === "UAS" ? modules : []).filter((m) => examKind(m.title) === null);
  if (!files.length && !before.length) return null;
  const count = (id: number) => materials.filter((m) => m.moduleId === id).length;
  const empty = before.filter((m) => count(m.id) === 0).length;
  const modulesTitle = t("examPage.modulesBefore", { kind: t(`exam.kind.${exam.kind}`) });
  return (
    <View>
      <SectionTitle title={t("examPage.study")} />
      {files.length > 0 && (
        <View style={{ marginBottom: space[4] }}>
          <Text size="labelLarge" style={{ marginBottom: space[2], marginLeft: space[1], color: theme.v4.muted }}>
            {t("examPage.lecturerFiles")}
          </Text>
          <Panel style={{ gap: space[2] }}>
            {files.map(({ file, taskId }, i) => (
              <LecturerFile key={file.url} file={file} edunexUrl={edunexTaskUrl(taskId)} testID={`row.file.${i}`} />
            ))}
          </Panel>
        </View>
      )}
      {before.length > 0 && (
        <>
          <View
            style={{ marginBottom: space[2], marginLeft: space[1], flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[4] }}
          >
            <Text size="labelLarge" style={{ flex: 1, color: theme.v4.muted }}>
              {modulesTitle}
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => go({ screen: "course", code: exam.courseCode, tab: "modules" })}
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", gap: 2, minHeight: 48 }}
            >
              <Text size="small" weight="medium" tone="accent">
                {t("examPage.openModules")}
              </Text>
              <Icons.ChevronRight size={14} color={theme.color.accentFg} />
            </Pressable>
          </View>
          <CardList inset={56}>
            {/* A module with something in it: its number, its title on up to two lines, how many items under it. */}
            {before.map((module, i) =>
              count(module.id) ? (
                <Row
                  key={module.id}
                  onPress={() => go({ screen: "course", code: exam.courseCode, tab: "modules", module: module.id })}
                  leading={
                    <View style={[styles.number, { backgroundColor: theme.v4.chip }]}>
                      <Text size="caption" weight="semibold" tone="muted" tabular>
                        {String(i + 1)}
                      </Text>
                    </View>
                  }
                  title={
                    <Text size="bodyLarge" numberOfLines={2}>
                      {module.title}
                    </Text>
                  }
                  label={factsLabel(module.title, t("examPage.items", { count: count(module.id) }))}
                  meta={t("examPage.items", { count: count(module.id) })}
                />
              ) : null,
            )}
            {/* The empty ones folded into one row ("3 modul belum ada materi"), opening the course's modules. */}
            {empty > 0 && (
              <Row
                key="empty"
                testID="row.emptyModules"
                onPress={() => go({ screen: "course", code: exam.courseCode, tab: "modules" })}
                leading={<Icons.FolderDown size={20} color={theme.v4.muted} />}
                title={
                  <Text size="bodyLarge" tone="muted">
                    {t("examPage.emptyModules", { count: empty })}
                  </Text>
                }
              />
            )}
          </CardList>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: space[4], paddingVertical: space[4] },
  room: { marginTop: space[2], flexDirection: "row", alignItems: "center", gap: space[2] },
  other: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    minHeight: 48,
    borderRadius: shape.md,
    paddingHorizontal: space[3],
    overflow: "hidden",
  },
  number: { width: 24, height: 24, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});

/** "Kam 10 Des dan 17 Des": the weekday once, each day, a day already over muted. */
function SittingDays({ sittings, now, muted }: { sittings: readonly ClassSession[]; now: number; muted: string }) {
  const f = useFormat();
  const [first] = sittings;
  if (!first) return null;
  const sameWeekday = sittings.every((s) => f.weekdayShort(s.start) === f.weekdayShort(first.start));
  const word = (s: ClassSession) => (sameWeekday ? f.dayMonth(s.start) : dayLabel(f, s.start));
  // The words between the days as the app lists them ("10 Des dan 17 Des", "a, b dan c").
  const marker = "\u0000";
  const joins = f.list(sittings.map(() => marker)).split(marker);
  return (
    <>
      {sameWeekday ? `${f.weekdayShort(first.start)} ` : ""}
      {sittings.map((s, i) => (
        // Spans of the card's big line: they keep its size and face.
        <Fragment key={s.id}>
          {joins[i]}
          <NativeText style={s.end <= now ? { color: muted } : undefined}>{word(s)}</NativeText>
        </Fragment>
      ))}
      {joins[sittings.length]}
    </>
  );
}
