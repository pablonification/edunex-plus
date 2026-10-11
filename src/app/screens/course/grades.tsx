// The Nilai tab: EduNex's grade only once the lecturer publishes it (before
// that EduNex says 0 · E, never shown), and the course-contract calculator:
// the Student enters each part's weight and the score they have or expect,
// and sees their final score or what they need on what's left. What they
// enter stays on this computer ("local.courseWeights").
import { useState } from "react";
import { EXAMPLE_CONTRACT, EXAMPLE_PART_IDS, partScore, standing } from "../../../core/course-contract";
import { CONTRACT_LETTERS, type ContractPart, type CourseContract } from "../../../core/models";
import { useFormat, useT } from "../../i18n";
import { useBridge, useDataset } from "../../store";
import { Button, IconButton } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Card, SourceTag } from "../../ui/display";
import { Icons } from "../../ui/icons";
import type { CoursePage } from "./data";

export function GradesTab({ page }: { page: CoursePage }) {
  const t = useT();
  const f = useFormat();
  const grade = page.outline?.grade ?? null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_280px] items-start gap-8">
      <Calculator page={page} />
      <Card className="px-4 py-3.5">
        <p className="flex items-center justify-between gap-2 text-small font-semibold text-muted">
          {t("grade.edunex")}
          <SourceTag source="edunex" />
        </p>
        {grade ? (
          <p className="mt-2 text-body">
            <span className="text-heading font-semibold tabular-nums">{f.number(grade.total, 1)}</span>
            <span className="ml-2 text-heading font-semibold">{grade.letter}</span>
          </p>
        ) : (
          <p className="mt-2 flex items-start gap-2 text-body text-muted">
            <Icons.EyeOff className="mt-0.5 size-3.5 shrink-0" />
            {t("grade.unpublished")}
          </p>
        )}
      </Card>
    </div>
  );
}

const clampScore = (text: string): number | null => {
  const digits = text.replace(/[^\d.,]/g, "").replace(",", ".");
  if (digits === "") return null;
  const value = Number(digits);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
};

function Calculator({ page }: { page: CoursePage }) {
  const t = useT();
  const f = useFormat();
  const bridge = useBridge();
  const code = page.course.code;
  const saved = useDataset("local.courseWeights");
  const [draft, setDraft] = useState<CourseContract | null>(null);
  const contract = draft ?? saved?.[code] ?? EXAMPLE_CONTRACT;
  const isExample = !draft && !saved?.[code];
  const attendance = page.course.attendance && page.course.attendance.held > 0 ? Math.round((page.course.attendance.attended / page.course.attendance.held) * 100) : null;
  const result = standing(contract, attendance);

  const save = (next: CourseContract | null) => {
    setDraft(next);
    const all = { ...(saved ?? {}) };
    if (next) all[code] = next;
    else delete all[code];
    void bridge.invoke("local.set", { name: "local.courseWeights", value: all }).catch(() => undefined);
  };
  const setPart = (id: string, patch: Partial<ContractPart>) => save({ ...contract, parts: contract.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const nameOf = (part: ContractPart) => part.name || ((EXAMPLE_PART_IDS as readonly string[]).includes(part.id) ? t(`grade.part.${part.id as (typeof EXAMPLE_PART_IDS)[number]}`) : t("grade.part.new"));

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3.5">
        <div>
          <h2 className="text-title font-semibold">{t("grade.standing")}</h2>
          <p className="mt-0.5 text-small text-muted">{isExample ? t("grade.example") : t("grade.yours")}</p>
        </div>
        {!isExample && (
          <Button variant="ghost" size="sm" onClick={() => save(null)}>
            {t("grade.reset")}
          </Button>
        )}
      </div>

      <div className="px-4 py-3">
        <table className="w-full text-body">
          <thead>
            <tr className="text-left text-caption text-faint">
              <th className="py-1 font-medium">{t("grade.part")}</th>
              <th className="w-[84px] py-1 text-right font-medium">{t("grade.weight")}</th>
              <th className="w-[84px] py-1 text-right font-medium">{t("grade.score")}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {contract.parts.map((part) => {
              const name = nameOf(part);
              const fromSix = part.attendance && attendance !== null;
              return (
                <tr key={part.id} className="border-t border-line">
                  <td className="py-1.5 pr-2">
                    <input
                      aria-label={t("grade.partName")}
                      value={name}
                      maxLength={80}
                      onChange={(event) => setPart(part.id, { name: event.target.value })}
                      className="focus-ring h-7 w-full rounded-md bg-transparent px-1.5 font-medium hover:bg-fill"
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <input
                      aria-label={t("grade.weightOf", { part: name })}
                      inputMode="numeric"
                      value={part.weight}
                      onChange={(event) => setPart(part.id, { weight: clampScore(event.target.value) ?? 0 })}
                      className="focus-ring h-7 w-12 rounded-md bg-fill px-1.5 text-right tabular-nums"
                    />
                    <span className="ml-0.5 text-faint">%</span>
                  </td>
                  <td className="py-1.5 text-right">
                    {fromSix ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
                        <SourceTag source="six" />
                        {partScore(part, attendance)}
                      </span>
                    ) : (
                      <input
                        aria-label={t("grade.scoreOf", { part: name })}
                        inputMode="decimal"
                        placeholder="—"
                        value={part.score ?? ""}
                        onChange={(event) => setPart(part.id, { score: clampScore(event.target.value) })}
                        className="focus-ring h-7 w-16 rounded-md bg-fill px-1.5 text-right tabular-nums"
                      />
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    <IconButton label={t("grade.remove", { part: name })} size="sm" onClick={() => save({ ...contract, parts: contract.parts.filter((p) => p.id !== part.id) })}>
                      <Icons.X className="size-3.5" />
                    </IconButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-2 flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            disabled={contract.parts.length >= 20}
            onClick={() => save({ ...contract, parts: [...contract.parts, { id: `p${Date.now().toString(36)}`, name: "", weight: 0, score: null }] })}
          >
            {t("grade.add")}
          </Button>
          {Math.abs(result.totalWeight - 100) > 1e-9 && (
            <p className="text-small font-medium text-danger-fg" role="status">
              {t("grade.weightsOff", { total: f.number(result.totalWeight, 0) })}
            </p>
          )}
        </div>
        <fieldset className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-small text-muted">
          <legend className="sr-only">{t("grade.cutoffs")}</legend>
          <span aria-hidden>{t("grade.cutoffs")}</span>
          {CONTRACT_LETTERS.map((letter) => (
            <label key={letter} className="inline-flex items-center gap-1">
              <span className="font-semibold text-fg">{letter}</span>≥
              <input
                aria-label={t("grade.cutoffOf", { letter })}
                inputMode="numeric"
                value={contract.cutoffs[letter]}
                onChange={(event) => save({ ...contract, cutoffs: { ...contract.cutoffs, [letter]: clampScore(event.target.value) ?? 0 } })}
                className="focus-ring h-6 w-10 rounded-md bg-fill px-1 text-right tabular-nums"
              />
            </label>
          ))}
        </fieldset>
      </div>

      <div className="border-t border-line bg-fill/60 px-4 py-3.5" aria-live="polite">
        {result.final !== null ? (
          <p className="text-body">
            {t("grade.final")} <span className="font-semibold tabular-nums">{f.number(result.final, 1)}</span> ·{" "}
            <span className="text-lead font-semibold">{result.letter}</span>
          </p>
        ) : (
          <div>
            <p className="text-small text-muted">{t("grade.needs")}</p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-body">
              {result.needs.map((need) => (
                <span key={need.letter} className={cx(need.need === null && !need.reached && "text-faint")}>
                  <span className="font-semibold">{need.letter}</span>{" "}
                  <span className="tabular-nums">{need.reached ? t("grade.secured") : need.need === null ? t("grade.outOfReach") : `≥ ${need.need}`}</span>
                </span>
              ))}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
