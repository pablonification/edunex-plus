// Nilai (#78): where the Student stands, answered first. The IPK and where
// the grades they expect would take them, in one sentence; four equal
// figures (IPK, SKS passed, last IP, the highest IPK still possible); IP and
// IPK per semester on one chart with the target; the IPK at graduation with
// honors in one positive sentence (the ladder lives in the planner); this
// term's grades as a clearly marked what-if with the one shared target; and
// the transcript by term. Without SIX, this term's courses from Edunex with
// their calculators, and what signing in to SIX unlocks.
import { useState } from "react";
import type { CalendarEvent, CheckedIndex, TranscriptTerm } from "../../core/models";
import { checkPlan, expectedGrade, project, sksModel, type StudentRecord, targetOf } from "../../core/planner";
import { useTermCourses } from "../courses";
import { useOpenExternal } from "../hooks";
import { useFormat, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { type PlanState, usePlan, useStudentRecord } from "../study-plan";
import { useDataset } from "../store";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card, CourseCode } from "../ui/display";
import { Icons } from "../ui/icons";
import { Flash } from "../ui/motion";
import { List, Meta, Notice, Page, PageHeader, Row, Section, Stat } from "../ui/layout";
import { GradeBadge, GradeSelect, HonorsSentence, IpkChart, NeedText, predicateFor, TargetControl, usePredicate, useTermName } from "./plan/projection";
import { SixNeeded } from "./plan/six-needed";

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
  if (!record || !state) return <WithoutSix />;
  return (
    <Page className="@container">
      <Answer record={record} state={state} />
      <Disagreement record={record} />
      <Standing record={record} state={state} />
      <div className="mt-10 grid grid-cols-1 items-start gap-6 @3xl:grid-cols-[minmax(0,1fr)_288px]">
        <Card className="min-w-0 px-5 pt-4 pb-4">
          <h2 className="mb-3 text-title font-semibold tracking-[-0.01em]">{t("grades.chart")}</h2>
          <IpkChart steps={state.projection.steps} target={targetOf(record, state.plan)} />
        </Card>
        <Graduation record={record} state={state} />
      </div>
      <ThisTerm record={record} state={state} />
      <Transcript record={record} />
    </Page>
  );
}

/** The one line that answers "where is my IPK", under the title. */
function Answer({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const predicate = usePredicate();
  const ipk = shownIndex(record.transcript!.ipk);
  const { finalIpk, path, variableSks } = state.projection;
  const word = predicate(predicateFor(finalIpk, path));
  return (
    <PageHeader
      title={t("nav.grades")}
      description={
        <>
          <span className="font-medium text-fg">{t("grades.answer", { ipk: ipk === null ? "—" : f.number(ipk, 2) })}</span>{" "}
          {variableSks > 0 && finalIpk !== null && word && t("grades.answerFinal", { final: f.number(finalIpk, 2), predicate: word.toLowerCase() })}
        </>
      }
    />
  );
}

function Disagreement({ record }: { record: StudentRecord }) {
  const t = useT();
  const f = useFormat();
  const { ipk } = record.transcript!;
  if (ipk.agrees) return null;
  const num = (value: number | null) => (value === null ? "—" : f.number(value, 2));
  return (
    <Notice tone="warning" title={t("grades.disagreeTitle")} className="mb-6">
      <span role="status">
        {ipk.six !== null && Math.abs(ipk.six - (ipk.computed ?? -1)) > 0.005 + 1e-9 && t("grades.disagree", { six: num(ipk.six), computed: num(ipk.computed) })}{" "}
        {ipk.sixSks !== null && ipk.sixSks !== ipk.sks && t("grades.disagreeSks", { six: ipk.sixSks, rows: ipk.sks })}
      </span>
    </Notice>
  );
}

function Standing({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const termName = useTermName(record);
  const predicate = usePredicate();
  const transcript = record.transcript!;
  const num = (value: number | null) => (value === null ? "—" : f.number(value, 2));
  const graded = transcript.terms.filter((term) => term.term !== record.term && shownIndex(term.ip) !== null);
  const last = graded.at(-1);
  const before = graded.at(-2);
  const lastIp = last ? shownIndex(last.ip) : null;
  const delta = lastIp !== null && before ? lastIp - shownIndex(before.ip)! : null;
  const signed = (value: number) => `${value > 0.004 ? "+" : value < -0.004 ? "−" : "±"}${f.number(Math.abs(value), 2)}`;
  const sks = sksModel(record, state.plan);
  const { bestIpk, variableSks } = state.projection;
  // Honors are a graduation word; today's IPK gets the plain predicate.
  const nowWord = predicate(predicateFor(shownIndex(transcript.ipk), { retakes: true, semesters: 99 }));
  return (
    <div className="grid grid-cols-2 gap-3 @4xl:grid-cols-4">
      <Stat className="flex flex-col [&>div:first-child]:flex-1" label={t("grades.ipk")} value={num(shownIndex(transcript.ipk))} hint={nowWord ?? undefined} />
      <Stat className="flex flex-col [&>div:first-child]:flex-1" label={t("grades.sksPassed")} value={String(record.passedSks)} hint={t("grades.sksPassedHint", { need: sks.need })} />
      <Stat
        className="flex flex-col [&>div:first-child]:flex-1"
        label={t("grades.lastIp")}
        value={num(lastIp)}
        hint={last ? (delta === null ? termName(last.term) : t("grades.lastIpHint", { term: termName(last.term).split(" · ")[0], delta: signed(delta) })) : undefined}
      />
      <Stat
        className="flex flex-col [&>div:first-child]:flex-1"
        label={t("grades.best")}
        value={num(bestIpk)}
        hint={variableSks ? t("grades.bestHint", { sks: variableSks }) : t("grades.bestNone")}
      />
    </div>
  );
}

function Graduation({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const nav = useNav();
  const predicate = usePredicate();
  const termName = useTermName(record);
  const { projection, plan } = state;
  const final = projection.finalIpk;
  const word = predicate(predicateFor(final, projection.path));
  const finish = checkPlan(record, plan, projection).find((r) => r.id === "finish");
  const lastTerm = [...plan.terms].reverse().find((term) => term.courses.length)?.term ?? record.term;
  return (
    <Card className="flex flex-col px-5 py-4">
      <h2 className="text-title font-semibold tracking-[-0.01em]">{t("grades.graduation")}</h2>
      <p className="text-caption text-muted">{t("grades.graduationEstimate")}</p>
      <p className="mt-3 text-[34px] leading-10 font-semibold tracking-[-0.02em]">
        <Flash value={final}>{final === null ? "—" : f.number(final, 2)}</Flash>
      </p>
      {word && <p className={cx("text-small font-semibold", projection.honor ? "text-success-fg" : "text-fg")}>{word}</p>}
      {finish && (
        <p className={cx("mt-1 flex items-center gap-1.5 text-small", finish.level === "error" ? "text-warning-fg" : "text-muted")}>
          {finish.level === "error" ? <Icons.AlertTriangle className="size-3.5 shrink-0" /> : <Icons.Flag className="size-3.5 shrink-0" />}
          {finish.level === "error" ? t("grades.graduationBlocked") : lastTerm ? t("grades.graduationWhen", { term: termName(lastTerm) }) : null}
        </p>
      )}
      <HonorsSentence projection={projection} className="mt-3 border-t border-line pt-3" />
      <Button className="mt-4 self-start" onClick={() => nav.go({ screen: "plan", tab: "planner" })}>
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
          <List label={t("grades.thisTerm")}>
            {record.thisTerm.map((course, i) => {
              const published = outline?.[course.code]?.grade ?? null;
              return (
                <Row
                  key={course.code}
                  index={i}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-accent-fg"
                        aria-label={`${t("grades.whatNeed")} ${course.code}`}
                        onClick={() => nav.go({ screen: "course", code: course.code, tab: "grades" })}
                      >
                        {t("grades.whatNeed")}
                      </Button>
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
                  {t("grades.ipkAfter")} <span className="ml-1 text-lead font-semibold tabular-nums">{after === null ? "—" : f.number(after, 2)}</span>
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
            {t("grades.questionnaireSoon", { start: f.dayMonth(questionnaire.start), end: f.dayMonth(questionnaire.end - 1) })}
          </li>
        )}
        {deadline && (
          <li className="flex items-start gap-2">
            <Icons.Calendar className="mt-0.5 size-3.5 shrink-0" />
            {t("grades.gradeDeadline", { date: f.dayMonth(deadline.start) })}
          </li>
        )}
      </ul>
    </div>
  );
}

function Transcript({ record }: { record: StudentRecord }) {
  const t = useT();
  const f = useFormat();
  const terms = record.transcript!.terms;
  const stage = record.progress?.stages.at(-1);
  const stageIp = stage ? shownIndex(stage.ip) : null;
  const lastGraded = [...terms].reverse().find((term) => term.ip.computed !== null)?.term ?? null;
  const [open, setOpen] = useState<string | null>(lastGraded);
  return (
    <Section
      id="transcript"
      title={t("grades.transcript")}
      description={
        <Meta>
          {t("grades.transcriptFrom")}
          {/* SIX's "Tahap Sarjana" IPK is the IPK without TPB: said in the Student's words. */}
          {stage && stageIp !== null && !/persiapan/i.test(stage.name) ? t("grades.stageIp", { ip: f.number(stageIp, 2) }) : ""}
        </Meta>
      }
    >
      <List label={t("grades.transcript")}>
        {[...terms].reverse().map((term) => (
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
  const num = (value: number | null) => (value === null ? "—" : f.number(value, 2));
  const now = term.term === record.term && ip === null;
  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open} className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-hover">
        <Icons.ChevronRight className={cx("size-4 text-faint transition-transform duration-150", open && "rotate-90")} />
        <span className="flex-1 text-body font-medium">{termName(term.term)}</span>
        {!term.ip.agrees && (
          <span className="inline-flex items-center gap-1 text-caption font-medium text-warning-fg">
            <Icons.AlertTriangle className="size-3" />
            {t("grades.termDisagree", { six: num(term.ip.six), computed: num(term.ip.computed) })}
          </span>
        )}
        <span className="text-small text-muted">{t("grades.courseCount", { count: term.courses.length })}</span>
        <span className={cx("w-[84px] text-right tabular-nums", now ? "text-small text-muted" : "text-body font-semibold")}>{now ? t("grades.inProgress") : `IP ${num(ip)}`}</span>
      </button>
      {open && (
        <ul className="border-t border-line bg-sunken px-4 py-2">
          {term.courses.map((course) => (
            <li key={`${course.code}-${course.attempt}`} className="grid grid-cols-[84px_minmax(0,1fr)_auto_56px_40px] items-center gap-3 py-1.5 text-body">
              <span className="text-small font-semibold tabular-nums">{course.code}</span>
              <span className="truncate">{course.name}</span>
              <span className="flex justify-end gap-1.5">
                {course.attempt > 1 && <Tag>{t("grades.retaken")}</Tag>}
                {course.standing !== "counted" && <Tag tone={course.standing === "pending" ? "neutral" : "warning"}>{t(`grades.standing.${course.standing}`)}</Tag>}
              </span>
              <span className="text-right text-small text-muted tabular-nums">{course.sks} SKS</span>
              <span className="text-right">{course.grade ? <GradeBadge grade={course.grade} struck={course.standing === "replaced"} /> : <span className="text-faint">—</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Tag({ tone = "neutral", children }: { tone?: "neutral" | "warning"; children: string }) {
  return (
    <span className={cx("inline-flex h-[18px] items-center rounded-[5px] px-1.5 text-micro font-semibold whitespace-nowrap", tone === "warning" ? "bg-warning-bg text-warning-fg" : "bg-neutral-bg text-neutral-fg")}>
      {children}
    </span>
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
      <SixNeeded icon={<Icons.GraduationCap className="size-5" />} title={t("grades.needSix")} body={t("grades.needSixBody")} />
      {courses && courses.length > 0 && (
        // With no grade published anywhere, that's said once above the list, not on every row.
        <Section id="edunex-term" title={t("grades.edunexTerm")} description={t(anyGrade ? "grades.edunexTermHint" : "grades.edunexTermNoneHint")}>
          <List label={t("grades.edunexTerm")}>
            {courses.map((course, i) => {
              const grade = outline?.[course.code]?.grade ?? null;
              return (
                <Row
                  key={course.code}
                  index={i}
                  leading={<CourseCode code={course.code} color={course.color} className="w-[76px] text-small" />}
                  title={course.name}
                  meta={grade ? t("grades.edunexGrade", { total: f.number(grade.total, 1), letter: grade.letter }) : anyGrade ? t("grades.edunexNone") : undefined}
                  trailing={<span className="text-small font-medium text-accent-fg">{t("grades.whatNeed")}</span>}
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
