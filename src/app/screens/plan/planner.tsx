// Rencana studi tab — The study planner (#79): semesters from now to
// graduation, courses from SIX's public catalog (required, electives,
// specialization and minor packages, all of ITB) and retakes, every rule
// checked live (Peraturan Akademik ITB and the program's curriculum), and
// expected grades projecting each semester's IP, the IPK at graduation,
// honors and what the one shared target needs. Graduating is one verdict
// (the header and the rules never disagree), the SKS one count shared with
// Kurikulum and Nilai, and every removal can be taken back. The plan stays
// on this computer; the app never sends a KRS.
import * as Tabs from "@radix-ui/react-tabs";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { nearestLetter } from "../../../core/honors";
import type { LetterGrade, StudyPlan } from "../../../core/models";
import {
  addCourse,
  addShortTerm,
  addTerm,
  type CourseInfo,
  canRemoveTerm,
  checkPlan,
  courseInfo,
  courseRole,
  courseState,
  defaultPlan,
  expectedGrade,
  livePlan,
  type MinorOption,
  type ProjectedStep,
  plannedCodes,
  programElectives,
  type Rule,
  type RuleLevel,
  rankedMinors,
  removeCourse,
  removeTerm,
  retakeCandidates,
  type Shortfall,
  type SksModel,
  type StudentRecord,
  searchCourses,
  semesterOf,
  setGrade,
  shortTermToAdd,
  sksModel,
  targetOf,
  termKind,
} from "../../../core/planner";
import { useFormat, useLang, useT } from "../../i18n";
import { type PlanState, usePlan, useStudentRecord } from "../../study-plan";
import { Button, IconButton } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Card } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta } from "../../ui/layout";
import { Flash } from "../../ui/motion";
import { ConfirmDialog, Dialog, dismissToast, Tooltip, toast } from "../../ui/overlays";
import { GradeSelect, HonorsList, IpkChart, NeedText, predicateFor, TargetControl, usePredicate, useTermLabel } from "./projection";
import { SixNeeded } from "./six-needed";

export const ready = true;

/** A count for the Rencana studi sidebar entry, if any. */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  return null;
}

export function Tab({ onCalendar }: { onCalendar?: () => void }) {
  const t = useT();
  const record = useStudentRecord();
  const state = usePlan(record);
  if (!record || !state)
    return (
      <SixNeeded
        icon={<Icons.BookOpen className="size-5" />}
        title={t("planner.needSix")}
        body={t("planner.needSixBody")}
        action={
          onCalendar && (
            <Button variant="ghost" onClick={onCalendar}>
              {t("plan.toCalendar")}
            </Button>
          )
        }
      />
    );
  return <Planner record={record} state={state} />;
}

/** A plan change that can be taken back: an 8-second toast with "Urungkan", and ⌘Z. */
function useUndoable(state: PlanState) {
  const t = useT();
  const last = useRef<StudyPlan | null>(null);
  const shown = useRef<number | null>(null);
  const restore = (before: StudyPlan) => {
    state.update(() => before);
    last.current = null;
    if (shown.current !== null) dismissToast(shown.current);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!last.current) return;
      event.preventDefault();
      restore(last.current);
      toast(t("planner.undone"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (edit: (plan: StudyPlan) => StudyPlan, message: string) => {
    const before = state.plan;
    state.update(edit);
    last.current = before;
    // Only the latest change can be taken back (an older undo would throw away what came after it), so its toast replaces the last one.
    if (shown.current !== null) dismissToast(shown.current);
    shown.current = toast(message, "neutral", { label: t("planner.undo"), onClick: () => last.current === before && restore(before) });
  };
}

/** What a reset would throw away, compared with the starting plan. */
function resetLoss(record: StudentRecord, plan: StudyPlan): { grades: number; added: number; removed: number; terms: number; other: boolean } {
  const start = livePlan(defaultPlan(record), record);
  const startCourses = new Map(start.terms.flatMap((term) => term.courses.map((c) => [c.code, c] as const)));
  const now = plan.terms.flatMap((term) => term.courses);
  const startTerms = new Set(start.terms.map((term) => term.term));
  return {
    grades: Object.keys(plan.expected).length + now.filter((c) => startCourses.has(c.code) && startCourses.get(c.code)!.grade !== c.grade).length,
    added: now.filter((c) => !startCourses.has(c.code)).length,
    removed: [...startCourses.keys()].filter((code) => !now.some((c) => c.code === code)).length,
    terms: plan.terms.filter((term) => !startTerms.has(term.term)).length,
    other: plan.target !== null || plan.minor !== start.minor,
  };
}

function Planner({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const lang = useLang();
  const termLabel = useTermLabel();
  const { plan, projection, update } = state;
  const [adding, setAdding] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const undoable = useUndoable(state);
  const rules = checkPlan(record, plan, projection);
  const minor = record.minors.find((m) => m.key === plan.minor) ?? null;
  const stepOf = new Map(projection.steps.map((s) => [s.term, s]));
  const short = shortTermToAdd(plan, record);
  const loss = resetLoss(record, plan);
  const lossParts = [
    loss.grades && t("planner.reset.grades", { n: loss.grades, count: loss.grades }),
    loss.added && t("planner.reset.added", { n: loss.added, count: loss.added }),
    loss.terms && t("planner.reset.terms", { n: loss.terms, count: loss.terms }),
    loss.removed && t("planner.reset.removed", { n: loss.removed, count: loss.removed }),
    loss.other && t("planner.reset.other"),
  ].filter((part): part is string => Boolean(part));
  const list = new Intl.ListFormat(lang, { type: "conjunction" });
  // A course's own warning (odd/even, earlier than the curriculum), shown on its row.
  const flags = new Map<string, Extract<Rule, { id: "parity" | "early" }>>();
  for (const rule of rules) if (rule.id === "parity" || rule.id === "early") flags.set(`${rule.term}|${rule.code}`, rule);

  return (
    <div className="@container space-y-6">
      <Summary record={record} state={state} rules={rules} />
      <div className="grid grid-cols-1 items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <Past record={record} steps={projection.steps.filter((s) => !s.projected && s.term !== record.term)} />
          {record.term && record.thisTerm.length > 0 && (
            <TermBlock
              title={record.semesterNow ? t("planner.now", { n: record.semesterNow }) : t("planner.nowPlain")}
              subtitle={t("planner.nowSub")}
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
                  guess={plan.expected[course.code] === undefined}
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
                onRemove={
                  canRemoveTerm(plan, term.term)
                    ? () => undoable((p) => removeTerm(p, term.term), t("planner.removedTerm", { term: label, count: term.courses.length }))
                    : undefined
                }
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
                        <Tag>{t("planner.role.retake", { grade: record.graded.get(course.code)?.grade ?? "—" })}</Tag>
                      ) : (
                        <RoleTag record={record} code={course.code} minor={minor} />
                      )
                    }
                    flag={flags.get(`${term.term}|${course.code}`)}
                    grade={course.grade}
                    onGrade={(grade) => update((p) => setGrade(p, term.term, course.code, grade))}
                    onRemove={() => undoable((p) => removeCourse(p, term.term, course.code), t("planner.removedCourse", { code: course.code }))}
                  />
                ))}
                {term.courses.length === 0 && <li className="px-4 py-3 text-small text-faint">{t("planner.nothing")}</li>}
              </TermBlock>
            );
          })}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button icon={<Icons.Plus className="size-3.5" />} onClick={() => update((p) => addTerm(p, record))}>
              {t("planner.addTerm")}
            </Button>
            {short && (
              <Button icon={<Icons.Plus className="size-3.5" />} onClick={() => update((p) => addShortTerm(p, record))}>
                {t("planner.addShort")}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="ml-auto hover:text-danger-fg" disabled={!lossParts.length} onClick={() => setConfirmReset(true)}>
              <Icons.RefreshCw className="size-3.5" />
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
          <Outlook record={record} state={state} />
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
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t("planner.resetTitle")}
        body={lossParts.length ? t("planner.resetBody", { list: list.format(lossParts) }) : t("planner.resetNothing")}
        confirmLabel={t("planner.resetConfirm")}
        onConfirm={() => {
          setConfirmReset(false);
          undoable(() => defaultPlan(record), t("planner.resetDone"));
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------ summary

/** "kurang 5 SKS dan 2 mata kuliah wajib": what stands between the plan and graduating. */
function useShortfallText(): (shortfall: Shortfall) => string {
  const t = useT();
  const lang = useLang();
  const list = new Intl.ListFormat(lang, { type: "conjunction" });
  return (s) =>
    list.format(
      [
        s.sks > 0 && t("planner.short.sks", { n: s.sks }),
        s.required > 0 && t("planner.short.required", { n: s.required, count: s.required }),
        s.electives > 0 && t("planner.short.electives", { n: s.electives }),
        s.other > 0 && t("planner.short.other", { n: s.other, count: s.other }),
      ].filter((part): part is string => Boolean(part)),
    );
}

function Summary({ record, state, rules }: { record: StudentRecord; state: PlanState; rules: Rule[] }) {
  const t = useT();
  const f = useFormat();
  const predicate = usePredicate();
  const shortfall = useShortfallText();
  const { plan, projection } = state;
  const sks = sksModel(record, plan);
  const finish = rules.find((r): r is Extract<Rule, { id: "finish" }> => r.id === "finish");
  const warnings = rules.filter((r) => r.level === "warn").length;
  const word = predicate(predicateFor(projection.finalIpk, projection.path));
  return (
    <Card variant="raised" className="px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-4">
        <div className="min-w-0">
          {record.program && <p className="text-small font-medium text-muted">{t("planner.program", { name: record.program.name })}</p>}
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[26px] leading-8 font-semibold tracking-[-0.02em]">
            {sks.short ? t("planner.sksShort", { total: sks.total, need: sks.need }) : t("planner.sksDone", { need: sks.need })}
            <span className={cx("text-body font-semibold tracking-normal", sks.short ? "text-danger-fg" : "text-success-fg")}>
              {sks.short ? t("planner.sksShortBy", { short: sks.short }) : sks.extra ? t("planner.sksSpare", { extra: sks.extra }) : null}
            </span>
          </p>
        </div>
        <dl className="flex gap-10">
          <div>
            <dt className="text-caption font-medium text-muted">{t("planner.graduate")}</dt>
            {finish?.blocked ? (
              <>
                <dd className="flex items-center gap-1.5 text-title font-semibold text-danger-fg">
                  <Icons.AlertTriangle className="size-4" />
                  {t("planner.notYet")}
                </dd>
                <dd className="text-caption text-muted" role="status">
                  {t("planner.shortfall", { list: shortfall(finish.blocked) })}
                </dd>
              </>
            ) : (
              <>
                <dd className="text-title font-semibold">{finish ? t("planner.semester", { n: finish.semester }) : "—"}</dd>
                <dd className={cx("text-caption font-medium", warnings ? "text-warning-fg" : "text-muted")} role="status">
                  {warnings
                    ? t("planner.toCheck", { count: warnings })
                    : finish && finish.semester > finish.normal
                      ? t("planner.late", { normal: finish.normal })
                      : t("planner.onTime")}
                </dd>
              </>
            )}
          </div>
          <div>
            <dt className="text-caption font-medium text-muted">{t("grades.graduation")}</dt>
            <dd className="text-title font-semibold tabular-nums">
              <Flash value={projection.finalIpk}>{projection.finalIpk === null ? "—" : f.number(projection.finalIpk, 2)}</Flash>
            </dd>
            <dd className={cx("text-caption", projection.honor ? "font-semibold text-success-fg" : "text-muted")}>{word}</dd>
          </div>
        </dl>
      </div>
      <SksBar sks={sks} />
    </Card>
  );
}

/** Passed, this semester and planned against what graduating needs, with its legend. */
function SksBar({ sks }: { sks: SksModel }) {
  const t = useT();
  const scale = Math.max(sks.need, sks.total);
  const share = (n: number) => `${(n / scale) * 100}%`;
  const parts = [
    { n: sks.passed, label: t("planner.legend.passed", { n: sks.passed }), color: "bg-live" },
    { n: sks.inProgress, label: t("planner.legend.now", { n: sks.inProgress }), color: "bg-live/45" },
    { n: sks.planned, label: t("planner.legend.planned", { n: sks.planned }), color: "bg-info-fg/55" },
  ];
  return (
    <div className="mt-4">
      <div
        role="progressbar"
        aria-label={t("planner.progress")}
        aria-valuemin={0}
        aria-valuemax={sks.need}
        aria-valuenow={Math.min(sks.total, sks.need)}
        className="relative flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]"
      >
        {parts.map((part) => (
          <span
            key={part.label}
            className={cx("h-full first:rounded-l-full last:rounded-r-full motion-safe:transition-[width] motion-safe:duration-500", part.color)}
            style={{ width: share(part.n) }}
          />
        ))}
        {sks.total > sks.need && <span aria-hidden className="absolute inset-y-0 w-[2px] bg-fg/70" style={{ left: share(sks.need) }} />}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted tabular-nums">
        {parts.map((part) => (
          <li key={part.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cx("size-2 rounded-full", part.color)} />
            {part.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------ semesters

function Past({ record, steps }: { record: StudentRecord; steps: ProjectedStep[] }) {
  const t = useT();
  const f = useFormat();
  const termLabel = useTermLabel();
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  const ipk = record.transcript ? (record.transcript.ipk.six ?? record.transcript.ipk.computed) : null;
  const last = steps.at(-1)?.semester ?? steps.length;
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-hover"
      >
        <Icons.ChevronRight className={cx("size-4 text-faint transition-transform duration-150", open && "rotate-90")} />
        <Meta className="flex-1 text-body font-semibold">
          {t("planner.past", { n: last })}
          <span className="font-normal text-muted">{t("planner.pastMeta", { sks: record.passedSks, ipk: ipk === null ? "—" : f.number(ipk, 2) })}</span>
        </Meta>
      </button>
      {open && (
        <ul className="grid grid-cols-2 gap-2 border-t border-line bg-sunken px-4 py-3 @2xl:grid-cols-3">
          {steps.map((s) => (
            <li key={s.term} className="text-small">
              <span className="font-medium">{termLabel(s.term, s.semester)}</span>
              <Meta className="text-muted tabular-nums">
                {`IP ${s.ip === null ? "—" : f.number(s.ip, 2)}`}
                {`${s.sks} SKS`}
              </Meta>
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
          <span className={cx("text-small font-semibold tabular-nums", over ? "text-danger-fg" : "text-muted")}>
            {sks}
            {limit !== null && ` / ${limit}`} SKS
          </span>
          {step && (
            <span className="border-l border-line pl-3 text-right leading-tight">
              <span className="block text-small font-semibold tabular-nums">IP {step.ip === null ? "—" : f.number(step.ip, 2)}</span>
              <span className="block text-caption text-faint tabular-nums">
                {t("planner.ipkAfter", { ipk: step.ipk === null ? "—" : f.number(step.ipk, 2) })}
              </span>
            </span>
          )}
          {onRemove && (
            <Tooltip content={removeLabel}>
              <IconButton label={removeLabel ?? ""} size="sm" onClick={onRemove}>
                <Icons.X className="size-3.5" />
              </IconButton>
            </Tooltip>
          )}
        </header>
        <ul>{children}</ul>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="focus-ring flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-small font-semibold text-accent-fg transition-colors duration-150 hover:bg-hover"
          >
            <Icons.Plus className="size-3.5" />
            {t("planner.addCourse")}
          </button>
        )}
      </Card>
    </section>
  );
}

/** A course's type: neutral, except "Wajib", the one that matters for graduating. */
function Tag({ tone = "neutral", children }: { tone?: "neutral" | "required"; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex h-[20px] items-center rounded-[5px] px-1.5 text-micro font-semibold whitespace-nowrap",
        tone === "required" ? "bg-info-bg text-info-fg" : "border border-edge text-muted",
      )}
    >
      {children}
    </span>
  );
}

function RoleTag({ record, code, minor }: { record: StudentRecord; code: string; minor: MinorOption | null }) {
  const t = useT();
  const role = courseRole(record, code, minor);
  const semester = record.required.get(code)?.semester ?? record.requiredLeft.find((c) => c.code === code)?.semester;
  return role === "required" ? <Tag tone="required">{t("planner.role.required", { n: semester ?? "—" })}</Tag> : <Tag>{t(`planner.role.${role}`)}</Tag>;
}

const ruleAnchor = (rule: Rule) => `rule-${rule.id}${"code" in rule ? `-${rule.code}` : ""}${"term" in rule ? `-${rule.term}` : ""}`;

/** Shows a rule in the list and draws the eye to it. */
function goToRule(rule: Rule) {
  const el = document.getElementById(ruleAnchor(rule));
  if (!el) return;
  el.scrollIntoView?.({ behavior: "smooth", block: "center" });
  el.classList.add("bg-warning-bg");
  setTimeout(() => el.classList.remove("bg-warning-bg"), 1200);
}

function CourseLine({
  code,
  name,
  sks,
  tag,
  flag,
  grade,
  guess,
  posted,
  onGrade,
  onRemove,
}: {
  code: string;
  name: string;
  sks: number;
  tag: ReactNode;
  flag?: Extract<Rule, { id: "parity" | "early" }>;
  grade: LetterGrade;
  guess?: boolean;
  posted?: boolean;
  onGrade: (grade: LetterGrade) => void;
  onRemove?: () => void;
}) {
  const t = useT();
  return (
    <li className="grid grid-cols-[64px_minmax(0,1fr)_auto_28px_62px_28px] items-center gap-3 border-b border-line px-4 py-2 text-body last:border-b-0">
      <span className="text-small font-semibold tabular-nums">{code}</span>
      <span className="min-w-0">
        <span className="block truncate">{name}</span>
        {flag && (
          <button
            type="button"
            onClick={() => goToRule(flag)}
            className="focus-ring mt-0.5 inline-flex items-center gap-1 rounded text-caption font-medium text-warning-fg hover:underline"
          >
            <Icons.AlertTriangle className="size-3" />
            {flag.id === "parity"
              ? t("planner.flag.parity", { kind: t(flag.semester % 2 === 1 ? "rule.parity.odd" : "rule.parity.even") })
              : t("planner.flag.early")}
          </button>
        )}
      </span>
      {tag}
      <span className="text-right text-small text-muted tabular-nums">{sks}</span>
      {posted ? (
        <span
          className="inline-flex h-7 items-center justify-center rounded-md bg-neutral-bg text-small font-bold text-neutral-fg"
          title={t("grades.sixGrade")}
        >
          {grade}
        </span>
      ) : (
        <GradeSelect label={t("grades.expectedOf", { code })} value={grade} guess={guess} onChange={onGrade} />
      )}
      {onRemove ? (
        <Tooltip content={t("planner.removeCourse", { code })}>
          <IconButton label={t("planner.removeCourse", { code })} size="sm" onClick={onRemove}>
            <Icons.X className="size-3.5" />
          </IconButton>
        </Tooltip>
      ) : (
        <span />
      )}
    </li>
  );
}

// ------------------------------------------------------------ rules and the outlook

const LEVEL_MARK: Record<RuleLevel, { tone: string; label: "planner.ruleOk" | "planner.ruleWarn" | "planner.ruleError" }> = {
  ok: { tone: "bg-success-bg text-success-fg", label: "planner.ruleOk" },
  warn: { tone: "bg-warning-bg text-warning-fg", label: "planner.ruleWarn" },
  error: { tone: "bg-danger-bg text-danger-fg", label: "planner.ruleError" },
};

function useRuleText(record: StudentRecord): (rule: Rule) => { title: string; detail: string } {
  const t = useT();
  const termLabel = useTermLabel();
  const shortfall = useShortfallText();
  const list = (items: { code: string; name: string }[]) => items.map((c) => `${c.code} ${c.name}`).join(", ");
  return (rule) => {
    switch (rule.id) {
      case "total": {
        const extra = rule.have - rule.need;
        return {
          title:
            extra > 0
              ? t("rule.total.done", { need: rule.need, extra })
              : extra === 0
                ? t("rule.total.exact", { need: rule.need })
                : t("rule.total", { have: rule.have, need: rule.need }),
          detail: rule.level === "ok" ? t("rule.total.ok") : t("rule.total.short", { short: rule.need - rule.have }),
        };
      }
      case "required":
        return {
          title: t("rule.required"),
          detail: rule.missing.length
            ? t("rule.missing", { list: list(rule.missing) })
            : rule.total
              ? t("rule.required.okCount", { count: rule.total })
              : t("rule.required.ok"),
        };
      case "electives": {
        const extra = rule.have - rule.need;
        return {
          title: t("rule.electives"),
          detail:
            extra > 0
              ? t("rule.electives.done", { need: rule.need, extra })
              : extra === 0
                ? t("rule.electives.exact", { need: rule.need })
                : t("rule.electives.short", { have: rule.have, need: rule.need, short: -extra }),
        };
      }
      case "specialization":
        return {
          title: rule.name,
          detail: rule.missing.length ? t("rule.missing", { list: list(rule.missing) }) : t("rule.specialization.ok", { count: rule.total }),
        };
      case "minor":
        return { title: t("rule.minor", { name: rule.name }), detail: t("rule.minor.detail", { have: rule.have, need: rule.need }) };
      case "load":
        return {
          title: termLabel(rule.term, semesterOf(rule.term, record.entryTerm)),
          detail:
            rule.level === "error" ? t("rule.load.over", { sks: rule.sks, limit: rule.limit }) : t("rule.load.advisor", { sks: rule.sks, limit: rule.limit }),
        };
      case "parity": {
        const odd = rule.semester % 2 === 1;
        return {
          title: `${rule.code} ${rule.name}`,
          detail: t("rule.parity", {
            semester: rule.semester,
            parity: t(odd ? "rule.parity.odd" : "rule.parity.even"),
            kind: t(odd ? "rule.parity.even" : "rule.parity.odd"),
          }),
        };
      }
      case "early":
        return { title: `${rule.code} ${rule.name}`, detail: t("rule.early", { semester: rule.semester }) };
      case "finish":
        if (rule.blocked) return { title: t("rule.finish.blocked"), detail: t("rule.finish.blockedDetail", { list: shortfall(rule.blocked) }) };
        return {
          title: t("rule.finish", { n: rule.semester }),
          detail:
            rule.level === "ok"
              ? t("rule.finish.ok", { normal: rule.normal })
              : rule.semester <= 9
                ? t("rule.finish.late", { normal: rule.normal })
                : t("rule.finish.tooLate"),
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
      <ul className="space-y-1 px-2 pt-2 pb-3" aria-label={t("planner.rules")}>
        {rules.map((rule) => {
          const { title, detail } = text(rule);
          const mark = LEVEL_MARK[rule.level];
          return (
            <li
              key={ruleAnchor(rule)}
              id={ruleAnchor(rule)}
              className="flex scroll-m-24 items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-500"
              data-rule={rule.id}
              data-level={rule.level}
            >
              <span className={cx("mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full", mark.tone)} title={t(mark.label)}>
                {rule.level === "ok" ? <Icons.Check className="size-3" weight="bold" /> : <span className="text-micro font-bold">!</span>}
                <span className="sr-only">{t(mark.label)}</span>
              </span>
              <span className="min-w-0 flex-1 text-small">
                <span className="block font-semibold">{title}</span>
                <span className="text-muted">{detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** The one shared target, what the rest needs for it, the IPK path, and the honors ladder. */
function Outlook({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const { plan, projection } = state;
  const target = targetOf(record, plan);
  return (
    <Card className="overflow-hidden">
      <h3 className="px-4 pt-3.5 text-body font-semibold">{t("planner.outlook")}</h3>
      <div className="space-y-2 px-4 pt-2.5">
        <TargetControl record={record} state={state} />
        <p className="text-small text-muted" role="status">
          <NeedText need={projection.need(target)} target={target} sks={projection.variableSks} scope="rest" />
        </p>
      </div>
      <IpkChart steps={projection.steps} target={target} height={148} className="px-3 pt-3" />
      <div className="mt-3 border-t border-line px-4 py-3">
        <p className="mb-1.5 text-caption font-medium text-muted">{t("honors.title")}</p>
        <HonorsList projection={projection} />
      </div>
      <p className="border-t border-line px-4 py-2.5 text-caption text-faint">{t("honors.rule")}</p>
    </Card>
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
                className={cx(
                  "focus-ring flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150",
                  on ? "bg-selected" : "hover:bg-hover",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-semibold">{m.name}</span>
                  <span className="block truncate text-caption text-muted">{m.program}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-caption font-semibold tabular-nums">{t("planner.minorSks", { have: m.have, need: m.need })}</span>
                  <span className={cx("inline-flex items-center gap-1 text-caption", on ? "font-medium text-accent-fg" : "text-faint")}>
                    {on ? <Icons.Check className="size-3" weight="bold" /> : <Icons.Target className="size-3" />}
                    {on ? t("planner.minorWatching") : t("planner.minorTrackShort")}
                  </span>
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
    ...(record.specialization?.courses ?? [])
      .filter((c) => open(c.code) || planned.has(c.code))
      .map((c) => ({ code: c.code, why: t("planner.why.specialization", { name: record.specialization!.name }) })),
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
          <Meta truncate className="text-caption text-muted">
            {`${info.sks} SKS`}
            {owner}
            {why}
            {retake && retake.now !== null && retake.after !== null
              ? t("planner.retakeGain", { now: f.number(retake.now, 2), after: f.number(retake.after, 2) })
              : null}
          </Meta>
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
          {tab === "program" && (
            <ul>
              {programElectives(record)
                .filter(matches)
                .map((c) => row(c.code))}
            </ul>
          )}
          {tab === "minors" && (
            <ul>
              {rankedMinors(record, plan)
                .filter((m) => !q || m.name.toLowerCase().includes(q) || m.program.toLowerCase().includes(q))
                .slice(0, 40)
                .map((m) => (
                  <li key={m.key} className="border-b border-line px-5 py-2.5 last:border-b-0">
                    <p className="flex items-center justify-between gap-3 text-body font-semibold">
                      {m.name}
                      <Meta className="text-caption font-medium text-muted">
                        {m.program}
                        {`${m.need} SKS`}
                      </Meta>
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
