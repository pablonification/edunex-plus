// Nilai on the phone (S11): src/app/screens/grades.tsx in one column, with the same figures from
// the same hooks. Where the Student stands, answered first: the IPK and where the grades they
// expect would take them, in one sentence; three figures under it (SKS passed, last IP, the
// highest IPK still possible); the IPK at graduation with honors in one positive sentence; IP
// and IPK per semester on one chart with the target; this term's grades as a clearly marked
// what-if with the one shared target; and the transcript, a term at a time. Without SIX, this
// term's courses from Edunex with their calculators, and what signing in to SIX unlocks.
// On the phone the graduation card comes before the chart: the answer before the picture of it.
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useTermCourses } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { type PlanState, usePlan, useStudentRecord } from "../../../../src/app/study-plan";
import type { CalendarEvent } from "../../../../src/core/models";
import { checkPlan, expectedGrade, hasWhatIfs, passedSks, project, type StudentRecord, sksModel, targetOf } from "../../../../src/core/planner";
import { useNav } from "../../nav";
import { SixPageNote, UnreadNote } from "../../parts/six-page-note";
import { usePullToRefresh } from "../../shell/source-status";
import { Button } from "../../ui/controls";
import { Card, CourseCode } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta, Notice, Page, PageHeader, Row, Section, Stat, StatRow } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { useFreshPlan } from "../plan/fresh-plan";
import { GradeBadge, GradeSelect, HonorsSentence, IpkChart, NeedText, predicateFor, TargetControl, usePredicate, useTermName } from "../plan/projection";
import { SixNeeded } from "../plan/six-needed";
import { shownIndex, Transcript } from "./transcript";

const SIX_WEB = "https://six.itb.ac.id";

export function GradesScreen() {
  const pull = usePullToRefresh();
  // Back from the planner with a plan it changed: start again from what's saved.
  const fresh = useFreshPlan();
  return (
    <Page testID="screen.grades" header={<TopBar />} {...pull}>
      <GradesOrWithoutSix key={fresh} />
    </Page>
  );
}

function GradesOrWithoutSix() {
  const record = useStudentRecord();
  // SIX's own record: the planner's what-ifs for this term stay in the planner.
  const state = usePlan(record, false);
  return record && state ? <Grades record={record} state={state} /> : <WithoutSix />;
}

function Grades({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  return (
    <>
      <Answer record={record} state={state} />
      <View style={{ gap: space[6] }}>
        <SixPageNote datasets={["six.transcript", "six.progress"]} />
        <UnreadNote record={record} />
        <Disagreement record={record} />
        <Standing record={record} state={state} />
        <Graduation record={record} state={state} />
        <Card style={{ paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[3] }} testID="card.chart">
          <Text size="title" weight="semibold" accessibilityRole="header" style={{ marginBottom: space[3] }}>
            {t("grades.chart")}
          </Text>
          <IpkChart steps={state.projection.steps} target={targetOf(record, state.plan)} />
        </Card>
      </View>
      <ThisTerm record={record} state={state} />
      <Transcript record={record} />
    </>
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
        <Text size="lead" tone="muted">
          <Text size="lead" weight="medium">
            {t("grades.answer", { ipk: ipk === null ? "-" : f.number(ipk, 2) })}
          </Text>
          {variableSks > 0 && finalIpk !== null && word ? ` ${t("grades.answerFinal", { final: f.number(finalIpk, 2), predicate: word.toLowerCase() })}` : ""}
        </Text>
      }
    />
  );
}

function Disagreement({ record }: { record: StudentRecord }) {
  const t = useT();
  const f = useFormat();
  const { ipk } = record.transcript!;
  if (ipk.agrees) return null;
  const num = (value: number | null) => (value === null ? "-" : f.number(value, 2));
  const parts = [
    ipk.six !== null && Math.abs(ipk.six - (ipk.computed ?? -1)) > 0.005 + 1e-9 ? t("grades.disagree", { six: num(ipk.six), computed: num(ipk.computed) }) : "",
    ipk.sixSks !== null && ipk.sixSks !== ipk.sks ? t("grades.disagreeSks", { six: ipk.sixSks, rows: ipk.sks }) : "",
  ].filter(Boolean);
  return (
    <Notice tone="warning" title={t("grades.disagreeTitle")} testID="note.disagree">
      {parts.join(" ")}
    </Notice>
  );
}

function Standing({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const termName = useTermName(record);
  const transcript = record.transcript!;
  const num = (value: number | null) => (value === null ? "-" : f.number(value, 2));
  const graded = transcript.terms.filter((term) => term.term !== record.term && shownIndex(term.ip) !== null);
  const last = graded.at(-1);
  const before = graded.at(-2);
  const lastIp = last ? shownIndex(last.ip) : null;
  const delta = lastIp !== null && before ? lastIp - shownIndex(before.ip)! : null;
  const signed = (value: number) => `${value > 0.004 ? "+" : value < -0.004 ? "−" : "±"}${f.number(Math.abs(value), 2)}`;
  const sks = sksModel(record, state.plan);
  const { bestIpk, variableSks } = state.projection;
  // The IPK itself is the header's answer; these are the figures around it.
  return (
    <StatRow>
      <Stat label={t("grades.sksPassed")} value={String(passedSks(record) ?? "-")} hint={t("grades.sksPassedHint", { need: sks.need })} />
      <Stat
        label={t("grades.lastIp")}
        value={num(lastIp)}
        hint={
          last ? (
            delta === null ? (
              termName(last.term)
            ) : (
              <Meta size="caption">{t("grades.lastIpHint", { term: termName(last.term).split(" · ")[0], delta: signed(delta) })}</Meta>
            )
          ) : undefined
        }
      />
      <Stat label={t("grades.best")} value={num(bestIpk)} hint={variableSks ? t("grades.bestHint", { sks: variableSks }) : t("grades.bestNone")} />
    </StatRow>
  );
}

function Graduation({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const nav = useNav();
  const theme = useTheme();
  const predicate = usePredicate();
  const termName = useTermName(record);
  const { projection, plan } = state;
  const final = projection.finalIpk;
  const word = predicate(predicateFor(final, projection.path));
  const finish = checkPlan(record, plan, projection).find((r) => r.id === "finish");
  const lastTerm = [...plan.terms].reverse().find((term) => term.courses.length)?.term ?? record.term;
  const blocked = finish?.level === "error";
  return (
    <Card style={{ paddingHorizontal: space[4], paddingVertical: space[4] }} testID="card.graduation">
      <Text size="title" weight="semibold" accessibilityRole="header">
        {t("grades.graduation")}
      </Text>
      <Text size="caption" tone="muted">
        {t("grades.graduationEstimate")}
      </Text>
      <Text size="display" weight="semibold" tabular style={{ marginTop: space[3] }}>
        {final === null ? "-" : f.number(final, 2)}
      </Text>
      {word ? (
        <Text size="small" weight="semibold" tone={projection.honor ? "success" : "fg"}>
          {word}
        </Text>
      ) : null}
      {finish && (
        <View style={{ marginTop: space[1], flexDirection: "row", alignItems: "center", gap: 6 }}>
          {blocked ? <Icons.AlertTriangle size={14} color={theme.color.warningFg} /> : <Icons.Flag size={14} color={theme.color.muted} />}
          <Text size="small" tone={blocked ? "warning" : "muted"} style={{ flex: 1 }}>
            {blocked ? t("grades.graduationBlocked") : lastTerm ? t("grades.graduationWhen", { term: termName(lastTerm) }) : ""}
          </Text>
        </View>
      )}
      {hasWhatIfs(plan, record) && (
        <Text size="caption" tone="muted" style={{ marginTop: space[1] }}>
          {t("grades.withoutWhatIfs")}
        </Text>
      )}
      <View style={{ marginTop: space[3], paddingTop: space[3], borderTopWidth: 1, borderTopColor: theme.color.line }}>
        <HonorsSentence projection={projection} />
      </View>
      <View style={{ marginTop: space[4], flexDirection: "row" }}>
        <Button onPress={() => nav.go({ screen: "plan", tab: "planner" })} testID="action.toPlanner">
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
            <Text size="small" weight="semibold">
              {t("grades.toPlanner")}
            </Text>
            <Icons.ChevronRight size={16} />
          </View>
        </Button>
      </View>
    </Card>
  );
}

function ThisTerm({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const nav = useNav();
  const theme = useTheme();
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
    <Section title={t("grades.thisTerm")} description={pending ? t("grades.whatIf") : undefined} testID="section.thisTerm">
      <List>
        {record.thisTerm.map((course) => {
          const published = outline?.[course.code]?.grade ?? null;
          return (
            <Row
              key={course.code}
              testID={`row.course.${course.code}`}
              leading={
                <Text size="small" weight="semibold" tabular style={{ width: 64 }}>
                  {course.code}
                </Text>
              }
              title={course.name}
              meta={
                <Meta>
                  {t("curriculum.sks", { sks: course.sks })}
                  {published ? t("grades.edunexGrade", { total: f.number(published.total, 1), letter: published.letter }) : ""}
                </Meta>
              }
              trailing={
                course.grade ? (
                  <GradeBadge grade={course.grade} label={t("grades.sixGrade")} />
                ) : (
                  <GradeSelect
                    label={t("grades.expectedOf", { code: course.code })}
                    value={expectedGrade(record, plan, course.code)}
                    guess={plan.expected[course.code] === undefined}
                    onChange={(grade) => update((p) => ({ ...p, expected: { ...p.expected, [course.code]: grade } }))}
                    testID={`action.grade.${course.code}`}
                  />
                )
              }
            >
              {/* Quiet: one per course, so a column of blue links doesn't outshout the grades beside it. */}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${t("grades.whatNeed")} ${course.code}`}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 12 }}
                onPress={() => nav.go({ screen: "course", code: course.code, tab: "grades" })}
                style={{ alignSelf: "flex-start", marginTop: space[1.5], flexDirection: "row", alignItems: "center", gap: 2 }}
                testID={`action.whatNeed.${course.code}`}
              >
                <Text size="small" weight="medium" tone="muted">
                  {t("grades.whatNeed")}
                </Text>
                <Icons.ChevronRight size={12} color={theme.color.muted} />
              </Pressable>
            </Row>
          );
        })}
        <View style={{ backgroundColor: theme.color.sunken, paddingHorizontal: space[4], paddingVertical: space[3.5], gap: space[3] }}>
          <Text size="body">
            {t("grades.ipkAfter")}{" "}
            <Text size="lead" weight="semibold" tabular>
              {after === null ? "-" : f.number(after, 2)}
            </Text>
          </Text>
          <TargetControl record={record} state={state} />
          <NeedText need={termOnly.need(goal)} target={goal} sks={record.inProgressSks} scope="term" />
        </View>
      </List>
      {hidden && (
        <Text size="caption" tone="faint" style={{ marginTop: space[2] }}>
          {t("grades.edunexNote")}
        </Text>
      )}
      <TermNotes record={record} />
    </Section>
  );
}

/** SIX's rule about hidden grades, timed to ITB's questionnaire window, and the grade deadline. */
function TermNotes({ record }: { record: StudentRecord }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
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
  const line = (icon: ReactNode, text: string) => (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
      <View style={{ paddingTop: 2 }}>{icon}</View>
      <Text size="small" tone="muted" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
  return (
    <View style={{ marginTop: space[4], gap: space[3] }}>
      {during && (
        <Notice
          tone="warning"
          icon={<Icons.ClipboardCheck size={18} color={theme.color.warningFg} />}
          title={t("grades.questionnaireNow", { date: f.dayMonth(questionnaire.end - 1) })}
          action={
            <Button size="sm" icon={<Icons.ArrowUpRight size={14} />} onPress={() => open(questionnaireUrl)} testID="action.questionnaire">
              {t("grades.openSix")}
            </Button>
          }
        />
      )}
      {questionnaire &&
        !during &&
        line(
          <Icons.ClipboardCheck size={14} color={theme.color.muted} />,
          t("grades.questionnaireSoon", { start: f.dayMonth(questionnaire.start), end: f.dayMonth(questionnaire.end - 1) }),
        )}
      {deadline && line(<Icons.Calendar size={14} color={theme.color.muted} />, t("grades.gradeDeadline", { date: f.dayMonth(deadline.start) }))}
    </View>
  );
}

// ------------------------------------------------------------ without SIX

/** This term's courses from Edunex, each with its calculator, and what SIX would add. */
function WithoutSix() {
  const t = useT();
  const nav = useNav();
  const f = useFormat();
  const theme = useTheme();
  const courses = useTermCourses();
  const outline = useDataset("edunex.outline");
  const anyGrade = courses?.some((c) => outline?.[c.code]?.grade) ?? false;
  return (
    <>
      <PageHeader title={t("nav.grades")} />
      <SixNeeded
        datasets={["six.transcript", "six.progress"]}
        icon={<Icons.GraduationCap size={20} color={theme.color.muted} />}
        title={t("grades.needSix")}
        body={t("grades.needSixBody")}
      />
      {courses && courses.length > 0 && (
        // With no grade published anywhere, that's said once above the list, not on every row.
        <Section title={t("grades.edunexTerm")} description={t(anyGrade ? "grades.edunexTermHint" : "grades.edunexTermNoneHint")} testID="section.edunexTerm">
          <List>
            {courses.map((course) => {
              const grade = outline?.[course.code]?.grade ?? null;
              return (
                <Row
                  key={course.code}
                  testID={`row.course.${course.code}`}
                  leading={<CourseCode code={course.code} color={course.color} />}
                  title={course.name}
                  meta={
                    grade ? t("grades.edunexGrade", { total: f.number(grade.total, 1), letter: grade.letter }) : anyGrade ? t("grades.edunexNone") : undefined
                  }
                  trailing={
                    <Text size="small" weight="medium" tone="muted">
                      {t("grades.whatNeed")}
                    </Text>
                  }
                  onPress={() => nav.go({ screen: "course", code: course.code, tab: "grades" })}
                />
              );
            })}
          </List>
        </Section>
      )}
    </>
  );
}
