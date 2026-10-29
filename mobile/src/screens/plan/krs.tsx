// Rencana studi › KRS on the phone (src/app/screens/plan/krs.tsx, S14): this term's study plan
// and its approval, in one column. The plan's one honest status and the next step (a clash still
// to come is said in amber, with where to see it), the courses with class, SKS and the advisor's
// approval, then the plan's steps with their times (and the change round). View only.
import { View } from "react-native";
import { useCourseColor, useTermCourses } from "../../../../src/app/courses";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { type KrsStage, type KrsStep, krsOverlaps, krsStage, krsTimeline, nextKrsWindow, type Overlap, rupiah } from "../../../../src/core/academic";
import type { ClassSession, KrsPlan } from "../../../../src/core/models";
import { useNav } from "../../nav";
import { SixPageNote } from "../../parts/six-page-note";
import { Button } from "../../ui/controls";
import { Bar, Card, CourseCode } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta, Row, Section } from "../../ui/layout";
import { Text, type TextTone } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { useTermYears } from "./projection";
import { SixNeeded } from "./six-needed";

function useSchedule(): ClassSession[] {
  return useDataset("six.schedule") ?? [];
}

const TONE_COLOR = { warning: "warningFg", muted: "muted", info: "infoFg", success: "successFg" } as const;

/** The stage's icon color, drawn bare before its title the way a Notice draws its icon. */
const STAGE_TONE: Record<KrsStage | "clash", { tone: keyof typeof TONE_COLOR & TextTone; icon: (typeof Icons)[keyof typeof Icons] }> = {
  send: { tone: "warning", icon: Icons.AlertTriangle },
  advisor: { tone: "muted", icon: Icons.Clock },
  ukt: { tone: "warning", icon: Icons.Wallet },
  official: { tone: "info", icon: Icons.Clock },
  done: { tone: "success", icon: Icons.ShieldCheck },
  clash: { tone: "warning", icon: Icons.Overlap },
};

export function Tab(_: { onCalendar?: () => void }) {
  const t = useT();
  const theme = useTheme();
  const plan = useDataset("six.krs");
  const schedule = useSchedule();
  const now = useNow();
  if (!plan)
    return (
      <SixNeeded
        datasets={["six.krs"]}
        icon={<Icons.ClipboardCheck size={20} color={theme.color.muted} />}
        title={t("krs.needSix")}
        body={t("krs.needSixBody")}
      />
    );
  const { plan: steps, change } = krsTimeline(plan);
  const overlaps = krsOverlaps(
    plan.courses.map((c) => c.code),
    schedule,
    now,
  );
  return (
    <View style={{ gap: space[8] }}>
      <SixPageNote datasets={["six.krs"]} />
      <Stage plan={plan} overlaps={overlaps.filter((o) => o.upcoming)} />
      <Courses plan={plan} overlaps={overlaps} />
      <View style={{ gap: space[8] }}>
        <Timeline title={t("krs.round.plan")} steps={steps} />
        {change && <Timeline title={t("krs.round.change")} steps={change} />}
      </View>
    </View>
  );
}

/**
 * The plan's one honest status, and the next step. An official KRS with a clash still to come is
 * not "nothing to do": it says so in amber, what to do about it, and where to see it.
 */
function Stage({ plan, overlaps }: { plan: KrsPlan; overlaps: Overlap[] }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const nav = useNav();
  const theme = useTheme();
  const termYears = useTermYears();
  const calendar = useDataset("itb.calendar");
  const stage = krsStage(plan);
  const clash = overlaps.length > 0 && (stage === "done" || stage === "official");
  const { tone, icon: Icon } = STAGE_TONE[clash ? "clash" : stage];
  const window = nextKrsWindow(plan, calendar, now);
  const day = (iso: string) => f.dayMonth(Date.parse(`${iso}T12:00:00+07:00`));
  const first = overlaps[0];
  const when = first ? `${f.weekdayShort(first.start)} ${f.dayMonth(first.start)}, ${f.timeRange(first.start, first.end)}` : "";
  return (
    <Card variant="raised" style={{ paddingHorizontal: space[4], paddingVertical: space[4] }} testID="card.krsStage">
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2.5] }}>
        <View style={{ paddingTop: 3 }}>
          <Icon size={18} color={theme.color[TONE_COLOR[tone]]} weight="bold" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="title" weight="semibold" tone={clash ? "warning" : "fg"}>
            {clash ? t(stage === "done" ? "krs.stage.clash" : "krs.stage.clashApproved", { count: overlaps.length }) : t(`krs.stage.${stage}`)}
          </Text>
          {clash && first ? (
            <>
              <Text size="body" style={{ marginTop: 2 }}>
                {t("krs.overlap", { a: first.codes[0], b: first.codes[1], when, count: first.count })}
              </Text>
              <Text size="small" tone="muted" style={{ marginTop: space[1] }}>
                {window?.kind === "urs"
                  ? t("krs.clash.nextUrs", { a: first.codes[0], b: first.codes[1], range: `${day(window.event.firstDay)}–${day(window.event.lastDay)}` })
                  : t("krs.clash.next", { a: first.codes[0], b: first.codes[1] })}
              </Text>
            </>
          ) : (
            <Text size="small" tone="muted" style={{ marginTop: 2 }}>
              {t(`krs.stage.${stage}.hint`)}
            </Text>
          )}
          <View style={{ marginTop: space[2] }}>
            <Meta size="caption">
              {termYears(plan.term)}
              {plan.advisor ? t("krs.advisor", { name: plan.advisor }) : ""}
            </Meta>
          </View>
          {clash && (
            <View style={{ marginTop: space[3], flexDirection: "row" }}>
              <Button onPress={() => nav.go({ screen: "schedule" })} testID="action.toSchedule">
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
                  <Text size="small" weight="semibold">
                    {t("krs.toSchedule")}
                  </Text>
                  <Icons.ChevronRight size={16} />
                </View>
              </Button>
            </View>
          )}
        </View>
      </View>
      {window && (
        <View
          style={{
            marginTop: space[3],
            paddingTop: space[3],
            borderTopWidth: 1,
            borderTopColor: theme.color.line,
            flexDirection: "row",
            alignItems: "center",
            gap: space[2],
          }}
        >
          <Icons.CalendarClock size={14} color={theme.color.muted} />
          <Text size="small" weight={window.open ? "medium" : "regular"} tone={window.open ? "fg" : "muted"} style={{ flex: 1 }}>
            {window.open
              ? t(`krs.window.${window.kind}.open`, { date: day(window.event.lastDay) })
              : t(`krs.window.${window.kind}.next`, { range: `${day(window.event.firstDay)} – ${day(window.event.lastDay)}` })}
          </Text>
        </View>
      )}
    </Card>
  );
}

function Timeline({ title, steps }: { title: string; steps: KrsStep[] }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  return (
    <View>
      <Text size="small" weight="semibold" accessibilityRole="header" style={{ marginBottom: space[3] }}>
        {title}
      </Text>
      <View style={{ marginLeft: 6, borderLeftWidth: 1, borderLeftColor: theme.color.line, paddingLeft: space[5], gap: space[4] }}>
        {steps.map((step) => (
          <View key={step.key}>
            <View
              style={{
                position: "absolute",
                top: 3,
                left: -space[5] - 8,
                width: 15,
                height: 15,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: step.done ? 2 : 1,
                borderColor: step.done ? theme.color.canvas : theme.color.track,
                backgroundColor: step.done ? theme.color.live : theme.color.surface,
              }}
            >
              {step.done && <Icons.Check size={9} color="#ffffff" weight="bold" />}
            </View>
            <Text size="body" weight="medium" tone={step.done ? "fg" : "muted"}>
              {t(`krs.step.${step.key}`)}
            </Text>
            <Meta size="caption">
              {step.key === "ukt"
                ? step.done
                  ? step.amount != null
                    ? rupiah(step.amount)
                    : t("bills.status.paid")
                  : t("krs.step.uktUnpaid")
                : step.at !== null
                  ? [`${f.weekdayShort(step.at)}, ${f.dayMonth(step.at)}`, f.time(step.at)]
                  : step.done
                    ? "-"
                    : t("krs.step.notYet")}
            </Meta>
          </View>
        ))}
      </View>
    </View>
  );
}

function Courses({ plan, overlaps }: { plan: KrsPlan; overlaps: Overlap[] }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const { go } = useNav();
  const term = useTermCourses();
  const colorOf = useCourseColor();
  // A total, class or approval SIX writes in a way the app can't read yet is "-", never 0 and never "not approved".
  const sks = plan.sks ?? "-";
  const over = plan.maxSks !== null && plan.sks !== null && plan.sks > plan.maxSks;
  // Say once what every row shares; chips only where a row differs. No class read on any row: nothing to say.
  const classes = new Set(plan.courses.map((c) => c.classNo));
  const oneClass = classes.size === 1;
  const sameClass = oneClass ? [...classes][0] : null;
  const allApproved = plan.courses.every((c) => c.approved === true);
  const clashWith = (code: string) => overlaps.filter((o) => o.upcoming && o.codes.includes(code)).map((o) => o.codes.find((c) => c !== code)!);
  const past = overlaps.filter((o) => !o.upcoming);
  return (
    <Section
      first
      title={t("krs.courses")}
      action={
        <Text size="small" weight="medium" tone={over ? "danger" : "muted"} tabular>
          {plan.maxSks !== null ? t("krs.sksOfMax", { sks, max: plan.maxSks }) : t("krs.sks", { sks })}
        </Text>
      }
      testID="section.krsCourses"
    >
      {plan.maxSks !== null && plan.sks !== null && (
        <>
          <Bar
            style={{ marginBottom: space[3] }}
            value={plan.sks / plan.maxSks}
            color={over ? theme.color.dangerFg : theme.color.meterSuccess}
            label={t("krs.sksOfMax", { sks: plan.sks, max: plan.maxSks })}
          />
          {over && (
            <Text size="small" weight="medium" tone="danger" style={{ marginBottom: space[3] }}>
              {t("krs.overMax", { max: plan.maxSks })}
            </Text>
          )}
        </>
      )}
      <List>
        {plan.courses.map((course) => {
          const known = term?.find((c) => c.code === course.code);
          const clashes = clashWith(course.code);
          return (
            <Row
              key={course.code}
              testID={`row.course.${course.code}`}
              leading={<CourseCode code={course.code} color={colorOf(course.code)} />}
              title={course.name}
              meta={
                clashes.length || !oneClass ? (
                  <Meta>
                    {oneClass ? "" : t("krs.class", { classNo: course.classNo ?? "-" })}
                    {clashes.length ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Icons.Overlap size={12} color={theme.color.warningFg} weight="bold" />
                        <Text size="small" weight="medium" tone="warning">
                          {t("krs.clashWith", { code: clashes.join(", ") })}
                        </Text>
                      </View>
                    ) : (
                      ""
                    )}
                  </Meta>
                ) : undefined
              }
              trailing={
                <>
                  <Text size="small" weight="medium" tabular>
                    {t("krs.sks", { sks: course.sks ?? "-" })}
                  </Text>
                  {course.approved === false && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Icons.Clock size={12} color={theme.color.warningFg} />
                      <Text size="caption" weight="semibold" tone="warning">
                        {t("krs.notApproved")}
                      </Text>
                    </View>
                  )}
                </>
              }
              onPress={known ? () => go({ screen: "course", code: course.code }) : undefined}
            />
          );
        })}
      </List>
      <View style={{ marginTop: space[2] }}>
        <Meta size="caption" tone="faint">
          {sameClass ? t("krs.sameClass", { classNo: sameClass }) : ""}
          {allApproved ? t("krs.allApproved") : ""}
          {t("krs.from")}
        </Meta>
      </View>
      {past.map((overlap) => (
        <View key={overlap.codes.join()} style={{ marginTop: space[2], flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
          <View style={{ paddingTop: 2 }}>
            <Icons.Overlap size={14} color={theme.color.muted} />
          </View>
          <Text size="small" tone="muted" style={{ flex: 1 }}>
            {t("krs.overlap.past", {
              a: overlap.codes[0],
              b: overlap.codes[1],
              when: `${f.weekdayShort(overlap.start)} ${f.dayMonth(overlap.start)}, ${f.timeRange(overlap.start, overlap.end)}`,
              count: overlap.count,
            })}
          </Text>
        </View>
      ))}
    </Section>
  );
}
