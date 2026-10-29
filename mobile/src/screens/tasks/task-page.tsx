// The Task page on the phone (S3): src/app/screens/tasks.tsx's TaskPage in one column. The way up
// (course, module), the title, one line of facts, the exam it's part of, what Edunex doesn't say
// (attendance, a short window, a lecturer's edit), the instructions, the lecturer's files, the
// hand-in card and History; Simpan draf and Kumpulkan stay at the bottom of the screen.
import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, type ScrollView, StyleSheet, View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { useCourseColor } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Format, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useExams } from "../../../../src/app/schedule-data";
import { useDone } from "../../../../src/app/snoozes";
import { useDataset } from "../../../../src/app/store";
import { presenceOptional } from "../../../../src/core/attendance";
import { introModule } from "../../../../src/core/course-materials";
import { taskDoneKey } from "../../../../src/core/done";
import type { Task, TaskChange, TaskFile } from "../../../../src/core/models";
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
import { LecturerFile } from "../../parts/files";
import { plainText } from "../../parts/html";
import { LecturerHtml } from "../../parts/lecturer-html";
import { DoneButton } from "../../parts/snooze";
import { usePullToRefresh } from "../../shell/source-status";
import { Button } from "../../ui/controls";
import { CourseDot, EmptyState } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Meta, Notice as NoticeBox, Page } from "../../ui/layout";
import { Sheet } from "../../ui/sheet";
import { Text, type TextTone } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
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
  if (task) return <TaskPage key={task.id} task={task} />;
  return (
    <Page testID="screen.task" header={<TopBar />}>
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
  const dueTone: TextTone = late ? "danger" : soon ? "warning" : "fg";

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.canvas }}>
      <Page testID="screen.task" header={<TopBar />} scrollRef={scroll} {...pull}>
        {/* The way up, part by part: the course, and its module. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[1.5], flexWrap: "wrap" }}>
          <Pressable
            accessibilityRole="link"
            onPress={() => go({ screen: "course", code: task.courseCode })}
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            testID="action.course"
          >
            <CourseDot color={color} size={8} />
            <Text size="small" weight="semibold" tone="muted">
              {task.courseCode}
            </Text>
          </Pressable>
          {where && (
            <>
              <Icons.ChevronRight size={12} color={c.muted} />
              <Pressable
                accessibilityRole="link"
                onPress={() => go({ screen: "course", code: task.courseCode, tab: "modules", module: task.moduleId ?? introModule(task.courseId) })}
                hitSlop={8}
                style={{ flexShrink: 1 }}
              >
                <Meta numberOfLines={1}>{where}</Meta>
              </Pressable>
            </>
          )}
        </View>
        <Text size="display" weight="semibold" accessibilityRole="header" style={{ marginTop: space[2], letterSpacing: -0.4 }}>
          {task.title}
        </Text>
        {/* One line of facts; once the Task is open, when it opened is history (Riwayat says it). */}
        <View style={{ marginTop: space[2.5] }}>
          {task.dueAt !== null ? (
            <Facts
              items={[
                {
                  node: (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Icons.Clock size={14} color={c[late ? "dangerFg" : soon ? "warningFg" : "fg"]} />
                      <Text size="body" weight="medium" tone={dueTone}>
                        {t("task.due", { when: f.dueLabel(task.dueAt) })}
                      </Text>
                    </View>
                  ),
                },
                { text: f.fromNow(task.dueAt), tone: late ? "danger" : soon ? "warning" : "muted" },
                isOpenStatus(status)
                  ? { text: task.lateAllowed ? t("handIn.lateAllowed") : t("handIn.lateNotAllowed"), tone: !task.lateAllowed && soon ? "warning" : "muted" }
                  : null,
                task.opensAt !== null && notOpenYet(task, now)
                  ? { text: t("task.opens", { when: f.dueLabel(task.opensAt) }), tone: "warning", strong: true }
                  : null,
              ]}
            />
          ) : (
            <Facts
              items={[
                { text: t("task.noDeadline"), tone: "muted" },
                task.opensAt !== null && notOpenYet(task, now)
                  ? { text: t("task.opens", { when: f.dueLabel(task.opensAt) }), tone: "warning", strong: true }
                  : null,
              ]}
            />
          )}
        </View>
        {exam && (
          // The exam it's part of, and how the app knows: Edunex files it there, or its name says so.
          <View style={{ marginTop: space[3], gap: 2 }}>
            <Pressable
              accessibilityRole="link"
              onPress={() => go({ screen: "exam", examId: exam.id })}
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
              testID="action.exam"
            >
              <Icons.GraduationCap size={14} color={c.accentFg} />
              <Text size="small" weight="medium" tone="accent">
                {t("task.partOfExam", { kind: t(`exam.kind.${exam.kind}`), code: exam.courseCode })}
              </Text>
              <Icons.ChevronRight size={14} color={c.accentFg} />
            </Pressable>
            {takeHomeWhy(t, task) && (
              <Text size="small" tone="muted">
                {takeHomeWhy(t, task)}
              </Text>
            )}
          </View>
        )}

        <Notes task={task} />
        <EditNotice task={task} onSee={(at) => setReveal((was) => ({ at, asked: (was?.asked ?? 0) + 1 }))} />

        <View style={{ marginTop: space[8] }}>
          <Text size="title" weight="semibold" accessibilityRole="header" style={{ marginBottom: space[2.5] }}>
            {t("task.instructions")}
          </Text>
          {plainText(task.instructions) ? (
            <LecturerHtml html={task.instructions} size="lead" />
          ) : (
            <Text size="body" tone="muted">
              {t("task.noInstructions")}
            </Text>
          )}
        </View>

        {task.files.length > 0 && (
          <View style={{ marginTop: space[8] }}>
            <Text size="title" weight="semibold" accessibilityRole="header" style={{ marginBottom: space[2.5] }}>
              {t("task.lecturerFiles")}
            </Text>
            <View style={{ gap: space[2] }}>
              {task.files.map((file) => (
                <LecturerFile key={file.url} file={file} />
              ))}
            </View>
          </View>
        )}

        <View style={{ marginTop: space[8] }}>
          <HandInCard h={handIn} />
        </View>
        <View
          style={{ marginTop: space[6] }}
          onLayout={(event) => {
            historyAt.current = event.nativeEvent.layout.y;
          }}
        >
          <History task={task} reveal={reveal} />
        </View>
      </Page>
      <HandInBar h={handIn} />
    </KeyboardAvoidingView>
  );
}

type Fact = { text: string; tone?: TextTone; strong?: boolean } | { node: ReactNode };

/** Facts on one line split by quiet dots, each in its own tone (Meta's look with colours of their own). */
/** The dot between two facts, in a slot of its own: Meta's (src/ui/layout.tsx), at body size. */
const SEP = 22;

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
            <Text size="body" tone="faint" style={{ width: SEP, textAlign: "center" }} accessible={false} importantForAccessibility="no">
              {i > 0 ? "·" : ""}
            </Text>
            {"node" in item ? (
              item.node
            ) : (
              <Text size="body" tone={item.tone ?? "muted"} weight={item.strong ? "medium" : "regular"} style={{ flexShrink: 1 }}>
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
  const range = (opensAt: number, closesAt: number) => `${f.relativeDay(opensAt)}, ${f.timeRange(opensAt, closesAt)}`;
  const result = attendanceResult(task, sessions, now);
  const status = taskStatus(task, now);
  const session = isOpenStatus(status) ? attendanceSession(task, sessions, now) : null;
  if (optional) {
    if (session && session.closesAt > now)
      notes.push({
        tone: "neutral",
        icon: "hand",
        text: t("task.note.attendanceOptional", {
          date: f.relativeDay(session.opensAt),
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
      text: t("task.note.attendance", { date: f.relativeDay(session.opensAt), time: f.timeRange(session.opensAt, session.closesAt) }),
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
    <View style={{ paddingHorizontal: space[1] }}>
      {steps.length >= 2 && (
        <>
          <Text size="small" weight="semibold" tone="muted" accessibilityRole="header" style={{ marginBottom: space[3] }}>
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
                      : { backgroundColor: c.track };
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
      <Pressable
        accessibilityRole="link"
        onPress={() => open(edunexTaskUrl(task.id))}
        hitSlop={8}
        style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: steps.length >= 2 ? space[4] : 0 }}
        testID="action.openInEdunex"
      >
        <Text size="small" weight="medium" tone="accent">
          {t("action.openInEdunex")}
        </Text>
        <Icons.ArrowUpRight size={14} color={c.accentFg} />
      </Pressable>
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
    gap: space[2.5],
    borderRadius: radius.lg,
    paddingHorizontal: space[3.5],
    paddingVertical: space[2.5],
  },
  dot: { position: "absolute", left: -space[4] - 5, top: 4, width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
});
