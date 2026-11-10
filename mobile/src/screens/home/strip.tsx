// Beranda's strip about the Student (`home.strip`): the three things they check every day, each one target that opens
// the page with its detail (the kit's StatTile, side by side in b.tsx's CountStrip). One number, one source (the
// decisions, round 1):
// - Tasks: the soonest thing due. "2 hari ini"; else how many are late; else the next date over "tugas terdekat";
//   a check and "Tugas beres" only when nothing is open. It opens Tugas, whose list holds exactly those.
// - Absences: every course with no absence left, at the limit or past it, over "absen habis" (true of each): red
//   while any is past its limit, else amber, else a check. It opens Kuliah, which leads with the same courses.
// Round 3: the three are one family, a figure over two words with the noun ("16 Okt / tugas terdekat", "3 / absen
// habis", "7 hari / ke UTS").
// - The next exam: counted to the exam's own day with the function Tugas and Ujian use (`countdown`), so the three
//   can't disagree. It opens Ujian.
// While the first read runs (or the demo's first sync) no tile answers: each stands as a neutral shape of its final
// size under its plain name, so a green tick can't turn into a red 3 under the Student's eyes. What the strip says is
// said nowhere else on Beranda (./urus.tsx leaves those rows to it).
import { router } from "expo-router";
import { memo, useMemo } from "react";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useTodo } from "../../../../src/app/schedule-data";
import type { ExamKind } from "../../../../src/core/exams";
import type { TodoItem } from "../../../../src/core/todo";
import { useSettling } from "../../host/settling";
import { useNav } from "../../nav";
import { useFirstFrameShown } from "../../shell/first-frame";
import { useFirstReadRunning } from "../../shell/source-status";
import { CountStrip } from "../../ui/b";
import { StatTile } from "../../ui/kit";
import { countdown } from "../tasks/row-parts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** A day's number in WIB, so "today" is the Student's day, not 24 hours. */
const wibDayNumber = (at: number) => Math.floor((at + 7 * HOUR) / DAY);

/** The soonest thing due among the open Tasks (never one the Student put away, never an exam: the third tile's). */
export type Due =
  | { kind: "today"; count: number }
  | { kind: "late"; count: number }
  | { kind: "next"; at: number; title: string }
  | { kind: "undated"; count: number }
  | { kind: "none" };

export function soonestDue(items: readonly TodoItem[], now: number): Due {
  const open = items.filter((item): item is Extract<TodoItem, { kind: "task" }> => item.kind === "task" && !item.putAway);
  const today = wibDayNumber(now);
  const dueToday = open.filter((item) => !item.late && item.at !== null && item.at >= now && wibDayNumber(item.at) === today).length;
  if (dueToday > 0) return { kind: "today", count: dueToday };
  const late = open.filter((item) => item.late).length;
  if (late > 0) return { kind: "late", count: late };
  let next: Extract<TodoItem, { kind: "task" }> | null = null;
  for (const item of open) if (item.at !== null && item.at >= now && (next === null || item.at < (next.at ?? 0))) next = item;
  if (next?.at != null) return { kind: "next", at: next.at, title: next.task.title };
  return open.length > 0 ? { kind: "undated", count: open.length } : { kind: "none" };
}

/** The next exam with a day of its own (never the start of "Masa UTS": Tugas and Ujian count to the exam). */
export function nextExam(items: readonly TodoItem[], now: number): { kind: ExamKind; at: number } | null {
  let found: { kind: ExamKind; at: number } | null = null;
  for (const item of items) {
    if (item.kind !== "exam" || item.late || item.at === null || item.at < now) continue;
    if (found === null || item.at < found.at) found = { kind: item.exam.kind, at: item.at };
  }
  return found;
}

/** The strip before its answers: three neutral shapes of the tiles' final size under their plain names, each already a way in. */
export function StripShape() {
  const t = useT();
  const { go } = useNav();
  return (
    <CountStrip testID="home.strip">
      {[
        <StatTile key="tasks" pending value="" label={t("mobile.strip.wait.tasks")} onPress={() => go({ screen: "tasks" })} testID="action.strip.tasks" />,
        <StatTile
          key="absences"
          pending
          value=""
          label={t("mobile.strip.wait.absences")}
          onPress={() => go({ screen: "presence" })}
          testID="action.strip.absences"
        />,
        <StatTile key="exam" pending value="" label={t("mobile.strip.wait.exam")} onPress={() => router.push("/exams")} testID="action.strip.exam" />,
      ]}
    </CountStrip>
  );
}

export const HomeStrip = memo(function HomeStrip({ over, none }: { over: number; none: number }) {
  const { go } = useNav();
  const settling = useSettling();
  const firstRead = useFirstReadRunning();
  // Counting every Task and exam is kept off the first frame (as the tabs' badges are): the tile stands in its shape.
  const counted = useFirstFrameShown();
  const openTasks = () => go({ screen: "tasks" });
  const openCourses = () => go({ screen: "presence" });
  const openExams = () => router.push("/exams");
  if (settling || firstRead || !counted) return <StripShape />;
  return <Counted over={over} none={none} openTasks={openTasks} openCourses={openCourses} openExams={openExams} />;
});

/** The tiles once everything is read: what's due, the absences, the next exam when there is one. */
function Counted({ over, none, openTasks, openCourses, openExams }: { over: number; none: number; openTasks(): void; openCourses(): void; openExams(): void }) {
  const t = useT();
  const f = useFormat();
  const todo = useTodo();
  const facts = useMemo(() => (todo ? { due: soonestDue(todo.items, todo.now), exam: nextExam(todo.items, todo.now) } : null), [todo]);
  const due = facts?.due;
  const exam = facts?.exam ?? null;
  const away = exam && todo ? countdown(t, todo.now, exam.at) : null;
  const kind = exam ? t(`exam.kind.${exam.kind}`) : "";
  const tasks = !due ? (
    <StatTile key="tasks" pending value="" label={t("mobile.strip.wait.tasks")} onPress={openTasks} testID="action.strip.tasks" />
  ) : due.kind === "today" ? (
    <StatTile
      key="tasks"
      value={String(due.count)}
      label={t("mobile.strip.today")}
      accessibilityLabel={t("mobile.strip.todaySpoken", { count: due.count })}
      onPress={openTasks}
      testID="action.strip.tasks"
    />
  ) : due.kind === "late" ? (
    <StatTile
      key="tasks"
      value={String(due.count)}
      tone="danger"
      label={t("mobile.strip.lateTasks", { count: due.count })}
      accessibilityLabel={t("mobile.strip.lateSpoken", { count: due.count })}
      onPress={openTasks}
      testID="action.strip.tasks"
    />
  ) : due.kind === "next" ? (
    <StatTile
      key="tasks"
      value={f.dayMonth(due.at)}
      label={t("mobile.strip.next")}
      accessibilityLabel={t("mobile.strip.nextSpoken", { date: f.dayMonth(due.at), title: due.title })}
      onPress={openTasks}
      testID="action.strip.tasks"
    />
  ) : due.kind === "undated" ? (
    <StatTile
      key="tasks"
      value={String(due.count)}
      label={t("mobile.strip.undated")}
      accessibilityLabel={t("mobile.strip.undatedSpoken", { count: due.count })}
      onPress={openTasks}
      testID="action.strip.tasks"
    />
  ) : (
    <StatTile key="tasks" mark value="" label={t("mobile.strip.tasksNone")} onPress={openTasks} testID="action.strip.tasks" />
  );
  // Every course with no absence left, at the limit or past it (the ones Kuliah leads with): one figure, one label
  // that is true of each. Red when any is past its limit, amber otherwise.
  const out = over + none;
  const absences =
    out > 0 ? (
      <StatTile
        key="absences"
        value={String(out)}
        tone={over > 0 ? "danger" : "warn"}
        label={t("mobile.strip.out")}
        accessibilityLabel={t("mobile.strip.outSpoken", { count: out })}
        onPress={openCourses}
        testID="action.strip.absences"
      />
    ) : (
      <StatTile key="absences" mark value="" label={t("mobile.strip.absencesNone")} onPress={openCourses} testID="action.strip.absences" />
    );
  return (
    <CountStrip testID="home.strip">
      {[
        tasks,
        absences,
        away ? (
          <StatTile
            key="exam"
            value={`${away.value} ${away.unit}`}
            label={t("mobile.strip.examTo", { kind })}
            accessibilityLabel={t("mobile.strip.examSpoken", { away: away.text, kind })}
            onPress={openExams}
            testID="action.strip.exam"
          />
        ) : null,
      ]}
    </CountStrip>
  );
}
