// The end of a hand-in, where Kumpulkan was (the Student's thumb and eye are there): the Task went to Selesai, with the
// way to see it there, and what's due next in one tap. Never a dead end: before this the page's job was done and only
// Back was left. The moment itself (the check that draws, the haptic) is ../../ui/celebrate.tsx's, over the page.
import { useMemo } from "react";
import { View } from "react-native";
import { useTermCourses } from "../../../../src/app/courses";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useTodo } from "../../../../src/app/schedule-data";
import type { Task } from "../../../../src/core/models";
import type { TodoItem } from "../../../../src/core/todo";
import { useNav } from "../../nav";
import { useB } from "../../ui/b";
import { Button } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { useBottomInset } from "../../ui/insets";
import { factsLabel } from "../../ui/layout";
import { Appear } from "../../ui/moves";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space } from "../../ui/theme";
import { shortName } from "../home/parts";
import { KindIcon } from "./row-parts";

/** The next Task to hand in after `taskId`, soonest first (a late one before the rest): a Task, or an exam's take-home. */
export function nextTask(items: readonly TodoItem[], taskId: number): { task: Task; exam: boolean } | null {
  for (const item of items) {
    if (item.kind === "task" && !item.putAway && item.task.id !== taskId) return { task: item.task, exam: false };
    if (item.kind === "exam" && item.part?.kind === "takehome" && item.part.task.id !== taskId) return { task: item.part.task, exam: true };
  }
  return null;
}

export function AfterHandIn({ taskId }: { taskId: number }) {
  const t = useT();
  const f = useFormat();
  const b = useB();
  const { go } = useNav();
  const bottom = useBottomInset();
  const todo = useTodo();
  const courses = useTermCourses();
  const next = useMemo(() => nextTask(todo?.items ?? [], taskId), [todo, taskId]);
  const seeDone = () => go({ screen: "tasks", show: "done" });
  const course = next ? courses?.find((c) => c.code === next.task.courseCode) : undefined;
  const line = next
    ? factsLabel(course ? shortName(course.name) : next.task.courseCode, next.task.dueAt !== null ? f.dueLabel(next.task.dueAt) : t("task.noDeadline"))
    : "";
  return (
    <Appear
      testID="bar.afterHandIn"
      style={{
        backgroundColor: b.page,
        borderTopWidth: 1,
        borderTopColor: b.line,
        paddingHorizontal: space.page,
        paddingTop: space[2],
        paddingBottom: space[3] + bottom,
        gap: space[2],
      }}
    >
      {/* Where it went: a mark and a few words, and the way to see it there. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 48 }}>
        <Icons.CheckCircle size={20} weight="fill" color={b.ok} />
        <Text size="bodyLarge" weight="medium" style={{ flex: 1, color: b.fg }}>
          {t("mobile.tasks.movedToDone")}
        </Text>
        {next && (
          <Button size="sm" variant="ghost" label={t("mobile.tasks.seeDone")} onPress={seeDone} testID="action.seeDone">
            {t("mobile.tasks.see")}
          </Button>
        )}
      </View>
      {next ? (
        // What's next, one tap away: pushed over this Task, so Back comes back here, then to where the Student came from.
        <PressScale
          testID="action.next"
          accessibilityRole="button"
          accessibilityLabel={factsLabel(t("mobile.tasks.next"), next.task.title, line)}
          onPress={() => go({ screen: "task", taskId: next.task.id })}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[3],
            minHeight: 64,
            borderRadius: 16,
            paddingHorizontal: space[4],
            paddingVertical: space[3],
            backgroundColor: b.brand,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size="bodyMedium" style={{ color: b.onBrand }}>
              {t("mobile.tasks.next")}
            </Text>
            <Text size="titleMedium" face="display" weight="bold" numberOfLines={1} style={{ color: b.onBrand }}>
              {next.task.title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <KindIcon kind={next.exam ? "exam" : "task"} color={b.onBrand} />
              <Text size="bodyMedium" tabular numberOfLines={1} style={{ flexShrink: 1, color: b.onBrand }}>
                {line}
              </Text>
            </View>
          </View>
          <Icons.ArrowRight size={20} color={b.onBrand} />
        </PressScale>
      ) : (
        // Nothing else to hand in: the one way on is the list, on Selesai, where this Task now is.
        <Button variant="primary" size="lg" onPress={seeDone} testID="action.seeDone">
          {t("mobile.tasks.seeDone")}
        </Button>
      )}
    </Appear>
  );
}
