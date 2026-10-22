// Pieces Nilai and the planner share, so the two screens say the same thing
// the same way: how a term is named, the expected-grade picker, grade
// badges, the one IPK target (quick picks plus any value), what a target
// needs, the honors outlook, and the IP/IPK chart.
import { useState } from "react";
import { letterForAverage, type Predicate, predicateFor } from "../../../core/honors";
import { GRADE_POINTS, LETTER_GRADES, type LetterGrade } from "../../../core/models";
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
} from "../../../core/planner";
import { useFormat, useT } from "../../i18n";
import type { PlanState } from "../../study-plan";
import { ChartLegend, LineChart } from "../../ui/chart";
import { Segmented } from "../../ui/controls";
import { cx } from "../../ui/cx";

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
 * An expected grade. Until the Student picks one (`guess`), it's drawn as a
 * dashed, quiet control: an assumption, not a fact.
 */
export function GradeSelect({
  value,
  onChange,
  label,
  guess = false,
  className,
}: {
  value: LetterGrade;
  onChange: (grade: LetterGrade) => void;
  label: string;
  guess?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(event) => onChange(event.target.value as LetterGrade)}
      className={cx(
        "focus-ring h-7 w-[62px] rounded-md px-1.5 text-small font-semibold transition-colors duration-150 hover:bg-hover",
        guess ? "border border-dashed border-field-edge bg-transparent text-muted" : "border border-field-edge bg-surface text-fg",
        className,
      )}
    >
      {LETTER_GRADES.map((grade) => (
        <option key={grade} value={grade}>
          {grade}
        </option>
      ))}
    </select>
  );
}

/** A grade: neutral, and only a failing one (D, E) in red. */
export function GradeBadge({ grade, struck = false, title }: { grade: string; struck?: boolean; title?: string }) {
  const failing = grade === "D" || grade === "E";
  return (
    <span
      title={title}
      className={cx(
        "inline-grid h-6 min-w-8 place-items-center rounded-md px-1.5 text-small font-bold tabular-nums",
        failing ? "bg-danger-bg text-danger-fg" : "bg-neutral-bg text-neutral-fg",
        struck && "line-through",
      )}
    >
      {grade}
    </span>
  );
}

/**
 * The IPK target, one setting for Nilai and the planner: three quick picks
 * and any other value from 2,00 to 4,00. A value out of range is said, and
 * never counted.
 */
export function TargetControl({ record, state, className }: { record: StudentRecord; state: PlanState; className?: string }) {
  const t = useT();
  const f = useFormat();
  const target = targetOf(record, state.plan);
  const custom = !TARGET_PICKS.some((v) => Math.abs(v - target) < 1e-9);
  const [typing, setTyping] = useState<string | null>(null);
  const parsed = typing === null ? null : parseTarget(typing);
  const set = (value: number) => state.update((p) => ({ ...p, target: value }));
  // While a value is being typed, the pick still counted stays marked until the typed one is valid.
  const picked = typing === null || parsed?.kind !== "ok" ? TARGET_PICKS.find((pick) => Math.abs(pick - target) < 1e-9) : undefined;
  return (
    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      <span className="text-small font-medium text-muted">{t("grades.target")}</span>
      <span className="flex items-center gap-2">
        <Segmented
          label={t("grades.target")}
          value={picked?.toString() ?? null}
          options={TARGET_PICKS.map((pick) => ({ value: pick.toString(), label: f.number(pick, 2), name: t("grades.targetOf", { value: f.number(pick, 2) }) }))}
          onChange={(pick) => {
            setTyping(null);
            set(Number(pick));
          }}
        />
        <input
          inputMode="decimal"
          aria-label={t("grades.targetOther")}
          aria-invalid={parsed?.kind === "invalid" || undefined}
          placeholder={t("grades.targetOtherShort")}
          value={typing ?? (custom ? f.number(target, 2) : "")}
          onFocus={() => setTyping(custom ? f.number(target, 2) : "")}
          onChange={(event) => {
            setTyping(event.target.value);
            const next = parseTarget(event.target.value);
            if (next.kind === "ok") set(next.value);
          }}
          onBlur={() => setTyping(null)}
          className={cx(
            "focus-ring h-8 w-[76px] rounded-lg border bg-surface px-2 text-right text-small font-semibold text-fg tabular-nums placeholder:font-normal placeholder:text-faint",
            parsed?.kind === "invalid" ? "border-danger-fg" : "border-edge",
          )}
        />
      </span>
      {parsed?.kind === "invalid" && (
        <span role="alert" className="w-full text-small font-medium text-danger-fg">
          {t("grades.targetRange")}
        </span>
      )}
    </div>
  );
}

/**
 * What a target needs, said positively and honestly. `scope`: this semester's
 * courses (Nilai) or everything still to be graded (the planner).
 */
export function NeedText({ need, target, sks, scope }: { need: Need; target: number; sks: number; scope: "term" | "rest" }) {
  const t = useT();
  const f = useFormat();
  const goal = f.number(target, 2);
  if (need.kind === "none") return <>{t(scope === "term" ? "grades.targetNone" : "planner.targetNone")}</>;
  if (need.kind === "secured") return <span className="font-medium text-success-fg">{t("grades.targetSecured", { target: goal })}</span>;
  if (need.kind === "out")
    return <span className="font-medium text-fg">{t(scope === "term" ? "grades.targetOut" : "planner.targetOut", { target: goal })}</span>;
  // Below a D average the target is safe: say so, never "you need a D".
  if (need.average <= GRADE_POINTS.D + 1e-9) return <span className="font-medium text-success-fg">{t("grades.targetSafe", { target: goal })}</span>;
  return (
    <>
      {t(scope === "term" ? "grades.targetNeed" : "planner.targetNeed", {
        avg: f.number(need.average, 2),
        letter: letterForAverage(need.average),
        sks,
        target: goal,
      })}
    </>
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
 * The honors outlook in one positive sentence (Nilai): the first level still
 * open and what it needs, or the best IPK still possible when none is.
 */
export function HonorsSentence({ projection, className }: { projection: Projection; className?: string }) {
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
  return <p className={cx("text-small text-muted", className)}>{text}</p>;
}

/** Each honors level: reached, what the rest needs, or why it's out (the planner only). */
export function HonorsList({ projection, className }: { projection: Projection; className?: string }) {
  const t = useT();
  const f = useFormat();
  // Never three "di luar jangkauan" in a row: when every level is out, one honest, positive sentence.
  if (honorsOutlook(projection).every((h) => h.kind === "out")) return <HonorsSentence projection={projection} className={className} />;
  return (
    <ul className={cx("space-y-1.5 text-small", className)}>
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
                    : "—";
          const strong = h.kind === "needs" || h.kind === "secured";
          return (
            <li key={h.level} className="flex items-baseline justify-between gap-3">
              <span className="font-medium">
                {t(`honors.${h.level}`)} <span className="font-normal text-faint tabular-nums">≥ {f.number(h.min, 2)}</span>
              </span>
              <span className={cx("text-right tabular-nums", strong ? "font-semibold" : "text-muted", h.kind === "secured" && "text-success-fg")}>{text}</span>
            </li>
          );
        })}
    </ul>
  );
}

/**
 * IP per semester (dots) and the IPK after each (a line), estimates dashed,
 * the target as a labelled dashed line, and the IPK at graduation at the end.
 */
export function IpkChart({ steps, target, height, className }: { steps: ProjectedStep[]; target: number | null; height?: number; className?: string }) {
  const t = useT();
  const f = useFormat();
  const label = useStepLabel();
  const shown = steps.filter((s) => s.ip !== null || s.ipk !== null);
  if (shown.length < 2) return null;
  const firstEstimate = shown.findIndex((s) => s.projected);
  const values = shown.flatMap((s) => [s.ip, s.ipk]).filter((v): v is number => v !== null);
  const low = Math.min(...values, target ?? 4);
  const min = low < 2 ? Math.max(0, Math.floor(low)) : 2;
  const gridlines = min < 2 ? [min, 2, 3, 4] : [2, 2.5, 3, 3.5, 4];
  const last = shown.at(-1)!;
  const series = [
    { name: t("grades.chart.ipk"), kind: "line" as const, values: shown.map((s) => s.ipk), color: "var(--accent)" },
    { name: t("grades.chart.ip"), kind: "dots" as const, values: shown.map((s) => s.ip), color: "var(--faint)" },
  ];
  return (
    <div className={className}>
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
    </div>
  );
}
