// Nilai on the phone: src/app/screens/grades.tsx in one column, flat on the page, the same figures from the same
// hooks. The first view answers "after an exam: my grade and what it does to my IPK" (round 1's council): the IPK big,
// and beside it what it becomes after this semester; the SKS passed over a thin bar of those needed; then this term's
// courses, the grades that are out first as plain letters, the ones still to come under a heading that says in words
// they're the Student's own estimates, each with a picker that's a 48 dp control. Then the target, a row each on the
// way to graduating (when; the next honor
// as "Butuh rata-rata 3,66", over which SKS a sheet away, or "Tak terkejar"; the highest IPK possible "jika semua A";
// the first opens the planner), IP and IPK per
// semester with its legend and the target's line (the IPK at graduation at its end, when it differs from today's),
// this term's grades as a clearly marked what-if with the one shared target, and the transcript, a term at a time
// (./transcript.tsx). Without SIX: this term's courses from Edunex, each opening its calculator. Before SIX's first
// read, the card stands in its shape.
// Nothing here names a minute (HourClock), and what's below the first screenful mounts a part a frame (Later).
import { memo, type ReactNode, useMemo, useState } from "react";
import { View } from "react-native";
import { useTermCourses } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useLang, useNow, useT } from "../../../../src/app/i18n";
import { useDataset, useStatus } from "../../../../src/app/store";
import { type PlanState, usePlan, useStudentRecord } from "../../../../src/app/study-plan";
import type { CalendarEvent } from "../../../../src/core/models";
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
} from "../../../../src/core/planner";
import { useNav } from "../../nav";
import { SixPageNote, UnreadNote } from "../../parts/six-page-note";
import { usePerfDrawn } from "../../perf";
import { ProblemBanner, usePullToRefresh } from "../../shell/source-status";
import { useB } from "../../ui/b";
import { Skeleton } from "../../ui/display";
import { CountUp, Rise } from "../../ui/expressive";
import { Figure, FigureDash, FigureLabel, Group, GroupRow, Heading, IconTile, Panel, Pill, type PillTone } from "../../ui/group";
import { haptic } from "../../ui/haptics";
import { HourClock } from "../../ui/hour-clock";
import { Icons } from "../../ui/icons";
import { Notice, Page } from "../../ui/layout";
import { Meter } from "../../ui/meter";
import { PressScale } from "../../ui/press";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { font, space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { TopBar } from "../../ui/top-bar";
import { Later } from "../plan/deferred";
import { useFreshPlan } from "../plan/fresh-plan";
import { effortKey, GradeSelect, IpkChart, NeedText, TargetControl, useTermName } from "../plan/projection";
import { SixNeeded } from "../plan/six-needed";
import { GradeLetter, shownIndex, Transcript } from "./transcript";

const SIX_WEB = "https://six.itb.ac.id";

/** Android's confirm tick, for a grade picked. */
const confirm = () => haptic.confirm();

/** "Sangat berat" from "sangat berat": a pill's words start with a capital. */
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function GradesScreen() {
  const t = useT();
  const b = useB();
  const pull = usePullToRefresh();
  // Back from the planner with a plan it changed: start again from what's saved.
  const fresh = useFreshPlan();
  return (
    <Page
      testID="screen.grades"
      background={b.page}
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
  // The key figures are the first frame; this term, the way to graduating with the chart, and the transcript come
  // after, a frame each, each drawing only itself when it comes.
  // This term alone: what the IPK becomes, and what the target needs from its courses. Worked out once, for both.
  const { plan } = state;
  const termOnly = useMemo(() => project(record, { ...plan, terms: [] }), [record, plan]);
  const after = record.term && record.thisTerm.length ? (termOnly.steps.find((s) => s.term === record.term)?.ipk ?? null) : null;
  return (
    <>
      <Rise screen="grades" index={0}>
        <Standing record={record} state={state} after={after} />
      </Rise>
      <View style={{ gap: space[3], marginTop: space[3] }}>
        <SixPageNote datasets={["six.transcript", "six.progress"]} />
        <UnreadNote record={record} />
        <Disagreement record={record} />
      </View>
      {/* The newest grades next, with what they do to the IPK ("IPK setelah semester ini"): after an exam that's what
          the Student came for, so it's the first thing under the big number, not a screen or two down. */}
      <Later frame={1}>
        <ThisTerm record={record} state={state} termOnly={termOnly} />
      </Later>
      <Later frame={2}>
        <Graduation record={record} state={state} />
        <Chart record={record} state={state} />
      </Later>
      <Later frame={3}>
        <Transcript record={record} />
      </Later>
    </>
  );
}

// ------------------------------------------------------------ the key card

/**
 * The IPK, big, and beside it what it becomes after this semester (from the grades that are out and the Student's
 * estimates for the rest: the answer to "what does this grade do to my IPK"); under them the SKS passed over a thin
 * bar of those needed. Flat on the page, starting at the headings' edge. No predicate in words beside the number
 * (round 1's council: "words for what the number says"): the honors are rows of their own under "Menuju lulus".
 */
const Standing = memo(function Standing({ record, state, after }: { record: StudentRecord; state: PlanState; after: number | null }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const v = useTheme().v4;
  const ipk = shownIndex(record.transcript!.ipk);
  const sks = passedSks(record);
  const need = sksModel(record, state.plan).need;
  const of = t("mobile.academic.sksOf", { need });
  return (
    <View testID="card.standing" style={{ marginHorizontal: space[1], marginTop: space[2], gap: space[4] }}>
      {/* Two figures on one baseline, the second wrapping under the first at a big font size. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", columnGap: space[6], rowGap: space[3] }}>
        <View>
          <FigureLabel>{t("grades.chart.ipk")}</FigureLabel>
          {ipk === null ? <FigureDash /> : <Figure id="grades.ipk" value={ipk} decimals={2} comma={lang === "id"} />}
        </View>
        {after !== null && (
          <View accessible accessibilityLabel={`${t("grades.ipkAfter")} ${f.number(after, 2)}`} style={{ paddingBottom: 4 }}>
            <FigureLabel>{t("mobile.grades.afterTerm")}</FigureLabel>
            <Figure id="grades.after" value={after} decimals={2} comma={lang === "id"} size={28} color={v.fg2} />
          </View>
        )}
      </View>
      <View style={{ gap: space[2] }}>
        {/* The label at the start, the figure at the end, wrapping under it at a big font size. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: space[3] }}>
          <FigureLabel>{t("grades.sksPassed")}</FigureLabel>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[1] }}>
            {sks === null ? (
              <Text size="titleMedium" style={{ color: v.fg }}>
                -
              </Text>
            ) : (
              <CountUp id="grades.sks" value={sks} style={{ fontFamily: font.display.bold, fontSize: 20, lineHeight: 26, color: v.fg }} />
            )}
            <Text size="bodyMedium" style={{ color: v.muted }}>
              {of}
            </Text>
          </View>
        </View>
        {sks !== null && need > 0 && <Meter value={sks / need} track={v.track} label={`${t("grades.sksPassed")} ${sks} ${of}`} />}
      </View>
    </View>
  );
});

/** The page's shape while SIX's record is on its way: the key card (the IPK, the SKS and its bar), then a card of rows. */
function GradesSkeleton() {
  return (
    <View accessibilityState={{ busy: true }} testID="grades.loading" style={{ gap: space[6] }}>
      {/* At the figures' own edge (the headings'), so nothing shifts when they arrive. */}
      <Panel style={{ paddingHorizontal: space[1], paddingTop: space[2], gap: space[3] }}>
        <View style={{ gap: space[2] }}>
          <Skeleton width={32} height={14} />
          <Skeleton width={104} height={44} />
          <Skeleton width="45%" height={14} />
        </View>
        <View style={{ gap: space[2], marginTop: space[2] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Skeleton width={64} height={14} />
            <Skeleton width={88} height={18} />
          </View>
          <Skeleton width="100%" height={6} />
        </View>
      </Panel>
      <Panel style={{ paddingHorizontal: 14, gap: space[5] }}>
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

/**
 * When the Student graduates (one press: the planner), the honor reached, the next one with the average it needs
 * ("Butuh rata-rata 3,66"), or "Tak terkejar" when even straight A's fall short, and the highest IPK still possible
 * ("Jika semua A"). Over which SKS that average is (this term's and the plan's, which can be more than the card's SKS
 * left) is the honor row's sheet, never a count on screen beside "125 dari 144".
 */
const Graduation = memo(function Graduation({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const nav = useNav();
  const v = useTheme().v4;
  const termName = useTermName(record);
  const { projection, plan } = state;
  const finish = useMemo(() => checkPlan(record, plan, projection).find((r) => r.id === "finish"), [record, plan, projection]);
  // Cum, magna, summa: the highest level already reached, and the first one not reached that isn't ruled out.
  const honors = useMemo(() => honorsOutlook(projection).reverse(), [projection]);
  const secured = [...honors].reverse().find((h) => h.kind === "secured");
  const next = honors.find((h) => h.kind === "needs" || h.kind === "out");
  const lastTerm = [...plan.terms].reverse().find((term) => term.courses.length)?.term ?? record.term;
  const blocked = finish?.level === "error";
  const best = projection.bestIpk;
  const [why, setWhy] = useState(false);
  // The SKS the honor's average is over: this term's without a grade, and the plan's (projection.variableSks).
  const whyText = useMemo(() => {
    const termSks = record.thisTerm.filter((c) => c.grade === null).reduce((sum, c) => sum + c.sks, 0);
    const planSks = Math.max(0, projection.variableSks - termSks);
    const left = Math.max(0, sksModel(record, plan).need - record.passedSks);
    return [
      planSks
        ? t("mobile.grades.honorsWhy", { sks: projection.variableSks, term: termSks, plan: planSks })
        : t("mobile.grades.honorsWhyTerm", { sks: projection.variableSks }),
      projection.variableSks > left ? t("mobile.grades.honorsWhyMore", { left }) : "",
    ]
      .filter(Boolean)
      .join(" ");
  }, [record, plan, projection, t]);
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
  if (next?.kind === "needs")
    rows.push(
      // The row opens why: over which SKS that average is (the card's SKS are another count).
      <GroupRow
        key="next"
        leading={<IconTile tone="plain" icon={(color) => <Icons.Star size={22} color={color} />} />}
        title={t(`honors.${next.level}`)}
        meta={
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
            <Text size="bodyMedium" tabular style={{ flexShrink: 1, color: v.muted }}>
              {t("mobile.grades.honorsAverage", { avg: f.number(next.average, 2), sks: projection.variableSks })}
            </Text>
            <Icons.Info size={16} color={v.muted} />
          </View>
        }
        trailing={<Pill tone={effortTone(next.average)}>{capital(t(effortKey(next.average)))}</Pill>}
        onPress={() => setWhy(true)}
        accessibilityRole="button"
        accessibilityHint={whyText}
        testID="action.honorsWhy"
      />,
    );
  else if (next?.kind === "out")
    rows.push(
      <GroupRow
        key="next"
        leading={<IconTile tone="plain" icon={(color) => <Icons.Star size={22} color={color} />} />}
        title={t(`honors.${next.level}`)}
        // One word, as plain text: nothing to press, and no second number beside the best IPK's.
        trailing={
          <Text size="bodyMedium" weight="medium" style={{ color: v.muted }}>
            {t("mobile.grades.honorsOut")}
          </Text>
        }
      />,
    );
  rows.push(
    <GroupRow
      key="best"
      leading={<IconTile tone="plain" icon={(color) => <Icons.Target size={22} color={color} />} />}
      title={t("grades.best")}
      // Which SKS: the honor's sheet says it, once.
      meta={projection.variableSks ? t("mobile.grades.bestHint") : t("grades.bestNone")}
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
      {next?.kind === "needs" && (
        <Sheet open={why} onClose={() => setWhy(false)} title={t(`honors.${next.level}`)} background={v.card} testID="sheet.honorsWhy">
          <Text size="bodyLarge" style={{ color: v.fg, paddingBottom: space[4] }}>
            {whyText}
          </Text>
        </Sheet>
      )}
    </>
  );
});

/** How hard an average is, as the pill's tone: within reach green, effort blue, hard amber. */
function effortTone(average: number): PillTone {
  const key = effortKey(average);
  return key === "grades.effort.easy" ? "ok" : key === "grades.effort.fair" ? "brand" : "amber";
}

// ------------------------------------------------------------ the chart

/**
 * IP and IPK per semester under their legend, the target as its labelled dashed line (set in Semester ini, under it),
 * and the IPK at graduation at the line's end when it isn't today's.
 */
function Chart({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  return (
    <>
      <Heading>{t("grades.chart")}</Heading>
      <Panel style={{ paddingHorizontal: space[2], paddingTop: space[4], paddingBottom: space[3] }} testID="card.chart">
        <IpkChart steps={state.projection.steps} target={targetOf(record, state.plan)} best={state.projection.bestIpk} />
      </Panel>
    </>
  );
}

// ------------------------------------------------------------ this term

/**
 * This term's courses. The grades that are out lead, as plain letters under "Semester ini"; the ones still to come sit
 * under a heading that says, once and in words, that they're the Student's own estimates (round 1's council: "are the
 * AB chips real or guesses?"). Under them the target and what it needs from this term.
 */
function ThisTerm({ record, state, termOnly }: { record: StudentRecord; state: PlanState; termOnly: Projection }) {
  const t = useT();
  const v = useTheme().v4;
  const outline = useDataset("edunex.outline");
  const goal = targetOf(record, state.plan);
  const out = record.thisTerm.filter((c) => c.grade !== null);
  const coming = record.thisTerm.filter((c) => c.grade === null);
  const hidden = coming.some((c) => !outline?.[c.code]?.grade);
  if (!record.term || !record.thisTerm.length) return null;
  return (
    <View testID="section.thisTerm">
      {out.length > 0 && (
        <>
          <Heading>{t("grades.thisTerm")}</Heading>
          <Group>
            {out.map((course, i) => (
              <TermCourseRow key={course.code} record={record} state={state} course={course} first={i === 0} />
            ))}
          </Group>
        </>
      )}
      {coming.length > 0 && (
        <View testID="section.estimates">
          <Heading>{t(out.length ? "mobile.grades.estimatesRest" : "mobile.grades.estimates")}</Heading>
          <Group>
            {coming.map((course, i) => (
              <TermCourseRow key={course.code} record={record} state={state} course={course} first={i === 0} />
            ))}
          </Group>
        </View>
      )}
      {/* The figure itself ("IPK setelah semester ini") is at the top of the page, once. */}
      <View style={{ marginTop: space[5], marginHorizontal: space[1], gap: space[3] }} testID="card.ipkAfter">
        <TargetControl record={record} state={state} />
        <NeedText need={termOnly.need(goal)} target={goal} sks={record.inProgressSks} scope="term" />
      </View>
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
