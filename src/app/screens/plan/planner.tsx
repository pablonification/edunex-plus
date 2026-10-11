// Rencana studi tab — The study planner (#79): semesters from now to
// graduation, courses from SIX's public catalog (required, electives,
// specialization and minor packages, all of ITB) and retakes, every rule
// checked live (Peraturan Akademik ITB and the program's curriculum), and
// expected grades projecting each semester's IP, the IPK at graduation,
// honors and what a target needs. The plan stays on this computer; the app
// never sends a KRS.
import * as Tabs from "@radix-ui/react-tabs";
import { useState, type ReactNode } from "react";
import { letterForAverage, nearestLetter } from "../../../core/honors";
import type { LetterGrade } from "../../../core/models";
import {
  addCourse,
  addShortTerm,
  addTerm,
  canRemoveTerm,
  checkPlan,
  courseInfo,
  courseRole,
  courseState,
  expectedGrade,
  plannedCodes,
  programElectives,
  rankedMinors,
  removeCourse,
  removeTerm,
  retakeCandidates,
  type Rule,
  type RuleLevel,
  searchCourses,
  setGrade,
  shortTermToAdd,
  type StudentRecord,
  semesterOf,
  termKind,
  type CourseInfo,
  type MinorOption,
  type ProjectedStep,
} from "../../../core/planner";
import { useFormat, useT } from "../../i18n";
import { type PlanState, usePlan, useStudentRecord } from "../../study-plan";
import { Button, IconButton } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Card, EmptyState, SourceTag } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Dialog } from "../../ui/overlays";
import { GradeSelect, HonorsList, ProjectedTable, useTermLabel } from "./projection";

export const ready = true;

/** A count for the Rencana studi sidebar entry, if any. */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  return null;
}

const ROLE_TONE = {
  required: "bg-info-bg text-info-fg",
  specialization: "bg-(--status-review-bg) text-(--status-review-fg)",
  minor: "bg-warning-bg text-warning-fg",
  "program-elective": "bg-(--source-six-bg) text-(--source-six-fg)",
  "outside-elective": "bg-neutral-bg text-neutral-fg",
  retake: "bg-warning-bg text-warning-fg",
} as const;

export function Tab() {
  const t = useT();
  const record = useStudentRecord();
  const state = usePlan(record);
  if (!record || !state) return <EmptyState icon={<Icons.BookOpen className="size-5" />} title={t("planner.empty")} />;
  return <Planner record={record} state={state} />;
}

function Planner({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const termLabel = useTermLabel();
  const { plan, projection, update } = state;
  const [adding, setAdding] = useState<string | null>(null);
  const rules = checkPlan(record, plan, projection);
  const minor = record.minors.find((m) => m.key === plan.minor) ?? null;
  const stepOf = new Map(projection.steps.map((s) => [s.term, s]));
  const short = shortTermToAdd(plan, record);

  return (
    <div className="space-y-6">
      <Summary record={record} state={state} rules={rules} />
      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6">
        <div className="space-y-3">
          <Past record={record} steps={projection.steps.filter((s) => !s.projected && s.term !== record.term)} />
          {record.term && record.thisTerm.length > 0 && (
            <TermBlock
              title={record.semesterNow ? t("planner.now", { n: record.semesterNow }) : t("planner.nowPlain")}
              subtitle={t("planner.nowSub")}
              source
              sks={record.thisTerm.reduce((sum, c) => sum + c.sks, 0)}
              limit={null}
              step={stepOf.get(record.term)}
            >
              {record.thisTerm.map((course) => (
                <CourseLine
                  key={course.code}
                  code={course.code}
                  name={course.name}
                  sks={course.sks}
                  tag={<RoleTag record={record} code={course.code} minor={minor} />}
                  grade={course.grade ?? expectedGrade(record, plan, course.code)}
                  posted={course.grade !== null}
                  onGrade={(grade) => update((p) => ({ ...p, expected: { ...p.expected, [course.code]: grade } }))}
                />
              ))}
            </TermBlock>
          )}
          {plan.terms.map((term) => {
            const semester = semesterOf(term.term, record.entryTerm);
            const label = termLabel(term.term, semester);
            return (
              <TermBlock
                key={term.term}
                title={label}
                subtitle={t("planner.plannedSub")}
                sks={term.courses.reduce((sum, c) => sum + c.sks, 0)}
                limit={termKind(term.term) === "short" ? 9 : 24}
                step={stepOf.get(term.term)}
                onRemove={canRemoveTerm(plan, term.term) ? () => update((p) => removeTerm(p, term.term)) : undefined}
                removeLabel={t("planner.removeTerm", { term: label })}
                onAdd={() => setAdding(term.term)}
              >
                {term.courses.map((course) => (
                  <CourseLine
                    key={course.code}
                    code={course.code}
                    name={course.name}
                    sks={course.sks}
                    tag={
                      course.retake ? (
                        <Tag tone={ROLE_TONE.retake}>{t("planner.role.retake", { grade: record.graded.get(course.code)?.grade ?? "—" })}</Tag>
                      ) : (
                        <RoleTag record={record} code={course.code} minor={minor} />
                      )
                    }
                    grade={course.grade}
                    onGrade={(grade) => update((p) => setGrade(p, term.term, course.code, grade))}
                    onRemove={() => update((p) => removeCourse(p, term.term, course.code))}
                  />
                ))}
                {term.courses.length === 0 && <li className="px-4 py-3 text-small text-faint">{t("planner.nothing")}</li>}
              </TermBlock>
            );
          })}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {short && (
              <Button size="sm" icon={<Icons.Calendar className="size-3.5" />} onClick={() => update((p) => addShortTerm(p, record))}>
                {t("planner.addShort")}
              </Button>
            )}
            <Button size="sm" icon={<Icons.Calendar className="size-3.5" />} onClick={() => update((p) => addTerm(p, record))}>
              {t("planner.addTerm")}
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={state.reset}>
              {t("planner.reset")}
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-caption text-faint">
            <Icons.Lock className="size-3" />
            {t("planner.local")}
          </p>
        </div>
        <aside className="space-y-4">
          <Rules record={record} rules={rules} />
          <Target state={state} />
          <Minors record={record} state={state} />
        </aside>
      </div>
      {adding && (
        <AddCourse
          record={record}
          state={state}
          term={adding}
          title={t("planner.addTo", { term: termLabel(adding, semesterOf(adding, record.entryTerm)) })}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------ summary

function Summary({ record, state, rules }: { record: StudentRecord; state: PlanState; rules: Rule[] }) {
  const t = useT();
  const f = useFormat();
  const { plan, projection } = state;
  const planned = plan.terms.flatMap((term) => term.courses.filter((c) => !c.retake)).reduce((sum, c) => sum + c.sks, 0);
  const total = record.passedSks + record.inProgressSks + planned;
  const need = record.graduationSks;
  const errors = rules.filter((r) => r.level === "error").length;
  const warnings = rules.filter((r) => r.level === "warn").length;
  const share = (sks: number) => `${Math.max(0, Math.min(1, sks / need)) * 100}%`;
  return (
    <Card className="px-6 py-5">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          {record.program && <p className="text-small font-medium text-muted">{t("planner.program", { name: record.program.name })}</p>}
          <p className="mt-1 text-[28px] leading-9 font-semibold tracking-[-0.02em] tabular-nums">
            {total} <span className="text-[18px] font-medium text-muted">{t("planner.sksOf", { need })}</span>
          </p>
          <p className="text-body text-muted">{t("planner.split", { passed: record.passedSks, now: record.inProgressSks, planned })}</p>
        </div>
        <div className="flex gap-8 text-right">
          <div>
            <p className="text-caption font-medium text-muted">{t("planner.graduate")}</p>
            <p className="text-[16px] font-semibold">{projection.finishSemester === null ? "—" : t("planner.semester", { n: projection.finishSemester })}</p>
            <p className={cx("text-caption font-semibold", errors ? "text-danger-fg" : warnings ? "text-warning-fg" : "text-success-fg")} role="status">
              {errors ? t("planner.rulesNotMet", { count: errors }) : warnings ? t("planner.toCheck", { count: warnings }) : t("planner.allMet")}
            </p>
          </div>
          <div>
            <p className="text-caption font-medium text-muted">{t("grades.graduation")}</p>
            <p className="text-[16px] font-semibold tabular-nums">{projection.finalIpk === null ? "—" : f.number(projection.finalIpk, 2)}</p>
            <p className={cx("text-caption", projection.honor ? "font-semibold text-success-fg" : "text-faint")}>
              {projection.honor ? t(`honors.${projection.honor}`) : t("honors.none")}
            </p>
          </div>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={t("planner.progress")}
        aria-valuemin={0}
        aria-valuemax={need}
        aria-valuenow={Math.min(total, need)}
        className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]"
      >
        <span className="h-full bg-live" style={{ width: share(record.passedSks) }} />
        <span className="h-full bg-success-bg" style={{ width: share(record.inProgressSks) }} />
        <span className="h-full bg-info-fg/50" style={{ width: share(planned) }} />
      </div>
    </Card>
  );
}

// ------------------------------------------------------------ semesters

function Past({ record, steps }: { record: StudentRecord; steps: ProjectedStep[] }) {
  const t = useT();
  const f = useFormat();
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  const ipk = record.transcript ? (record.transcript.ipk.six ?? record.transcript.ipk.computed) : null;
  const last = steps.at(-1)?.semester ?? steps.length;
  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hover">
        <Icons.ChevronRight className={cx("size-4 text-faint transition-transform duration-150", open && "rotate-90")} />
        <span className="flex-1 text-body font-semibold">
          {t("planner.past", { n: last })}
          <span className="ml-2 font-medium text-muted">· {t("planner.pastMeta", { sks: record.passedSks, ipk: ipk === null ? "—" : f.number(ipk, 2) })}</span>
        </span>
        <SourceTag source="six" />
      </button>
      {open && (
        <ul className="grid grid-cols-3 gap-2 border-t border-line px-4 py-3">
          {steps.map((s) => (
            <li key={s.term} className="rounded-lg bg-fill px-3 py-2 text-small">
              <span className="font-semibold">{f.term(s.term)}</span>
              <span className="block text-muted tabular-nums">
                IP {s.ip === null ? "—" : f.number(s.ip, 2)} · {s.sks} SKS
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TermBlock({
  title,
  subtitle,
  source,
  sks,
  limit,
  step,
  onAdd,
  onRemove,
  removeLabel,
  children,
}: {
  title: string;
  subtitle: string;
  source?: boolean;
  sks: number;
  limit: number | null;
  step: ProjectedStep | undefined;
  onAdd?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  children: ReactNode;
}) {
  const t = useT();
  const f = useFormat();
  const over = limit !== null && sks > limit;
  return (
    <section aria-label={title}>
      <Card className="overflow-hidden">
        <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <h3 className="text-body font-semibold">{title}</h3>
            <span className="block text-caption text-faint">{subtitle}</span>
          </span>
          {source && <SourceTag source="six" />}
          <span className={cx("text-small font-semibold tabular-nums", over ? "text-danger-fg" : "text-muted")}>
            {sks}
            {limit !== null && ` / ${limit}`} SKS
          </span>
          {step && (
            <span className="border-l border-line pl-3 text-right leading-tight">
              <span className="block text-small font-semibold tabular-nums">IP {step.ip === null ? "—" : f.number(step.ip, 2)}</span>
              <span className="block text-caption text-faint tabular-nums">{t("planner.ipkAfter", { ipk: step.ipk === null ? "—" : f.number(step.ipk, 2) })}</span>
            </span>
          )}
          {onRemove && (
            <IconButton label={removeLabel ?? ""} size="sm" onClick={onRemove}>
              <Icons.X className="size-3.5" />
            </IconButton>
          )}
        </header>
        <ul>{children}</ul>
        {onAdd && (
          <button type="button" onClick={onAdd} className="focus-ring flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-small font-semibold text-accent-fg hover:bg-hover">
            <Icons.Search className="size-3.5" />
            {t("planner.addCourse")}
          </button>
        )}
      </Card>
    </section>
  );
}

function Tag({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={cx("inline-flex h-[20px] items-center rounded px-1.5 text-micro font-semibold whitespace-nowrap", tone)}>{children}</span>;
}

function RoleTag({ record, code, minor }: { record: StudentRecord; code: string; minor: MinorOption | null }) {
  const t = useT();
  const role = courseRole(record, code, minor);
  const semester = record.required.get(code)?.semester ?? record.requiredLeft.find((c) => c.code === code)?.semester;
  return <Tag tone={ROLE_TONE[role]}>{role === "required" ? t("planner.role.required", { n: semester ?? "—" }) : t(`planner.role.${role}`)}</Tag>;
}

function CourseLine({
  code,
  name,
  sks,
  tag,
  grade,
  posted,
  onGrade,
  onRemove,
}: {
  code: string;
  name: string;
  sks: number;
  tag: ReactNode;
  grade: LetterGrade;
  posted?: boolean;
  onGrade: (grade: LetterGrade) => void;
  onRemove?: () => void;
}) {
  const t = useT();
  return (
    <li className="grid grid-cols-[70px_minmax(0,1fr)_auto_36px_62px_28px] items-center gap-3 border-b border-line px-4 py-2 text-body last:border-b-0">
      <span className="font-semibold tabular-nums">{code}</span>
      <span className="truncate">{name}</span>
      {tag}
      <span className="text-right text-muted tabular-nums">{sks}</span>
      {posted ? (
        <span className="inline-flex h-7 items-center justify-center rounded-md bg-success-bg text-small font-bold text-success-fg" title={t("grades.sixGrade")}>
          {grade}
        </span>
      ) : (
        <GradeSelect label={t("grades.expectedOf", { code })} value={grade} onChange={onGrade} />
      )}
      {onRemove ? (
        <IconButton label={t("planner.removeCourse", { code })} size="sm" onClick={onRemove}>
          <Icons.X className="size-3.5" />
        </IconButton>
      ) : (
        <span />
      )}
    </li>
  );
}

// ------------------------------------------------------------ rules and the target

const LEVEL_MARK: Record<RuleLevel, { tone: string; label: "planner.ruleOk" | "planner.ruleWarn" | "planner.ruleError" }> = {
  ok: { tone: "bg-success-bg text-success-fg", label: "planner.ruleOk" },
  warn: { tone: "bg-warning-bg text-warning-fg", label: "planner.ruleWarn" },
  error: { tone: "bg-danger-bg text-danger-fg", label: "planner.ruleError" },
};

function useRuleText(record: StudentRecord): (rule: Rule) => { title: string; detail: string; source: "six" | "itb" } {
  const t = useT();
  const termLabel = useTermLabel();
  const list = (items: { code: string; name: string }[]) => items.map((c) => `${c.code} ${c.name}`).join(", ");
  return (rule) => {
    switch (rule.id) {
      case "total":
        return { title: t("rule.total", { have: rule.have, need: rule.need }), detail: rule.level === "ok" ? t("rule.total.ok") : t("rule.total.short", { short: rule.need - rule.have }), source: "six" };
      case "required":
        return {
          title: t("rule.required"),
          detail: rule.missing.length ? t("rule.missing", { list: list(rule.missing) }) : rule.total ? t("rule.required.okCount", { count: rule.total }) : t("rule.required.ok"),
          source: "six",
        };
      case "electives":
        return { title: t("rule.electives"), detail: t("rule.electives.detail", { have: rule.have, need: rule.need }), source: "six" };
      case "specialization":
        return { title: rule.name, detail: rule.missing.length ? t("rule.missing", { list: list(rule.missing) }) : t("rule.specialization.ok", { count: rule.total }), source: "six" };
      case "minor":
        return { title: t("rule.minor", { name: rule.name }), detail: t("rule.minor.detail", { have: rule.have, need: rule.need }), source: "six" };
      case "load":
        return {
          title: termLabel(rule.term, semesterOf(rule.term, record.entryTerm)),
          detail: rule.level === "error" ? t("rule.load.over", { sks: rule.sks, limit: rule.limit }) : t("rule.load.advisor", { sks: rule.sks, limit: rule.limit }),
          source: "itb",
        };
      case "parity": {
        const odd = rule.semester % 2 === 1;
        return {
          title: `${rule.code} ${rule.name}`,
          detail: t("rule.parity", { semester: rule.semester, parity: t(odd ? "rule.parity.odd" : "rule.parity.even"), kind: t(odd ? "rule.parity.even" : "rule.parity.odd") }),
          source: "six",
        };
      }
      case "early":
        return { title: `${rule.code} ${rule.name}`, detail: t("rule.early", { semester: rule.semester }), source: "six" };
      case "finish":
        return {
          title: t("rule.finish", { n: rule.semester }),
          detail: rule.level === "ok" ? t("rule.finish.ok", { normal: rule.normal }) : rule.semester <= 9 ? t("rule.finish.late", { normal: rule.normal }) : t("rule.finish.tooLate"),
          source: "itb",
        };
    }
  };
}

function Rules({ record, rules }: { record: StudentRecord; rules: Rule[] }) {
  const t = useT();
  const text = useRuleText(record);
  return (
    <Card className="overflow-hidden">
      <h3 className="px-4 pt-3.5 text-body font-semibold">{t("planner.rules")}</h3>
      <ul className="space-y-2.5 px-4 pt-3 pb-4" aria-label={t("planner.rules")}>
        {rules.map((rule, i) => {
          const { title, detail, source } = text(rule);
          const mark = LEVEL_MARK[rule.level];
          return (
            <li key={`${rule.id}-${i}`} className="flex items-start gap-2.5" data-rule={rule.id} data-level={rule.level}>
              <span className={cx("mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full", mark.tone)} title={t(mark.label)}>
                {rule.level === "ok" ? <Icons.Check className="size-3" strokeWidth={3} /> : <span className="text-micro font-bold">!</span>}
                <span className="sr-only">{t(mark.label)}</span>
              </span>
              <span className="min-w-0 flex-1 text-small">
                <span className="flex items-center justify-between gap-2 font-semibold">
                  <span className="min-w-0 truncate">{title}</span>
                  <SourceTag source={source} />
                </span>
                <span className="text-muted">{detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const TARGETS = [3, 3.5, 3.75] as const;

function Target({ state }: { state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const { plan, projection, update } = state;
  const target = plan.target ?? 3.5;
  const need = projection.need(target);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
        <h3 className="text-body font-semibold">{t("planner.target")}</h3>
        <span className="flex items-center gap-1" role="radiogroup" aria-label={t("planner.target")}>
          {TARGETS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={target === value}
              aria-label={t("grades.targetOf", { value: f.number(value, 2) })}
              onClick={() => update((p) => ({ ...p, target: value }))}
              className={cx("focus-ring h-7 rounded-md px-2 text-small font-semibold tabular-nums", target === value ? "bg-accent text-on-accent" : "bg-fill text-muted hover:text-fg")}
            >
              {f.number(value, 2)}
            </button>
          ))}
        </span>
      </div>
      <p className="px-4 pt-2 text-small text-muted" role="status">
        {need.kind === "none"
          ? t("planner.targetNone")
          : need.kind === "out"
            ? t("planner.targetOut")
            : need.kind === "secured"
              ? t("planner.targetSecured")
              : t("planner.targetNeed", { avg: f.number(need.average, 2), letter: letterForAverage(need.average), sks: projection.variableSks })}
      </p>
      <IpkChart steps={projection.steps} target={target} />
      <div className="px-4 pb-3">
        <ProjectedTable steps={projection.steps} />
        <HonorsList projection={projection} className="mt-2" />
      </div>
      <p className="border-t border-line px-4 py-2.5 text-caption text-faint">{t("honors.rule")}</p>
    </Card>
  );
}

function IpkChart({ steps, target }: { steps: ProjectedStep[]; target: number }) {
  const t = useT();
  const f = useFormat();
  const points = steps.filter((s) => s.ipk !== null);
  if (points.length < 2) return null;
  const w = 300;
  const h = 120;
  const pad = { l: 8, r: 8, t: 14, b: 22 };
  const min = 2;
  const max = 4;
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(1, points.length - 1);
  const y = (v: number) => pad.t + ((max - Math.min(max, Math.max(min, v))) / (max - min)) * (h - pad.t - pad.b);
  const firstProjected = points.findIndex((s) => s.projected);
  const line = (from: number, to: number) =>
    points
      .slice(from, to + 1)
      .map((s, i) => `${i === 0 ? "M" : "L"}${x(from + i).toFixed(1)},${y(s.ipk!).toFixed(1)}`)
      .join(" ");
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 w-full px-2" role="img" aria-label={`${t("planner.chart")}: ${points.map((s) => f.number(s.ipk!, 2)).join(", ")}`}>
      <line x1={pad.l} x2={w - pad.r} y1={y(target)} y2={y(target)} className="stroke-warning-fg" strokeDasharray="4 3" strokeWidth={1} />
      <text x={pad.l} y={y(target) - 4} fontSize="9" fontWeight={600} className="fill-warning-fg">
        {f.number(target, 2)}
      </text>
      {firstProjected !== 0 && <path d={line(0, firstProjected < 0 ? points.length - 1 : firstProjected - 1)} fill="none" className="stroke-accent" strokeWidth={2} />}
      {firstProjected >= 0 && <path d={line(Math.max(0, firstProjected - 1), points.length - 1)} fill="none" className="stroke-accent" strokeWidth={2} strokeDasharray="4 3" />}
      {points.map((s, i) => (
        <g key={s.term}>
          <circle cx={x(i)} cy={y(s.ipk!)} r={2.6} className={cx("stroke-accent", s.projected ? "fill-surface" : "fill-accent")} strokeWidth={1.5} />
          <text x={x(i)} y={h - 8} textAnchor="middle" fontSize="8.5" className="fill-faint">
            {s.semester ?? "·"}
          </text>
        </g>
      ))}
      <text x={x(points.length - 1)} y={y(last.ipk!) + 14} textAnchor="end" fontSize="9.5" fontWeight={700} className="fill-accent-fg">
        {f.number(last.ipk!, 2)}
      </text>
    </svg>
  );
}

// ------------------------------------------------------------ minors

function Minors({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const { plan, update } = state;
  const ranked = rankedMinors(record, plan);
  const shown = [...ranked.filter((m) => m.key === plan.minor), ...ranked.filter((m) => m.key !== plan.minor && m.have > 0).slice(0, 4)];
  return (
    <Card className="overflow-hidden">
      <h3 className="px-4 pt-3.5 text-body font-semibold">{t("planner.minors")}</h3>
      <ul className="px-2 pt-2 pb-2">
        {shown.map((m) => {
          const on = plan.minor === m.key;
          return (
            <li key={m.key}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={t("planner.minorTrack", { name: m.name })}
                onClick={() => update((p) => ({ ...p, minor: on ? null : m.key }))}
                className={cx("focus-ring flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left", on ? "bg-selected" : "hover:bg-hover")}
              >
                {on ? <Icons.CheckCircle className="size-4 shrink-0 text-accent-fg" /> : <Icons.Circle className="size-4 shrink-0 text-faint" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-semibold">{m.name}</span>
                  <span className="block truncate text-caption text-muted">{m.program}</span>
                </span>
                <span className="text-small font-semibold tabular-nums">
                  {m.have}/{m.need}
                </span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-2 py-1 text-small text-faint">{t("planner.minorNone")}</li>}
      </ul>
    </Card>
  );
}

// ------------------------------------------------------------ adding a course

type AddTab = "needed" | "program" | "minors" | "all";

function AddCourse({ record, state, term, title, onClose }: { record: StudentRecord; state: PlanState; term: string; title: string; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const { plan, update } = state;
  const [tab, setTab] = useState<AddTab>("needed");
  const [query, setQuery] = useState("");
  const minor = record.minors.find((m) => m.key === plan.minor) ?? null;
  const grade = nearestLetter(record.transcript?.ipk.computed ?? null);
  const add = (code: string, retake: boolean) => {
    const info = courseInfo(record, code);
    update((p) => addCourse(p, term, { code, name: info.name, sks: info.sks, grade, retake }));
    onClose();
  };
  const planned = plannedCodes(plan);
  const open = (code: string) => !planned.has(code) && courseState(record, plan, code) === null;
  const needed: { code: string; why: string }[] = [
    ...record.requiredLeft.map((c) => ({ code: c.code, why: t("planner.why.required") })),
    ...(record.specialization?.courses ?? []).filter((c) => open(c.code) || planned.has(c.code)).map((c) => ({ code: c.code, why: t("planner.why.specialization", { name: record.specialization!.name }) })),
    ...(minor?.courses ?? []).filter((code) => open(code) || planned.has(code)).map((code) => ({ code, why: t("planner.why.minor", { name: minor!.name }) })),
  ].filter((x, i, all) => all.findIndex((y) => y.code === x.code) === i);
  const retakes = retakeCandidates(record);
  const q = query.trim().toLowerCase();
  const matches = (c: CourseInfo) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  const found = searchCourses(record, query);

  const row = (code: string, why?: string, retake?: { from: string; now: number | null; after: number | null }) => {
    const info = courseInfo(record, code);
    const st = retake ? (planned.has(code) ? "planned" : null) : courseState(record, plan, code);
    const owner = info.owner ? (record.programNames.get(info.owner) ?? null) : null;
    return (
      <li key={code} className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-b-0">
        <span className="w-[64px] shrink-0 text-small font-semibold tabular-nums">{code}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium">{info.name}</span>
          <span className="block truncate text-caption text-muted">
            {[`${info.sks} SKS`, owner, why, retake && retake.now !== null && retake.after !== null ? t("planner.retakeGain", { now: f.number(retake.now, 2), after: f.number(retake.after, 2) }) : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {st ? (
          <span className="text-caption font-semibold whitespace-nowrap text-faint">
            {st === "passed" ? t("planner.state.passed", { grade: record.graded.get(code)?.grade ?? "" }) : t(`planner.state.${st}`)}
          </span>
        ) : (
          <Button size="sm" aria-label={t(retake ? "planner.retakeCode" : "planner.addCode", { code })} onClick={() => add(code, Boolean(retake))}>
            {retake ? t("planner.retake") : t("planner.add")}
          </Button>
        )}
      </li>
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title} className="w-[min(680px,calc(100vw-48px))]">
      <div className="-mx-5 -my-5">
        <div className="border-b border-line px-5 pt-3">
          <label className="flex h-9 items-center gap-2 rounded-lg bg-fill px-3">
            <Icons.Search className="size-4 text-faint" />
            <input
              autoFocus
              value={query}
              aria-label={t("planner.search")}
              placeholder={t("planner.search")}
              onChange={(event) => {
                setQuery(event.target.value);
                if (event.target.value.trim().length >= 2 && tab === "needed") setTab("all");
              }}
              className="h-full flex-1 bg-transparent text-body outline-none placeholder:text-faint"
            />
          </label>
          <Tabs.Root value={tab} onValueChange={(v) => setTab(v as AddTab)}>
            <Tabs.List aria-label={title} className="mt-2 flex gap-5">
              {(["needed", "program", "minors", "all"] as const).map((id) => (
                <Tabs.Trigger
                  key={id}
                  value={id}
                  className="focus-ring -mb-px h-9 border-b-2 border-transparent text-small font-medium text-muted data-[state=active]:border-fg data-[state=active]:text-fg"
                >
                  {t(`planner.tab.${id}`)}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>
        </div>
        <div className="min-h-[300px]">
          {tab === "needed" && (
            <>
              <ul>{needed.map((x) => row(x.code, x.why))}</ul>
              {retakes.length > 0 && (
                <>
                  <p className="px-5 pt-4 pb-1 text-caption font-semibold tracking-[0.04em] text-faint uppercase">{t("planner.retakes")}</p>
                  <p className="px-5 pb-1 text-caption text-faint">{t("planner.retakeSumma")}</p>
                  <ul>{retakes.map((r) => row(r.code, t("planner.why.grade", { grade: r.grade }), { from: r.grade, now: r.ipkNow, after: r.ipkWithA }))}</ul>
                </>
              )}
            </>
          )}
          {tab === "program" && <ul>{programElectives(record).filter(matches).map((c) => row(c.code))}</ul>}
          {tab === "minors" && (
            <ul>
              {rankedMinors(record, plan)
                .filter((m) => !q || m.name.toLowerCase().includes(q) || m.program.toLowerCase().includes(q))
                .slice(0, 40)
                .map((m) => (
                  <li key={m.key} className="border-b border-line px-5 py-2.5 last:border-b-0">
                    <p className="flex items-center justify-between gap-3 text-body font-semibold">
                      {m.name}
                      <span className="text-caption font-medium text-muted">
                        {m.program} · {m.need} SKS
                      </span>
                    </p>
                    {m.note && <p className="mt-0.5 line-clamp-2 text-caption text-muted">{m.note}</p>}
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.courses.map((code) => {
                        const st = courseState(record, plan, code);
                        return (
                          <li key={code}>
                            <button
                              type="button"
                              disabled={st !== null}
                              title={courseInfo(record, code).name}
                              aria-label={st ? undefined : t("planner.addCode", { code })}
                              onClick={() => add(code, false)}
                              className={cx(
                                "focus-ring inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption font-semibold tabular-nums",
                                st ? "bg-success-bg text-success-fg" : "border border-edge bg-surface hover:bg-hover",
                              )}
                            >
                              {code}
                              {st ? <Icons.Check className="size-3" /> : <span aria-hidden>+</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
            </ul>
          )}
          {tab === "all" &&
            (q.length < 2 ? (
              <p className="px-5 py-6 text-center text-body text-muted">{t("planner.typeMore", { count: record.courses.size })}</p>
            ) : (
              <ul>
                {found.map((c) => row(c.code))}
                {found.length === 0 && <li className="px-5 py-6 text-center text-body text-muted">{t("planner.noMatch")}</li>}
              </ul>
            ))}
        </div>
        <p className="border-t border-line px-5 py-2 text-caption text-faint">{t("planner.catalogSource")}</p>
      </div>
    </Dialog>
  );
}
