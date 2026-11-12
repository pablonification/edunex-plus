// What Nilai and the planner share (src/app/screens/plan/projection.tsx) on the phone, so the two
// screens say the same thing the same way: how a term is named, the expected-grade picker (a
// sheet of grades instead of a select), grade badges, the one IPK target (quick picks plus any
// value), what a target needs, the honors outlook, and the IP/IPK chart. The naming helpers are
// the desktop's, copied as they are (that file draws DOM too).
import { type ReactNode, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import type { PlanState } from "../../../../src/app/study-plan";
import { HIDDEN_FIGURE } from "../../../../src/core/hide-grades";
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
import { useGradesHidden } from "../../parts/hide-grades";
import { Segmented } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { iosPressed } from "../../ui/press";
import { Sheet } from "../../ui/sheet";
import { SEGMENT_HEIGHT, slopY } from "../../ui/sizes";
import { Text, type TextTone, useFieldColors, useTextWidth } from "../../ui/text";
import { radius, space, TOUCH, type, useTheme } from "../../ui/theme";
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
  const v = theme.v4;
  const [open, setOpen] = useState(false);
  // Hidden grades: the letter is dots (an estimate not yet picked comes from the IPK); a tap still picks one.
  const hidden = useGradesHidden();
  const t = useT();
  // A control, 48 dp tall: a dashed outline with no fill, the letter in a medium weight, a chevron. Either way it's an
  // estimate, and looks like one (round 3's council: "bold 'AB' beside each course reads as a real grade"; a grade
  // that's out is a plain bold letter): one the Student picked is in the brand's ink, one the app still assumes in the
  // page's quiet ink. The group's heading says the word, once.
  const ink = guess ? v.fg2 : v.brandInk;
  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={hidden ? `${label}: ${t("mobile.hideGrades.hidden")}` : `${label}: ${value}`}
        onPress={() => setOpen(true)}
        android_ripple={{ color: c.selected, borderless: false }}
        style={({ pressed }) => [
          {
            minWidth: 68,
            height: TOUCH,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingHorizontal: space[3],
            borderRadius: 14,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: guess ? c.outline : v.brandInk,
            overflow: "hidden",
          },
          iosPressed(pressed),
        ]}
      >
        <Text size="titleMedium" weight="medium" tabular style={{ color: ink, fontSize: 17 }}>
          {hidden ? HIDDEN_FIGURE : value}
        </Text>
        <Icons.ChevronDown size={14} color={guess ? v.muted : ink} weight="bold" />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={label} background={v.card} testID="sheet.grade">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], paddingBottom: space[2] }}>
          {LETTER_GRADES.map((grade) => {
            const on = !hidden && grade === value;
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
                style={({ pressed }) => [
                  {
                    width: 64,
                    height: 52,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: on ? 2 : 0,
                    borderColor: v.brandInk,
                    backgroundColor: on ? v.brandTint : v.chip,
                  },
                  iosPressed(pressed),
                ]}
              >
                <Text size="bodyLarge" face="display" weight="bold" tabular style={{ color: on ? v.brandInk : v.fg }}>
                  {grade}
                </Text>
                <Text size="micro" tabular style={{ color: on ? v.brandInk : v.muted }}>
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
  const t = useT();
  // Hidden grades: dots, in the neutral colour (red would say "failing"), and never the letter to a screen reader.
  const hidden = useGradesHidden();
  const failing = !hidden && (grade === "D" || grade === "E");
  return (
    <View
      accessibilityLabel={hidden ? t("mobile.hideGrades.said", { name: label ?? t("grades.sixGrade") }) : label ? `${label}: ${grade}` : undefined}
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
        style={{ color: failing ? theme.color.dangerFg : theme.color.neutralFg, textDecorationLine: struck && !hidden ? "line-through" : "none" }}
      >
        {hidden ? HIDDEN_FIGURE : grade}
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
  const pickWidth = useTextWidth(208);
  return (
    <View style={{ gap: space[2] }}>
      <Text size="small" weight="medium" tone="muted">
        {t("grades.target")}
      </Text>
      {/* The picks and the field side by side while they fit; at a big font size the field wraps under the picks. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[2] }}>
        <View style={{ flexGrow: 1, flexBasis: pickWidth }}>
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
          hitSlop={slopY(SEGMENT_HEIGHT)}
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
            // The fourth choice of the same control: the picks' own height, outline and round ends, no fill of its own
            // (round 2's council: "boxed differently from the three beside it").
            width: 88,
            height: SEGMENT_HEIGHT,
            borderRadius: SEGMENT_HEIGHT / 2,
            borderWidth: 1,
            borderColor: invalid ? theme.color.dangerFg : theme.color.outline,
            backgroundColor: "transparent",
            paddingHorizontal: space[3],
            paddingVertical: 0,
            textAlign: "center",
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

/**
 * What a target takes from this semester, as a figure at the end of one line (Nilai): the average needed and its
 * letter, or, when even straight A's fall short, the highest IPK still possible. A target already safe keeps its one
 * positive line (`NeedText`).
 */
export function NeedFigure({ need, target, sks, best }: { need: Need; target: number; sks: number; best: number | null }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const out = need.kind === "out";
  if (!(out && best !== null) && !(need.kind === "needs" && need.average > GRADE_POINTS.D + 1e-9)) {
    return <NeedText need={need} target={target} sks={sks} scope="term" />;
  }
  const label = out ? t("mobile.grades.termBest") : t("mobile.grades.needAverage", { sks });
  const figure = out
    ? f.number(best ?? 0, 2)
    : `${f.number(need.kind === "needs" ? need.average : 0, 2)} · ${letterForAverage(need.kind === "needs" ? need.average : 0)}`;
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${figure}`}
      accessibilityLiveRegion="polite"
      testID="grades.need"
      style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: space[3] }}
    >
      <Text size="bodyMedium" style={{ color: v.muted }}>
        {label}
      </Text>
      <Text size="bodyLarge" face="display" weight="bold" tabular style={{ color: v.fg }}>
        {figure}
      </Text>
    </View>
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
 * IP per semester (dots) and the IPK after each (a line), estimates dashed and hollow, under a legend that names the
 * three marks (read before the chart, not after it); the target as a dashed line labelled as its control names it
 * ("Target IPK 3,50"), and the IPK at graduation at
 * the line's end only when it isn't today's (the same figure twice reads as a change that isn't one).
 */
export function IpkChart({
  steps,
  target,
  best = null,
  height,
}: {
  steps: ProjectedStep[];
  target: number | null;
  /** The highest IPK still possible: a target over it is out of reach, and the line shows this instead. */
  best?: number | null;
  height?: number;
}): ReactNode {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const label = useStepLabel();
  const shown = steps.filter((s) => s.ip !== null || s.ipk !== null);
  if (shown.length < 2) return null;
  const firstEstimate = shown.findIndex((s) => s.projected);
  const values = shown.flatMap((s) => [s.ip, s.ipk]).filter((v): v is number => v !== null);
  // A target out of reach isn't drawn as if it were one: the line marks the highest IPK still possible, named so.
  const out = target !== null && best !== null && target > best + 1e-9;
  const reference =
    target === null
      ? undefined
      : out && best !== null
        ? { value: best, label: t("grades.chart.best", { value: f.number(best, 2) }) }
        : // Named as the control that sets it ("Target IPK", Nilai's Semester ini and the planner), so it's never a bare "Target".
          { value: target, label: t("grades.targetOf", { value: f.number(target, 2) }) };
  const low = Math.min(...values, reference?.value ?? 4);
  const min = low < 2 ? Math.max(0, Math.floor(low)) : 2;
  const gridlines = min < 2 ? [min, 2, 3, 4] : [2, 2.5, 3, 3.5, 4];
  const last = shown[shown.length - 1]!;
  const today = [...shown].reverse().find((s) => !s.projected && s.ipk !== null)?.ipk ?? null;
  const same = last.projected && last.ipk !== null && today !== null && f.number(last.ipk, 2) === f.number(today, 2);
  const series = [
    { name: t("grades.chart.ipk"), kind: "line" as const, values: shown.map((s) => s.ipk), color: theme.color.accent },
    { name: t("grades.chart.ip"), kind: "dots" as const, values: shown.map((s) => s.ip), color: theme.color.faint },
  ];
  return (
    <View style={{ gap: space[3] }}>
      <ChartLegend series={series} estimate={firstEstimate >= 0 ? t("grades.estimate") : undefined} />
      <LineChart
        label={t("grades.chartLabel")}
        columns={shown.map(label)}
        shortColumns={shown.map((s) => (s.semester === null ? "P" : String(s.semester)))}
        series={series}
        estimateFrom={firstEstimate < 0 ? undefined : firstEstimate}
        min={min}
        max={4}
        gridlines={gridlines}
        reference={reference}
        endLabel={last.ipk === null || same ? undefined : t(last.projected ? "grades.chart.end" : "grades.chart.endNow", { value: f.number(last.ipk, 2) })}
        estimateWord={t("grades.estimate")}
        format={(v) => f.number(v, 2)}
        height={height}
      />
    </View>
  );
}
