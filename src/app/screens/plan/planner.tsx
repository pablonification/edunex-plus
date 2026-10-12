// Rencana studi tab — The study planner (#79): semesters from now to
// graduation, courses from SIX's public catalog (required, electives,
// specialization and minor packages, all of ITB) and retakes, every rule
// checked live (Peraturan Akademik ITB and the program's curriculum), and
// expected grades projecting each semester's IP, the IPK at graduation,
// honors and what the one shared target needs. Graduating is one verdict
// (the header and the rules never disagree), the SKS one count shared with
// Kurikulum and Nilai, and every removal can be taken back. The plan stays
// on this computer; the app never sends a KRS. This semester takes what-ifs
// (a course added or left out, only in the plan), warnings can be hidden with
// a reason, and a minor can be planned with its courses in view.
import * as Tabs from "@radix-ui/react-tabs";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { nearestLetter } from "../../../core/honors";
import type { LetterGrade, PlannedCourse, StudyPlan } from "../../../core/models";
import {
  activeSpecialization,
  addCourse,
  addShortTerm,
  addTerm,
  addToNow,
  type CourseInfo,
  type CourseState,
  canRemoveTerm,
  checkPlan,
  courseInfo,
  courseRole,
  courseState,
  defaultPlan,
  expectedGrade,
  hasWhatIfs,
  hideReasons,
  hideRule,
  isHidden,
  leaveOut,
  livePlan,
  MAX_SKS,
  type MinorOption,
  minorProgress,
  NORMAL_SKS,
  type ProjectedStep,
  plannedCodes,
  programElectives,
  putBack,
  type Rule,
  type RuleLevel,
  rankedMinors,
  removeCourse,
  removeTerm,
  removeTried,
  retakeCandidates,
  ruleKey,
  SHORT_SKS,
  type Shortfall,
  type SksModel,
  type StudentRecord,
  searchCourses,
  semesterOf,
  setGrade,
  shortTermToAdd,
  showRule,
  sksModel,
  targetOf,
  termKind,
  untried,
  withWhatIf,
} from "../../../core/planner";
import { useFocusNext } from "../../hooks";
import { useFormat, useLang, useT } from "../../i18n";
import { type PlanState, usePlan, useStudentRecord } from "../../study-plan";
import { Button, IconButton } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Card } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta } from "../../ui/layout";
import { Menu } from "../../ui/menu";
import { AnimatedNumber } from "../../ui/motion/animated-number";
import { ConfirmDialog, Dialog, dismissToast, Tooltip, toast } from "../../ui/overlays";
import { TabBar } from "../../ui/tabs";
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
  return <Planner real={record} record={state.record} state={state} />;
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
    const before = state.base;
    state.update(edit);
    last.current = before;
    // Only the latest change can be taken back (an older undo would throw away what came after it), so its toast replaces the last one.
    if (shown.current !== null) dismissToast(shown.current);
    shown.current = toast(message, "neutral", { label: t("planner.undo"), onClick: () => last.current === before && restore(before) });
  };
}

/** How many of the plan's what-ifs still change this term. */
function whatIfCount(record: StudentRecord, plan: StudyPlan): number {
  const applied = withWhatIf(record, plan);
  return applied.thisTermAdded.length + applied.thisTermDropped.length;
}

/** What a reset would throw away, compared with the starting plan (from SIX's own record: a reset ends this term's what-ifs). Hidden warnings stay. */
function resetLoss(record: StudentRecord, plan: StudyPlan): { grades: number; added: number; removed: number; terms: number; whatIfs: number; other: boolean } {
  const start = livePlan(defaultPlan(record, plan.hidden), record);
  const startCourses = new Map(start.terms.flatMap((term) => term.courses.map((c) => [c.code, c] as const)));
  // A course tried this semester still counts where it was planned: its what-if is counted on its own.
  const live = livePlan(untried(plan), record);
  const now = live.terms.flatMap((term) => term.courses);
  const startTerms = new Set(start.terms.map((term) => term.term));
  return {
    grades: Object.keys(plan.expected).length + now.filter((c) => startCourses.has(c.code) && startCourses.get(c.code)!.grade !== c.grade).length,
    added: now.filter((c) => !startCourses.has(c.code)).length,
    removed: [...startCourses.keys()].filter((code) => !now.some((c) => c.code === code)).length,
    terms: live.terms.filter((term) => !startTerms.has(term.term)).length,
    whatIfs: whatIfCount(record, plan),
    other: plan.target !== null || plan.minor !== start.minor,
  };
}

/** `real`: SIX's own record; `record`: with this term's what-ifs, which every figure here counts. */
function Planner({ real, record, state }: { real: StudentRecord; record: StudentRecord; state: PlanState }) {
  const t = useT();
  const lang = useLang();
  const termLabel = useTermLabel();
  const { plan, projection, update } = state;
  const [adding, setAdding] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const undoable = useUndoable(state);
  const focusNext = useFocusNext();
  const rules = checkPlan(record, plan, projection);
  const minor = record.minors.find((m) => m.key === plan.minor) ?? null;
  const spec = activeSpecialization(record, plan);
  const stepOf = new Map(projection.steps.map((s) => [s.term, s]));
  const short = shortTermToAdd(plan, record);
  const loss = resetLoss(real, state.base);
  const lossParts = [
    loss.grades && t("planner.reset.grades", { n: loss.grades, count: loss.grades }),
    loss.added && t("planner.reset.added", { n: loss.added, count: loss.added }),
    loss.terms && t("planner.reset.terms", { n: loss.terms, count: loss.terms }),
    loss.removed && t("planner.reset.removed", { n: loss.removed, count: loss.removed }),
    loss.whatIfs && t("planner.reset.whatIfs", { n: loss.whatIfs, count: loss.whatIfs }),
    loss.other && t("planner.reset.other"),
  ].filter((part): part is string => Boolean(part));
  const list = new Intl.ListFormat(lang, { type: "conjunction" });
  // A course's own warning (odd/even, earlier than the curriculum), shown on its row unless the Student hid it.
  const flags = new Map<string, Extract<Rule, { id: "parity" | "early" }>>();
  for (const rule of rules) if ((rule.id === "parity" || rule.id === "early") && !isHidden(rule, plan)) flags.set(`${rule.term}|${rule.code}`, rule);
  const whatIf = hasWhatIfs(plan, record);
  const added = new Set(record.thisTermAdded);
  const leftOut = new Set(record.thisTermDropped.map((c) => c.code));
  // This semester in SIX's KRS order, a course left out crossed out where it was, then the ones tried.
  const nowCourses = [...real.thisTerm, ...record.thisTerm.filter((c) => added.has(c.code))];
  const nowLabel = record.semesterNow ? t("planner.now", { n: record.semesterNow }) : t("planner.nowPlain");

  return (
    <div className="@container space-y-6">
      <Summary record={record} state={state} rules={rules} />
      <div className="grid grid-cols-1 items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <Past record={record} steps={projection.steps.filter((s) => !s.projected && s.term !== record.term)} />
          {/* Shown while this term's KRS is still empty too: that's when trying courses matters most. */}
          {record.term && (
            <TermBlock
              title={nowLabel}
              subtitle={whatIf ? t("planner.nowWhatIf") : t("planner.nowSub")}
              whatIf={whatIf}
              sks={record.thisTerm.reduce((sum, c) => sum + c.sks, 0)}
              limit={whatIf ? (termKind(record.term) === "short" ? SHORT_SKS : MAX_SKS) : null}
              step={stepOf.get(record.term)}
              onAdd={() => setAdding(record.term)}
              addLabel={t("planner.addWhatIf")}
              addKey="now-add"
            >
              {nowCourses.map((course) => {
                const mine = added.has(course.code);
                const term = record.term!;
                if (leftOut.has(course.code))
                  return (
                    <DroppedLine
                      key={course.code}
                      code={course.code}
                      name={course.name}
                      sks={course.sks}
                      onPutBack={() => {
                        undoable((p) => putBack(p, term, course.code), t("planner.putBackDone", { code: course.code }));
                        focusNext(`now-remove-${course.code}`);
                      }}
                    />
                  );
                return (
                  <CourseLine
                    key={course.code}
                    code={course.code}
                    name={course.name}
                    sks={course.sks}
                    tag={mine ? <Tag tone="what-if">{t("planner.whatIfTag")}</Tag> : <RoleTag record={record} code={course.code} minor={minor} spec={spec} />}
                    flag={mine ? flags.get(`${term}|${course.code}`) : undefined}
                    grade={course.grade ?? expectedGrade(record, plan, course.code)}
                    guess={plan.expected[course.code] === undefined}
                    posted={course.grade !== null}
                    onGrade={(grade) => update((p) => ({ ...p, expected: { ...p.expected, [course.code]: grade } }))}
                    // A course SIX already graded stays: there's nothing to try without it.
                    onRemove={
                      course.grade === null
                        ? () => {
                            undoable(
                              (p) => (mine ? removeTried(p, term, course.code) : leaveOut(p, term, course.code)),
                              t(mine ? "planner.removedNow" : "planner.leftOut", { code: course.code }),
                            );
                            // The row goes (or turns into its crossed-out self): focus follows to what's there now.
                            focusNext(mine ? "now-add" : `now-putback-${course.code}`);
                          }
                        : undefined
                    }
                    removeLabel={t(mine ? "planner.removeCourse" : "planner.leaveOut", { code: course.code })}
                    removeKey={`now-remove-${course.code}`}
                  />
                );
              })}
              {nowCourses.length === 0 && <li className="px-4 py-3 text-small text-faint">{t("planner.nowEmpty")}</li>}
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
                    ? () =>
                        // The courses the Student sees: a hidden copy of one taken already (in the KRS, passed) isn't lost with it.
                        undoable((p) => removeTerm(p, term.term), t("planner.removedTerm", { term: label, count: term.courses.length }))
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
                        <RoleTag record={record} code={course.code} minor={minor} spec={spec} />
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
          <Rules record={record} rules={rules} plan={plan} undoable={undoable} />
          <Outlook record={record} state={state} />
          <Minors record={record} state={state} undoable={undoable} />
        </aside>
      </div>
      {adding && (
        <AddCourse
          record={record}
          state={state}
          now={adding === record.term}
          title={
            adding === record.term
              ? t("planner.addToNow", { term: nowLabel })
              : t("planner.addTo", { term: termLabel(adding, semesterOf(adding, record.entryTerm)) })
          }
          onAdd={(course) =>
            adding === record.term
              ? undoable((p) => addToNow(p, adding, course), t("planner.addedNow", { code: course.code }))
              : update((p) => addCourse(p, adding, course))
          }
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
          undoable((p) => defaultPlan(real, p.hidden), t("planner.resetDone"));
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
  const warnings = rules.filter((r) => r.level === "warn" && !isHidden(r, plan)).length;
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
              {projection.finalIpk === null ? "—" : <AnimatedNumber value={projection.finalIpk} format={(value) => f.number(value, 2)} />}
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
  whatIf = false,
  sks,
  limit,
  step,
  onAdd,
  addLabel,
  addKey,
  onRemove,
  removeLabel,
  children,
}: {
  title: string;
  subtitle: string;
  /** The semester holds what-ifs: the subtitle says they're only in the plan. */
  whatIf?: boolean;
  sks: number;
  limit: number | null;
  step: ProjectedStep | undefined;
  onAdd?: () => void;
  addLabel?: string;
  /** Marks the add button for `useFocusNext`. */
  addKey?: string;
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
            {whatIf ? (
              <span className="flex items-center gap-1 text-caption font-medium text-info-fg" role="status">
                <Icons.Info className="size-3 shrink-0" weight="bold" />
                <Meta>{subtitle}</Meta>
              </span>
            ) : (
              <span className="block text-caption text-faint">{subtitle}</span>
            )}
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
            data-focus={addKey}
            className="focus-ring flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-small font-semibold text-accent-fg transition-colors duration-150 hover:bg-hover"
          >
            <Icons.Plus className="size-3.5" />
            {addLabel ?? t("planner.addCourse")}
          </button>
        )}
      </Card>
    </section>
  );
}

/** A course's type: neutral, except "Wajib", the one that matters for graduating, and a what-if, dashed because it isn't real. */
export function Tag({ tone = "neutral", children }: { tone?: "neutral" | "required" | "what-if"; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex h-[20px] items-center rounded-[5px] px-1.5 text-micro font-semibold whitespace-nowrap",
        tone === "required"
          ? "bg-info-bg text-info-fg"
          : tone === "what-if"
            ? "border border-dashed border-info-fg/60 text-info-fg"
            : "border border-edge text-muted",
      )}
    >
      {children}
    </span>
  );
}

function RoleTag({ record, code, minor, spec }: { record: StudentRecord; code: string; minor: MinorOption | null; spec: StudentRecord["specialization"] }) {
  const t = useT();
  const role = courseRole(record, code, minor, spec);
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
  removeLabel,
  removeKey,
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
  removeLabel?: string;
  /** Marks the remove button for `useFocusNext`. */
  removeKey?: string;
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
        <Tooltip content={removeLabel ?? t("planner.removeCourse", { code })}>
          <IconButton label={removeLabel ?? t("planner.removeCourse", { code })} size="sm" onClick={onRemove} data-focus={removeKey}>
            <Icons.X className="size-3.5" />
          </IconButton>
        </Tooltip>
      ) : (
        <span />
      )}
    </li>
  );
}

/** A KRS course the Student left out as a what-if: crossed out where it was, in the columns of the rows around it, with the way back. */
function DroppedLine({ code, name, sks, onPutBack }: { code: string; name: string; sks: number; onPutBack: () => void }) {
  const t = useT();
  return (
    <li className="grid grid-cols-[64px_minmax(0,1fr)_auto_28px_62px_28px] items-center gap-3 border-b border-line px-4 py-2 text-body text-muted last:border-b-0">
      <span className="text-small font-semibold tabular-nums line-through">{code}</span>
      <span className="min-w-0">
        <span className="block truncate line-through">{name}</span>
        <span className="block text-caption text-info-fg">{t("planner.droppedTag")}</span>
      </span>
      <span />
      <span className="text-right text-small tabular-nums line-through">{sks}</span>
      <Button
        size="sm"
        variant="ghost"
        className="col-span-2 justify-self-end text-accent-fg"
        aria-label={t("planner.putBackCode", { code })}
        data-focus={`now-putback-${code}`}
        onClick={onPutBack}
      >
        {t("planner.putBack")}
      </Button>
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
      case "required": {
        const detail = rule.missing.length
          ? t("rule.missing", { list: list(rule.missing) })
          : rule.total
            ? t("rule.required.okCount", { count: rule.total })
            : t("rule.required.ok");
        // Honest about what the Student's own corrections decided.
        const corrected = rule.corrected.length ? t("rule.required.corrected", { list: list(rule.corrected), count: rule.corrected.length }) : null;
        return { title: t("rule.required"), detail: corrected ? `${detail} ${corrected}` : detail };
      }
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

type Undoable = (edit: (plan: StudyPlan) => StudyPlan, message: string) => void;

/** The rules, each warning with "Hide" and a reason; hidden ones wait in a quiet list to be shown again. Errors decide graduating: they can't be hidden. */
function Rules({ record, rules, plan, undoable }: { record: StudentRecord; rules: Rule[]; plan: StudyPlan; undoable: Undoable }) {
  const t = useT();
  const text = useRuleText(record);
  const focusNext = useFocusNext();
  const [showHidden, setShowHidden] = useState(false);
  const hidden: { key: string; anchor: string; title: string }[] = rules
    .filter((rule) => isHidden(rule, plan))
    .map((rule) => ({ key: ruleKey(rule)!, anchor: ruleAnchor(rule), title: text(rule).title }));
  // Not continuing the specialization still counts once its warning is gone (every course covered): it stays here to be taken back.
  const spec = record.specialization;
  const specKey = spec ? `specialization|${spec.name.toLowerCase()}` : null;
  if (spec && specKey && !activeSpecialization(record, plan) && !hidden.some((h) => h.key === specKey))
    hidden.push({ key: specKey, anchor: specKey, title: spec.name });
  return (
    <Card className="overflow-hidden">
      <h3 className="px-4 pt-3.5 text-body font-semibold" tabIndex={-1} data-focus="rules">
        {t("planner.rules")}
      </h3>
      <ul className="space-y-1 px-2 pt-2 pb-3" aria-label={t("planner.rules")}>
        {rules
          .filter((rule) => !isHidden(rule, plan))
          .map((rule) => {
            const { title, detail } = text(rule);
            const mark = LEVEL_MARK[rule.level];
            const key = ruleKey(rule);
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
                {key && (
                  <span className="-mt-0.5 -mr-1 shrink-0" data-focus={`hide-${key}`}>
                    <Menu
                      trigger={{ icon: <Icons.EyeOff className="size-3.5" /> }}
                      label={t("planner.hideRule", { title })}
                      items={hideReasons(rule).map((reason) => ({
                        label: t(`planner.hideReason.${reason}`),
                        hint: reason === "not-continuing" ? t("planner.hideReason.not-continuingHint") : undefined,
                        onSelect: () => {
                          undoable((p) => hideRule(p, key, reason, Date.now()), t("planner.hiddenDone", { title }));
                          // Its row goes: focus lands on the list it went to.
                          focusNext("hidden-toggle");
                        },
                      }))}
                    />
                  </span>
                )}
              </li>
            );
          })}
      </ul>
      {hidden.length > 0 && (
        <div className="border-t border-line px-4 py-2">
          <button
            type="button"
            aria-expanded={showHidden}
            data-focus="hidden-toggle"
            onClick={() => setShowHidden(!showHidden)}
            className="focus-ring -mx-1 rounded px-1 py-0.5 text-caption text-muted hover:text-fg"
          >
            <Meta>
              {t("planner.hidden", { count: hidden.length })}
              <span className="font-medium text-accent-fg">{t(showHidden ? "planner.hiddenClose" : "planner.hiddenShow")}</span>
            </Meta>
          </button>
          {showHidden && (
            <ul className="mt-1 space-y-1 pb-1" aria-label={t("planner.hidden", { count: hidden.length })}>
              {hidden.map(({ key, anchor, title }, index) => {
                const reason = plan.hidden?.[key]?.reason ?? "other";
                // Once shown, its line goes: focus moves to the next hidden one, or back to the warning when none is left.
                const rest = hidden.filter((h) => h.key !== key);
                const after = rest.length ? [`show-${rest[Math.min(index, rest.length - 1)].key}`, "hidden-toggle"] : [`hide-${key}`, "rules"];
                return (
                  <li key={anchor} className="flex items-center gap-2 text-small">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-fg">{title}</span>
                      <span className="block text-caption text-muted">{t(`planner.reasonShort.${reason}`)}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t("planner.showAgainRule", { title })}
                      data-focus={`show-${key}`}
                      onClick={() => {
                        undoable((p) => showRule(p, key), t("planner.shownDone", { title }));
                        focusNext(...after);
                      }}
                    >
                      {t("planner.showAgain")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
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

function Minors({ record, state, undoable }: { record: StudentRecord; state: PlanState; undoable: Undoable }) {
  const t = useT();
  const { plan } = state;
  const [open, setOpen] = useState<string | null>(null);
  const ranked = rankedMinors(record, plan);
  const pinned = (key: string) => key === plan.minor || key === record.registeredMinor;
  const shown = [...ranked.filter((m) => pinned(m.key)), ...ranked.filter((m) => !pinned(m.key) && m.have > 0).slice(0, 4)];
  const opened = record.minors.find((m) => m.key === open);
  return (
    <Card className="overflow-hidden">
      <h3 className="px-4 pt-3.5 text-body font-semibold">{t("planner.minors")}</h3>
      <ul className="px-2 pt-2 pb-2">
        {shown.map((m) => {
          const on = plan.minor === m.key;
          const registered = record.registeredMinor === m.key;
          return (
            <li key={m.key}>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setOpen(m.key)}
                className="focus-ring group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-hover"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-semibold">{m.name}</span>
                  <span className="block truncate text-caption text-muted">{m.program}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-caption font-semibold tabular-nums">{t("planner.minorSks", { have: m.have, need: m.need })}</span>
                  {(on || registered) && (
                    <span className="inline-flex items-center gap-1 text-caption font-medium text-accent-fg">
                      <Icons.Check className="size-3" weight="bold" />
                      {registered ? t("planner.minorRegistered") : t("planner.minorPlanned")}
                    </span>
                  )}
                </span>
                <Icons.ChevronRight className="size-3.5 shrink-0 text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-2 py-1 text-small text-faint">{t("planner.minorNone")}</li>}
      </ul>
      {opened && <MinorPanel record={record} state={state} minor={opened} undoable={undoable} onClose={() => setOpen(null)} />}
    </Card>
  );
}

/** The first planned regular semester a course still fits in at the normal load, else the last one. */
function termFor(plan: StudyPlan, sks: number): string | null {
  const regular = plan.terms.filter((t) => termKind(t.term) !== "short");
  return (regular.find((t) => t.courses.reduce((sum, c) => sum + c.sks, 0) + sks <= NORMAL_SKS) ?? regular.at(-1))?.term ?? null;
}

/** A minor up close: SIX's rules, each course with where it stands and a way to plan it, and planning the minor itself, said plainly. */
function MinorPanel({
  record,
  state,
  minor,
  undoable,
  onClose,
}: {
  record: StudentRecord;
  state: PlanState;
  minor: MinorOption;
  undoable: Undoable;
  onClose: () => void;
}) {
  const t = useT();
  const termLabel = useTermLabel();
  const focusNext = useFocusNext();
  const { plan } = state;
  const on = plan.minor === minor.key;
  const progress = minorProgress(record, plan, minor);
  const have = progress.passed + progress.now + progress.planned;
  const grade = nearestLetter(record.transcript?.ipk.computed ?? null);
  const label = (term: string) => termLabel(term, semesterOf(term, record.entryTerm));
  const stateText = (code: string, st: CourseState) =>
    st === "passed" ? t("planner.state.passed", { grade: record.graded.get(code)?.grade ?? "" }) : st ? t(`planner.state.${st}`) : null;
  const termOf = (code: string) => (courseState(record, plan, code) ? null : termFor(plan, courseInfo(record, code).sks));
  // The courses with an Add button, in order: once one is added, focus moves to the next (the button turns into its status).
  const addable = minor.courses.filter((code) => termOf(code) !== null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t("rule.minor", { name: minor.name })}>
      <p className="text-small text-muted">
        <Meta>
          {minor.program}
          {record.registeredMinor === minor.key ? t("planner.minorRegistered") : ""}
        </Meta>
      </p>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-title font-semibold tabular-nums">{t("planner.minorSks", { have, need: progress.need })}</span>
        <Meta className="text-small text-muted tabular-nums">
          {t("planner.minorSplit", { passed: progress.passed, now: progress.now, planned: progress.planned })}
        </Meta>
      </p>
      {minor.note && (
        <section className="mt-4">
          <h3 className="text-caption font-medium text-muted">{t("planner.minorRules")}</h3>
          <p className="mt-1 text-small whitespace-pre-line">{minor.note}</p>
        </section>
      )}
      <section className="mt-4">
        <h3 className="text-caption font-medium text-muted">{t("planner.minorCourses")}</h3>
        <ul className="mt-1">
          {minor.courses.map((code) => {
            const info = courseInfo(record, code);
            const st = courseState(record, plan, code);
            const term = termOf(code);
            return (
              <li key={code} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2 last:border-b-0">
                <span className="text-small font-semibold tabular-nums">{code}</span>
                <span className="min-w-0">
                  <span className="block truncate text-body">{info.name}</span>
                  <span className="block text-caption text-muted">{info.sks} SKS</span>
                </span>
                {st ? (
                  <span className={cx("text-caption font-semibold whitespace-nowrap", st === "this-term" ? "text-info-fg" : "text-faint")}>
                    {stateText(code, st)}
                  </span>
                ) : term ? (
                  <Button
                    size="sm"
                    aria-label={t("planner.addCodeTo", { code, term: label(term) })}
                    data-focus={`minor-add-${code}`}
                    onClick={() => {
                      undoable(
                        (p) => addCourse(p, term, { code, name: info.name, sks: info.sks, grade, retake: false }),
                        t("planner.addedTo", { code, term: label(term) }),
                      );
                      const next = addable[addable.indexOf(code) + 1];
                      focusNext(...(next ? [`minor-add-${next}`] : []), "minor-plan");
                    }}
                  >
                    {t("planner.add")}
                  </Button>
                ) : (
                  <span className="text-caption text-faint">{t("planner.state.left")}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <p className="mt-4 text-caption text-muted">{t("planner.minorWhat")}</p>
      <div className="mt-4 flex justify-end">
        {on ? (
          <Button data-focus="minor-plan" onClick={() => undoable((p) => ({ ...p, minor: null }), t("planner.minorStopped", { name: minor.name }))}>
            {t("planner.minorStop")}
          </Button>
        ) : (
          <Button
            variant="primary"
            data-focus="minor-plan"
            icon={<Icons.Target className="size-3.5" />}
            onClick={() => undoable((p) => ({ ...p, minor: minor.key }), t("planner.minorPlannedDone", { name: minor.name }))}
          >
            {t("planner.minorPlan")}
          </Button>
        )}
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------ adding a course

type AddTab = "needed" | "program" | "minors" | "all";

/** `now`: adding to this semester, as a what-if; a course planned for later can move into it. */
function AddCourse({
  record,
  state,
  now,
  title,
  onAdd,
  onClose,
}: {
  record: StudentRecord;
  state: PlanState;
  now: boolean;
  title: string;
  onAdd: (course: PlannedCourse) => void;
  onClose: () => void;
}) {
  const t = useT();
  const f = useFormat();
  const { plan } = state;
  const [tab, setTab] = useState<AddTab>("needed");
  const [query, setQuery] = useState("");
  const minor = record.minors.find((m) => m.key === plan.minor) ?? null;
  const spec = activeSpecialization(record, plan);
  const grade = nearestLetter(record.transcript?.ipk.computed ?? null);
  const add = (code: string, retake: boolean) => {
    const info = courseInfo(record, code);
    onAdd({ code, name: info.name, sks: info.sks, grade, retake });
    onClose();
  };
  const planned = plannedCodes(plan);
  const canAdd = (st: CourseState) => st === null || (now && st === "planned");
  const open = (code: string) => !planned.has(code) && courseState(record, plan, code) === null;
  const needed: { code: string; why: string }[] = [
    ...record.requiredLeft.map((c) => ({ code: c.code, why: t("planner.why.required") })),
    ...(spec?.courses ?? [])
      .filter((c) => open(c.code) || planned.has(c.code))
      .map((c) => ({ code: c.code, why: t("planner.why.specialization", { name: spec!.name }) })),
    ...(minor?.courses ?? []).filter((code) => open(code) || planned.has(code)).map((code) => ({ code, why: t("planner.why.minor", { name: minor!.name }) })),
  ].filter((x, i, all) => all.findIndex((y) => y.code === x.code) === i);
  const retakes = retakeCandidates(record);
  const q = query.trim().toLowerCase();
  const matches = (c: CourseInfo) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  const found = searchCourses(record, query);

  const row = (code: string, why?: string, retake?: { from: string; now: number | null; after: number | null }) => {
    const info = courseInfo(record, code);
    const st: CourseState = retake
      ? record.thisTerm.some((c) => c.code === code)
        ? "this-term"
        : planned.has(code)
          ? "planned"
          : null
      : courseState(record, plan, code);
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
        {!canAdd(st) && st ? (
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
      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as AddTab)} className="-mx-5 -my-5">
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
          {now && <p className="mt-2 text-caption text-info-fg">{t("planner.addToNowNote")}</p>}
          <TabBar
            value={tab}
            label={title}
            size="sm"
            tabs={(["needed", "program", "minors", "all"] as const).map((id) => ({ value: id, label: t(`planner.tab.${id}`) }))}
            className="mt-2 gap-5"
          />
        </div>
        {/* The lists aren't Tab stops of their own (Radix makes a panel one): Tab goes from the tab to the first course's button, and the search and tabs stay in view. */}
        <div className="min-h-[300px]">
          <Tabs.Content value="needed" tabIndex={-1}>
            <ul>{needed.map((x) => row(x.code, x.why))}</ul>
            {retakes.length > 0 && (
              <>
                <p className="px-5 pt-4 pb-1 text-caption font-semibold tracking-[0.04em] text-faint uppercase">{t("planner.retakes")}</p>
                <p className="px-5 pb-1 text-caption text-faint">{t("planner.retakeSumma")}</p>
                <ul>{retakes.map((r) => row(r.code, t("planner.why.grade", { grade: r.grade }), { from: r.grade, now: r.ipkNow, after: r.ipkWithA }))}</ul>
              </>
            )}
          </Tabs.Content>
          <Tabs.Content value="program" tabIndex={-1}>
            <ul>
              {programElectives(record)
                .filter(matches)
                .map((c) => row(c.code))}
            </ul>
          </Tabs.Content>
          <Tabs.Content value="minors" tabIndex={-1}>
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
                        const done = !canAdd(st);
                        return (
                          <li key={code}>
                            <button
                              type="button"
                              disabled={done}
                              title={courseInfo(record, code).name}
                              aria-label={done ? undefined : t("planner.addCode", { code })}
                              onClick={() => add(code, false)}
                              className={cx(
                                "focus-ring inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption font-semibold tabular-nums",
                                done ? "bg-success-bg text-success-fg" : "border border-edge bg-surface hover:bg-hover",
                              )}
                            >
                              {code}
                              {done ? <Icons.Check className="size-3" /> : <span aria-hidden>+</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
            </ul>
          </Tabs.Content>
          <Tabs.Content value="all" tabIndex={-1}>
            {q.length < 2 ? (
              <p className="px-5 py-6 text-center text-body text-muted">{t("planner.typeMore", { count: record.courses.size })}</p>
            ) : (
              <ul>
                {found.map((c) => row(c.code))}
                {found.length === 0 && <li className="px-5 py-6 text-center text-body text-muted">{t("planner.noMatch")}</li>}
              </ul>
            )}
          </Tabs.Content>
        </div>
        <p className="border-t border-line px-5 py-2 text-caption text-faint">{t("planner.catalogSource")}</p>
      </Tabs.Root>
    </Dialog>
  );
}
