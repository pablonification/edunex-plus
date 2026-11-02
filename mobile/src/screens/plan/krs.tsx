// Rencana studi › KRS on the phone (src/app/screens/plan/krs.tsx, S14; round 2, v4): this term's study plan and its
// approval, in one column.
// 1. One card led by the SKS taken of the most allowed (a big number that counts up once, a thin bar), the term and
//    the advisor a quiet line over it, the plan's one state as a pill, the next KRS window, and SIX's KRS page as the
//    one button while there's a KRS to send.
// 2. Each clash still to come as a row right under it (its when on one line): its sheet says what to do about it and
//    opens Jadwal.
// 3. The courses as rows in their colours: name, code and SKS, one short status (Bentrok, or not approved yet).
// 4. The plan's steps with their times (and the change round's), below the fold. View only.
import { useState } from "react";
import { View } from "react-native";
import { useTermCourses } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { type KrsStage, type KrsStep, krsOverlaps, krsStage, krsTimeline, nextKrsWindow, type Overlap, rupiah } from "../../../../src/core/academic";
import { SIX_WEB, sixPageOf } from "../../../../src/core/links";
import type { ClassSession, KrsPlan } from "../../../../src/core/models";
import { useNav } from "../../nav";
import { SixPageNote } from "../../parts/six-page-note";
import { BigButton } from "../../ui/big-button";
import { Rise } from "../../ui/expressive";
import { Figure, FigureLabel, Group, GroupRow, Heading, IconTile, Panel, Pill, type PillTone } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Meter } from "../../ui/meter";
import { ActionSheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { font, space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { Later } from "./deferred";
import { useTermYears } from "./projection";
import { SixNeeded } from "./six-needed";

function useSchedule(): ClassSession[] {
  return useDataset("six.schedule") ?? [];
}

const RISE = "plan-krs";

/** Each state's pill: amber where the Student has something to do, green once it's official. */
const STAGE_TONE: Record<KrsStage, PillTone> = {
  send: "amber",
  advisor: "plain",
  ukt: "amber",
  official: "brand",
  done: "ok",
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
  const upcoming = overlaps.filter((o) => o.upcoming);
  const past = overlaps.filter((o) => !o.upcoming);
  return (
    <View>
      <SixPageNote datasets={["six.krs"]} />
      <Rise screen={RISE} index={0}>
        <Stage plan={plan} overlaps={upcoming} />
      </Rise>
      {upcoming.length > 0 && (
        <Rise screen={RISE} index={1} style={{ marginTop: space[3] }}>
          <Clashes overlaps={upcoming} plan={plan} />
        </Rise>
      )}
      <Rise screen={RISE} index={2}>
        <Courses plan={plan} overlaps={overlaps} />
      </Rise>
      <Later>
        {past.length > 0 && <Clashes overlaps={past} plan={plan} past />}
        <Timeline title={t("krs.round.plan")} steps={steps} />
        {change && <Timeline title={t("krs.round.change")} steps={change} />}
      </Later>
    </View>
  );
}

/** "Kam 8 Okt 16:00–16:30": when a clash is (next, or last), short enough for a row's one line. */
function useWhen(): (overlap: Overlap) => string {
  const f = useFormat();
  return (o) => `${f.weekdayShort(o.start)} ${f.dayMonth(o.start)} ${f.timeRange(o.start, o.end)}`;
}

/**
 * The leading card: the SKS taken, big, and the plan's one state as a pill. A clash still to come is the row right
 * under the card (judge round 3: one status on the card); a screen reader hears it with the state.
 */
function Stage({ plan, overlaps }: { plan: KrsPlan; overlaps: Overlap[] }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const open = useOpenExternal();
  const termYears = useTermYears();
  const calendar = useDataset("itb.calendar");
  const student = useDataset("six.student");
  const stage = krsStage(plan);
  const clash = overlaps.length > 0 && (stage === "done" || stage === "official");
  const window = nextKrsWindow(plan, calendar, now);
  const day = (iso: string) => f.dayMonth(Date.parse(`${iso}T12:00:00+07:00`));
  // A total SIX writes in a way the app can't read yet is "-", never 0.
  const over = plan.maxSks !== null && plan.sks !== null && plan.sks > plan.maxSks;
  const total = plan.maxSks !== null ? t("krs.sksOfMax", { sks: plan.sks ?? "-", max: plan.maxSks }) : t("krs.sks", { sks: plan.sks ?? "-" });
  const state = clash ? t(stage === "done" ? "krs.stage.clash" : "krs.stage.clashApproved", { count: overlaps.length }) : t(`krs.stage.${stage}`);
  // SIX's KRS page while there's a KRS to send and SIX takes it (its window open, or no window known).
  const canSend = stage === "send" && (!window || window.open);
  return (
    <Panel testID="card.krsStage" style={{ padding: space[5], gap: space[3] }}>
      <Text size="bodyMedium" style={{ color: v.muted }}>
        {factsLabel(termYears(plan.term), plan.advisor && t("krs.advisor", { name: plan.advisor }))}
      </Text>
      <View accessible accessibilityLabel={total}>
        <FigureLabel>{t("mobile.krs.sksLabel")}</FigureLabel>
        {plan.sks === null ? (
          <Text style={{ fontFamily: font.display.extrabold, fontSize: 44, lineHeight: 51, color: v.fg }}>-</Text>
        ) : (
          <Figure
            id="krs.sks"
            value={plan.sks}
            unit={plan.maxSks !== null ? t("mobile.krs.ofMax", { max: plan.maxSks }) : "SKS"}
            color={over ? v.redFg : undefined}
          />
        )}
      </View>
      {plan.maxSks !== null && plan.sks !== null && <Meter value={plan.sks / plan.maxSks} color={over ? v.redFg : v.brand} label={total} />}
      {over && (
        <Text size="bodyMedium" weight="medium" style={{ color: v.redFg }}>
          {t("krs.overMax", { max: plan.maxSks! })}
        </Text>
      )}
      <View accessible accessibilityLabel={state} style={{ flexDirection: "row" }}>
        <Pill tone={STAGE_TONE[stage]}>{t(`krs.stage.${stage}`)}</Pill>
      </View>
      {window && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Icons.CalendarClock size={16} color={window.open ? v.fg : v.muted} />
          <Text size="bodyMedium" weight={window.open ? "medium" : "regular"} style={{ color: window.open ? v.fg : v.muted, flex: 1 }}>
            {window.open
              ? t(`krs.window.${window.kind}.open`, { date: day(window.event.lastDay) })
              : t(`krs.window.${window.kind}.next`, { range: `${day(window.event.firstDay)} – ${day(window.event.lastDay)}` })}
          </Text>
        </View>
      )}
      {canSend && (
        <View style={{ marginTop: space[1] }}>
          <BigButton
            icon={<Icons.ArrowUpRight size={18} color={v.onBrand} />}
            onPress={() => open(student ? sixPageOf("six.krs", student) : SIX_WEB)}
            testID="action.krs.openSix"
          >
            {t("mobile.krs.openSix")}
          </BigButton>
        </View>
      )}
    </Panel>
  );
}

/** Clashes as rows: each still to come opens its sheet (what to do, and Jadwal); one that's over is a quiet fact under the courses. */
function Clashes({ overlaps, plan, past = false }: { overlaps: Overlap[]; plan: KrsPlan; past?: boolean }) {
  const t = useT();
  const v = useTheme().v4;
  const when = useWhen();
  const [picked, setPicked] = useState<Overlap | null>(null);
  return (
    <View style={past ? { marginTop: space[3] } : undefined}>
      <Group testID={past ? "section.krsPastClashes" : "section.krsClashes"}>
        {overlaps.map((o, i) => {
          const [a, b] = o.codes;
          return past ? (
            <GroupRow
              key={o.codes.join()}
              first={i === 0}
              leading={<IconTile tone="plain" icon={(color) => <Icons.Overlap size={22} color={color} />} />}
              title={
                <Text size="bodyLarge" style={{ color: v.muted }}>
                  {t("mobile.krs.clashPast.title", { a, b })}
                </Text>
              }
              meta={t("mobile.krs.clashPast.meta", { when: when(o), count: o.count })}
            />
          ) : (
            <GroupRow
              key={o.codes.join()}
              first={i === 0}
              leading={<IconTile tone="amber" icon={(color) => <Icons.Overlap size={22} color={color} weight="bold" />} />}
              title={t("mobile.krs.clash.title", { a, b })}
              meta={
                <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: v.muted }}>
                  {when(o)}
                </Text>
              }
              accessibilityLabel={factsLabel(t("mobile.krs.clash.title", { a, b }), t("mobile.krs.clash.meta", { when: when(o), count: o.count }))}
              onPress={() => setPicked(o)}
              testID={`row.krsClash.${o.codes.join("-")}`}
            />
          );
        })}
      </Group>
      {!past && <ClashSheet plan={plan} overlap={picked} onClose={() => setPicked(null)} />}
    </View>
  );
}

/**
 * A clash's sheet: when it is, the one thing to do about it once the KRS is approved (ask the lecturers, or change it
 * in the URS window), and Jadwal at it.
 */
function ClashSheet({ plan, overlap, onClose }: { plan: KrsPlan; overlap: Overlap | null; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const nav = useNav();
  const theme = useTheme();
  const when = useWhen();
  const calendar = useDataset("itb.calendar");
  const stage = krsStage(plan);
  const window = nextKrsWindow(plan, calendar, now);
  const day = (iso: string) => f.dayMonth(Date.parse(`${iso}T12:00:00+07:00`));
  const [a, b] = overlap?.codes ?? ["", ""];
  const advice =
    stage === "done" || stage === "official"
      ? window?.kind === "urs"
        ? t("krs.clash.nextUrs", { a, b, range: `${day(window.event.firstDay)}–${day(window.event.lastDay)}` })
        : t("krs.clash.next", { a, b })
      : null;
  return (
    <ActionSheet
      open={overlap !== null}
      onClose={onClose}
      title={overlap ? t("mobile.krs.clash.title", { a, b }) : undefined}
      message={overlap ? factsLabel(t("mobile.krs.clash.meta", { when: when(overlap), count: overlap.count }), advice) : undefined}
      testID="sheet.krsClash"
      choices={[
        {
          label: t("krs.toSchedule"),
          icon: <Icons.Calendar size={20} color={theme.color.fg} />,
          onPress: () => nav.go({ screen: "schedule" }),
          testID: "action.toSchedule",
        },
      ]}
    />
  );
}

function Courses({ plan, overlaps }: { plan: KrsPlan; overlaps: Overlap[] }) {
  const t = useT();
  const v = useTheme().v4;
  const { go } = useNav();
  const term = useTermCourses();
  // Say once what every row shares; a row says only where it differs. No class read on any row: nothing to say.
  const classes = new Set(plan.courses.map((c) => c.classNo));
  const oneClass = classes.size === 1;
  const sameClass = oneClass ? [...classes][0] : null;
  const allApproved = plan.courses.every((c) => c.approved === true);
  const clashWith = (code: string) => overlaps.filter((o) => o.upcoming && o.codes.includes(code)).map((o) => o.codes.find((c) => c !== code)!);
  return (
    <View testID="section.krsCourses">
      <Heading>{t("krs.courses")}</Heading>
      <Group>
        {plan.courses.map((course, i) => {
          const known = term?.find((c) => c.code === course.code);
          const clashes = clashWith(course.code);
          return (
            <GroupRow
              key={course.code}
              first={i === 0}
              testID={`row.course.${course.code}`}
              leading={<CourseTile code={course.code} name={course.name} />}
              title={course.name}
              // A class or approval SIX writes in a way the app can't read yet is "-", never "not approved".
              meta={factsLabel(course.code, t("krs.sks", { sks: course.sks ?? "-" }), !oneClass && t("krs.class", { classNo: course.classNo ?? "-" }))}
              accessibilityLabel={factsLabel(
                course.name,
                course.code,
                t("krs.sks", { sks: course.sks ?? "-" }),
                clashes.length > 0 && t("krs.clashWith", { code: clashes.join(", ") }),
                course.approved === false && t("krs.notApproved"),
              )}
              trailing={
                clashes.length ? (
                  <Pill tone="amber">{t("mobile.home.chip.clash")}</Pill>
                ) : course.approved === false ? (
                  <Pill tone="amber">{t("krs.notApproved")}</Pill>
                ) : undefined
              }
              onPress={known ? () => go({ screen: "course", code: course.code }) : undefined}
            />
          );
        })}
      </Group>
      <Text size="bodyMedium" style={{ color: v.muted, marginTop: space[2], marginLeft: space[1] }}>
        {factsLabel(sameClass && t("krs.sameClass", { classNo: sameClass }), allApproved && t("krs.allApproved"), t("krs.from"))}
      </Text>
    </View>
  );
}

/** A round's steps as rows: a check once done, when it happened (or the UKT paid), quiet until then. */
function Timeline({ title, steps }: { title: string; steps: KrsStep[] }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  return (
    <View>
      <Heading>{title}</Heading>
      <Group>
        {steps.map((step, i) => (
          <GroupRow
            key={step.key}
            first={i === 0}
            leading={
              <IconTile
                tone={step.done ? "ok" : "plain"}
                icon={(color) => (step.done ? <Icons.Check size={22} color={color} weight="bold" /> : <Icons.Circle size={20} color={color} />)}
              />
            }
            title={
              <Text size="bodyLarge" weight="medium" style={{ color: step.done ? v.fg : v.muted }}>
                {t(`krs.step.${step.key}`)}
              </Text>
            }
            meta={
              step.key === "ukt"
                ? step.done
                  ? step.amount != null
                    ? rupiah(step.amount)
                    : t("bills.status.paid")
                  : t("krs.step.uktUnpaid")
                : step.at !== null
                  ? factsLabel(`${f.weekdayShort(step.at)}, ${f.dayMonth(step.at)}`, f.time(step.at))
                  : step.done
                    ? "-"
                    : t("krs.step.notYet")
            }
          />
        ))}
      </Group>
    </View>
  );
}
