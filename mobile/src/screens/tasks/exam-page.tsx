// The exam page on the phone (S4): src/app/screens/exam.tsx's ExamPage in one column, with the same
// facts, in v4 (round 2): the day, the time and the room big on the course's tint, the rest on white cards. When and where (SIX's sitting with its room, Edunex's, the take-home), what to do when SIX
// and Edunex disagree, the attendance before it, what to study, the official pages, the other exams.
// An Edunex window open now can be marked done here too, with Undo (Tandai selesai).
import * as Clipboard from "expo-clipboard";
import { type ReactNode, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { budgetLabel, STATE_TONE } from "../../../../src/app/attendance-labels";
import { errorKey } from "../../../../src/app/bridge";
import { type TermCourse, useTermCourses } from "../../../../src/app/courses";
import { useExamMarkList, useExamMarks } from "../../../../src/app/exam-marks";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useLang, useNow, useT } from "../../../../src/app/i18n";
import { useExams } from "../../../../src/app/schedule-data";
import { useDataset, useStore } from "../../../../src/app/store";
import { type Exam, examAhead, examKind, examMarkOn, examParts } from "../../../../src/core/exams";
import { edunexCourseUrl, sixTimetableUrl } from "../../../../src/core/links";
import type { Task } from "../../../../src/core/models";
import { phoneItems } from "../../../../src/core/phone-calendar";
import { edunexTaskUrl, isOpenStatus, taskStatus } from "../../../../src/core/tasks";
import { useNav } from "../../nav";
import { toneOf } from "../../parts/attendance";
import { LecturerFile } from "../../parts/files";
import { usePerfDrawn } from "../../perf";
import { usePullToRefresh } from "../../shell/source-status";
import { toast } from "../../swaps/overlays";
import { BigButton } from "../../ui/big-button";
import { CardList, Panel, SectionTitle } from "../../ui/card-list";
import { Button } from "../../ui/controls";
import { EmptyState, Skeleton, StatusChip } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Meta, Notice, Page, Row } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { radius, shape, space, useTheme } from "../../ui/theme";
import { CourseTile, useCourseTile } from "../../ui/tile";
import { TopBar } from "../../ui/top-bar";
import { addToPhoneCalendar, shareIcs } from "../schedule/phone-calendar";
import { examCalendarItems } from "./exam-calendar";
import { dayLabel, examWeekLabel, sourceDays, takeHomeWhy } from "./exam-rows";

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

  const links: { key: string; label: string; url: string }[] = [];
  if (exam.six.length > 0 && student) links.push({ key: "six", label: t("examPage.seeSix"), url: sixTimetableUrl(student) });
  for (const task of exam.tasks)
    links.push({
      key: `task:${task.id}`,
      label: exam.tasks.length > 1 ? factsLabel(t("examPage.seeTask"), task.title) : t("examPage.seeTask"),
      url: edunexTaskUrl(task.id),
    });
  if (!exam.tasks.length && course?.edunex) links.push({ key: "course", label: t("examPage.seeCourse"), url: edunexCourseUrl(course.edunex.courseId) });

  return (
    // One title: the exam's own, on the page; the bar carries only Back.
    <Page testID="screen.exam" header={<TopBar />} background={v.page} {...pull}>
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
      <Text size="bodyMedium" style={{ marginTop: space[1], color: v.muted }}>
        {exam.at !== null
          ? factsLabel(f.dateLong(exam.at), f.fromNow(exam.at))
          : exam.week && (exam.kind === "UTS" || exam.kind === "UAS")
            ? t(ahead ? "exam.dayUnknown" : "exam.neverAnnounced")
            : t("exam.noDate")}
      </Text>

      <View testID="section.when">
        <SectionTitle title={t("exam.when")} />
        <View style={{ gap: space[3] }}>
          {exam.six.map((session) => (
            // SIX's sitting: the day, the time and the room, big, on the course's tint (the page's one big card).
            <View key={session.id} style={[styles.card, { backgroundColor: tint, borderRadius: 24 }]} testID={`card.sitting.${session.id}`}>
              <Text size="labelLarge" weight="semibold" style={{ color: ink }}>
                {t("exam.inClass")}
              </Text>
              <Text face="display" weight="extrabold" tabular style={{ marginTop: space[1], color: v.fg, fontSize: 28, lineHeight: 36, letterSpacing: -0.5 }}>
                {dayLabel(f, session.start)}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: space[2] }}>
                <Text size="titleLarge" face="display" weight="bold" tabular style={{ color: v.fg }}>
                  {f.timeRange(session.start, session.end)}
                </Text>
                <Text size="bodyMedium" style={{ color: v.fg2 }}>
                  {t("exam.length", { minutes: Math.round((session.end - session.start) / 60_000) })}
                </Text>
              </View>
              <View style={[styles.room, { backgroundColor: v.card }]}>
                <Icons.MapPin size={22} weight="fill" color={session.room ? ink : v.muted} />
                {session.room ? (
                  <Text size="titleLarge" face="display" weight="bold" style={{ flexShrink: 1, color: v.fg }}>
                    {session.room}
                  </Text>
                ) : (
                  <Text size="bodyLarge" style={{ color: v.muted }}>
                    {t("exam.noRoom")}
                  </Text>
                )}
              </View>
            </View>
          ))}
          {exam.edunex.map((e) => (
            <EdunexCard key={e.id} exam={exam} edunex={e} />
          ))}
          {exam.tasks.map((task) => (
            <TakeHomeCard key={task.id} task={task} />
          ))}
          {/* The header already says the day isn't known: here only what is, the exam week and where the exam is listed. */}
          {!dated && exam.week && (exam.kind === "UTS" || exam.kind === "UAS") ? (
            <View style={[styles.card, { backgroundColor: tint, borderRadius: 24 }]}>
              <Text size="titleLarge" face="display" weight="bold" style={{ color: v.fg }}>
                {examWeekLabel(t, f, exam.kind, exam.week)}
              </Text>
              {exam.inOutline && (
                <Text size="bodyMedium" style={{ marginTop: space[1], color: v.fg2 }}>
                  {t("exam.outlineOnly")}
                </Text>
              )}
            </View>
          ) : (
            !dated &&
            exam.inOutline && (
              <Text size="bodyMedium" style={{ color: v.muted }}>
                {t("exam.outlineOnly")}
              </Text>
            )
          )}
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
        {exam.takeHomeApart !== null && !exam.disagree && (
          <LinkLine onPress={() => go({ screen: "course", code: exam.courseCode, tab: "announcements" })}>{t("examPage.checkAnnouncements")}</LinkLine>
        )}
        <ExamToCalendar exam={exam} />
        {ahead && <BeforeExam code={exam.courseCode} />}
      </View>

      <Study exam={exam} />

      {links.length > 0 && (
        <View>
          <SectionTitle title={t("examPage.official")} />
          <Panel style={{ paddingVertical: space[1], paddingHorizontal: space[1], alignItems: "flex-start" }}>
            {links.map((link) => (
              <Button key={link.key} variant="ghost" icon={<Icons.ArrowUpRight size={18} color={c.primary} />} onPress={() => open(link.url)}>
                {link.label}
              </Button>
            ))}
          </Panel>
        </View>
      )}

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
 * "Tambahkan ke kalender HP": this exam's sittings and take-home deadlines into the phone's "Edunex
 * Plus" calendar, as Jadwal's sheet puts them there (adding again updates them). Only while the
 * exam has a date somewhere.
 */
function ExamToCalendar({ exam }: { exam: Exam }) {
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
  if (items.length === 0) return null;
  const share = () => {
    setProblem(null);
    void shareIcs(items, now).catch(() => setProblem({ text: t("mobile.calendar.shareFailed") }));
  };
  const add = async () => {
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
  return (
    <View style={{ marginTop: space[3], gap: space[3], alignItems: "flex-start" }}>
      <Button icon={<Icons.Smartphone size={18} color={theme.color.primary} />} busy={busy} onPress={() => void add()} testID="action.examToCalendar">
        {t("schedule.export")}
      </Button>
      {problem && (
        // Said where it happened, with its one fix (a snackbar is gone before it's read).
        <View style={{ alignSelf: "stretch" }}>
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
      )}
    </View>
  );
}

function LinkLine({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={8}
      style={{ marginTop: space[2], flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", minHeight: 48 }}
    >
      <Text size="labelLarge" tone="primary">
        {children}
      </Text>
      <Icons.ChevronRight size={16} color={theme.color.primary} />
    </Pressable>
  );
}

/**
 * Edunex's own exam: its day and time, and its title. A window open now (a quiz open for days) has
 * Tandai selesai under it, the one thing about it the app can't see; once marked, the way back.
 */
function EdunexCard({ exam, edunex }: { exam: Exam; edunex: Exam["edunex"][number] }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
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
    <Panel>
      <Text size="labelLarge" weight="semibold" style={{ color: v.muted }}>
        {t("exam.onEdunex")}
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

function TakeHomeCard({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const v = theme.v4;
  const { go } = useNav();
  const status = taskStatus(task, now);
  const open = isOpenStatus(status);
  return (
    <PressScale
      testID={`row.task.${task.id}`}
      accessibilityRole="button"
      onPress={() => go({ screen: "task", taskId: task.id })}
      style={[styles.card, styles.takeHome, { backgroundColor: v.card }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
        {/* How the app knows it's the exam's take-home, said once where it's shown. */}
        <View style={{ flex: 1 }}>
          <Meta>
            {t("exam.takeHome")}
            {takeHomeWhy(t, task) ?? ""}
          </Meta>
        </View>
        {status !== "not_started" && <StatusChip status={status} />}
      </View>
      <Text face="display" weight="extrabold" tabular style={{ marginTop: space[1], color: v.fg, fontSize: 24, lineHeight: 32, letterSpacing: -0.4 }}>
        {task.dueAt !== null ? dayLabel(f, task.dueAt) : t("exam.noDate")}
      </Text>
      {task.dueAt !== null && (
        <Text size="titleMedium" face="display" weight="bold" tabular style={{ color: v.fg }}>
          {t("exam.due", { when: f.time(task.dueAt) })}
        </Text>
      )}
      <View style={{ marginTop: space[3], flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text size="labelLarge" tone="primary" numberOfLines={2} style={{ flexShrink: 1 }}>
          {open ? t("examPage.openTask") : task.title}
          {open ? (
            <Text size="bodyMedium" tone="muted">
              {`  ·  ${task.title}`}
            </Text>
          ) : null}
        </Text>
        <Icons.ChevronRight size={16} color={theme.color.primary} />
      </View>
    </PressScale>
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
            {files.map(({ file, taskId }) => (
              <LecturerFile key={file.url} file={file} edunexUrl={edunexTaskUrl(taskId)} />
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
            {before.map((module, i) => (
              <Row
                key={module.id}
                onPress={() => go({ screen: "course", code: exam.courseCode, tab: "modules", module: module.id })}
                leading={
                  <View style={[styles.number, { backgroundColor: theme.v4.page }]}>
                    <Text size="caption" weight="semibold" tone="muted" tabular>
                      {String(i + 1)}
                    </Text>
                  </View>
                }
                title={module.title}
                trailing={
                  <Text size="small" tone="faint">
                    {count(module.id) ? t("examPage.items", { count: count(module.id) }) : t("examPage.noItems")}
                  </Text>
                }
              />
            ))}
          </CardList>
        </>
      )}
    </View>
  );
}

function BeforeExam({ code }: { code: string }) {
  const t = useT();
  const theme = useTheme();
  const { go } = useNav();
  const attendance = useAttendance();
  const entry = attendance?.courses.find((c) => c.course.code === code);
  if (!entry || entry.health.attended === null) return null;
  const { health } = entry;
  return (
    <View style={{ marginTop: space[4], flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
      <View style={{ marginTop: 3 }}>
        <Icons.Hand size={16} color={theme.color.muted} />
      </View>
      <View style={{ flex: 1, gap: space[1] }}>
        <Text size="body" weight="medium">
          {t("examPage.attendance")}
        </Text>
        <Text size="small" tone="muted">
          {t("examPage.attendanceLine", { attended: health.attended ?? 0, held: health.held ?? 0 })}
          <Text size="small" weight="semibold" tone={toneOf(STATE_TONE[health.state])}>
            {`  ·  ${budgetLabel(t, health)}`}
          </Text>
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => go({ screen: "presence" })}
          hitSlop={8}
          style={{ alignSelf: "flex-start", minHeight: 48, justifyContent: "center" }}
        >
          <Text size="labelLarge" tone="primary">
            {t("examPage.seePresence")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: space[4], paddingVertical: space[4] },
  takeHome: { borderRadius: shape.lgPlus, overflow: "hidden" },
  room: {
    marginTop: space[3],
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    borderRadius: shape.md,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
  },
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
