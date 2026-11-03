// Akademik (round 2, v4; the tab that replaced Lainnya): in three seconds, the IPK and what to do this term.
// 1. One leading card: the IPK and SKS passed as big numbers that count up once, the name and NIM a quiet line over
//    them. The whole card is one target that opens Nilai (the avatar in the bar is the way to the account and Settings).
// 2. To-do chips, only while something's due (send the KRS, pay UKT, fill in the questionnaire SIX hides grades
//    behind), each opening its screen. Nothing due: nothing shown.
// 3. Nilai and Rencana studi's parts (Rencana, Kurikulum, KRS, UKT, Kalender akademik) as rows in one card, each with
//    the one line that answers it and at most one status pill. The screens' content lives in their own files.
// Before SIX's first read, the card and the rows' lines stand in their own shape; never a spinner.
import { memo, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useDeadlines, useThisTerm } from "../../../../src/app/deadlines";
import { useFormat, useLang, useNow, useT } from "../../../../src/app/i18n";
import { displayName } from "../../../../src/app/names";
import { usePlanTabBadges } from "../../../../src/app/shell/badges";
import { builtPlanTabs, type PlanTab } from "../../../../src/app/shell/built";
import { useDataset, useStatus } from "../../../../src/app/store";
import { usePlan, useStudentRecord } from "../../../../src/app/study-plan";
import { billUrgency, type KrsStage, krsOverlaps, krsStage } from "../../../../src/core/academic";
import { checkPlan, passedSks, type Rule, type StudentRecord } from "../../../../src/core/planner";
import { useNav } from "../../nav";
import { useSignIn } from "../../shell/source-status";
import { BigButton } from "../../ui/big-button";
import { Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { Figure, FigureLabel, Group, GroupRow, IconTile, Panel, Pill, type PillTone } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { font, space, TOUCH, useTheme } from "../../ui/theme";
import { shownIndex } from "../grades/transcript";

type IconKind = (typeof Icons)[keyof typeof Icons];
type MetaTone = "muted" | "red" | "amber" | "ok";

const PART_ICON: Readonly<Record<PlanTab, IconKind>> = {
  planner: Icons.Route,
  curriculum: Icons.Layers,
  krs: Icons.CalendarCheck,
  bills: Icons.Wallet,
  deadlines: Icons.CalendarClock,
};

/** What a to-do chip says, for a part whose badge is a warning (something the Student has to do now). */
const TODO: Partial<Record<PlanTab, { key: "mobile.academic.todo.krs" | "mobile.academic.todo.bills" | "mobile.academic.todo.deadlines"; icon: IconKind }>> = {
  krs: { key: "mobile.academic.todo.krs", icon: Icons.CalendarCheck },
  bills: { key: "mobile.academic.todo.bills", icon: Icons.Wallet },
  deadlines: { key: "mobile.academic.todo.deadlines", icon: Icons.PenLine },
};

/** The KRS row's pill for each stage: amber while the Student has something to do, green once it's official. */
const KRS_TONE: Readonly<Record<KrsStage, PillTone>> = { send: "amber", advisor: "plain", ukt: "amber", official: "brand", done: "ok" };

/** A source's first read is still running: what it brings stands in its shape until it's here. */
function useFirstRead(source: "six" | "itb"): boolean {
  const status = useStatus(source);
  return status.state === "connecting" || (status.state === "live" && status.updatedAt === null);
}

export function AcademicContent() {
  const badges = usePlanTabBadges();
  const record = useStudentRecord();
  const six = useStatus("six");
  const student = useDataset("six.student");
  const todos = builtPlanTabs.filter((part) => TODO[part] && badges[part]?.tone === "warning");
  return (
    <View style={{ gap: space[4] }}>
      <Rise screen="academic" index={0}>
        {record?.transcript ? (
          <Standing record={record} />
        ) : student || six.state === "connecting" || six.state === "live" ? (
          <StandingSkeleton />
        ) : (
          <ConnectSix />
        )}
      </Rise>
      {todos.length > 0 && (
        <Rise screen="academic" index={1}>
          <Todos parts={todos} />
        </Rise>
      )}
      <Rise screen="academic" index={2} style={{ marginTop: space[2] }}>
        <Group testID="section.academic.screens">
          <GradesRow record={record} />
          <PlannerRow record={record} />
          <CurriculumRow record={record} />
          <KrsRow />
          <BillsRow />
          <DeadlinesRow />
        </Group>
      </Rise>
    </View>
  );
}

// ------------------------------------------------------------ the leading card

/** The IPK and SKS passed, big: the answer the Student opens Akademik for. One target: Nilai. */
const Standing = memo(function Standing({ record }: { record: StudentRecord }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const nav = useNav();
  const v = useTheme().v4;
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const name = account?.name ?? student?.name;
  const ipk = shownIndex(record.transcript!.ipk);
  const ipkText = ipk === null ? "-" : f.number(ipk, 2);
  const sks = passedSks(record);
  const sksText = sks === null ? "-" : String(sks);
  const of = t("mobile.academic.sksOf", { need: record.graduationSks });
  const who = factsLabel(name ? displayName(name) : null, account?.nim ?? student?.nim);
  return (
    // The card's ID for the flows (W12 taps it), the press's for what it does.
    <View testID="card.profile">
      <Panel
        onPress={() => nav.go({ screen: "grades" })}
        accessibilityLabel={factsLabel(`${t("grades.chart.ipk")} ${ipkText}`, `${t("grades.sksPassed")} ${sksText} ${of}`, who)}
        accessibilityHint={t("mobile.academic.openGrades")}
        testID="action.academic.grades"
        style={{ padding: space[5], gap: space[3] }}
      >
        {who ? (
          <Text size="bodyMedium" numberOfLines={2} style={{ color: v.muted }}>
            {who}
          </Text>
        ) : null}
        {/* Side by side while they fit; at a big font size the SKS goes under the IPK. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", columnGap: space[8], rowGap: space[3] }}>
          <View>
            <FigureLabel>{t("grades.chart.ipk")}</FigureLabel>
            {ipk === null ? <Dash size={44} /> : <Figure id="academic.ipk" value={ipk} decimals={2} comma={lang === "id"} />}
          </View>
          <View>
            <FigureLabel>{t("grades.sksPassed")}</FigureLabel>
            {sks === null ? <Dash size={32} /> : <Figure id="academic.sks" value={sks} unit={of} size={32} />}
          </View>
        </View>
      </Panel>
    </View>
  );
});

/** A figure with nothing to count: "-" in the figure's face and size. */
function Dash({ size }: { size: number }) {
  const v = useTheme().v4;
  return <Text style={{ fontFamily: font.display.extrabold, fontSize: size, lineHeight: Math.round(size * 1.15), color: v.fg }}>-</Text>;
}

/** The card's shape while SIX's record is on its way. */
function StandingSkeleton() {
  return (
    <Panel accessibilityState={{ busy: true }} testID="academic.loading" style={{ padding: space[5], gap: space[3] }}>
      <Skeleton width="55%" height={14} />
      <View style={{ flexDirection: "row", gap: space[8] }}>
        <View style={{ gap: space[2] }}>
          <Skeleton width={32} height={14} />
          <Skeleton width={104} height={44} />
        </View>
        <View style={{ gap: space[2] }}>
          <Skeleton width={64} height={14} />
          <Skeleton width={112} height={32} />
        </View>
      </View>
    </Panel>
  );
}

/** No SIX to read the IPK from: whose record it is (from Edunex), where the IPK will show, and the way to connect while SIX isn't signed in. */
function ConnectSix() {
  const t = useT();
  const v = useTheme().v4;
  const status = useStatus("six");
  const { signIn, busy } = useSignIn();
  // Edunex knows the Student too: the card keeps its quiet line of whose record it is, as it does with SIX.
  const account = useDataset("edunex.account");
  const who = factsLabel(account?.name ? displayName(account.name) : null, account?.nim);
  return (
    <Panel style={{ padding: space[5], gap: space[4] }} testID="academic.noSix">
      {who ? (
        <Text size="bodyMedium" numberOfLines={2} style={{ color: v.muted }}>
          {who}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <IconTile icon={(color) => <Icons.GraduationCap size={24} color={color} />} />
        <Text size="bodyLarge" style={{ color: v.fg, flex: 1 }}>
          {t("mobile.academic.noIpk")}
        </Text>
      </View>
      {status.state === "signed-out" && (
        // Quiet: the outline one, so the empty card doesn't shout. Disabled while the sign-in page is open.
        <BigButton variant="outline" onPress={busy ? undefined : () => void signIn("six")} testID="action.academic.signIn">
          {t("action.signInTo", { source: "SIX" })}
        </BigButton>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------ to do

/** What to take care of this term, as tonal chips: each opens its screen. */
function Todos({ parts }: { parts: readonly PlanTab[] }) {
  const t = useT();
  const nav = useNav();
  const v = useTheme().v4;
  return (
    <View accessibilityLabel={t("mobile.academic.todo")} style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }} testID="section.academic.todo">
      {parts.map((part) => {
        const { key, icon: Icon } = TODO[part]!;
        return (
          <PressScale
            key={part}
            onPress={() => nav.go({ screen: "plan", tab: part })}
            testID={`action.todo.${part}`}
            style={{
              minHeight: TOUCH,
              flexDirection: "row",
              alignItems: "center",
              gap: space[2],
              paddingLeft: space[3.5],
              paddingRight: space[4],
              borderRadius: TOUCH / 2,
              backgroundColor: v.ambBg,
            }}
          >
            <Icon size={20} color={v.ambFg} />
            <Text size="labelLarge" weight="semibold" style={{ color: v.ambFg }}>
              {t(key)}
            </Text>
          </PressScale>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------ the screens

/** A screen's row: its tile, its name, the one line that answers it (or that line's shape while SIX reads), one pill. */
function ScreenRow({
  icon: Icon,
  title,
  meta,
  tone = "muted",
  pill,
  route,
  first = false,
  testID,
}: {
  icon: IconKind;
  title: string;
  /** The line; `"pending"` while what it says is still on its way. */
  meta: string | null | "pending";
  tone?: MetaTone;
  pill?: { tone: PillTone; text: string } | null;
  route: PlanTab | "grades";
  first?: boolean;
  testID: string;
}) {
  const nav = useNav();
  return (
    <GroupRow
      first={first}
      leading={<IconTile icon={(color) => <Icon size={22} color={color} />} />}
      title={title}
      meta={meta === "pending" ? <Skeleton width={128} height={12} style={{ marginTop: space[1] }} /> : meta}
      metaTone={tone}
      trailing={pill ? <Pill tone={pill.tone}>{pill.text}</Pill> : undefined}
      onPress={() => nav.go(route === "grades" ? { screen: "grades" } : { screen: "plan", tab: route })}
      testID={testID}
    />
  );
}

/**
 * What a row says while its data isn't here: its shape during SIX's first read, else nothing. Without SIX the leading
 * card says so once, with the way to connect (and the banner under the bar when the session ran out), not every row.
 */
function useMissingMeta(): null | "pending" {
  return useFirstRead("six") ? "pending" : null;
}

function GradesRow({ record }: { record: StudentRecord | undefined }) {
  const t = useT();
  const f = useFormat();
  const missing = useMissingMeta();
  const text = useMemo(() => {
    if (!record?.transcript) return null;
    const ipk = shownIndex(record.transcript.ipk);
    if (ipk === null) return null;
    const last = record.transcript.terms.filter((term) => term.term !== record.term && shownIndex(term.ip) !== null).at(-1);
    const ip = last ? shownIndex(last.ip) : null;
    return ip === null
      ? t("mobile.academic.meta.gradesIpk", { ipk: f.number(ipk, 2) })
      : t("mobile.academic.meta.grades", { ipk: f.number(ipk, 2), ip: f.number(ip, 2) });
  }, [record, t, f]);
  return (
    <ScreenRow icon={Icons.ClipboardCheck} title={t("nav.grades")} meta={record?.transcript ? text : missing} route="grades" first testID="row.nav.grades" />
  );
}

/**
 * When the plan graduates. The plan's projection is the heaviest thing here, so it's worked out once the tab has
 * drawn, never on its first frame; until then the line stands in its shape.
 */
function PlannerRow({ record }: { record: StudentRecord | undefined }) {
  const t = useT();
  const missing = useMissingMeta();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // When the JS thread is idle (the tab is mounted ahead, at start-up), at the latest after a second.
    const task = requestIdleCallback(() => setReady(true), { timeout: 1000 });
    return () => cancelIdleCallback(task);
  }, []);
  if (record && ready) return <PlannerFinish record={record} />;
  return <PartRow part="planner" meta={record ? "pending" : missing} title={t("plan.tab.planner")} />;
}

const PlannerFinish = memo(function PlannerFinish({ record }: { record: StudentRecord }) {
  const t = useT();
  const state = usePlan(record);
  const finish = useMemo(
    () =>
      state ? checkPlan(state.record, state.plan, state.projection).find((rule): rule is Extract<Rule, { id: "finish" }> => rule.id === "finish") : undefined,
    [state],
  );
  const title = t("plan.tab.planner");
  if (!finish) return <PartRow part="planner" meta={null} title={title} />;
  if (finish.blocked) return <PartRow part="planner" meta={t("mobile.academic.meta.plannerShort")} tone="amber" title={title} />;
  return <PartRow part="planner" meta={t("mobile.academic.meta.plannerSemester", { n: finish.semester })} title={title} />;
});

/** One of Rencana studi's parts as a row: it opens that part's screen. */
function PartRow({
  part,
  title,
  meta,
  tone,
  pill,
}: {
  part: PlanTab;
  title: string;
  meta: string | null | "pending";
  tone?: MetaTone;
  pill?: { tone: PillTone; text: string } | null;
}) {
  return <ScreenRow icon={PART_ICON[part]} title={title} meta={meta} tone={tone} pill={pill} route={part} testID={`row.nav.plan.${part}`} />;
}

function CurriculumRow({ record }: { record: StudentRecord | undefined }) {
  const t = useT();
  const missing = useMissingMeta();
  const meta = record ? t("mobile.academic.meta.curriculum", { passed: passedSks(record) ?? "-", need: record.graduationSks }) : missing;
  return <PartRow part="curriculum" title={t("plan.tab.curriculum")} meta={meta} />;
}

function KrsRow() {
  const t = useT();
  const now = useNow();
  const plan = useDataset("six.krs");
  const schedule = useDataset("six.schedule");
  const missing = useMissingMeta();
  const shown = useMemo(() => {
    if (!plan) return null;
    const stage = krsStage(plan);
    const clashes = krsOverlaps(
      plan.courses.map((c) => c.code),
      schedule ?? [],
      now,
    ).filter((o) => o.upcoming).length;
    return {
      // The SKS taken as the line, the plan's one status as the pill: a clash still to come (worth a question to the
      // lecturer) over the plan's stage.
      text: t("krs.sks", { sks: plan.sks ?? "-" }),
      pill: clashes
        ? { tone: "amber" as const, text: t("mobile.academic.pill.clash", { count: clashes }) }
        : { tone: KRS_TONE[stage], text: t(`krs.stage.${stage}`) },
    };
  }, [plan, schedule, now, t]);
  return <PartRow part="krs" title={t("plan.tab.krs")} meta={shown ? shown.text : missing} pill={shown?.pill} />;
}

/** UKT: this term's bill (else the last billed) as the row's one pill: paid, the date it's due by, or overdue. */
function BillsRow() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const bills = useDataset("six.bills");
  const term = useThisTerm();
  const missing = useMissingMeta();
  const title = t("plan.tab.bills");
  if (!bills) return <PartRow part="bills" title={title} meta={missing} />;
  const billed = bills.filter((b) => b.status !== "not-billed");
  const bill = (term && bills.find((b) => b.term === term)) || billed.at(-1);
  if (!bill) return <PartRow part="bills" title={title} meta={null} />;
  const urgency = billUrgency(bill, now);
  const pill: { tone: PillTone; text: string } =
    urgency === "overdue"
      ? { tone: "red", text: t("bills.status.overdue") }
      : (urgency === "soon" || urgency === "due") && bill.nextDueAt !== null
        ? { tone: urgency === "soon" ? "amber" : "plain", text: t("mobile.academic.pill.billsDue", { date: f.dayMonth(bill.nextDueAt) }) }
        : { tone: bill.status === "paid" ? "ok" : "plain", text: t(`bills.status.${bill.status}`) };
  return <PartRow part="bills" title={title} meta={null} pill={pill} />;
}

function DeadlinesRow() {
  const t = useT();
  const f = useFormat();
  const { upcoming } = useDeadlines();
  const calendar = useDataset("itb.calendar");
  const reading = useFirstRead("itb");
  const next = upcoming[0];
  const title = t("plan.tab.deadlines");
  if (!next) return <PartRow part="deadlines" title={title} meta={!calendar && reading ? "pending" : null} />;
  const what = t(`deadline.kind.${next.event.kind}` as Parameters<typeof t>[0]);
  return (
    <PartRow
      part="deadlines"
      title={title}
      meta={
        next.when === "now"
          ? t("mobile.academic.meta.deadlineNow", { what })
          : t("mobile.academic.meta.deadlineNext", { what, date: f.dayMonth(next.event.start) })
      }
    />
  );
}
