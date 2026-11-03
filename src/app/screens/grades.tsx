// Nilai (#78): where the Student stands, answered first. The IPK as the one
// big figure, the facts around it beside it as figures with a word or two
// (where the grades they expect would take them by graduation, SKS passed,
// last IP, the highest IPK still possible), each said once, what's behind each
// a tooltip away (honors behind the predicate; the ladder lives in the
// planner); IP and IPK per semester on one chart with the target; this term's
// grades as a clearly marked what-if with the one shared target; and the
// transcript by term. Without SIX, this term's courses from Edunex with their
// calculators, and what signing in to SIX unlocks.
import { type ReactNode, useId } from "react";
import type { CalendarEvent, CheckedIndex, TranscriptTerm } from "../../core/models";
import {
  checkPlan,
  expectedGrade,
  hasWhatIfs,
  honorsOutlook,
  type Projection,
  passedSks,
  project,
  type StudentRecord,
  sksModel,
  targetOf,
} from "../../core/planner";
import { useTermCourses } from "../courses";
import { useOpenExternal } from "../hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../i18n";
import { useNav, usePlaceState } from "../nav";
import { SixPageNote, UnreadNote } from "../six-page-note";
import { useDataset } from "../store";
import { type PlanState, usePlan, useStudentRecord } from "../study-plan";
import { Button, IconButton } from "../ui/controls";
import { cx } from "../ui/cx";
import { CourseCode, Tag } from "../ui/display";
import { Explained } from "../ui/explain";
import { Icons } from "../ui/icons";
import { breakAfterSlashes, List, Meta, Notice, Page, PageHeader, Row, Section } from "../ui/layout";
import { AnimatedNumber } from "../ui/motion/animated-number";
import { DisclosurePanel, disclosureTrigger } from "../ui/motion/disclosure";
import { Tooltip } from "../ui/overlays";
import { PLAIN_LIST } from "./plain-list";
import {
  effortKey,
  GradeBadge,
  GradeSelect,
  HonorsSentence,
  IpkChart,
  NeedText,
  predicateFor,
  TargetControl,
  usePredicate,
  useTermName,
} from "./plan/projection";
import { SixNeeded } from "./plan/six-needed";

const SIX_WEB = "https://six.itb.ac.id";

/** SIX's figure when it shows one (it wins when the rows disagree), else the app's. */
const shownIndex = (index: CheckedIndex) => index.six ?? index.computed;

export function GradesScreen() {
  const t = useT();
  const nav = useNav();
  const record = useStudentRecord();
  // SIX's own record: the planner's what-ifs for this term stay in the planner.
  const state = usePlan(record, false);
  if (!record || !state) return <WithoutSix />;
  return (
    <Page className="@container">
      <PageHeader title={t("nav.grades")} className="mb-6" />
      <div className="mb-6 space-y-2 empty:hidden">
        <SixPageNote datasets={["six.transcript", "six.progress"]} />
        <UnreadNote record={record} />
      </div>
      <Disagreement record={record} />
      <Standing record={record} state={state} />
      {/* The guide points here (shell/guide.tsx). */}
      <section aria-labelledby="grades-chart" data-guide="grades-outlook" className="mt-12">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 id="grades-chart" className="text-title font-semibold tracking-[-0.01em]">
            {t("grades.chart")}
          </h2>
          <Button onClick={() => nav.go({ screen: "plan", tab: "planner" })}>
            {t("grades.toPlanner")}
            <Icons.ChevronRight className="size-4" />
          </Button>
        </div>
        {/* The IPK at graduation is said in words above: the chart's end isn't labelled with it again. */}
        <IpkChart steps={state.projection.steps} target={targetOf(record, state.plan)} endLabel={false} />
        {/* Honors sit behind the IPK at graduation above; with no IPK at graduation to hang them on, they're said here. */}
        {state.projection.finalIpk === null && <HonorsSentence projection={state.projection} className="mt-3" />}
        {hasWhatIfs(state.plan, record) && <p className="mt-3 text-caption text-muted">{t("grades.withoutWhatIfs")}</p>}
      </section>
      <ThisTerm record={record} state={state} />
      <Transcript record={record} />
    </Page>
  );
}

function Disagreement({ record }: { record: StudentRecord }) {
  const t = useT();
  const f = useFormat();
  const { ipk } = record.transcript!;
  if (ipk.agrees) return null;
  const num = (value: number | null) => (value === null ? "-" : f.number(value, 2));
  return (
    <Notice tone="warning" title={t("grades.disagreeTitle")} className="mb-6">
      <span role="status">
        {ipk.six !== null &&
          Math.abs(ipk.six - (ipk.computed ?? -1)) > 0.005 + 1e-9 &&
          t("grades.disagree", { six: num(ipk.six), computed: num(ipk.computed) })}{" "}
        {ipk.sixSks !== null && ipk.sixSks !== ipk.sks && t("grades.disagreeSks", { six: ipk.sixSks, rows: ipk.sks })}
      </span>
    </Notice>
  );
}

/**
 * The honors outlook in one positive sentence, as the planner's HonorsSentence says it: the first level still open
 * and what it needs, or that cum laude is out of reach. A string, for the tooltip behind the predicate.
 */
function honorsWhy(t: Translate, f: Format, projection: Projection): string {
  const outlook = honorsOutlook(projection).reverse(); // cum, magna, summa
  const secured = [...outlook].reverse().find((h) => h.kind === "secured");
  const next = outlook.find((h) => h.kind === "needs");
  const securedText = secured ? t("grades.honorsSecured", { level: t(`honors.${secured.level}`) }) : null;
  if (next && next.kind === "needs") {
    const needs = t("grades.honorsNeeds", {
      level: t(`honors.${next.level}`),
      avg: f.number(next.average, 2),
      sks: projection.variableSks,
      effort: t(effortKey(next.average)),
    });
    return securedText ? `${securedText} ${needs}` : needs;
  }
  if (securedText) return securedText;
  const cum = outlook.find((h) => h.level === "cum")!;
  return t("grades.honorsOut", { min: f.number(cum.min, 2) });
}

/**
 * The IPK, the one big figure on the page, and beside it the facts around it, each a figure and a word or two:
 * where the grades the Student expects lead by graduation, SKS passed, last semester's IP, the highest IPK still
 * possible. What's behind a figure (honors, the semester it's compared with, the A's it takes) is a tooltip away.
 */
function Standing({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const predicate = usePredicate();
  const termName = useTermName(record);
  const transcript = record.transcript!;
  const num = (value: number | null) => (value === null ? "-" : f.number(value, 2));
  /** "Smt 6", without its years. */
  const short = (term: string) => termName(term).split(" · ")[0];
  const ipk = shownIndex(transcript.ipk);
  const graded = transcript.terms.filter((term) => term.term !== record.term && shownIndex(term.ip) !== null);
  const last = graded.at(-1);
  const before = graded.at(-2);
  const lastIp = last ? shownIndex(last.ip) : null;
  const beforeIp = before ? shownIndex(before.ip) : null;
  const delta = lastIp !== null && beforeIp !== null ? lastIp - beforeIp : null;
  const signed = (value: number) => `${value > 0.004 ? "+" : value < -0.004 ? "−" : "±"}${f.number(Math.abs(value), 2)}`;
  const sks = sksModel(record, state.plan);
  const { projection, plan } = state;
  const { bestIpk, variableSks, finalIpk } = projection;
  const word = predicate(predicateFor(finalIpk, projection.path));
  const finish = checkPlan(record, plan, projection).find((r) => r.id === "finish");
  const lastTerm = [...plan.terms].reverse().find((term) => term.courses.length)?.term ?? record.term;
  const blocked = finish?.level === "error";
  const honors = honorsWhy(t, f, projection);
  return (
    <section aria-label={t("grades.standing")} className="grid grid-cols-1 items-start gap-x-14 gap-y-5 @2xl:grid-cols-[auto_minmax(0,1fr)]">
      <div>
        <p className="text-small font-medium text-muted">{t("grades.ipkNow")}</p>
        <p className="text-hero font-semibold tracking-[-0.02em] tabular-nums">{num(ipk)}</p>
      </div>
      <dl className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-small @2xl:pt-0.5">
        {finalIpk !== null && (
          <Fact
            label={t("grades.graduationLabel")}
            // With no predicate to hang it on, the honors outlook goes behind the label.
            why={word ? undefined : honors}
            value={<AnimatedNumber value={finalIpk} format={(value) => f.number(value, 2)} />}
            hint={
              <Meta>
                {word ? <Explained text={word} why={honors} className={cx(projection.honor && "text-success-fg")} /> : null}
                {blocked ? (
                  <span className="inline-flex items-center gap-1 text-warning-fg">
                    <Icons.AlertTriangle className="size-3.5 shrink-0" />
                    {t("grades.graduationBlocked")}
                  </span>
                ) : finish && lastTerm ? (
                  t("grades.graduationWhen", { term: short(lastTerm) })
                ) : null}
              </Meta>
            }
          />
        )}
        <Fact label={t("grades.sksPassed")} value={String(passedSks(record) ?? "-")} hint={t("grades.sksPassedHint", { need: sks.need })} />
        <Fact
          label={t("grades.lastIp")}
          value={num(lastIp)}
          hint={
            last ? (
              delta === null || !before ? (
                short(last.term)
              ) : (
                <Explained
                  text={signed(delta)}
                  why={t("grades.lastIpWhy", { term: short(last.term), before: short(before.term), ip: num(beforeIp) })}
                  className="tabular-nums"
                />
              )
            ) : undefined
          }
        />
        <Fact label={t("grades.best")} why={variableSks ? t("grades.bestHint", { sks: variableSks }) : t("grades.bestNone")} value={num(bestIpk)} />
      </dl>
    </section>
  );
}

/** One quiet fact beside the IPK: its name (with what's behind it a tooltip away), its figure, and a word or two. */
function Fact({ label, why, value, hint }: { label: string; why?: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="col-span-3 grid grid-cols-subgrid items-start">
      <dt className="text-muted">{why ? <Explained text={label} why={why} /> : label}</dt>
      <dd className="text-right font-semibold tabular-nums">{value}</dd>
      <dd className="min-w-0 text-muted">{hint}</dd>
    </div>
  );
}

function ThisTerm({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const nav = useNav();
  const outline = useDataset("edunex.outline");
  const { plan, update } = state;
  if (!record.term || !record.thisTerm.length) return null;
  // This term alone: what the IPK becomes and what the target needs from its courses.
  const termOnly = project(record, { ...plan, terms: [] });
  const after = termOnly.steps.find((s) => s.term === record.term)?.ipk ?? null;
  const goal = targetOf(record, plan);
  const pending = record.thisTerm.some((c) => c.grade === null);
  const hidden = record.thisTerm.some((c) => c.grade === null && !outline?.[c.code]?.grade);
  return (
    <Section id="this-term" title={t("grades.thisTerm")} description={pending ? t("grades.whatIf") : undefined}>
      <div className="grid grid-cols-1 items-start gap-6 @3xl:grid-cols-[minmax(0,1fr)_288px]">
        <div className="min-w-0">
          <List label={t("grades.thisTerm")} className={PLAIN_LIST}>
            {record.thisTerm.map((course) => {
              const published = outline?.[course.code]?.grade ?? null;
              return (
                <Row
                  key={course.code}
                  leading={<span className="w-[60px] text-small font-semibold tabular-nums">{course.code}</span>}
                  title={course.name}
                  meta={
                    <Meta>
                      {t("curriculum.sks", { sks: course.sks })}
                      {published ? t("grades.edunexGrade", { total: f.number(published.total, 1), letter: published.letter }) : ""}
                    </Meta>
                  }
                  trailing={
                    <span className="flex items-center gap-2">
                      {/* Quiet: one per course, its words a tooltip away, so a column of "Butuh berapa?" doesn't outshout the grades beside it. */}
                      <Tooltip content={t("grades.whatNeed")}>
                        <IconButton
                          size="sm"
                          label={`${t("grades.whatNeed")} ${course.code}`}
                          onClick={() => nav.go({ screen: "course", code: course.code, tab: "grades" })}
                        >
                          <Icons.Target className="size-4" />
                        </IconButton>
                      </Tooltip>
                      {course.grade ? (
                        <GradeBadge grade={course.grade} title={t("grades.sixGrade")} />
                      ) : (
                        <GradeSelect
                          label={t("grades.expectedOf", { code: course.code })}
                          value={expectedGrade(record, plan, course.code)}
                          guess={plan.expected[course.code] === undefined}
                          onChange={(grade) => update((p) => ({ ...p, expected: { ...p.expected, [course.code]: grade } }))}
                        />
                      )}
                    </span>
                  }
                />
              );
            })}
            <li className="space-y-2.5 bg-sunken px-4 py-3.5" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <p className="text-body">
                  {t("grades.ipkAfter")} <span className="ml-1 text-lead font-semibold tabular-nums">{after === null ? "-" : f.number(after, 2)}</span>
                </p>
                <TargetControl record={record} state={state} />
              </div>
              <p className="text-small text-muted" role="status">
                <NeedText need={termOnly.need(goal)} target={goal} sks={record.inProgressSks} scope="term" />
              </p>
            </li>
          </List>
          {hidden && <p className="mt-2 text-caption text-faint">{t("grades.edunexNote")}</p>}
        </div>
        <TermNotes record={record} />
      </div>
    </Section>
  );
}

/** ITB's questionnaire window and the grade deadline, each a few words with SIX's rule behind it a tooltip away. */
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
  if (!questionnaire && !deadline) return null;
  const questionnaireUrl = student ? `${SIX_WEB}/app/mahasiswa:${student.nim}+${record.term}/evaluasi/kuesioner` : SIX_WEB;
  return (
    <div className="space-y-3">
      {during && (
        <Notice
          tone="warning"
          icon={<Icons.ClipboardCheck className="size-4" />}
          title={t("grades.questionnaireNow", { date: f.dayMonth(questionnaire.end - 1) })}
        >
          <Button size="sm" className="mt-2" onClick={() => open(questionnaireUrl)}>
            {t("grades.openSix")}
            <Icons.ArrowUpRight className="size-3.5" />
          </Button>
        </Notice>
      )}
      <ul className="space-y-2.5 text-small text-muted">
        {questionnaire && !during && (
          <li className="flex items-start gap-2">
            <Icons.ClipboardCheck className="mt-0.5 size-3.5 shrink-0" />
            <Explained
              text={t("grades.questionnaireSoon", { start: f.dayMonth(questionnaire.start), end: f.dayMonth(questionnaire.end - 1) })}
              why={t("grades.questionnaireWhy")}
              className="text-left"
            />
          </li>
        )}
        {deadline && (
          <li className="flex items-start gap-2">
            <Icons.Calendar className="mt-0.5 size-3.5 shrink-0" />
            <Explained
              text={t("grades.gradeDeadline", { date: f.dayMonth(deadline.start) })}
              why={t("grades.gradeDeadlineWhy", { date: f.dayMonth(deadline.start) })}
              className="text-left"
            />
          </li>
        )}
      </ul>
    </div>
  );
}

function Transcript({ record }: { record: StudentRecord }) {
  const t = useT();
  const terms = record.transcript!.terms;
  // Every semester starts closed (its IP on the row is the answer; its courses a click away), oldest first.
  const [open, setOpen] = usePlaceState<string | null>("grades.open", null);
  return (
    <Section id="transcript" title={t("grades.transcript")}>
      <List label={t("grades.transcript")} className={PLAIN_LIST}>
        {/* This semester, still without an IP, is Semester ini above: not a row here again. */}
        {terms
          .filter((term) => !(term.term === record.term && shownIndex(term.ip) === null && record.thisTerm.length > 0))
          .map((term) => (
            <TermRow key={term.term} record={record} term={term} open={open === term.term} onToggle={() => setOpen(open === term.term ? null : term.term)} />
          ))}
      </List>
    </Section>
  );
}

function TermRow({ record, term, open, onToggle }: { record: StudentRecord; term: TranscriptTerm; open: boolean; onToggle: () => void }) {
  const t = useT();
  const f = useFormat();
  const termName = useTermName(record);
  const ip = shownIndex(term.ip);
  const num = (value: number | null) => (value === null ? "-" : f.number(value, 2));
  const now = term.term === record.term && ip === null;
  const id = useId();
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        {...disclosureTrigger(open, id)}
        className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hover focus-visible:-outline-offset-2"
      >
        <Icons.ChevronRight className={cx("size-4 text-faint transition-transform duration-quick", open && "rotate-90")} />
        <span className="flex-1 text-body font-medium">{termName(term.term)}</span>
        {!term.ip.agrees && (
          <span className="inline-flex items-center gap-1 text-caption font-medium text-warning-fg">
            <Icons.AlertTriangle className="size-3" weight="bold" />
            {t("grades.termDisagree", { six: num(term.ip.six), computed: num(term.ip.computed) })}
          </span>
        )}
        <span className={cx("w-[84px] text-right tabular-nums", now ? "text-small text-muted" : "text-body font-semibold")}>
          {now ? t("grades.inProgress") : `IP ${num(ip)}`}
        </span>
      </button>
      <DisclosurePanel open={open} id={id}>
        {/* In a narrow list (the window zoomed in) a course's tags and SKS go on a line under its name, its grade staying on the row. */}
        <ul className="@container border-t border-line bg-sunken px-4 py-2">
          {term.courses.map((course) => (
            <li
              key={`${course.code}-${course.attempt}`}
              className="grid grid-cols-[84px_minmax(0,1fr)_auto_56px_40px] items-center gap-3 py-1.5 text-body @max-md:grid-cols-[84px_minmax(0,1fr)_40px] @max-md:gap-y-1"
            >
              <span className="text-small font-semibold tabular-nums">{course.code}</span>
              {/* As a kit Row's title: a long name wraps (after a "/" too) and shows whole on hover. */}
              <span className="line-clamp-2 block break-words" title={course.name}>
                {breakAfterSlashes(course.name)}
              </span>
              <span className="contents @max-md:col-start-2 @max-md:row-start-2 @max-md:flex @max-md:flex-wrap @max-md:items-center @max-md:gap-1.5 @max-md:[&>:empty]:hidden">
                <span className="flex justify-end gap-1.5">
                  {course.attempt > 1 && <Tag>{t("grades.retaken")}</Tag>}
                  {course.standing !== "counted" && (
                    <Tag tone={course.standing === "pending" || course.standing === "unknown" ? "neutral" : "warning"}>
                      {t(`grades.standing.${course.standing}`)}
                    </Tag>
                  )}
                </span>
                <span className="text-right text-small text-muted tabular-nums">{course.sks ?? "-"} SKS</span>
              </span>
              <span className="text-right">
                {course.grade ? <GradeBadge grade={course.grade} struck={course.standing === "replaced"} /> : <span className="text-faint">-</span>}
              </span>
            </li>
          ))}
        </ul>
      </DisclosurePanel>
    </li>
  );
}

// ------------------------------------------------------------ without SIX

/** This term's courses from Edunex, each with its calculator, and what SIX would add. */
function WithoutSix() {
  const t = useT();
  const nav = useNav();
  const f = useFormat();
  const courses = useTermCourses();
  const outline = useDataset("edunex.outline");
  const anyGrade = courses?.some((c) => outline?.[c.code]?.grade) ?? false;
  return (
    <Page>
      <PageHeader title={t("nav.grades")} />
      <SixNeeded
        datasets={["six.transcript", "six.progress"]}
        icon={<Icons.GraduationCap className="size-5" />}
        title={t("grades.needSix")}
        body={t("grades.needSixBody")}
      />
      {courses && courses.length > 0 && (
        // With no grade published anywhere, that's said once above the list, not on every row.
        <Section id="edunex-term" title={t("grades.edunexTerm")} description={t(anyGrade ? "grades.edunexTermHint" : "grades.edunexTermNoneHint")}>
          <List label={t("grades.edunexTerm")} className={PLAIN_LIST}>
            {courses.map((course) => {
              const grade = outline?.[course.code]?.grade ?? null;
              return (
                <Row
                  key={course.code}
                  leading={<CourseCode code={course.code} color={course.color} className="w-[76px] text-small" />}
                  title={course.name}
                  meta={
                    grade ? t("grades.edunexGrade", { total: f.number(grade.total, 1), letter: grade.letter }) : anyGrade ? t("grades.edunexNone") : undefined
                  }
                  trailing={<span className="text-small font-medium text-muted">{t("grades.whatNeed")}</span>}
                  onClick={() => nav.go({ screen: "course", code: course.code, tab: "grades" })}
                />
              );
            })}
          </List>
        </Section>
      )}
    </Page>
  );
}
