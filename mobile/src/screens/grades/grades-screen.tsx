// Nilai on the phone (round 2, v4: mobile/qa/v4-rollout.md): src/app/screens/grades.tsx in one column on v4's grey
// page, the same figures from the same hooks. The key number first: one card led by the IPK, big and counting up once,
// the SKS passed beside it, last semester's IP a quiet line and the predicate it heads for a pill (the IPK at
// graduation is the chart's, said once). Then a
// row each on the way to graduating (when, the honors still open, the highest IPK possible; the first opens the
// planner), IP and IPK per semester on a white card, this term's grades as a clearly marked what-if with the one shared
// target, and the transcript, a term at a time (./transcript.tsx). Without SIX: this term's courses from Edunex, each
// opening its calculator. Before SIX's first read, the card stands in its shape.
// Nothing here names a minute (HourClock), and what's below the first screenful mounts a part a frame (Later).
import * as Haptics from "expo-haptics";
import { memo, type ReactNode, useMemo } from "react";
import { View } from "react-native";
import { useTermCourses } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useLang, useNow, useT } from "../../../../src/app/i18n";
import { useDataset, useStatus } from "../../../../src/app/store";
import { type PlanState, usePlan, useStudentRecord } from "../../../../src/app/study-plan";
import type { CalendarEvent } from "../../../../src/core/models";
import { checkPlan, expectedGrade, hasWhatIfs, honorsOutlook, passedSks, project, type StudentRecord, sksModel, targetOf } from "../../../../src/core/planner";
import { useNav } from "../../nav";
import { SixPageNote, UnreadNote } from "../../parts/six-page-note";
import { usePerfDrawn } from "../../perf";
import { ProblemBanner, usePullToRefresh } from "../../shell/source-status";
import { Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { Figure, FigureCell, FigureDash, FigureLabel, FigureRow, Group, GroupRow, Heading, IconTile, Panel, Pill, type PillTone } from "../../ui/group";
import { HourClock } from "../../ui/hour-clock";
import { Icons } from "../../ui/icons";
import { Notice, Page } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { TopBar } from "../../ui/top-bar";
import { Later } from "../plan/deferred";
import { useFreshPlan } from "../plan/fresh-plan";
import { effortKey, GradeSelect, IpkChart, NeedText, predicateFor, TargetControl, usePredicate, useTermName } from "../plan/projection";
import { SixNeeded } from "../plan/six-needed";
import { GradeLetter, shownIndex, Transcript } from "./transcript";

const SIX_WEB = "https://six.itb.ac.id";

/** Android's confirm tick, for a grade picked. */
const confirm = () => void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(() => undefined);

/** "Sangat berat" from "sangat berat": a pill's words start with a capital. */
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function GradesScreen() {
  const t = useT();
  const v = useTheme().v4;
  const pull = usePullToRefresh();
  // Back from the planner with a plan it changed: start again from what's saved.
  const fresh = useFreshPlan();
  return (
    <Page
      testID="screen.grades"
      background={v.page}
      header={
        <>
          {/* The screen's one title, in its bar (no second "Nilai" on the page). */}
          <TopBar title={t("nav.grades")} />
          {/* Grades the app can't trust right now (offline, SIX's session ended, a page SIX changed): said here, as on the desktop. */}
          <ProblemBanner belowBar />
        </>
      }
      {...pull}
    >
      {/* Nothing here says a time to the minute: the minute's tick doesn't draw the page again. */}
      <HourClock>
        <GradesOrWithoutSix key={fresh} />
      </HourClock>
    </Page>
  );
}

function GradesOrWithoutSix() {
  const record = useStudentRecord();
  // SIX's own record: the planner's what-ifs for this term stay in the planner.
  const state = usePlan(record, false);
  const six = useStatus("six");
  // Drawn with its data: SIX's record, or what shows without it once there's nothing to wait for.
  usePerfDrawn(Boolean(record && state) || (six.state !== "connecting" && six.state !== "live"));
  if (record && state) return <Grades record={record} state={state} />;
  // SIX's first read still running: the page's shape, never a spinner.
  const firstRead = six.state === "connecting" || (six.state === "live" && six.updatedAt === null);
  return firstRead ? <GradesSkeleton /> : <WithoutSix />;
}

function Grades({ record, state }: { record: StudentRecord; state: PlanState }) {
  // The key card and the way to graduating fill the first screenful; the chart, this term and the transcript come
  // after, a frame each, each drawing only itself when it comes.
  return (
    <>
      <Rise screen="grades" index={0}>
        <Standing record={record} state={state} />
      </Rise>
      <View style={{ gap: space[3], marginTop: space[3] }}>
        <SixPageNote datasets={["six.transcript", "six.progress"]} />
        <UnreadNote record={record} />
        <Disagreement record={record} />
      </View>
      <Rise screen="grades" index={1}>
        <Graduation record={record} state={state} />
      </Rise>
      <Later frame={1}>
        <Chart state={state} />
      </Later>
      <Later frame={2}>
        <ThisTerm record={record} state={state} />
      </Later>
      <Later frame={3}>
        <Transcript record={record} />
      </Later>
    </>
  );
}

// ------------------------------------------------------------ the key card

/** The IPK, big, and the SKS passed beside it; last semester's IP a quiet line; the IPK at graduation a pill. */
const Standing = memo(function Standing({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const v = useTheme().v4;
  const predicate = usePredicate();
  const transcript = record.transcript!;
  const ipk = shownIndex(transcript.ipk);
  const sks = passedSks(record);
  const need = sksModel(record, state.plan).need;
  const { finalIpk, path, honor } = state.projection;
  const word = predicate(predicateFor(finalIpk, path));
  const graded = transcript.terms.filter((term) => term.term !== record.term && shownIndex(term.ip) !== null);
  const last = graded.at(-1);
  const lastIp = last ? shownIndex(last.ip) : null;
  return (
    <Panel testID="card.standing" style={{ padding: space[5], gap: space[3] }}>
      {/* Side by side while they fit; at a big font size the SKS goes under the IPK. */}
      <FigureRow>
        <FigureCell label={t("grades.chart.ipk")}>
          {ipk === null ? <FigureDash /> : <Figure id="grades.ipk" value={ipk} decimals={2} comma={lang === "id"} />}
        </FigureCell>
        <FigureCell label={t("grades.sksPassed")}>
          {sks === null ? <FigureDash /> : <Figure id="grades.sks" value={sks} unit={t("mobile.academic.sksOf", { need })} />}
        </FigureCell>
      </FigureRow>
      {lastIp !== null && (
        <Text size="bodyMedium" tabular style={{ color: v.muted }}>
          {t("mobile.grades.lastIp", { ip: f.number(lastIp, 2) })}
        </Text>
      )}
      {/* The predicate it heads for at graduation: the IPK then is the chart's end, said there once. */}
      {word ? (
        <View style={{ flexDirection: "row" }}>
          <Pill tone={honor ? "ok" : "plain"}>{word}</Pill>
        </View>
      ) : null}
    </Panel>
  );
});

/** The page's shape while SIX's record is on its way: the key card, then a card of rows. */
function GradesSkeleton() {
  return (
    <View accessibilityState={{ busy: true }} testID="grades.loading" style={{ gap: space[6] }}>
      <Panel style={{ padding: space[5], gap: space[3] }}>
        <View style={{ flexDirection: "row", gap: space[8] }}>
          <View style={{ gap: space[2] }}>
            <Skeleton width={32} height={14} />
            <Skeleton width={104} height={44} />
          </View>
          <View style={{ gap: space[2] }}>
            <Skeleton width={64} height={14} />
            <Skeleton width={112} height={44} />
          </View>
        </View>
        <Skeleton width="55%" height={14} />
      </Panel>
      <Panel style={{ padding: space[4], gap: space[5] }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
            <Skeleton width={44} height={44} style={{ borderRadius: 14 }} />
            <View style={{ flex: 1, gap: space[2] }}>
              <Skeleton width="70%" height={14} />
              <Skeleton width="40%" height={12} />
            </View>
          </View>
        ))}
      </Panel>
    </View>
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

// ------------------------------------------------------------ on the way to graduating

/** When the Student graduates (one press: the planner), the honors still open, and the highest IPK still possible. */
const Graduation = memo(function Graduation({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const nav = useNav();
  const v = useTheme().v4;
  const termName = useTermName(record);
  const { projection, plan } = state;
  const finish = useMemo(() => checkPlan(record, plan, projection).find((r) => r.id === "finish"), [record, plan, projection]);
  // Cum, magna, summa: the highest level already reached, and the first one still open with what it needs.
  const honors = useMemo(() => honorsOutlook(projection).reverse(), [projection]);
  const secured = [...honors].reverse().find((h) => h.kind === "secured");
  const next = honors.find((h) => h.kind === "needs");
  const lastTerm = [...plan.terms].reverse().find((term) => term.courses.length)?.term ?? record.term;
  const blocked = finish?.level === "error";
  const best = projection.bestIpk;
  const rows: ReactNode[] = [
    <GroupRow
      key="finish"
      first
      leading={<IconTile tone={blocked ? "amber" : "brand"} icon={(color) => <Icons.GraduationCap size={22} color={color} />} />}
      title={blocked ? t("grades.graduationBlocked") : finish && lastTerm ? t("grades.graduationWhen", { term: termName(lastTerm) }) : t("grades.toPlanner")}
      meta={hasWhatIfs(plan, record) ? t("mobile.grades.fromSix") : undefined}
      metaTone="muted"
      trailing={<Icons.ChevronRight size={18} color={v.muted} />}
      onPress={() => nav.go({ screen: "plan", tab: "planner" })}
      accessibilityHint={t("grades.toPlanner")}
      testID="action.toPlanner"
    />,
  ];
  if (secured)
    rows.push(
      <GroupRow
        key="secured"
        leading={<IconTile tone="ok" icon={(color) => <Icons.Star size={22} color={color} weight="fill" />} />}
        title={t(`honors.${secured.level}`)}
        trailing={<Pill tone="ok">{capital(t("honors.secured"))}</Pill>}
      />,
    );
  if (next && next.kind === "needs")
    rows.push(
      <GroupRow
        key="next"
        leading={<IconTile tone="plain" icon={(color) => <Icons.Star size={22} color={color} />} />}
        title={t(`honors.${next.level}`)}
        // The SKS it's averaged over are the best IPK's row's, said there once.
        meta={t("mobile.grades.honorsAverage", { avg: f.number(next.average, 2) })}
        trailing={<Pill tone={effortTone(next.average)}>{capital(t(effortKey(next.average)))}</Pill>}
      />,
    );
  rows.push(
    <GroupRow
      key="best"
      leading={<IconTile tone="plain" icon={(color) => <Icons.Target size={22} color={color} />} />}
      title={t("grades.best")}
      meta={projection.variableSks ? t("mobile.grades.bestHint", { sks: projection.variableSks }) : t("grades.bestNone")}
      trailing={
        <Text size="bodyLarge" face="display" weight="bold" tabular style={{ color: v.fg }}>
          {best === null ? "-" : f.number(best, 2)}
        </Text>
      }
    />,
  );
  return (
    <>
      <Heading>{t("mobile.grades.toGraduation")}</Heading>
      <Group testID="card.graduation">{rows}</Group>
    </>
  );
});

/** How hard an average is, as the pill's tone: within reach green, effort blue, hard amber. */
function effortTone(average: number): PillTone {
  const key = effortKey(average);
  return key === "grades.effort.easy" ? "ok" : key === "grades.effort.fair" ? "brand" : "amber";
}

// ------------------------------------------------------------ the chart

/** IP and IPK per semester, the IPK at graduation at its end. The target is set and said in Semester ini, under it. */
function Chart({ state }: { state: PlanState }) {
  const t = useT();
  return (
    <>
      <Heading>{t("grades.chart")}</Heading>
      <Panel style={{ paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[3] }} testID="card.chart">
        <IpkChart steps={state.projection.steps} target={null} />
      </Panel>
    </>
  );
}

// ------------------------------------------------------------ this term

function ThisTerm({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const lang = useLang();
  const v = useTheme().v4;
  const outline = useDataset("edunex.outline");
  const { plan } = state;
  // This term alone: what the IPK becomes and what the target needs from its courses.
  const termOnly = useMemo(() => project(record, { ...plan, terms: [] }), [record, plan]);
  const after = termOnly.steps.find((s) => s.term === record.term)?.ipk ?? null;
  const goal = targetOf(record, plan);
  const pending = record.thisTerm.some((c) => c.grade === null);
  const hidden = record.thisTerm.some((c) => c.grade === null && !outline?.[c.code]?.grade);
  if (!record.term || !record.thisTerm.length) return null;
  return (
    <View testID="section.thisTerm">
      {/* Grades still to come: the ones shown are the Student's own estimates, said once by the heading. */}
      <Heading trailing={pending ? <Pill tone="brand">{t("grades.estimate")}</Pill> : undefined}>{t("grades.thisTerm")}</Heading>
      <Group>
        {record.thisTerm.map((course, i) => (
          <TermCourseRow key={course.code} record={record} state={state} course={course} first={i === 0} />
        ))}
      </Group>
      <Panel style={{ marginTop: space[3], padding: space[5], gap: space[4] }} testID="card.ipkAfter">
        <View>
          <FigureLabel>{t("grades.ipkAfter")}</FigureLabel>
          {after === null ? <FigureDash size={32} /> : <Figure id="grades.after" value={after} decimals={2} comma={lang === "id"} size={32} />}
        </View>
        <TargetControl record={record} state={state} />
        <NeedText need={termOnly.need(goal)} target={goal} sks={record.inProgressSks} scope="term" />
      </Panel>
      {hidden && (
        <Text size="bodySmall" style={{ color: v.muted, marginTop: space[2], marginHorizontal: space[1] }}>
          {t("grades.edunexNote")}
        </Text>
      )}
      <TermNotes record={record} />
    </View>
  );
}

/**
 * A course this term: its tile, name, code and SKS (and Edunex's grade once published) open its calculator ("Butuh
 * berapa?"); SIX's grade, or the grade the Student expects (a control of its own, beside the press, not inside it), at
 * the end.
 */
function TermCourseRow({
  record,
  state,
  course,
  first,
}: {
  record: StudentRecord;
  state: PlanState;
  course: StudentRecord["thisTerm"][number];
  first: boolean;
}) {
  const t = useT();
  const f = useFormat();
  const nav = useNav();
  const v = useTheme().v4;
  const outline = useDataset("edunex.outline");
  const { plan, update } = state;
  const published = outline?.[course.code]?.grade ?? null;
  const meta = [
    course.code,
    t("curriculum.sks", { sks: course.sks }),
    published ? t("grades.edunexGrade", { total: f.number(published.total, 1), letter: published.letter }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingRight: 14 }}>
      {!first && <View style={{ position: "absolute", top: 0, left: 70, right: 0, height: 1, backgroundColor: v.line }} />}
      <PressScale
        onPress={() => nav.go({ screen: "course", code: course.code, tab: "grades" })}
        accessibilityHint={t("grades.whatNeed")}
        testID={`row.course.${course.code}`}
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          paddingLeft: 14,
          paddingRight: space[3],
          paddingVertical: space[3],
          minHeight: 64,
        }}
      >
        <CourseTile code={course.code} name={course.name} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="bodyLarge" weight="medium" style={{ color: v.fg, lineHeight: 21 }}>
            {course.name}
          </Text>
          <Text size="bodyMedium" tabular style={{ color: v.muted, marginTop: 2 }}>
            {meta}
          </Text>
        </View>
      </PressScale>
      {course.grade ? (
        <GradeLetter grade={course.grade} label={t("grades.sixGrade")} />
      ) : (
        <GradeSelect
          label={t("grades.expectedOf", { code: course.code })}
          value={expectedGrade(record, plan, course.code)}
          guess={plan.expected[course.code] === undefined}
          onChange={(grade) => {
            confirm();
            update((p) => ({ ...p, expected: { ...p.expected, [course.code]: grade } }));
          }}
          testID={`action.grade.${course.code}`}
        />
      )}
    </View>
  );
}

/** SIX's rule about hidden grades, timed to ITB's questionnaire window, and the grade deadline: a row each. */
function TermNotes({ record }: { record: StudentRecord }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const open = useOpenExternal();
  const calendar = useDataset("itb.calendar");
  const student = useDataset("six.student");
  const pending = record.thisTerm.some((c) => c.grade === null);
  const of = (kind: CalendarEvent["kind"]) => calendar?.events.find((e) => e.kind === kind && e.term === record.term && e.end > now);
  const questionnaire = pending ? of("questionnaire") : undefined;
  const deadline = pending ? of("grade-deadline") : undefined;
  const during = questionnaire !== undefined && questionnaire.start <= now;
  if (!questionnaire && !deadline) return null;
  const questionnaireUrl = student ? `${SIX_WEB}/app/mahasiswa:${student.nim}+${record.term}/evaluasi/kuesioner` : SIX_WEB;
  return (
    <Group style={{ marginTop: space[3] }} testID="card.termNotes">
      {questionnaire && (
        // Open now: the row is the way to SIX's questionnaire. Before it opens, its dates (the app reminds the Student).
        <GroupRow
          first
          leading={<IconTile tone={during ? "amber" : "plain"} icon={(color) => <Icons.ClipboardCheck size={22} color={color} />} />}
          title={t("mobile.grades.questionnaire")}
          meta={
            during
              ? t("mobile.grades.questionnaireUntil", { date: f.dayMonth(questionnaire.end - 1) })
              : `${f.dayMonth(questionnaire.start)}–${f.dayMonth(questionnaire.end - 1)}`
          }
          metaTone={during ? "amber" : "muted"}
          trailing={during ? <Icons.ArrowUpRight size={18} color={v.muted} /> : undefined}
          onPress={during ? () => open(questionnaireUrl) : undefined}
          accessibilityRole={during ? "link" : undefined}
          accessibilityHint={during ? t("grades.openSix") : undefined}
          testID={during ? "action.questionnaire" : undefined}
        />
      )}
      {deadline && (
        <GroupRow
          first={!questionnaire}
          leading={<IconTile tone="plain" icon={(color) => <Icons.Calendar size={22} color={color} />} />}
          title={t("mobile.grades.gradeDeadline")}
          meta={f.dayMonth(deadline.start)}
        />
      )}
    </Group>
  );
}

// ------------------------------------------------------------ without SIX

/** This term's courses from Edunex, each opening its calculator ("Butuh berapa?" at its end), and what SIX would add. */
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
      <SixNeeded
        datasets={["six.transcript", "six.progress"]}
        icon={<Icons.GraduationCap size={20} color={theme.color.muted} />}
        title={t("grades.needSix")}
        body={t("grades.needSixBody")}
      />
      {courses && courses.length > 0 && (
        <View testID="section.edunexTerm">
          {/* With no grade published anywhere, that's said once by the heading, not on every row. */}
          <Heading trailing={anyGrade ? undefined : <Pill tone="plain">{t("grades.standing.pending")}</Pill>}>{t("grades.edunexTerm")}</Heading>
          <Group>
            {courses.map((course, i) => {
              const grade = outline?.[course.code]?.grade ?? null;
              const said = grade
                ? t("grades.edunexGrade", { total: f.number(grade.total, 1), letter: grade.letter })
                : anyGrade
                  ? t("grades.edunexNone")
                  : null;
              return (
                <GroupRow
                  key={course.code}
                  first={i === 0}
                  testID={`row.course.${course.code}`}
                  leading={<CourseTile code={course.code} name={course.name} />}
                  title={course.name}
                  meta={said ? `${course.code} · ${said}` : course.code}
                  // What the tap answers, as the desktop's row ends (its calculator): no grade yet without SIX, so the question leads.
                  trailing={
                    <Text size="labelLarge" style={{ color: theme.v4.muted }}>
                      {t("grades.whatNeed")}
                    </Text>
                  }
                  onPress={() => nav.go({ screen: "course", code: course.code, tab: "grades" })}
                  accessibilityHint={t("grades.whatNeed")}
                />
              );
            })}
          </Group>
        </View>
      )}
    </>
  );
}
