// Beranda's strip about the Student (`home.strip`): the three things they check every day, each one target that opens
// the page with its detail. What's due: Tasks with a deadline in the next 7 days, late ones too (what a student has to
// act on now; every open Task is Tugas's own count). Absences: the courses with no absence left or past the limit, red
// once one is past it, amber at it. The next exam: the days to it ("7 hari ke UTS"). Good news is a check and a word,
// never "0"; a tile with nothing to say is gone and the others take the width. What the strip says is said nowhere else
// on Beranda (./urus.tsx leaves those rows to it).
import { memo, type ReactNode, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { useTodo } from "../../../../src/app/schedule-data";
import type { ExamKind } from "../../../../src/core/exams";
import type { TodoItem } from "../../../../src/core/todo";
import { useNav } from "../../nav";
import { useFirstFrameShown } from "../../shell/first-frame";
import { useB } from "../../ui/b";
import { Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { RollTo } from "../../ui/moves";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { font, space } from "../../ui/theme";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** A day's number in WIB, so "days to" counts midnights, not 24 hours. */
const wibDayNumber = (at: number) => Math.floor((at + 7 * HOUR) / DAY);

/** Tasks to act on now: late, or due within 7 days. Never one the Student put away, never an exam (the third tile's). */
export function dueSoon(items: readonly TodoItem[], now: number): number {
  return items.filter((item) => item.kind === "task" && !item.putAway && (item.late || (item.at !== null && item.at - now <= 7 * DAY))).length;
}

/** The next exam (or exam period) with a day: its kind, the days to it, and the exam's page when it has one. */
export function nextExam(items: readonly TodoItem[], now: number): { kind: ExamKind; days: number; examId: string | null } | null {
  for (const item of items) {
    if (item.at === null || item.at < now) continue;
    if (item.kind === "exam" && !item.late) return { kind: item.exam.kind, days: wibDayNumber(item.at) - wibDayNumber(now), examId: item.exam.id };
    if (item.kind === "period") return { kind: item.examKind, days: Math.max(0, wibDayNumber(item.at) - wibDayNumber(now)), examId: null };
  }
  return null;
}

export const HomeStrip = memo(function HomeStrip({ limit, past }: { limit: number; past: boolean }) {
  const t = useT();
  const b = useB();
  const { go } = useNav();
  // Counting every Task and exam is kept off the first frame (as the tabs' badges are): the tile stands in its shape.
  const counted = useFirstFrameShown();
  const absences =
    limit > 0 ? (
      <Tile
        key="absences"
        figure={limit}
        ink={past ? b.red : b.amber}
        label={t("mobile.strip.limit")}
        spoken={t("mobile.strip.limitSpoken", { count: limit })}
        onPress={() => go({ screen: "presence" })}
        testID="action.strip.absences"
      />
    ) : (
      <Tile key="absences" label={t("mobile.strip.absencesNone")} onPress={() => go({ screen: "presence" })} testID="action.strip.absences" />
    );
  return (
    <View testID="home.strip" style={{ flexDirection: "row", alignItems: "stretch" }}>
      {counted ? (
        <Counted absences={absences} />
      ) : (
        [
          <Tile key="tasks" pending label={t("mobile.strip.due")} onPress={() => go({ screen: "tasks" })} testID="action.strip.tasks" />,
          <Divider key="d" />,
          absences,
        ]
      )}
    </View>
  );
});

/** The tiles once Tugas's list is counted: what's due, the absences, the next exam when there is one. */
function Counted({ absences }: { absences: ReactNode }) {
  const t = useT();
  const b = useB();
  const { go } = useNav();
  const todo = useTodo();
  const facts = useMemo(
    () =>
      todo
        ? {
            due: dueSoon(todo.items, todo.now),
            late: todo.items.some((item) => item.kind === "task" && item.late && !item.putAway),
            exam: nextExam(todo.items, todo.now),
          }
        : null,
    [todo],
  );
  const openTasks = () => go({ screen: "tasks" });
  const exam = facts?.exam ?? null;
  const kind = exam ? t(`exam.kind.${exam.kind}`) : "";
  const openExam = () => (exam?.examId ? go({ screen: "exam", examId: exam.examId }) : openTasks());
  return (
    <>
      {!facts ? (
        <Tile pending label={t("mobile.strip.due")} onPress={openTasks} testID="action.strip.tasks" />
      ) : facts.due > 0 ? (
        <Tile figure={facts.due} ink={facts.late ? b.amber : undefined} label={t("mobile.strip.due")} onPress={openTasks} testID="action.strip.tasks" />
      ) : (
        <Tile label={t("mobile.strip.dueNone")} onPress={openTasks} testID="action.strip.tasks" />
      )}
      <Divider />
      {absences}
      {exam && <Divider />}
      {exam &&
        (exam.days > 0 ? (
          <Tile figure={exam.days} label={t("mobile.strip.examIn", { count: exam.days, kind })} onPress={openExam} testID="action.strip.exam" />
        ) : (
          <Tile mark="exam" label={t("mobile.strip.examToday", { kind })} onPress={openExam} testID="action.strip.exam" />
        ))}
    </>
  );
}

function Divider() {
  const b = useB();
  return <View style={{ width: StyleSheet.hairlineWidth * 2, marginVertical: space[3], backgroundColor: b.line }} />;
}

/**
 * One tile: its figure (rolling to a new value), or a check when all is well, then what it counts with a chevron, so it
 * reads as a way in. The whole tile is the target.
 */
function Tile({
  figure,
  ink,
  label,
  spoken,
  mark = "check",
  pending = false,
  onPress,
  testID,
}: {
  figure?: number;
  ink?: string;
  label: string;
  spoken?: string;
  mark?: "check" | "exam";
  pending?: boolean;
  onPress(): void;
  testID: string;
}) {
  const b = useB();
  return (
    <PressScale onPress={onPress} testID={testID} accessibilityLabel={spoken ?? (figure !== undefined ? `${figure} ${label}` : label)} style={styles.tile}>
      {/* The figure is a read-only field (RollTo): it never takes the tile's touch. */}
      <View pointerEvents="none" style={{ height: 32, justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {pending ? (
          <Skeleton width={28} height={20} />
        ) : figure !== undefined ? (
          <RollTo value={figure} style={[styles.figure, { color: ink ?? b.fg }]} />
        ) : mark === "exam" ? (
          <Icons.PenLine size={24} weight="fill" color={b.amber} />
        ) : (
          <Icons.CheckCircle size={24} weight="fill" color={b.ok} />
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        <Text size="bodyMedium" numberOfLines={2} style={{ color: b.fg2, fontSize: 13, lineHeight: 17, letterSpacing: 0, textAlign: "center", flexShrink: 1 }}>
          {label}
        </Text>
        <Icons.ChevronRight size={12} color={b.muted} />
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", paddingVertical: space[2], paddingHorizontal: space[1], gap: 2 },
  figure: { fontFamily: font.display.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, textAlign: "center", fontVariant: ["tabular-nums"] },
});
