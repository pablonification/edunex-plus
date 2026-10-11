// Pieces Nilai and the planner share: the expected-grade picker, the
// projected semesters table, the honors outlook, and how a term is named.
import { honorsOutlook, type Projection, type ProjectedStep, termKind } from "../../../core/planner";
import { letterForAverage } from "../../../core/honors";
import { LETTER_GRADES, type LetterGrade } from "../../../core/models";
import { useFormat, useT } from "../../i18n";
import { cx } from "../../ui/cx";

/** "Semester 8 · 2026/2027 Genap", "Semester pendek · 2026/2027". */
export function useTermLabel(): (term: string, semester: number | null) => string {
  const t = useT();
  return (term, semester) => {
    const year = Number(term.slice(0, 4));
    const years = `${year}/${year + 1}`;
    const kind = termKind(term);
    if (kind === "short" || semester === null) return t("planner.termShort", { years });
    return t("planner.term", { n: semester, years, kind: t(kind === "odd" ? "planner.odd" : "planner.even") });
  };
}

/** "Smt 7", or "Pendek" for a short semester. */
export function useStepLabel(): (step: Pick<ProjectedStep, "term" | "semester">) => string {
  const t = useT();
  return (step) => (step.semester === null ? t("grades.shortTerm") : t("grades.semShort", { n: step.semester }));
}

export function GradeSelect({ value, onChange, label, className }: { value: LetterGrade; onChange: (grade: LetterGrade) => void; label: string; className?: string }) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(event) => onChange(event.target.value as LetterGrade)}
      className={cx("focus-ring h-7 w-[62px] rounded-md border border-edge bg-surface px-1.5 text-small font-semibold text-fg hover:bg-hover", className)}
    >
      {LETTER_GRADES.map((grade) => (
        <option key={grade} value={grade}>
          {grade}
        </option>
      ))}
    </select>
  );
}

/** Each projected semester's SKS, IP and the IPK it leaves. */
export function ProjectedTable({ steps }: { steps: ProjectedStep[] }) {
  const t = useT();
  const f = useFormat();
  const label = useStepLabel();
  const rows = steps.filter((s) => s.projected);
  if (!rows.length) return null;
  const num = (value: number | null) => (value === null ? "—" : f.number(value, 2));
  return (
    <table className="w-full text-small">
      <thead>
        <tr className="text-left text-caption text-faint">
          <th className="py-1 font-medium">{t("grades.projected")}</th>
          <th className="py-1 text-right font-medium">SKS</th>
          <th className="py-1 text-right font-medium">IP</th>
          <th className="py-1 text-right font-medium">IPK</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((step) => (
          <tr key={step.term} className="border-t border-line">
            <td className="py-1.5 font-medium">{label(step)}</td>
            <td className="py-1.5 text-right text-muted tabular-nums">{step.sks}</td>
            <td className="py-1.5 text-right font-semibold tabular-nums">{num(step.ip)}</td>
            <td className="py-1.5 text-right font-semibold tabular-nums">{num(step.ipk)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Each honors level: reached, what the rest needs, or why it's out. */
export function HonorsList({ projection, className }: { projection: Projection; className?: string }) {
  const t = useT();
  const f = useFormat();
  return (
    <ul className={cx("space-y-1.5 rounded-lg bg-fill px-3 py-3 text-small", className)}>
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
                {t(`honors.${h.level}`)} <span className="text-faint">≥ {f.number(h.min, 2)}</span>
              </span>
              <span className={cx("text-right tabular-nums", strong ? "font-semibold" : "text-faint", h.kind === "secured" && "text-success-fg")}>{text}</span>
            </li>
          );
        })}
    </ul>
  );
}
