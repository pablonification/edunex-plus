// Rencana's outlook (round 2, v4): the one shared IPK target and what the rest needs for it, in the desktop's few words
// (why a target is out of reach is a tap on ⓘ away), the IPK path on its own white card, and each honors level as a row
// with its one status. How honors are decided (ITB's rule) and where the plan is kept are a tap deeper, in the plan's
// "about" sheet at the end of the page.
import { useState } from "react";
import { View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import type { PlanState } from "../../../../src/app/study-plan";
import { letterForAverage } from "../../../../src/core/honors";
import { GRADE_POINTS } from "../../../../src/core/models";
import { honorsOutlook, type Need, type Projection, type StudentRecord, targetOf } from "../../../../src/core/planner";
import { IconButton } from "../../ui/controls";
import { Group, GroupRow, IconTile, Panel, Pill, type PillTone } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { SectionHeading } from "./planner-kit";
import { HonorsSentence, IpkChart, NeedText, TargetControl } from "./projection";

export function Outlook({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const { plan, projection } = state;
  const target = targetOf(record, plan);
  const charted = projection.steps.filter((s) => s.ip !== null || s.ipk !== null).length >= 2;
  return (
    <View testID="card.outlook">
      <SectionHeading title={t("planner.outlook")} />
      <View style={{ gap: space[3] }}>
        <Panel style={{ padding: space[4], gap: space[3] }}>
          <TargetControl record={record} state={state} />
          <RestNeed need={projection.need(target)} target={target} sks={projection.variableSks} />
        </Panel>
        {charted && (
          <Panel style={{ paddingHorizontal: space[3], paddingTop: space[4], paddingBottom: space[3] }}>
            <IpkChart steps={projection.steps} target={target} best={projection.bestIpk} height={156} />
          </Panel>
        )}
        <Honors projection={projection} />
      </View>
    </View>
  );
}

/**
 * What the rest needs for the target, as the desktop's Outlook says it: out of reach in a few words with its why one
 * tap away, the average needed in a short line, or (nothing left, already secured, safe) NeedText's sentence.
 */
function RestNeed({ need, target, sks }: { need: Need; target: number; sks: number }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const [why, setWhy] = useState(false);
  if (need.kind === "out")
    return (
      <>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }} testID="planner.targetOut">
          <Text size="small" weight="medium" tone="fg" accessibilityLiveRegion="polite" style={{ flex: 1 }}>
            {t("planner.targetOutShort")}
          </Text>
          <IconButton label={t("action.why", { what: t("planner.targetOutWhy") })} onPress={() => setWhy(true)} testID="action.planner.targetOutWhy">
            <Icons.Info size={18} color={v.muted} />
          </IconButton>
        </View>
        <Sheet open={why} onClose={() => setWhy(false)} title={t("planner.targetOutShort")} background={v.card} testID="sheet.planner.targetOutWhy">
          <Text size="bodyLarge" style={{ color: v.fg, paddingBottom: space[2] }}>
            {t("planner.targetOutWhy")}
          </Text>
        </Sheet>
      </>
    );
  if (need.kind === "needs" && need.average > GRADE_POINTS.D + 1e-9)
    return (
      <Text size="small" tone="muted" accessibilityLiveRegion="polite">
        {t("planner.targetNeedShort", { avg: f.number(need.average, 2), letter: letterForAverage(need.average), sks })}
      </Text>
    );
  return <NeedText need={need} target={target} sks={sks} scope="rest" />;
}

/** Each honors level as a row (cum, magna, summa): its least IPK, and reached, what the rest needs, or why it's out. */
function Honors({ projection }: { projection: Projection }) {
  const t = useT();
  const f = useFormat();
  // ITB's rule for these (≥ 3,50, no retakes, within 9 semesters) is in the plan's "about" sheet.
  const outlook = honorsOutlook(projection).reverse();
  // Never three "di luar jangkauan" in a row: when every level is out, one honest, positive sentence.
  if (outlook.every((h) => h.kind === "out"))
    return (
      <Panel style={{ padding: space[4] }} testID="planner.honors">
        <HonorsSentence projection={projection} />
      </Panel>
    );
  return (
    <Group testID="planner.honors">
      {outlook.map((h, i) => {
        const status: { tone: PillTone; text: string } =
          h.kind === "blocked"
            ? { tone: "amber", text: t(h.reason === "retake" ? "honors.retake" : "honors.time") }
            : h.kind === "secured"
              ? { tone: "ok", text: t("honors.secured") }
              : h.kind === "needs"
                ? { tone: "brand", text: t("honors.needs", { avg: f.number(h.average, 2), letter: letterForAverage(h.average) }) }
                : h.kind === "out"
                  ? { tone: "plain", text: t("honors.out") }
                  : { tone: "plain", text: "-" };
        return (
          <GroupRow
            key={h.level}
            first={i === 0}
            title={t(`honors.${h.level}`)}
            meta={`≥ ${f.number(h.min, 2)}`}
            trailing={
              <View style={{ flexShrink: 1, maxWidth: "60%", alignItems: "flex-end" }}>
                <Pill tone={status.tone}>{status.text}</Pill>
              </View>
            }
          />
        );
      })}
    </Group>
  );
}

/** The plan's quiet facts, one tap deeper: where it's kept, and how honors are decided. */
export function AboutPlan() {
  const t = useT();
  const v = useTheme().v4;
  const [open, setOpen] = useState(false);
  return (
    <>
      <Group style={{ marginTop: space[3] }}>
        <GroupRow
          first
          leading={<IconTile tone="plain" icon={(color) => <Icons.Info size={22} color={color} />} />}
          title={t("mobile.planner.about")}
          meta={t("mobile.planner.aboutMeta")}
          onPress={() => setOpen(true)}
          testID="action.planner.about"
        />
      </Group>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("mobile.planner.about")} background={v.card} testID="sheet.planner.about">
        <View style={{ gap: space[4], paddingBottom: space[2] }}>
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Icons.Lock size={20} color={v.fg2} />
            <Text size="bodyLarge" style={{ color: v.fg2, flex: 1 }}>
              {t("planner.local")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Icons.GraduationCap size={20} color={v.fg2} />
            <Text size="bodyLarge" style={{ color: v.fg2, flex: 1 }}>
              {t("honors.rule")}
            </Text>
          </View>
        </View>
      </Sheet>
    </>
  );
}
