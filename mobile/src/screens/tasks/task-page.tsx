// The Task page on the phone (S3): src/app/screens/tasks.tsx's TaskPage in one column. The way up
// (course, module), the title, one line of facts, the exam it's part of, what Edunex doesn't say
// (attendance, a short window, a lecturer's edit), the instructions, the lecturer's files, the
// hand-in card and History; Simpan draf and Kumpulkan stay at the bottom of the screen.
import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, type ScrollView, StyleSheet, View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { useCourseColor, useTermCourses } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Format, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useExams } from "../../../../src/app/schedule-data";
import { useDone } from "../../../../src/app/snoozes";
import { useDataset } from "../../../../src/app/store";
import { presenceOptional } from "../../../../src/core/attendance";
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
import { dayWord } from "../../parts/day-word";
import { LecturerFile } from "../../parts/files";
import { plainText } from "../../parts/html";
import { LecturerHtml } from "../../parts/lecturer-html";
import { DoneButton } from "../../parts/snooze";
import { usePerfDrawn } from "../../perf";
import { usePullToRefresh } from "../../shell/source-status";
import { Celebration } from "../../ui/celebrate";
import { Button } from "../../ui/controls";
import { Card, CourseDot, EmptyState, StatusChip } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Notice as NoticeBox, Page, Section } from "../../ui/layout";
import { Sheet } from "../../ui/sheet";
import { Text, type TextTone } from "../../ui/text";
import { shape, space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { takeHomeWhy } from "./exam-rows";
import { HandInBar, HandInCard, useHandIn } from "./hand-in";
import { NoTasksYet } from "./list";
import { moduleLabel } from "./rows";

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
    <Page testID="screen.task" header={<TopBar title={t("nav.tasks")} />}>
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
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const c = theme.color;
  const { go } = useNav();
  const pull = usePullToRefresh();
  const color = useCourseColor()(task.courseCode);
  const course = useTermCourses()?.find((c) => c.code === task.courseCode);
  const sentAt = submittedAt(task);
  const exam = useExams()?.find((e) => e.tasks.some((item) => item.id === task.id));
  const status = taskStatus(task, now);
  const late = status === "overdue" || status === "closed";
  const soon = !late && isOpenStatus(status) && task.dueAt !== null && task.dueAt - now < DAY;
  const where = moduleLabel(t, task.module);
  const handIn = useHandIn(task, status);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const historyAt = useRef(0);
  /** "Lihat perubahannya" asks History to open its newest edit: which, and how many times asked. */
  const [reveal, setReveal] = useState<{ at: number; asked: number } | null>(null);
  useEffect(() => {
    if (reveal) scroll.current?.scrollTo({ y: Math.max(0, historyAt.current - space[4]), animated: true });
  }, [reveal]);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.surface }}>
      <Page testID="screen.task" header={<TopBar title={t("nav.tasks")} />} scrollRef={scroll} {...pull}>
        {/* The way up, part by part: the course, and its module. */}
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginLeft: -space[2] }}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={factsLabel(task.courseCode, course?.name)}
            onPress={() => go({ screen: "course", code: task.courseCode })}
            android_ripple={{ color: c.selected, borderless: false }}
            style={styles.crumb}
            testID="action.course"
          >
            <CourseDot color={color} size={8} />
            <Text size="labelLarge" tone="muted">
              {task.courseCode}
            </Text>
          </Pressable>
          {where && (
            <>
              <Icons.ChevronRight size={14} color={c.onSurfaceVariant} />
              <Pressable
                accessibilityRole="link"
                onPress={() => go({ screen: "course", code: task.courseCode, tab: "modules", module: task.moduleId ?? introModule(task.courseId) })}
                android_ripple={{ color: c.selected, borderless: false }}
                style={[styles.crumb, { flexShrink: 1 }]}
                testID="action.module"
              >
                <Text size="labelLarge" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {where}
                </Text>
              </Pressable>
            </>
          )}
        </View>
        <Text size="headlineSmall" accessibilityRole="header" style={{ marginTop: space[1] }}>
          {task.title}
        </Text>

        {/* By when, and where the Student stands: the first thing to read after the name. */}
        <DueCard task={task} status={status} late={late} soon={soon} />

        {exam && (
          // The exam it's part of, and how the app knows: Edunex files it there, or its name says so.
          <Pressable
            accessibilityRole="link"
            onPress={() => go({ screen: "exam", examId: exam.id })}
            android_ripple={{ color: c.selected }}
            style={[styles.examLink, { backgroundColor: c.surfaceContainerLow }]}
            testID="action.exam"
          >
            <View style={[styles.examIcon, { backgroundColor: c.primaryContainer }]}>
              <Icons.GraduationCap size={20} color={c.onPrimaryContainer} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size="bodyLarge">{t("task.partOfExam", { kind: t(`exam.kind.${exam.kind}`), code: exam.courseCode })}</Text>
              {takeHomeWhy(t, task) && (
                <Text size="bodyMedium" tone="muted">
                  {takeHomeWhy(t, task)}
                </Text>
              )}
            </View>
            <Icons.ChevronRight size={20} color={c.onSurfaceVariant} />
          </Pressable>
        )}

        <Notes task={task} />
        <EditNotice task={task} onSee={(at) => setReveal((was) => ({ at, asked: (was?.asked ?? 0) + 1 }))} />

        <Section title={t("task.instructions")} testID="section.instructions">
          {plainText(task.instructions) ? (
            <LecturerHtml html={task.instructions} size="bodyLarge" />
          ) : (
            <Text size="bodyLarge" tone="muted">
              {t("task.noInstructions")}
            </Text>
          )}
        </Section>

        {task.files.length > 0 && (
          <Section title={t("task.lecturerFiles")} count={task.files.length} testID="section.files">
            <View style={{ gap: space[2] }}>
              {task.files.map((file) => (
                <LecturerFile key={file.url} file={file} edunexUrl={edunexTaskUrl(task.id)} />
              ))}
            </View>
          </Section>
        )}

        <Section title={t("handIn.yourAnswer")} testID="section.answer">
          <HandInCard h={handIn} />
        </Section>
        <View
          style={{ marginTop: space[8] }}
          onLayout={(event) => {
            historyAt.current = event.nativeEvent.layout.y;
          }}
        >
          <History task={task} reveal={reveal} />
        </View>
      </Page>
      <HandInBar h={handIn} />
      {handIn.justDone === "submit" && (
        <Celebration title={t("mobile.tasks.handedIn")} detail={sentAt !== null ? t("handIn.recorded", { when: f.dayTimeWord(sentAt) }) : undefined} />
      )}
    </KeyboardAvoidingView>
  );
}

/**
 * The deadline, large, in the tone of how close it is (the error colour and a warning sign once late, amber within a
 * day), how long until it, whether late is still taken, and the status as Edunex has it.
 */
function DueCard({ task, status, late, soon }: { task: Task; status: TaskStatus; late: boolean; soon: boolean }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const c = theme.color;
  const tone: TextTone = late ? "danger" : soon ? "warning" : "fg";
  const iconColor = late ? c.error : soon ? c.warningFg : c.onSurfaceVariant;
  const opens = task.opensAt !== null && notOpenYet(task, now) ? t("task.opens", { when: f.dayTimeWord(task.opensAt) }) : null;
  return (
    <Card variant="raised" style={{ marginTop: space[4], padding: space[4], gap: space[2] }} testID="card.due">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
        <Text size="labelLarge" tone="muted">
          {t("change.deadline")}
        </Text>
        <StatusChip status={status} />
      </View>
      {task.dueAt !== null ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            {late ? <Icons.AlertTriangle size={22} weight="bold" color={iconColor} /> : <Icons.Clock size={22} color={iconColor} />}
            <Text
              size="titleLarge"
              weight="semibold"
              tone={tone}
              tabular
              style={{ flexShrink: 1 }}
              accessibilityLabel={t("task.due", { when: f.dayTimeWord(task.dueAt) })}
            >
              {f.dueLabel(task.dueAt)}
            </Text>
          </View>
          <Facts
            items={[
              { text: f.fromNow(task.dueAt), tone: late ? "danger" : soon ? "warning" : "muted", strong: late || soon },
              isOpenStatus(status)
                ? { text: task.lateAllowed ? t("handIn.lateAllowed") : t("handIn.lateNotAllowed"), tone: !task.lateAllowed && soon ? "warning" : "muted" }
                : null,
            ]}
          />
        </>
      ) : (
        <Text size="titleLarge" tone="muted">
          {t("task.noDeadline")}
        </Text>
      )}
      {opens && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Icons.Lock size={16} color={c.warningFg} />
          <Text size="bodyMedium" weight="medium" tone="warning" style={{ flexShrink: 1 }}>
            {opens}
          </Text>
        </View>
      )}
    </Card>
  );
}

type Fact = { text: string; tone?: TextTone; strong?: boolean } | { node: ReactNode };

/** Facts on one line split by quiet dots, each in its own tone (Meta's look with colours of their own). */
/** The dot between two facts, in a slot of its own: Meta's (src/ui/layout.tsx), at body size. */
const SEP = 20;

/**
 * The header's facts on as many lines as they need, the dot between them as Meta draws it: each
 * fact carries its dot in front, and the line's start sits one slot left of the clip, so a fact
 * that wraps starts its line with no stray "·".
 */
function Facts({ items }: { items: (Fact | null)[] }) {
  const shown = items.filter((item): item is Fact => item !== null);
  return (
    <View style={{ overflow: "hidden" }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 2, marginLeft: -SEP }}>
        {shown.map((item, i) => (
          <View key={"node" in item ? "node" : item.text} style={{ flexDirection: "row", alignItems: "center", flexShrink: 1, maxWidth: "100%" }}>
            <Text size="bodyMedium" tone="faint" style={{ width: SEP, textAlign: "center" }} accessible={false} importantForAccessibility="no">
              {i > 0 ? "·" : ""}
            </Text>
            {"node" in item ? (
              item.node
            ) : (
              <Text size="bodyMedium" tone={item.tone ?? "muted"} weight={item.strong ? "medium" : "regular"} style={{ flexShrink: 1 }}>
                {item.text}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * What Edunex doesn't say on its Task page: attendance taken by handing it in (and, once handed in,
 * whether it counted), a short window. Where the course counts in SIX, the attendance window is
 * optional: said once, calmly.
 */
function Notes({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const c = theme.color;
  const presence = useDataset("edunex.presence");
  const countedIn = useAttendance()?.courses.find((entry) => entry.course.code === task.courseCode)?.health.countedIn;
  const optional = presenceOptional(countedIn);
  const sessions = presence?.[task.courseCode] ?? [];
  const notes: { tone: "warning" | "neutral" | "success" | "danger"; icon: "hand" | "check" | "zap"; text: string }[] = [];
  const range = (opensAt: number, closesAt: number) => `${dayWord(f, t, opensAt)}, ${f.timeRange(opensAt, closesAt)}`;
  const result = attendanceResult(task, sessions, now);
  const status = taskStatus(task, now);
  const session = isOpenStatus(status) ? attendanceSession(task, sessions, now) : null;
  if (optional) {
    if (session && session.closesAt > now)
      notes.push({
        tone: "neutral",
        icon: "hand",
        text: t("task.note.attendanceOptional", {
          date: dayWord(f, t, session.opensAt),
          time: f.timeRange(session.opensAt, session.closesAt),
          course: task.courseCode,
        }),
      });
  } else if (result)
    notes.push(
      result.outcome === "counted"
        ? { tone: "success", icon: "check", text: t("task.note.attendanceCounted", { when: range(result.session.opensAt, result.session.closesAt) }) }
        : { tone: "danger", icon: "hand", text: t("task.note.attendanceOutside", { when: range(result.session.opensAt, result.session.closesAt) }) },
    );
  else if (session && session.closesAt > now)
    notes.push({
      tone: "warning",
      icon: "hand",
      text: t("task.note.attendance", { date: dayWord(f, t, session.opensAt), time: f.timeRange(session.opensAt, session.closesAt) }),
    });
  else if (session && !session.recorded?.present)
    notes.push({ tone: "neutral", icon: "hand", text: t("task.note.attendanceMissed", { when: range(session.opensAt, session.closesAt) }) });
  const window = shortWindow(task);
  if (window !== null && task.opensAt !== null && task.dueAt !== null)
    notes.push({
      tone: "neutral",
      icon: "zap",
      text: t("task.note.shortWindow", {
        duration:
          window >= HOUR ? t("task.duration.hours", { count: Math.round(window / HOUR) }) : t("task.duration.minutes", { count: Math.round(window / MINUTE) }),
        range: f.timeRange(task.opensAt, task.dueAt),
      }),
    });
  if (!notes.length) return null;
  const TONE = {
    warning: { bg: c.warningBg, fg: c.warningFg, tone: "warning" },
    neutral: { bg: c.fill, fg: c.muted, tone: "muted" },
    success: { bg: c.successBg, fg: c.successFg, tone: "success" },
    danger: { bg: c.dangerBg, fg: c.dangerFg, tone: "danger" },
  } as const;
  return (
    <View style={{ marginTop: space[5], gap: space[2] }}>
      {notes.map((note) => {
        const look = TONE[note.tone];
        const Icon = note.icon === "check" ? Icons.CheckCircle : note.icon === "zap" ? Icons.Zap : Icons.Hand;
        return (
          <View key={note.text} style={[styles.note, { backgroundColor: look.bg }]}>
            <View style={{ marginTop: 2 }}>
              <Icon size={16} color={look.fg} />
            </View>
            <Text size="body" tone={look.tone} style={{ flex: 1 }}>
              {note.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const BEFORE_FOR = 14 * DAY;
const NONE_FOR = 7 * DAY;

/**
 * A lecturer's edit, said in one line with the way to what changed: History holds the detail. After
 * hand-in it stays until checked ("Sudah kucek"); before hand-in, for two weeks or until checked,
 * and not for a new title alone. Nothing compared changed: a quiet grey line for a week. Once
 * checked here, one quiet line with Undo until the page is left.
 */
function EditNotice({ task, onSee }: { task: Task; onSee: (at: number) => void }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const open = useOpenExternal();
  const { entries, unmark } = useDone();
  const view = editView(task, useDataset("edunex.taskEdits"), entries);
  const shownAt = useRef(now);
  if (!view || task.editedAt === null) return null;
  const sentAt = submittedAt(task);
  const at = view.record?.at ?? task.editedAt;
  const age = now - at;
  const edited = f.dayMonth(at);
  const name = factsLabel(task.title, task.courseCode);
  if (view.checked) {
    const checked = view.checked;
    if (checked.at < shownAt.current) return null;
    const line = t("done.line.checked", { when: f.dayTimeWord(checked.at) });
    return (
      <View style={{ marginTop: space[5], flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[2] }}>
        <Icons.Check size={14} weight="bold" color={theme.color.successFg} />
        <Text size="small" tone="muted">
          {line}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("done.undoFor", { what: line })}
          onPress={() => void unmark(checked.id).catch(() => undefined)}
          hitSlop={10}
        >
          <Text size="small" weight="medium" tone="accent">
            {t("action.undo")}
          </Text>
        </Pressable>
      </View>
    );
  }
  const check = <DoneButton item={taskDoneKey(task, "edited", at)} how="checked" name={name} said={t("done.toast.checked")} words variant="secondary" />;
  const pen = (color: string) => <Icons.PenLine size={18} weight="bold" color={color} />;
  if (view.state === "unknown") {
    if (!view.afterSubmit || sentAt === null) return null;
    return (
      <View style={{ marginTop: space[5] }}>
        <NoticeBox
          tone="warning"
          icon={pen(theme.color.warningFg)}
          title={t("task.note.editedAfterSubmit", { edited, sent: f.dayMonth(sentAt) })}
          action={
            <>
              {check}
              <Button size="sm" variant="ghost" icon={<Icons.ArrowUpRight size={14} />} onPress={() => open(edunexTaskUrl(task.id))}>
                {t("action.openInEdunex")}
              </Button>
            </>
          }
        >
          {t("task.change.unknown")}
        </NoticeBox>
      </View>
    );
  }
  if (view.state === "none")
    return age < NONE_FOR ? (
      <View style={[styles.note, { marginTop: space[5], backgroundColor: theme.color.fill }]}>
        <Icons.Info size={16} color={theme.color.muted} />
        <Text size="body" tone="muted" style={{ flex: 1 }}>
          {t("task.change.none", { edited })}
        </Text>
      </View>
    ) : null;
  if (!view.afterSubmit && (titleOnly(view.changes) || age >= BEFORE_FOR)) return null;
  const pulledIn = view.changes.some((c) => c.kind === "deadline" && c.from !== null && c.to !== null && c.to < c.from && c.to - now <= DAY);
  const warn = view.afterSubmit || pulledIn;
  const fg = warn ? theme.color.warningFg : theme.color.infoFg;
  return (
    <View style={{ marginTop: space[5] }}>
      <NoticeBox
        tone={warn ? "warning" : "info"}
        icon={pen(fg)}
        title={
          <Text size="body" weight="semibold" style={{ color: fg }}>
            {view.afterSubmit && sentAt !== null ? t("task.change.afterSubmit", { edited, sent: f.dayMonth(sentAt) }) : t("task.change.before", { edited })}{" "}
            <Text accessibilityRole="link" onPress={() => onSee(at)} style={{ textDecorationLine: "underline" }}>
              {t("task.change.see")}
            </Text>
          </Text>
        }
        action={check}
      />
    </View>
  );
}

/** A date the way History says it: "Jum, 9 Okt, 23:59". */
const stamp = (f: Format, at: number) => `${f.weekdayShort(at)}, ${f.dayMonth(at)}, ${f.time(at)}`;

function History({ task, reveal }: { task: Task; reveal: { at: number; asked: number } | null }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const c = theme.color;
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
          <Text size="titleMedium" weight="semibold" accessibilityRole="header" style={{ marginBottom: space[3] }}>
            {t("history.title")}
          </Text>
          <View style={{ marginLeft: 4, borderLeftWidth: StyleSheet.hairlineWidth * 2, borderLeftColor: c.line, paddingLeft: space[4], gap: space[3] }}>
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
                      ? { backgroundColor: c.canvas, borderWidth: 1, borderColor: c.faint }
                      : // The desktop's faint at 60%: seen on the line in light and dark.
                        { backgroundColor: `${c.faint}99` };
              return (
                <View key={`${step.kind}:${step.at}`}>
                  <View style={[styles.dot, dot, { borderColor: (dot as { borderColor?: string }).borderColor ?? c.canvas }]} />
                  {known ? (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: isOpen }}
                        onPress={() => setOpened(isOpen ? null : step.at)}
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
        </>
      )}
      <View style={{ alignItems: "flex-start", marginTop: steps.length >= 2 ? space[4] : 0, marginLeft: -space[3] }}>
        <Button
          variant="ghost"
          icon={<Icons.ArrowUpRight size={18} color={c.primary} />}
          onPress={() => open(edunexTaskUrl(task.id))}
          testID="action.openInEdunex"
        >
          {t("action.openInEdunex")}
        </Button>
      </View>
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
            <Pressable accessibilityRole="button" onPress={() => onCompare(change)} hitSlop={10}>
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
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[3],
    borderRadius: shape.md,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  dot: { position: "absolute", left: -space[4] - 5, top: 4, width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  crumb: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48, paddingHorizontal: space[2], borderRadius: shape.sm, overflow: "hidden" },
  examLink: {
    marginTop: space[3],
    flexDirection: "row",
    alignItems: "center",
    gap: space[4],
    minHeight: 64,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: shape.lg,
    overflow: "hidden",
  },
  examIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
