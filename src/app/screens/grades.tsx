// Nilai (#78): where the Student stands. IPK, SKS passed, last IP and stage
// from SIX (SIX's figure, said plainly when the transcript rows disagree);
// IP per semester with this term and the planned ones as dashed estimates;
// the IPK at graduation and honors (Pasal 49) from the planner's projection;
// this term's expected grades and a target; the transcript by term with each
// row's standing; and SIX's questionnaire rule while it hides grades.
import { useState } from "react";
import { letterForAverage } from "../../core/honors";
import type { CalendarEvent, CheckedIndex, TranscriptTerm } from "../../core/models";
import { expectedGrade, type Need, project, type StudentRecord } from "../../core/planner";
import { useOpenExternal } from "../hooks";
import { useFormat, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { SixEmptyState } from "../shell/source-status";
import { type PlanState, usePlan, useStudentRecord } from "../study-plan";
import { useDataset } from "../store";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card, SectionTitle, SourceTag } from "../ui/display";
import { Icons } from "../ui/icons";
import { GradeSelect, HonorsList, ProjectedTable, useStepLabel } from "./plan/projection";

export const ready = true;

/** The count shown next to this screen in the sidebar, if any. */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  return null;
}

const SIX_WEB = "https://six.itb.ac.id";

/** SIX's figure when it shows one (it wins when the rows disagree), else the app's. */
const shownIndex = (index: CheckedIndex) => index.six ?? index.computed;

export function GradesScreen() {
  const t = useT();
  const record = useStudentRecord();
  const state = usePlan(record);
  if (!record || !state) {
    return (
      <div className="mx-auto max-w-[1080px] px-10 pt-7 pb-20">
        <h1 className="text-display font-semibold tracking-[-0.02em]">{t("nav.grades")}</h1>
        <div className="mt-6">
          <SixEmptyState icon={<Icons.GraduationCap className="size-5" />} title={t("grades.empty")} />
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[1080px] px-10 pt-7 pb-20">
      <header>
        <h1 className="text-display font-semibold tracking-[-0.02em]">{t("nav.grades")}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-small text-muted">
          {t("grades.from")} <SourceTag source="six" />
        </p>
      </header>
      <Standing record={record} />
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_360px] items-start gap-8">
        <IpChart state={state} />
        <Graduation record={record} state={state} />
      </div>
      <ThisTerm record={record} state={state} />
      <Transcript record={record} />
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-caption font-medium text-muted">{label}</p>
      <p className={cx("mt-1 font-semibold tracking-[-0.02em] tabular-nums", big ? "text-[30px] leading-9" : "text-[22px] leading-9")}>{value}</p>
    </Card>
  );
}

function Standing({ record }: { record: StudentRecord }) {
  const t = useT();
  const f = useFormat();
  const transcript = record.transcript!;
  const { ipk } = transcript;
  const num = (value: number | null) => (value === null ? "—" : f.number(value, 2));
  const lastIp = [...transcript.terms].reverse().map((term) => shownIndex(term.ip)).find((ip) => ip !== null) ?? null;
  const stage = record.progress?.stages.at(-1);
  return (
    <>
      {!ipk.agrees && (
        <p role="status" className="mt-5 flex items-start gap-2 rounded-lg bg-warning-bg px-3.5 py-2.5 text-small text-warning-fg">
          <Icons.AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {ipk.six !== null && Math.abs(ipk.six - (ipk.computed ?? -1)) > 0.005 + 1e-9 && t("grades.disagree", { six: num(ipk.six), computed: num(ipk.computed) })}{" "}
            {ipk.sixSks !== null && ipk.sixSks !== ipk.sks && t("grades.disagreeSks", { six: ipk.sixSks, rows: ipk.sks })}
          </span>
        </p>
      )}
      <div className="mt-6 grid grid-cols-4 gap-3">
        <Stat label={t("grades.ipk")} value={num(shownIndex(ipk))} big />
        <Stat label={t("grades.sksPassed")} value={String(record.passedSks)} />
        <Stat label={t("grades.lastIp")} value={num(lastIp)} />
        {stage && <Stat label={t("grades.stage", { name: stage.name.replace(/^Tahap\s+/i, "") })} value={t("grades.ipValue", { ip: num(shownIndex(stage.ip)) })} />}
      </div>
    </>
  );
}

function IpChart({ state }: { state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const label = useStepLabel();
  const steps = state.projection.steps.filter((s) => s.ip !== null);
  const height = (ip: number) => ({ height: `${Math.max(8, ((ip - 1.5) / 2.5) * 120)}px` });
  return (
    <Card className="p-5">
      <h2 className="flex items-baseline justify-between text-title font-semibold">
        {t("grades.chart")}
        <span className="inline-flex items-center gap-3 text-caption font-medium text-faint">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-info-bg" />
            {t("grades.final")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] border border-dashed border-accent" />
            {t("grades.estimate")}
          </span>
        </span>
      </h2>
      <ol aria-label={t("grades.chartLabel")} className="mt-5 flex h-[170px] items-end gap-2.5">
        {steps.map((step) => (
          <li key={step.term} className="flex min-w-0 flex-1 flex-col items-center gap-2" aria-label={`${label(step)}: IP ${f.number(step.ip!, 2)}${step.projected ? ` (${t("grades.estimate")})` : ""}`}>
            <span className={cx("text-caption font-semibold tabular-nums", step.projected && "text-accent-fg")}>{f.number(step.ip!, 2)}</span>
            <span
              aria-hidden
              className={cx("w-full max-w-[44px] rounded-md", step.projected ? "border-2 border-dashed border-accent bg-accent/10" : "bg-info-bg")}
              style={height(step.ip!)}
            />
            <span className={cx("text-caption whitespace-nowrap tabular-nums", step.projected ? "font-semibold text-accent-fg" : "text-faint")}>{label(step)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Graduation({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const nav = useNav();
  const { projection, plan } = state;
  const planned = plan.terms.flatMap((term) => term.courses.filter((c) => !c.retake)).reduce((sum, c) => sum + c.sks, 0);
  const final = projection.finalIpk;
  const predicate = projection.honor ? t(`honors.${projection.honor}`) : final === null ? null : final > 2.75 ? t("grades.predicate.veryGood") : final >= 2 ? t("grades.predicate.good") : null;
  return (
    <Card className="flex flex-col p-5">
      <h2 className="flex items-center gap-2 text-title font-semibold">
        <Icons.Flag className="size-4 text-warning-fg" />
        {t("grades.graduation")}
      </h2>
      <p className="mt-1 text-small text-muted">{t("grades.graduationFrom", { now: record.inProgressSks, planned })}</p>
      <p className="mt-4 text-[34px] leading-10 font-semibold tracking-[-0.02em] tabular-nums">{final === null ? "—" : f.number(final, 2)}</p>
      {predicate && <p className={cx("text-small font-semibold", projection.honor ? "text-success-fg" : "text-muted")}>{predicate}</p>}
      <div className="mt-3">
        <ProjectedTable steps={projection.steps} />
      </div>
      <HonorsList projection={projection} className="mt-2" />
      <Button className="mt-4" onClick={() => nav.go({ screen: "plan", tab: "planner" })}>
        {t("grades.toPlanner")}
        <Icons.ChevronRight className="size-4" />
      </Button>
    </Card>
  );
}

function ThisTerm({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const nav = useNav();
  const outline = useDataset("edunex.outline");
  const { plan, update } = state;
  if (!record.term || !record.thisTerm.length) return null;
  // This term alone: what the IPK becomes and what a target needs from its courses.
  const termOnly = project(record, { ...plan, terms: [] });
  const after = termOnly.steps.find((s) => s.term === record.term)?.ipk ?? null;
  const goal = plan.target ?? nearestTarget(record);
  const need = termOnly.need(goal);
  const setGoal = (value: number) => update((p) => ({ ...p, target: value }));
  return (
    <section className="mt-10">
      <SectionTitle>{t("grades.thisTerm")}</SectionTitle>
      <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-8">
        <Card className="overflow-hidden">
          <ul>
            {record.thisTerm.map((course, i) => {
              const published = outline?.[course.code]?.grade ?? null;
              return (
                <li key={course.code} className={cx("grid grid-cols-[76px_minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-2.5 text-body", i > 0 && "border-t border-line")}>
                  <span className="font-semibold tabular-nums">{course.code}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{course.name}</span>
                    <span className="block text-caption text-muted">
                      {course.sks} SKS ·{" "}
                      {published ? t("grades.edunexGrade", { total: f.number(published.total, 1), letter: published.letter }) : t("grades.edunexHidden")}
                    </span>
                  </span>
                  <Button variant="ghost" size="sm" className="text-accent-fg" onClick={() => nav.go({ screen: "course", code: course.code, tab: "grades" })}>
                    {t("grades.whatNeed")}
                    <Icons.ChevronRight className="size-3.5" />
                  </Button>
                  {course.grade ? (
                    <span className="inline-flex h-7 w-[62px] items-center justify-center gap-1 rounded-md bg-success-bg text-small font-bold text-success-fg" title={t("grades.sixGrade")}>
                      {course.grade}
                    </span>
                  ) : (
                    <GradeSelect
                      label={t("grades.expectedOf", { code: course.code })}
                      value={expectedGrade(record, plan, course.code)}
                      onChange={(grade) => update((p) => ({ ...p, expected: { ...p.expected, [course.code]: grade } }))}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line bg-fill/60 px-4 py-3" aria-live="polite">
            <p className="text-body">
              {t("grades.ipkAfter")} <span className="text-lead font-semibold tabular-nums">{after === null ? "—" : f.number(after, 2)}</span>
            </p>
            <label className="flex items-center gap-2 text-small text-muted">
              {t("grades.target")}
              <input
                type="number"
                min={0}
                max={4}
                step={0.01}
                value={goal}
                aria-label={t("grades.target")}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value) && value >= 0 && value <= 4) setGoal(Math.round(value * 100) / 100);
                }}
                className="focus-ring h-7 w-[72px] rounded-md bg-surface px-2 text-right font-semibold text-fg tabular-nums ring-1 ring-edge"
              />
            </label>
            <p className="w-full text-small text-muted" role="status">
              <TargetText need={need} sks={record.inProgressSks} />
            </p>
          </div>
        </Card>
        <TermNotes record={record} />
      </div>
    </section>
  );
}

/** A starting target: the next honors line above the IPK, else the next 0.25. */
function nearestTarget(record: StudentRecord): number {
  const ipk = record.transcript?.ipk.computed ?? 0;
  return [3, 3.25, 3.5, 3.75, 3.85, 4].find((v) => v > ipk + 1e-9) ?? 4;
}

function TargetText({ need, sks }: { need: Need; sks: number }) {
  const t = useT();
  const f = useFormat();
  if (need.kind === "none") return <>{t("grades.targetNone")}</>;
  if (need.kind === "secured") return <span className="font-semibold text-success-fg">{t("grades.targetSecured")}</span>;
  if (need.kind === "out") return <span className="font-semibold text-danger-fg">{t("grades.targetOut")}</span>;
  return <>{t("grades.targetNeed", { avg: f.number(need.average, 2), letter: letterForAverage(need.average), sks })}</>;
}

/** SIX's rule about hidden grades, timed to ITB's questionnaire window, and the grade deadline. */
function TermNotes({ record }: { record: StudentRecord }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const open = useOpenExternal();
  const calendar = useDataset("itb.calendar");
  const student = useDataset("six.student");
  const pending = record.thisTerm.some((c) => c.grade === null);
  const of = (kind: CalendarEvent["kind"]) => calendar?.events.find((e) => e.kind === kind && e.term === record.term && e.end > now);
  const questionnaire = pending ? of("questionnaire") : undefined;
  const deadline = pending ? of("grade-deadline") : undefined;
  const during = questionnaire && questionnaire.start <= now;
  const questionnaireUrl = student ? `${SIX_WEB}/app/mahasiswa:${student.nim}+${record.term}/evaluasi/kuesioner` : SIX_WEB;
  return (
    <ul className="space-y-2.5 text-small text-muted">
      {during && (
        <li className="rounded-lg bg-warning-bg px-3 py-2.5 text-warning-fg" role="status">
          <span className="flex items-start gap-2">
            <Icons.ClipboardCheck className="mt-0.5 size-3.5 shrink-0" />
            {t("grades.questionnaireNow", { date: f.dayMonth(questionnaire.end - 1) })}
          </span>
          <Button size="sm" className="mt-2 ml-5" onClick={() => open(questionnaireUrl)}>
            {t("grades.openSix")}
            <Icons.ArrowUpRight className="size-3.5" />
          </Button>
        </li>
      )}
      {questionnaire && !during && (
        <li className="flex items-start gap-2">
          <Icons.ClipboardCheck className="mt-0.5 size-3.5 shrink-0" />
          {t("grades.questionnaireSoon", { start: f.dayMonth(questionnaire.start), end: f.dayMonth(questionnaire.end - 1) })}
        </li>
      )}
      <li className="flex items-start gap-2">
        <Icons.EyeOff className="mt-0.5 size-3.5 shrink-0" />
        {t("grades.placeholder")}
      </li>
      {deadline && (
        <li className="flex items-start gap-2">
          <Icons.Calendar className="mt-0.5 size-3.5 shrink-0" />
          {t("grades.gradeDeadline", { date: f.dayMonth(deadline.start) })}
        </li>
      )}
    </ul>
  );
}

const GRADE_TONE: Record<string, string> = {
  A: "bg-success-bg text-success-fg",
  AB: "bg-success-bg text-success-fg",
  B: "bg-info-bg text-info-fg",
  BC: "bg-info-bg text-info-fg",
  C: "bg-warning-bg text-warning-fg",
};

function Transcript({ record }: { record: StudentRecord }) {
  const t = useT();
  const terms = record.transcript!.terms;
  const lastGraded = [...terms].reverse().find((term) => term.ip.computed !== null)?.term ?? null;
  const [open, setOpen] = useState<string | null>(lastGraded);
  return (
    <section className="mt-10">
      <SectionTitle>{t("grades.transcript")}</SectionTitle>
      <Card className="overflow-hidden">
        <ul>
          {[...terms].reverse().map((term, i) => (
            <TermRow key={term.term} term={term} first={i === 0} open={open === term.term} onToggle={() => setOpen(open === term.term ? null : term.term)} />
          ))}
        </ul>
      </Card>
    </section>
  );
}

function TermRow({ term, first, open, onToggle }: { term: TranscriptTerm; first: boolean; open: boolean; onToggle: () => void }) {
  const t = useT();
  const f = useFormat();
  const ip = shownIndex(term.ip);
  const num = (value: number | null) => (value === null ? "—" : f.number(value, 2));
  return (
    <li className={cx(!first && "border-t border-line")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hover">
        <Icons.ChevronRight className={cx("size-4 text-faint transition-transform duration-150", open && "rotate-90")} />
        <span className="flex-1 text-body font-medium">{f.term(term.term)}</span>
        {!term.ip.agrees && (
          <span className="inline-flex items-center gap-1 text-caption font-medium text-warning-fg">
            <Icons.AlertTriangle className="size-3" />
            {t("grades.termDisagree", { six: num(term.ip.six), computed: num(term.ip.computed) })}
          </span>
        )}
        <span className="text-small text-muted">{t("grades.courseCount", { count: term.courses.length })}</span>
        <span className="w-[72px] text-right text-body font-semibold tabular-nums">{ip === null ? "—" : t("grades.ipValue", { ip: num(ip) })}</span>
      </button>
      {open && (
        <ul className="border-t border-line bg-fill/50 px-4 py-2">
          {term.courses.map((course) => (
            <li key={`${course.code}-${course.attempt}`} className="grid grid-cols-[84px_minmax(0,1fr)_auto_56px_48px] items-center gap-3 py-1.5 text-body">
              <span className="font-semibold tabular-nums">{course.code}</span>
              <span className="truncate">{course.name}</span>
              <span className="flex justify-end gap-1.5">
                {course.attempt > 1 && <Tag>{t("grades.retaken")}</Tag>}
                {course.standing !== "counted" && <Tag tone={course.standing === "pending" ? "neutral" : "warning"}>{t(`grades.standing.${course.standing}`)}</Tag>}
              </span>
              <span className="text-right text-muted tabular-nums">{course.sks} SKS</span>
              <span className="text-right">
                {course.grade ? (
                  <span
                    className={cx(
                      "inline-grid min-w-8 place-items-center rounded-md px-1.5 py-0.5 text-small font-bold",
                      GRADE_TONE[course.grade] ?? "bg-danger-bg text-danger-fg",
                      course.standing === "replaced" && "line-through opacity-70",
                    )}
                  >
                    {course.grade}
                  </span>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Tag({ tone = "neutral", children }: { tone?: "neutral" | "warning"; children: string }) {
  return (
    <span className={cx("inline-flex h-[18px] items-center rounded px-1.5 text-micro font-semibold whitespace-nowrap", tone === "warning" ? "bg-warning-bg text-warning-fg" : "bg-neutral-bg text-neutral-fg")}>
      {children}
    </span>
  );
}
