// Rencana's leading card and the semesters behind the Student (round 2, v4). In three seconds: when do I graduate.
// The card leads with the semester the plan graduates in, big and counting up once, with whether that's on time, and
// the IPK it graduates with beside it: nothing else (the SKS bar is Kurikulum's, the predicate Nilai's). When a rule
// wants a look, the count of them is a row of its own under the card (it scrolls to the rules). A plan that can't
// graduate leads with its SKS against the need instead, and what's missing.
import { memo, useMemo } from "react";
import { View } from "react-native";
import { useFormat, useLang, useT } from "../../../../src/app/i18n";
import type { StudyPlan } from "../../../../src/core/models";
import { isHidden, type ProjectedStep, type Projection, passedSks, type Rule, type SksModel, type StudentRecord, sksModel } from "../../../../src/core/planner";
import { HiddenFigure, useGradesHidden, useGradeWords } from "../../parts/hide-grades";
import { Skeleton } from "../../ui/display";
import { Figure, FigureCell, FigureDash, FigureRow, Group, GroupRow, IconTile, Panel, Pill } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Text } from "../../ui/text";
import { font, type Palette, radius, space, useTheme } from "../../ui/theme";
import { usePlaceState } from "./place-state";
import { useShortfallText } from "./planner-kit";
import { useTermLabel } from "./projection";

type Finish = Extract<Rule, { id: "finish" }>;

export const PlanHero = memo(function PlanHero({
  record,
  plan,
  projection,
  rules,
  onCheck,
}: {
  record: StudentRecord;
  plan: StudyPlan;
  projection: Projection;
  rules: Rule[];
  onCheck: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const v = useTheme().v4;
  const shortfall = useShortfallText();
  const sks = useMemo(() => sksModel(record, plan), [record, plan]);
  const finish = rules.find((r): r is Finish => r.id === "finish");
  const warnings = rules.filter((r) => r.level === "warn" && !isHidden(r, plan)).length;
  const ipk = projection.finalIpk;
  const late = finish && !finish.blocked && finish.semester > finish.normal;
  const hidden = useGradesHidden();
  return (
    <View style={{ gap: space[3] }}>
      <Panel testID="card.planSummary" style={{ padding: space[5], gap: space[4] }}>
        {/* Side by side while they fit; at a big font size the IPK goes under the semester. */}
        <FigureRow>
          {finish?.blocked ? (
            <FigureCell
              label={t("mobile.planner.sksInPlan")}
              accessibilityLiveRegion="polite"
              under={
                <Pill tone="red" icon={(color) => <Icons.AlertTriangle size={14} color={color} weight="bold" />}>
                  {t("planner.notYet")}
                </Pill>
              }
            >
              <Figure id="planner.sks" value={sks.total} unit={t("mobile.academic.sksOf", { need: sks.need })} color={sks.short ? v.redFg : undefined} />
            </FigureCell>
          ) : (
            <FigureCell
              label={t("mobile.planner.finishIn")}
              accessibilityLiveRegion="polite"
              under={finish ? <Pill tone={late ? "amber" : "ok"}>{late ? t("planner.late", { normal: finish.normal }) : t("planner.onTime")}</Pill> : undefined}
            >
              {finish ? <Figure id="planner.finish" value={finish.semester} /> : <FigureDash />}
            </FigureCell>
          )}
          <FigureCell label={t("grades.graduation")}>
            {ipk === null ? (
              <FigureDash />
            ) : hidden ? (
              <HiddenFigure
                name={t("grades.graduation")}
                style={{ fontFamily: font.display.extrabold, fontSize: 44, lineHeight: 51, letterSpacing: -1, color: v.fg }}
              />
            ) : (
              <Figure id="planner.ipk" value={ipk} decimals={2} comma={lang === "id"} />
            )}
          </FigureCell>
        </FigureRow>
        {finish?.blocked ? (
          <Text size="bodyMedium" weight="medium" style={{ color: v.redFg }}>
            {t("planner.shortfall", { list: shortfall(finish.blocked) })}
          </Text>
        ) : null}
      </Panel>
      {warnings ? (
        // The rules sit beside the plan on the desktop; here they're further down, so the count takes you there.
        <Group>
          <GroupRow
            first
            leading={<IconTile tone="amber" icon={(color) => <Icons.AlertTriangle size={22} color={color} weight="bold" />} />}
            title={t("planner.toCheck", { count: warnings })}
            onPress={onCheck}
            accessibilityRole="button"
            accessibilityHint={t("mobile.planner.toCheckHint")}
            accessibilityLiveRegion="polite"
            testID="action.planChecks"
          />
        </Group>
      ) : null}
    </View>
  );
});

/**
 * Passed, this semester and planned as a bar, with its legend unless `legend` is false (Kurikulum's card keeps the bar
 * alone); with `headline`, the SKS against what graduating needs over it ("144 SKS terpenuhi +7 cadangan").
 */
export function SksBar({ sks, headline = true, legend = true }: { sks: SksModel; headline?: boolean; legend?: boolean }) {
  const t = useT();
  const theme = useTheme();
  const v = theme.v4;
  const scale = Math.max(sks.need, sks.total) || 1;
  const share = (n: number) => `${(n / scale) * 100}%` as const;
  const parts: { n: number; label: string; color: keyof Palette; opacity: number }[] = [
    { n: sks.passed, label: t("planner.legend.passed", { n: sks.passed }), color: "meterSuccess", opacity: 1 },
    { n: sks.inProgress, label: t("planner.legend.now", { n: sks.inProgress }), color: "meterSuccess", opacity: 0.45 },
    { n: sks.planned, label: t("planner.legend.planned", { n: sks.planned }), color: "infoFg", opacity: 0.55 },
    // Only once the Student said their program will add a required course.
    ...(sks.byProgram ? [{ n: sks.byProgram, label: t("planner.legend.byProgram", { n: sks.byProgram }), color: "infoFg" as const, opacity: 0.25 }] : []),
  ];
  return (
    <View style={{ gap: space[2] }}>
      {headline ? (
        <Text size="bodyMedium" weight="medium" tabular style={{ color: v.fg }}>
          {sks.short ? t("planner.sksShort", { total: sks.total, need: sks.need }) : t("planner.sksDone", { need: sks.need })}
          {sks.short || sks.extra ? (
            <Text size="bodyMedium" weight="semibold" style={{ color: sks.short ? v.redFg : v.okFg }}>
              {`  ${sks.short ? t("planner.sksShortBy", { short: sks.short }) : t("planner.sksSpare", { extra: sks.extra })}`}
            </Text>
          ) : null}
        </Text>
      ) : null}
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t("planner.progress")}
        accessibilityValue={{ min: 0, max: sks.need, now: Math.min(sks.total, sks.need) }}
        // The meters' own track and green, so what has passed reads 3:1 on it in both themes.
        style={{ flexDirection: "row", gap: 2, height: 10, borderRadius: radius.full, overflow: "hidden", backgroundColor: theme.color.meterTrack }}
      >
        {parts.map((part) => (
          <View key={part.label} style={{ height: "100%", width: share(part.n), backgroundColor: theme.color[part.color], opacity: part.opacity }} />
        ))}
        {sks.total > sks.need && <View style={{ position: "absolute", top: 0, bottom: 0, width: 2, left: share(sks.need), backgroundColor: v.fg }} />}
      </View>
      {legend ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space[4], rowGap: space[1] }}>
          {parts.map((part) => (
            <View key={part.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color[part.color], opacity: part.opacity }} />
              <Text size="bodySmall" tabular style={{ color: v.muted }}>
                {part.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The semesters behind the Student, folded: "Semester 1–6 · 125 SKS lulus · IPK 3,26". `action.planner.past` opens it. */
export const PastTerms = memo(function PastTerms({ record, steps }: { record: StudentRecord; steps: ProjectedStep[] }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const termLabel = useTermLabel();
  const [open, setOpen] = usePlaceState("planner.past", false);
  // Hidden grades: dots where the IPK and each IP were.
  const words = useGradeWords();
  if (!steps.length) return null;
  const ipk = record.transcript ? (record.transcript.ipk.six ?? record.transcript.ipk.computed) : null;
  const last = steps.at(-1)?.semester ?? steps.length;
  return (
    <Group>
      <GroupRow
        first
        leading={<IconTile tone="plain" icon={(color) => <Icons.History size={22} color={color} />} />}
        title={t("planner.past", { n: last })}
        meta={t("planner.pastMeta", { sks: passedSks(record) ?? "-", ipk: ipk === null ? "-" : words(f.number(ipk, 2)) })}
        trailing={
          <View testID={open ? "action.planner.past.open" : undefined} style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
            <Icons.ChevronRight size={18} color={v.muted} />
          </View>
        }
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        testID="action.planner.past"
      />
      {open &&
        steps.map((s) => (
          <GroupRow
            key={s.term}
            leading={<View style={{ width: 44 }} />}
            title={
              <Text size="bodyMedium" weight="medium" style={{ color: v.fg }}>
                {termLabel(s.term, s.semester)}
              </Text>
            }
            meta={factsLabel(`IP ${s.ip === null ? "-" : words(f.number(s.ip, 2))}`, `${s.sks ?? "-"} SKS`)}
          />
        ))}
    </Group>
  );
});

/** Rencana's shape while SIX's record is on its way: the leading card, then a semester's rows. */
export function PlannerSkeleton() {
  return (
    <View accessibilityState={{ busy: true }} testID="planner.loading" style={{ gap: space[3] }}>
      <Panel style={{ padding: space[5], gap: space[4] }}>
        <Skeleton width="60%" height={14} />
        <View style={{ flexDirection: "row", gap: space[8] }}>
          <View style={{ gap: space[2] }}>
            <Skeleton width={96} height={14} />
            <Skeleton width={56} height={44} />
          </View>
          <View style={{ gap: space[2] }}>
            <Skeleton width={88} height={14} />
            <Skeleton width={80} height={44} />
          </View>
        </View>
        <Skeleton height={10} />
      </Panel>
      <View style={{ marginTop: space[3], marginLeft: space[1] }}>
        <Skeleton width="50%" height={18} />
      </View>
      <Group>
        {[0, 1, 2].map((i) => (
          <GroupRow
            key={i}
            first={i === 0}
            leading={<Skeleton width={44} height={44} />}
            title={<Skeleton width="70%" height={14} />}
            meta={<Skeleton width="40%" height={12} />}
          />
        ))}
      </Group>
    </View>
  );
}
