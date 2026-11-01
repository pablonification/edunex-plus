// The minors the Student is closest to (round 2, v4): one row each (its name, the program that runs it and whether
// it's registered or planned, the SKS so far of what it needs at the end), a tap opening the minor up close: SIX's
// rules for it, each course with where it stands and a way to plan it, and planning (or stopping) the minor itself.
import { useState } from "react";
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import type { PlanState } from "../../../../src/app/study-plan";
import { nearestLetter } from "../../../../src/core/honors";
import type { StudyPlan } from "../../../../src/core/models";
import {
  activeMinor,
  activeSpecialization,
  addCourse,
  type CourseState,
  courseInfo,
  courseState,
  type MinorOption,
  minorProgress,
  NORMAL_SKS,
  notContinuing,
  packageKey,
  planMinor,
  rankedMinors,
  type StudentRecord,
  semesterOf,
  startingIpk,
  termKind,
} from "../../../../src/core/planner";
import { Button } from "../../ui/controls";
import { Group, GroupRow, IconTile, Pill } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { SectionHeading, type Undoable } from "./planner-kit";
import { useNotContinuing } from "./planner-rules";
import { useTermLabel } from "./projection";

export function Minors({ record, state, undoable }: { record: StudentRecord; state: PlanState; undoable: Undoable }) {
  const t = useT();
  const v = useTheme().v4;
  const { plan } = state;
  const [open, setOpen] = useState<string | null>(null);
  const ranked = rankedMinors(record, plan);
  const active = activeMinor(record, plan)?.key ?? null;
  const pinned = (key: string) => key === active || key === record.registeredMinor;
  const shown = [...ranked.filter((m) => pinned(m.key)), ...ranked.filter((m) => !pinned(m.key) && m.have > 0).slice(0, 4)];
  const opened = record.minors.find((m) => m.key === open);
  return (
    <View testID="card.minors">
      <SectionHeading title={t("mobile.planner.minors")} />
      <Group>
        {shown.map((m, i) => {
          const on = active === m.key;
          const registered = record.registeredMinor === m.key;
          const stopped = registered && notContinuing(plan, "minor", m.name);
          const status = stopped ? t("planner.reasonShort.not-continuing") : registered ? t("planner.minorRegistered") : on ? t("planner.minorPlanned") : null;
          return (
            <GroupRow
              key={m.key}
              first={i === 0}
              leading={
                <IconTile
                  tone={(on || registered) && !stopped ? "brand" : "plain"}
                  icon={(color) => <Icons.Layers size={22} color={color} weight={on || registered ? "fill" : "regular"} />}
                />
              }
              title={m.name}
              meta={factsLabel(m.program, status)}
              trailing={
                <Text size="labelLarge" face="display" weight="bold" tabular style={{ color: v.fg2 }}>
                  {t("planner.minorSks", { have: m.have, need: m.need })}
                </Text>
              }
              onPress={() => setOpen(m.key)}
              testID={`row.minor.${m.key}`}
            />
          );
        })}
        {shown.length === 0 && (
          <GroupRow
            first
            title={
              <Text size="bodyMedium" style={{ color: v.muted }}>
                {t("planner.minorNone")}
              </Text>
            }
          />
        )}
      </Group>
      {opened && <MinorSheet record={record} state={state} minor={opened} undoable={undoable} onClose={() => setOpen(null)} />}
    </View>
  );
}

/** The first planned regular semester a course still fits in at the normal load, else the last one. */
function termFor(plan: StudyPlan, sks: number): string | null {
  const regular = plan.terms.filter((term) => termKind(term.term) !== "short");
  return (regular.find((term) => term.courses.reduce((sum, c) => sum + c.sks, 0) + sks <= NORMAL_SKS) ?? regular.at(-1))?.term ?? null;
}

/** A minor up close: SIX's rules, each course with where it stands and a way to plan it, and planning the minor itself, said plainly. */
function MinorSheet({
  record,
  state,
  minor,
  undoable,
  onClose,
}: {
  record: StudentRecord;
  state: PlanState;
  minor: MinorOption;
  undoable: Undoable;
  onClose: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const v = theme.v4;
  const termLabel = useTermLabel();
  const notContinuingItems = useNotContinuing(record, state.plan, undoable);
  const { plan } = state;
  const registered = record.registeredMinor === minor.key;
  const on = activeMinor(record, plan)?.key === minor.key;
  const stopped = registered && notContinuing(plan, "minor", minor.name);
  const progress = minorProgress(record, plan, minor);
  const have = progress.passed + progress.now + progress.planned;
  const grade = nearestLetter(startingIpk(record));
  const label = (term: string) => termLabel(term, semesterOf(term, record.entryTerm));
  const stateText = (code: string, st: CourseState) =>
    st === "passed" ? t("planner.state.passed", { grade: record.graded.get(code)?.grade ?? "" }) : st ? t(`planner.state.${st}`) : null;
  const termOf = (code: string) => (courseState(record, plan, code) ? null : termFor(plan, courseInfo(record, code).sks));
  // Toasts are drawn under a sheet: a decision about the minor closes it first, so its Undo is in view.
  // Adding its courses keeps the sheet open (each row turns into its new state, and the course's row removes it).
  const decide = (change: () => void) => {
    onClose();
    change();
  };
  const stop =
    on && registered
      ? // Registered on SIX: not continuing it is for good (a reset doesn't plan it again), its courses only it asks for leaving the plan if the Student wants.
        notContinuingItems({
          key: packageKey("minor", minor.name),
          title: t("rule.minor", { name: minor.name }),
          codes: minor.courses,
          keep: activeSpecialization(record, plan)?.courses.map((c) => c.code) ?? [],
          label: t("planner.hideReason.not-continuingMinor"),
        })
      : [];
  return (
    <Sheet
      open
      onClose={onClose}
      title={t("rule.minor", { name: minor.name })}
      background={v.card}
      // Planning (or stopping) the minor stays in view under its course list, however long.
      footer={
        on && registered ? (
          // One button, or the choice of keeping or removing its planned courses when there are some (both in view: no menu on a sheet).
          stop.map((choice) => (
            <View key={choice.label} style={{ gap: space[1] }}>
              <Button onPress={() => decide(choice.onPress)} testID="action.minorStop">
                {choice.label}
              </Button>
              {stop.length > 1 && choice.hint ? (
                <Text size="bodySmall" style={{ color: v.muted }}>
                  {choice.hint}
                </Text>
              ) : null}
            </View>
          ))
        ) : on ? (
          <Button
            onPress={() => decide(() => undoable((p) => ({ ...p, minor: null }), t("planner.minorStopped", { name: minor.name })))}
            testID="action.minorStop"
          >
            {t("planner.minorStop")}
          </Button>
        ) : (
          <Button
            variant="primary"
            icon={<Icons.Target size={16} color={theme.color.onPrimary} />}
            onPress={() => decide(() => undoable((p) => planMinor(p, minor), t("planner.minorPlannedDone", { name: minor.name })))}
            testID="action.minorPlan"
          >
            {t("planner.minorPlan")}
          </Button>
        )
      }
      testID="sheet.minor"
    >
      <Text size="bodyMedium" style={{ color: v.muted }}>
        {factsLabel(minor.program, registered ? t(stopped ? "curriculum.notContinuing" : "planner.minorRegistered") : null)}
      </Text>
      <View style={{ marginTop: space[3], gap: 2 }}>
        <Text size="titleLarge" face="display" weight="bold" tabular style={{ color: v.fg }}>
          {t("planner.minorSks", { have, need: progress.need })}
        </Text>
        <Text size="bodyMedium" tabular style={{ color: v.muted }}>
          {t("planner.minorSplit", { passed: progress.passed, now: progress.now, planned: progress.planned })}
        </Text>
      </View>
      {minor.note ? (
        <View style={{ marginTop: space[4] }}>
          <Text size="labelLarge" weight="semibold" style={{ color: v.muted }}>
            {t("planner.minorRules")}
          </Text>
          <Text size="bodyMedium" style={{ marginTop: space[1], color: v.fg2 }}>
            {minor.note}
          </Text>
        </View>
      ) : null}
      <View style={{ marginTop: space[4] }}>
        <Text size="labelLarge" weight="semibold" style={{ color: v.muted }}>
          {t("planner.minorCourses")}
        </Text>
        {minor.courses.map((code, i) => {
          const info = courseInfo(record, code);
          const st = courseState(record, plan, code);
          const term = termOf(code);
          return (
            <View
              key={code}
              style={[
                { flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2], minHeight: 56 },
                i > 0 && { borderTopWidth: 1, borderTopColor: v.line },
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size="bodyLarge" style={{ color: v.fg }}>
                  {info.name}
                </Text>
                <Text size="bodyMedium" tabular style={{ color: v.muted }}>
                  {factsLabel(code, `${info.sks} SKS`)}
                </Text>
              </View>
              {st ? (
                <Pill tone={st === "this-term" ? "brand" : st === "passed" ? "ok" : "plain"}>{stateText(code, st) ?? ""}</Pill>
              ) : term ? (
                <Button
                  size="sm"
                  variant="tonal"
                  label={t("planner.addCodeTo", { code, term: label(term) })}
                  onPress={() =>
                    undoable(
                      (p) => addCourse(p, term, { code, name: info.name, sks: info.sks, grade, retake: false }),
                      t("planner.addedTo", { code, term: label(term) }),
                    )
                  }
                  testID={`action.minorAdd.${code}`}
                >
                  {t("planner.add")}
                </Button>
              ) : (
                <Pill tone="plain">{t("planner.state.left")}</Pill>
              )}
            </View>
          );
        })}
      </View>
      <Text size="bodySmall" style={{ marginTop: space[3], color: v.muted }}>
        {t("planner.minorWhat")}
      </Text>
    </Sheet>
  );
}
