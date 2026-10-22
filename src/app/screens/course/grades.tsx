// The Nilai tab: Edunex's grade only once the lecturer publishes it (before
// that Edunex says 0 · E, never shown), and the course-contract calculator.
// The answer comes first, as a sentence for the letter the Student aims for;
// it is only given when it can be trusted: the weights must add up to 100,
// example weights say so loudly, and a score outside 0–100 is explained, not
// quietly changed. What the Student enters stays on this computer
// ("local.courseWeights").
import { useEffect, useRef, useState } from "react";
import { percent } from "../../../core/attendance";
import { EXAMPLE_CONTRACT, EXAMPLE_PART_IDS, letterFor, partScore, standing } from "../../../core/course-contract";
import { CONTRACT_LETTERS, type ContractLetter, type ContractPart, type CourseContract } from "../../../core/models";
import { useFormat, useT } from "../../i18n";
import { useBridge, useDataset } from "../../store";
import { Button, IconButton, Segmented } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Card } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Notice } from "../../ui/layout";
import { dismissToast, toast } from "../../ui/overlays";
import type { CoursePage } from "./data";

export function GradesTab({ page, onOpenModules }: { page: CoursePage; onOpenModules?: () => void }) {
  const t = useT();
  const f = useFormat();
  const grade = page.outline?.grade ?? null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_260px] items-start gap-8 max-[1180px]:grid-cols-1">
      <Calculator page={page} onOpenModules={onOpenModules} />
      <Card className="px-4 py-3.5">
        <p className="text-small font-semibold text-muted">{t("grade.edunex")}</p>
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

/** "80" → 80; "" → null; anything else, or outside 0–100, is a problem to say, not to fix silently. */
function readScore(text: string, required = false): { value: number | null; problem: "range" | "number" | null } {
  const clean = text.trim().replace(",", ".");
  if (clean === "") return { value: null, problem: required ? "number" : null };
  const value = Number(clean);
  if (!Number.isFinite(value)) return { value: null, problem: "number" };
  if (value < 0 || value > 100) return { value: null, problem: "range" };
  return { value, problem: null };
}

/**
 * A number from 0 to 100 that looks editable and keeps what was typed: a
 * valid number is saved at once; an invalid one stays visible, marked, with
 * the reason under it, and nothing is saved.
 */
function ScoreInput({
  label,
  value,
  onValue,
  placeholder,
  className,
  highlight = false,
  width = "w-16",
  required = false,
  onProblem,
}: {
  label: string;
  value: number | null;
  onValue: (value: number | null) => void;
  placeholder?: string;
  className?: string;
  highlight?: boolean;
  width?: string;
  required?: boolean;
  /** Told whether the box holds something that can't be used, so the answer can wait for it. */
  onProblem?: (bad: boolean) => void;
}) {
  const t = useT();
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null ? "" : String(value).replace(".", ","));
  const { problem } = readScore(shown, required);
  const bad = problem !== null;
  const report = useRef(onProblem);
  report.current = onProblem;
  useEffect(() => report.current?.(bad), [bad]);
  useEffect(() => () => report.current?.(false), []);
  return (
    <span className={cx("inline-flex flex-col items-end", className)}>
      <input
        aria-label={label}
        aria-invalid={problem ? true : undefined}
        inputMode="decimal"
        placeholder={placeholder}
        value={shown}
        onChange={(event) => {
          setText(event.target.value);
          const read = readScore(event.target.value, required);
          if (!read.problem) onValue(read.value);
        }}
        onBlur={() => {
          if (!readScore(shown, required).problem) setText(null);
        }}
        className={cx(
          "focus-ring h-8 rounded-md border bg-surface px-2 text-right text-body tabular-nums shadow-[inset_0_1px_1px_rgb(0_0_0/0.04)] transition-colors duration-150",
          width,
          problem ? "border-danger-fg" : highlight ? "border-warning-fg ring-2 ring-warning-bg" : "border-field-edge",
        )}
      />
      {problem && (
        <span role="alert" className="mt-0.5 text-caption font-medium whitespace-nowrap text-danger-fg">
          {t(problem === "range" ? "grade.range" : "grade.notNumber")}
        </span>
      )}
    </span>
  );
}

function PartName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <input
        aria-label={t("grade.partName")}
        // biome-ignore lint/a11y/noAutofocus: the field appears only when the Student asks to rename, so it takes focus
        autoFocus
        defaultValue={name}
        maxLength={80}
        onBlur={(event) => {
          onRename(event.target.value.trim());
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setEditing(false);
        }}
        className="focus-ring h-8 w-full rounded-md border border-field-edge bg-surface px-2 font-medium"
      />
    );
  return (
    <span className="group flex items-center gap-1">
      <span className="truncate font-medium">{name}</span>
      <IconButton
        label={t("grade.rename", { part: name })}
        size="sm"
        className="text-faint group-hover:text-fg focus-visible:text-fg"
        onClick={() => setEditing(true)}
      >
        <Icons.PenLine className="size-3.5" />
      </IconButton>
    </span>
  );
}

function Calculator({ page, onOpenModules }: { page: CoursePage; onOpenModules?: () => void }) {
  const t = useT();
  const f = useFormat();
  const bridge = useBridge();
  const code = page.course.code;
  const saved = useDataset("local.courseWeights");
  const [draft, setDraft] = useState<CourseContract | null>(null);
  const [target, setTarget] = useState<ContractLetter | null>(null);
  // Boxes holding something unusable: no answer is given from numbers the Student can't see.
  const [problems, setProblems] = useState<ReadonlySet<string>>(new Set());
  const mark = (key: string) => (bad: boolean) =>
    setProblems((current) => {
      if (current.has(key) === bad) return current;
      const next = new Set(current);
      if (bad) next.add(key);
      else next.delete(key);
      return next;
    });
  const contract = draft ?? saved?.[code] ?? EXAMPLE_CONTRACT;
  const isExample = !draft && !saved?.[code];
  const attendance = page.course.attendance && page.course.attendance.held > 0 ? percent(page.course.attendance.attended, page.course.attendance.held) : null;
  const result = standing(contract, attendance);
  const fix = problems.size > 0;
  const sumOk = Math.abs(result.totalWeight - 100) < 1e-9;
  const weightsOk = !fix && sumOk;
  // The course contract, when the lecturer put it in a module ("Kontrak Belajar").
  const contractFile = (page.materials ?? []).some((m) => /kontrak/i.test(m.title)) || (page.outline?.modules ?? []).some((m) => /kontrak/i.test(m.title));

  const addPart = useRef<HTMLButtonElement>(null);
  // "Kembali ke contoh" can be taken back until the table changes again or the tab closes.
  const undo = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (undo.current !== null) dismissToast(undo.current);
    },
    [],
  );

  const save = (next: CourseContract | null) => {
    if (undo.current !== null) dismissToast(undo.current);
    undo.current = null;
    setDraft(next);
    const all = { ...(saved ?? {}) };
    if (next) all[code] = next;
    else delete all[code];
    void bridge.invoke("local.set", { name: "local.courseWeights", value: all }).catch(() => undefined);
  };
  const reset = () => {
    const before = contract;
    // The button goes with the Student's weights: focus stays at the table's foot, on the one beside it.
    addPart.current?.focus();
    save(null);
    undo.current = toast(t("grade.resetDone"), "neutral", { label: t("action.undo"), onClick: () => save(before) });
  };
  const setPart = (id: string, patch: Partial<ContractPart>) => save({ ...contract, parts: contract.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const nameOf = (part: ContractPart) =>
    part.name ||
    ((EXAMPLE_PART_IDS as readonly string[]).includes(part.id) ? t(`grade.part.${part.id as (typeof EXAMPLE_PART_IDS)[number]}`) : t("grade.part.new"));

  // The letter to answer for: the Student's pick, else the best one still open.
  const aim = target ?? result.needs.find((need) => !need.reached && need.need !== null)?.letter ?? "A";
  const need = result.needs.find((n) => n.letter === aim)!;
  const open = contract.parts.filter((part) => partScore(part, attendance) === null && part.weight > 0).map(nameOf);
  const listed = f.list(open);
  const best = result.secured + result.openWeight;

  let answer: string;
  if (fix) answer = t("grade.answer.fix");
  else if (!weightsOk) answer = t("grade.answer.weights", { total: f.number(result.totalWeight, 0) });
  else if (result.final !== null) answer = t("grade.answer.final", { score: f.number(result.final, 1), letter: result.letter ?? "E" });
  else if (need.reached) answer = t("grade.answer.secured", { letter: aim });
  else if (need.need === null) answer = t("grade.answer.out", { letter: aim, best: f.number(best, 1), bestLetter: letterFor(best, contract.cutoffs) });
  else answer = t("grade.answer.need", { letter: aim, need: need.need, parts: listed });

  return (
    // On the page, not in a box of its own: the warning, the answer, then the table it comes from.
    <div className="min-w-0">
      {isExample && (
        <Notice
          tone="warning"
          className="mb-5"
          title={t("grade.exampleNotice", { code })}
          action={
            contractFile && onOpenModules ? (
              <Button size="sm" onClick={onOpenModules}>
                {t("grade.openContract")}
              </Button>
            ) : undefined
          }
        >
          {t("grade.exampleHint")}
        </Notice>
      )}

      <div aria-live="polite">
        {weightsOk && result.final === null && (
          <div className="mb-3 flex items-center gap-3">
            <span className="text-small font-medium text-muted">{t("grade.target")}</span>
            <Segmented
              label={t("grade.target")}
              value={aim}
              onChange={setTarget}
              options={CONTRACT_LETTERS.slice(0, 5).map((letter) => ({ value: letter, label: letter }))}
            />
          </div>
        )}
        <p
          className={cx(
            "text-heading leading-snug font-semibold tracking-[-0.01em] text-balance",
            !weightsOk && "text-warning-fg",
            weightsOk && need.need === null && !need.reached && result.final === null && "text-danger-fg",
          )}
        >
          {answer}
        </p>
        {weightsOk && result.final === null && (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-small text-muted">
            <span>{t("grade.answer.others")}:</span>
            {result.needs
              .filter((n) => n.letter !== aim)
              .map((n) => (
                <span key={n.letter} className={cx(n.need === null && !n.reached && "text-faint")}>
                  <span className="font-semibold text-fg">{n.letter}</span>{" "}
                  <span className="tabular-nums">{n.reached ? t("grade.secured") : n.need === null ? t("grade.outOfReach") : `≥ ${n.need}`}</span>
                </span>
              ))}
          </p>
        )}
      </div>

      <div className="mt-5 border-t border-line pt-3">
        <table className="w-full text-body">
          <thead>
            <tr className="text-left text-caption text-faint">
              <th className="py-1.5 font-medium">{t("grade.part")}</th>
              <th className={cx("w-[96px] py-1.5 pr-4 text-right font-medium", !fix && !sumOk && "font-semibold text-warning-fg")}>{t("grade.weight")}</th>
              <th className="w-[96px] py-1.5 text-right font-medium">{t("grade.score")}</th>
              <th className="w-9" />
            </tr>
          </thead>
          <tbody>
            {contract.parts.map((part) => {
              const name = nameOf(part);
              const fromSix = part.attendance && attendance !== null;
              return (
                <tr key={part.id} className="border-t border-line align-top">
                  <td className="py-2 pr-2">
                    <PartName name={name} onRename={(next) => setPart(part.id, { name: next })} />
                  </td>
                  <td className="py-2 pr-4 text-right whitespace-nowrap">
                    <ScoreInput
                      label={t("grade.weightOf", { part: name })}
                      value={part.weight}
                      required
                      highlight={!fix && !sumOk}
                      width="w-14"
                      onProblem={mark(`w:${part.id}`)}
                      onValue={(value) => setPart(part.id, { weight: value ?? 0 })}
                    />
                    <span className="ml-1 inline-block pt-1.5 align-top text-faint">%</span>
                  </td>
                  <td className="py-2 text-right">
                    {fromSix ? (
                      <span className="inline-flex flex-col items-end pt-1">
                        <span className="font-semibold tabular-nums">{partScore(part, attendance)}</span>
                        <span className="text-caption text-faint">{t("grade.fromSixShort")}</span>
                      </span>
                    ) : (
                      <ScoreInput
                        label={t("grade.scoreOf", { part: name })}
                        value={part.score}
                        placeholder="—"
                        onProblem={mark(`s:${part.id}`)}
                        onValue={(value) => setPart(part.id, { score: value })}
                      />
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <IconButton
                      label={t("grade.remove", { part: name })}
                      size="sm"
                      onClick={() => save({ ...contract, parts: contract.parts.filter((p) => p.id !== part.id) })}
                    >
                      <Icons.X className="size-3.5" />
                    </IconButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line">
              <td className="py-2">
                {/* What changes the table, at its foot: a part more, or the example weights back. */}
                <span className="-ml-2 flex flex-wrap items-center gap-1">
                  <Button
                    ref={addPart}
                    variant="ghost"
                    size="sm"
                    icon={<Icons.Plus className="size-3.5" />}
                    disabled={contract.parts.length >= 20}
                    onClick={() => save({ ...contract, parts: [...contract.parts, { id: `p${Date.now().toString(36)}`, name: "", weight: 0, score: null }] })}
                  >
                    {t("grade.add")}
                  </Button>
                  {!isExample && (
                    <Button variant="ghost" size="sm" onClick={reset}>
                      {t("grade.reset")}
                    </Button>
                  )}
                </span>
              </td>
              <td className={cx("py-2 pr-4 text-right font-semibold tabular-nums", fix || sumOk ? "text-muted" : "text-warning-fg")}>
                {f.number(result.totalWeight, 0)}%
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
        <fieldset className="mt-3 border-t border-line pt-3 text-small text-muted">
          <legend className="sr-only">{t("grade.cutoffs")}</legend>
          {/* The label on its own line, so the six letters stay on one row. */}
          <p aria-hidden className="mb-1.5">
            {t("grade.cutoffs")}
          </p>
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            {CONTRACT_LETTERS.map((letter) => (
              <label key={letter} className="inline-flex items-start gap-1.5">
                <span className="pt-1.5 font-semibold text-fg">{letter} ≥</span>
                <ScoreInput
                  label={t("grade.cutoffOf", { letter })}
                  value={contract.cutoffs[letter]}
                  required
                  width="w-12"
                  onProblem={mark(`c:${letter}`)}
                  onValue={(value) => save({ ...contract, cutoffs: { ...contract.cutoffs, [letter]: value ?? 0 } })}
                />
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
