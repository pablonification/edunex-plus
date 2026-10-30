// What Nilai and the planner share (src/app/screens/plan/projection.tsx) on the phone, so the two
// screens say the same thing the same way: how a term is named, the expected-grade picker (a
// sheet of grades instead of a select), grade badges, the one IPK target (quick picks plus any
// value), what a target needs, the honors outlook, and the IP/IPK chart. The naming helpers are
// the desktop's, copied as they are (that file draws DOM too).
import { type ReactNode, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import type { PlanState } from "../../../../src/app/study-plan";
import { letterForAverage, type Predicate, predicateFor } from "../../../../src/core/honors";
import { GRADE_POINTS, LETTER_GRADES, type LetterGrade } from "../../../../src/core/models";
import {
  honorsOutlook,
  type Need,
  type ProjectedStep,
  type Projection,
  parseTarget,
  type StudentRecord,
  semesterOf,
  TARGET_PICKS,
  targetOf,
  termKind,
} from "../../../../src/core/planner";
import { Segmented } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { Sheet } from "../../ui/sheet";
import { Text, type TextTone, useFieldColors } from "../../ui/text";
import { radius, space, type, useTheme } from "../../ui/theme";
import { ChartLegend, LineChart } from "./chart";

const yearsOf = (term: string) => {
  const year = Number(term.slice(0, 4));
  return `${year}/${year + 1}`;
};

/** "Semester 8 · 2026/2027 Genap", "Semester pendek · 2026/2027". */
export function useTermLabel(): (term: string, semester: number | null) => string {
  const t = useT();
  return (term, semester) => {
    const kind = termKind(term);
    if (kind === "short" || semester === null) return t("planner.termShort", { years: yearsOf(term) });
    return t("planner.term", { n: semester, years: yearsOf(term), kind: t(kind === "odd" ? "planner.odd" : "planner.even") });
  };
}

/** "Smt 7 · 2026/2027 Ganjil": a term named the same way everywhere on Nilai. */
export function useTermName(record: Pick<StudentRecord, "entryTerm">): (term: string) => string {
  const t = useT();
  return (term) => {
    const kind = termKind(term);
    const semester = semesterOf(term, record.entryTerm);
    if (kind === "short" || semester === null) return t("planner.termShort", { years: yearsOf(term) });
    return t("grades.termName", { n: semester, years: yearsOf(term), kind: t(kind === "odd" ? "planner.odd" : "planner.even") });
  };
}

/** "2026/2027 Ganjil", "2026/2027 Pendek": a term without the Student's semester number (KRS, UKT, the calendar). */
export function useTermYears(): (term: string) => string {
  const t = useT();
  return (term) => {
    const kind = termKind(term);
    return `${yearsOf(term)} ${t(kind === "odd" ? "planner.odd" : kind === "even" ? "planner.even" : "grades.shortTerm")}`;
  };
}

/** "Smt 7", or "Pendek" for a short semester: the chart's columns. */
export function useStepLabel(): (step: Pick<ProjectedStep, "term" | "semester">) => string {
  const t = useT();
  return (step) => (step.semester === null ? t("grades.shortTerm") : t("grades.semShort", { n: step.semester }));
}

/** The predicate word for an IPK: one term on every screen. */
export function usePredicate(): (predicate: Predicate | null) => string | null {
  const t = useT();
  return (predicate) => (predicate === null ? null : t(`predicate.${predicate}`));
}

export { predicateFor };

/**
 * An expected grade: a small control showing the grade, a sheet of grades a tap away. Until the
 * Student picks one (`guess`), it's drawn dashed and quiet: an assumption, not a fact.
 */
export function GradeSelect({
  value,
  onChange,
  label,
  guess = false,
  testID,
}: {
  value: LetterGrade;
  onChange: (grade: LetterGrade) => void;
  /** The sheet's title and the control's name ("Perkiraan nilai DK4073"). */
  label: string;
  guess?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const c = theme.color;
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        hitSlop={6}
        onPress={() => setOpen(true)}
        android_ripple={{ color: c.selected }}
        style={{
          minWidth: 60,
          height: 44,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          paddingHorizontal: space[2],
          borderRadius: radius.md,
          borderWidth: 1,
          borderStyle: guess ? "dashed" : "solid",
          borderColor: c.fieldEdge,
          backgroundColor: guess ? "transparent" : c.surface,
        }}
      >
        <Text size="small" weight="semibold" tone={guess ? "muted" : "fg"} tabular>
          {value}
        </Text>
        <Icons.ChevronDown size={12} color={c.muted} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={label} testID="sheet.grade">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], paddingBottom: space[2] }}>
          {LETTER_GRADES.map((grade) => {
            const on = grade === value;
            return (
              <Pressable
                key={grade}
                testID={`action.grade.${grade}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  setOpen(false);
                  onChange(grade);
                }}
                android_ripple={{ color: c.selected }}
                style={{
                  width: 64,
                  height: 48,
                  borderRadius: radius.lg,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? c.accent : c.edge,
                  backgroundColor: on ? c.infoBg : c.surface,
                }}
              >
                <Text size="body" weight="semibold" tone={on ? "info" : "fg"} tabular>
                  {grade}
                </Text>
                <Text size="micro" tone="muted" tabular>
                  {GRADE_POINTS[grade].toFixed(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

/** A grade: neutral, and only a failing one (D, E) in red. */
export function GradeBadge({ grade, struck = false, label }: { grade: string; struck?: boolean; label?: string }) {
  const theme = useTheme();
  const failing = grade === "D" || grade === "E";
  return (
    <View
      accessibilityLabel={label ? `${label}: ${grade}` : undefined}
      style={{
        minWidth: 32,
        height: 26,
        paddingHorizontal: 6,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: failing ? theme.color.dangerBg : theme.color.neutralBg,
      }}
    >
      <Text
        size="small"
        weight="bold"
        tabular
        style={{ color: failing ? theme.color.dangerFg : theme.color.neutralFg, textDecorationLine: struck ? "line-through" : "none" }}
      >
        {grade}
      </Text>
    </View>
  );
}

/**
 * The IPK target, one setting for Nilai and the planner: three quick picks and any other value
 * from 2,00 to 4,00 (the number keypad). A value out of range is said, and never counted.
 */
export function TargetControl({ record, state }: { record: StudentRecord; state: PlanState }) {
  const fieldColors = useFieldColors();
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const target = targetOf(record, state.plan);
  const custom = !TARGET_PICKS.some((v) => Math.abs(v - target) < 1e-9);
  const [typing, setTyping] = useState<string | null>(null);
  const parsed = typing === null ? null : parseTarget(typing);
  const set = (value: number) => state.update((p) => ({ ...p, target: value }));
  // While a value is being typed, the pick still counted stays marked until the typed one is valid.
  const picked = typing === null || parsed?.kind !== "ok" ? TARGET_PICKS.find((pick) => Math.abs(pick - target) < 1e-9) : undefined;
  const invalid = parsed?.kind === "invalid";
  return (
    <View style={{ gap: space[2] }}>
      <Text size="small" weight="medium" tone="muted">
        {t("grades.target")}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <View style={{ flex: 1 }}>
          <Segmented
            label={t("grades.target")}
            value={picked?.toString() ?? ""}
            options={TARGET_PICKS.map((pick) => ({ value: pick.toString(), label: f.number(pick, 2) }))}
            onChange={(pick) => {
              setTyping(null);
              set(Number(pick));
            }}
            testID="action.targetPick"
          />
        </View>
        <TextInput
          {...fieldColors}
          testID="input.target"
          inputMode="decimal"
          keyboardType="decimal-pad"
          accessibilityLabel={t("grades.targetOther")}
          placeholder={t("grades.targetOtherShort")}
          placeholderTextColor={theme.color.faint}
          value={typing ?? (custom ? f.number(target, 2) : "")}
          onFocus={() => setTyping(custom ? f.number(target, 2) : "")}
          onChangeText={(text) => {
            setTyping(text);
            const next = parseTarget(text);
            if (next.kind === "ok") set(next.value);
          }}
          onBlur={() => setTyping(null)}
          style={{
            width: 80,
            height: 44,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: invalid ? theme.color.dangerFg : theme.color.edge,
            backgroundColor: theme.color.surface,
            paddingHorizontal: space[2],
            paddingVertical: 0,
            textAlign: "right",
            textAlignVertical: "center",
            includeFontPadding: false,
            color: theme.color.fg,
            ...type.small,
            fontWeight: "600",
          }}
        />
      </View>
      {invalid && (
        <Text size="small" weight="medium" tone="danger" accessibilityLiveRegion="assertive">
          {t("grades.targetRange")}
        </Text>
      )}
    </View>
  );
}

/**
 * What a target needs, said positively and honestly. `scope`: this semester's courses (Nilai) or
 * everything still to be graded (the planner).
 */
export function NeedText({ need, target, sks, scope }: { need: Need; target: number; sks: number; scope: "term" | "rest" }) {
  const t = useT();
  const f = useFormat();
  const goal = f.number(target, 2);
  const line = (text: string, tone: TextTone = "muted", strong = false) => (
    <Text size="small" tone={tone} weight={strong ? "medium" : "regular"} accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
  if (need.kind === "none") return line(t(scope === "term" ? "grades.targetNone" : "planner.targetNone"));
  if (need.kind === "secured") return line(t("grades.targetSecured", { target: goal }), "success", true);
  if (need.kind === "out") return line(t(scope === "term" ? "grades.targetOut" : "planner.targetOut", { target: goal }), "fg", true);
  // Below a D average the target is safe: say so, never "you need a D".
  if (need.average <= GRADE_POINTS.D + 1e-9) return line(t("grades.targetSafe", { target: goal }), "success", true);
  return line(
    t(scope === "term" ? "grades.targetNeed" : "planner.targetNeed", {
      avg: f.number(need.average, 2),
      letter: letterForAverage(need.average),
      sks,
      target: goal,
    }),
  );
}

/** How hard an average is, in a word: for "Cum laude butuh 3,90 …: sangat berat". */
export function effortKey(average: number): "grades.effort.easy" | "grades.effort.fair" | "grades.effort.hard" | "grades.effort.veryHard" {
  if (average <= 3 + 1e-9) return "grades.effort.easy";
  if (average <= 3.5 + 1e-9) return "grades.effort.fair";
  if (average <= 3.75 + 1e-9) return "grades.effort.hard";
  return "grades.effort.veryHard";
}

/**
 * The honors outlook in one positive sentence (Nilai): the first level still open and what it
 * needs, or the best IPK still possible when none is.
 */
export function HonorsSentence({ projection }: { projection: Projection }) {
  const t = useT();
  const f = useFormat();
  const outlook = honorsOutlook(projection).reverse(); // cum, magna, summa
  const secured = [...outlook].reverse().find((h) => h.kind === "secured");
  const next = outlook.find((h) => h.kind === "needs");
  let text: string;
  if (next && next.kind === "needs") {
    text = t("grades.honorsNeeds", {
      level: t(`honors.${next.level}`),
      avg: f.number(next.average, 2),
      sks: projection.variableSks,
      effort: t(effortKey(next.average)),
    });
    if (secured) text = `${t("grades.honorsSecured", { level: t(`honors.${secured.level}`) })} ${text}`;
  } else if (secured) {
    text = t("grades.honorsSecured", { level: t(`honors.${secured.level}`) });
  } else {
    const cum = outlook.find((h) => h.level === "cum")!;
    text = t("grades.honorsOut", { min: f.number(cum.min, 2) });
  }
  return (
    <Text size="small" tone="muted">
      {text}
    </Text>
  );
}

/** Each honors level: reached, what the rest needs, or why it's out (the planner only). */
export function HonorsList({ projection }: { projection: Projection }) {
  const t = useT();
  const f = useFormat();
  // Never three "di luar jangkauan" in a row: when every level is out, one honest, positive sentence.
  if (honorsOutlook(projection).every((h) => h.kind === "out")) return <HonorsSentence projection={projection} />;
  return (
    <View style={{ gap: space[1.5] }}>
      {honorsOutlook(projection)
        .reverse()
        .map((h) => {
          const text =
            h.kind === "blocked"
              ? t(h.reason === "retake" ? "honors.retake" : "honors.time")
              : h.kind === "secured"
                ? t("honors.secured")
                : h.kind === "needs"
                  ? t("honors.needs", { avg: f.number(h.average, 2), letter: letterForAverage(h.average) })
                  : h.kind === "out"
                    ? t("honors.out")
                    : "-";
          const strong = h.kind === "needs" || h.kind === "secured";
          return (
            <View key={h.level} style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space[3] }}>
              <Text size="small" weight="medium">
                {t(`honors.${h.level}`)}{" "}
                <Text size="small" tone="faint" tabular>
                  {`≥ ${f.number(h.min, 2)}`}
                </Text>
              </Text>
              <Text
                size="small"
                weight={strong ? "semibold" : "regular"}
                tone={h.kind === "secured" ? "success" : strong ? "fg" : "muted"}
                tabular
                style={{ flexShrink: 1, textAlign: "right" }}
              >
                {text}
              </Text>
            </View>
          );
        })}
    </View>
  );
}

/**
 * IP per semester (dots) and the IPK after each (a line), estimates dashed, the target as a
 * labelled dashed line, and the IPK at graduation at the end.
 */
export function IpkChart({ steps, target, height }: { steps: ProjectedStep[]; target: number | null; height?: number }): ReactNode {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const label = useStepLabel();
  const shown = steps.filter((s) => s.ip !== null || s.ipk !== null);
  if (shown.length < 2) return null;
  const firstEstimate = shown.findIndex((s) => s.projected);
  const values = shown.flatMap((s) => [s.ip, s.ipk]).filter((v): v is number => v !== null);
  const low = Math.min(...values, target ?? 4);
  const min = low < 2 ? Math.max(0, Math.floor(low)) : 2;
  const gridlines = min < 2 ? [min, 2, 3, 4] : [2, 2.5, 3, 3.5, 4];
  const last = shown[shown.length - 1]!;
  const series = [
    { name: t("grades.chart.ipk"), kind: "line" as const, values: shown.map((s) => s.ipk), color: theme.color.accent },
    { name: t("grades.chart.ip"), kind: "dots" as const, values: shown.map((s) => s.ip), color: theme.color.faint },
  ];
  return (
    <View>
      <LineChart
        label={t("grades.chartLabel")}
        columns={shown.map(label)}
        shortColumns={shown.map((s) => (s.semester === null ? "P" : String(s.semester)))}
        series={series}
        estimateFrom={firstEstimate < 0 ? undefined : firstEstimate}
        min={min}
        max={4}
        gridlines={gridlines}
        reference={target === null ? undefined : { value: target, label: t("grades.chart.target", { value: f.number(target, 2) }) }}
        endLabel={last.ipk === null ? undefined : t(last.projected ? "grades.chart.end" : "grades.chart.endNow", { value: f.number(last.ipk, 2) })}
        estimateWord={t("grades.estimate")}
        format={(v) => f.number(v, 2)}
        height={height}
      />
      <ChartLegend series={series} estimate={firstEstimate >= 0 ? t("grades.estimate") : undefined} />
    </View>
  );
}
