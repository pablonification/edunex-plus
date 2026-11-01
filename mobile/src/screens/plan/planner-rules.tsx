// Rencana's rules, checked live (round 2, v4): one row each in one card, its state as a tile (met, to check, not met),
// its title and one short line. A warning's way to be hidden, an error the Student's program settles, and a rule's
// whole explanation are a tap deeper, in the rule's sheet. Hidden warnings wait in a quiet row at the end, to be shown
// again.
import { useState } from "react";
import { View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useCurriculumFix } from "../../../../src/app/study-plan";
import type { HideReason, StudyPlan } from "../../../../src/core/models";
import {
  activeMinor,
  activeSpecialization,
  hideReasons,
  hideRule,
  isHidden,
  notContinuing,
  onlyFor,
  packageKey,
  planMinor,
  type Rule,
  type RuleLevel,
  ruleKey,
  type StudentRecord,
  semesterOf,
  showRule,
  stopFollowing,
} from "../../../../src/core/planner";
import { Button } from "../../ui/controls";
import { Group, GroupRow, IconTile, type PillTone } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import type { SheetChoice } from "../../ui/sheet";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, TOUCH, useTheme } from "../../ui/theme";
import { usePlaceState } from "./place-state";
import { SectionHeading, type Undoable, useShortfallText } from "./planner-kit";
import { useTermLabel } from "./projection";

const LEVEL_MARK: Record<RuleLevel, { tone: PillTone; label: "planner.ruleOk" | "planner.ruleWarn" | "planner.ruleError" }> = {
  ok: { tone: "ok", label: "planner.ruleOk" },
  warn: { tone: "amber", label: "planner.ruleWarn" },
  error: { tone: "red", label: "planner.ruleError" },
};

export function useRuleText(record: StudentRecord): (rule: Rule) => { title: string; detail: string } {
  const t = useT();
  const termLabel = useTermLabel();
  const shortfall = useShortfallText();
  const list = (items: { code: string; name: string }[]) => items.map((c) => `${c.code} ${c.name}`).join(", ");
  return (rule) => {
    switch (rule.id) {
      case "total": {
        const extra = rule.have - rule.need;
        return {
          title:
            extra > 0
              ? t("rule.total.done", { need: rule.need, extra })
              : extra === 0
                ? t("rule.total.exact", { need: rule.need })
                : t("rule.total", { have: rule.have, need: rule.need }),
          detail: rule.level === "ok" ? t("rule.total.ok") : t("rule.total.short", { short: rule.need - rule.have }),
        };
      }
      case "required": {
        const detail = rule.missing.length
          ? t("rule.missing", { list: list(rule.missing) })
          : rule.total
            ? t("rule.required.okCount", { count: rule.total })
            : t("rule.required.ok");
        // Honest about what the Student's own corrections decided.
        const corrected = rule.corrected.length ? t("rule.required.corrected", { list: list(rule.corrected), count: rule.corrected.length }) : null;
        const byProgram = rule.byProgram.length ? t("rule.required.byProgram", { list: list(rule.byProgram) }) : null;
        return { title: t("rule.required"), detail: [detail, corrected, byProgram].filter(Boolean).join(" ") };
      }
      case "electives": {
        const extra = rule.have - rule.need;
        return {
          title: t("rule.electives"),
          detail:
            extra > 0
              ? t("rule.electives.done", { need: rule.need, extra })
              : extra === 0
                ? t("rule.electives.exact", { need: rule.need })
                : t("rule.electives.short", { have: rule.have, need: rule.need, short: -extra }),
        };
      }
      case "specialization":
        return {
          title: rule.name,
          detail: rule.missing.length ? t("rule.missing", { list: list(rule.missing) }) : t("rule.specialization.ok", { count: rule.total }),
        };
      case "minor":
        return { title: t("rule.minor", { name: rule.name }), detail: t("rule.minor.detail", { have: rule.have, need: rule.need }) };
      case "load":
        return {
          title: termLabel(rule.term, semesterOf(rule.term, record.entryTerm)),
          detail:
            rule.level === "error" ? t("rule.load.over", { sks: rule.sks, limit: rule.limit }) : t("rule.load.advisor", { sks: rule.sks, limit: rule.limit }),
        };
      case "parity": {
        const odd = rule.semester % 2 === 1;
        return {
          title: `${rule.code} ${rule.name}`,
          detail: t("rule.parity", {
            semester: rule.semester,
            parity: t(odd ? "rule.parity.odd" : "rule.parity.even"),
            kind: t(odd ? "rule.parity.even" : "rule.parity.odd"),
          }),
        };
      }
      case "early":
        return { title: `${rule.code} ${rule.name}`, detail: t("rule.early", { semester: rule.semester }) };
      case "finish":
        if (rule.blocked) return { title: t("rule.finish.blocked"), detail: t("rule.finish.blockedDetail", { list: shortfall(rule.blocked) }) };
        return {
          title: t("rule.finish", { n: rule.semester }),
          detail:
            rule.level === "ok"
              ? t("rule.finish.ok", { normal: rule.normal })
              : rule.semester <= 9
                ? t("rule.finish.late", { normal: rule.normal })
                : t("rule.finish.tooLate"),
        };
    }
  };
}

/** A course's own warning in a few words, for its row and its rule's line: "Biasanya di semester genap". */
export function useFlagText(): (rule: Extract<Rule, { id: "parity" | "early" }>) => string {
  const t = useT();
  return (rule) =>
    rule.id === "parity" ? t("planner.flag.parity", { kind: t(rule.semester % 2 === 1 ? "rule.parity.odd" : "rule.parity.even") }) : t("planner.flag.early");
}

const ruleAnchor = (rule: Rule) => `rule-${rule.id}${"code" in rule ? `-${rule.code}` : ""}${"term" in rule ? `-${rule.term}` : ""}`;

/** What the Student set aside, in the quiet list under the rules: why, and how it comes back. */
interface SetAside {
  key: string;
  anchor: string;
  title: string;
  reason: HideReason;
  show: () => void;
}

/** A specialization's or minor's "not continuing", in the same step as its courses only it asks for leaving the plan, or staying. */
export function useNotContinuing(record: StudentRecord, plan: StudyPlan, undoable: Undoable) {
  const t = useT();
  const f = useFormat();
  return ({
    key,
    title,
    codes,
    keep,
    label,
  }: {
    key: string;
    title: string;
    codes: readonly string[];
    keep: readonly string[];
    label: string;
  }): SheetChoice[] => {
    const drop = onlyFor(record, plan, codes, keep).map((c) => c.code);
    const stop = (gone: string[]) =>
      undoable(
        (p) => stopFollowing(p, key, Date.now(), gone),
        gone.length ? t("planner.notContinuingDropped", { title, count: gone.length }) : t("planner.notContinuingDone", { title }),
      );
    return [
      { label, hint: t(drop.length ? "planner.notContinuing.keepHint" : "planner.hideReason.not-continuingHint"), onPress: () => stop([]) },
      ...(drop.length
        ? [{ label: t("planner.notContinuing.drop"), hint: t("planner.notContinuing.dropHint", { list: f.list(drop) }), onPress: () => stop(drop) }]
        : []),
    ];
  };
}

/** A rule a tap deeper: its whole explanation, and what can be done about it there. */
interface Opened {
  title: string;
  detail: string;
  hide: SheetChoice[];
  settle: SheetChoice[];
}

/**
 * The rules, each a row. A warning can be hidden with a reason, from its sheet; hidden ones wait in a quiet row to be
 * shown again. Errors decide graduating: they can't be hidden, but a required course the Student's program will add
 * can be settled from its sheet (kept with the curriculum corrections, listed with the hidden warnings, and taken back
 * from there).
 */
export function Rules({ record, rules, plan, undoable }: { record: StudentRecord; rules: Rule[]; plan: StudyPlan; undoable: Undoable }) {
  const t = useT();
  const v = useTheme().v4;
  const text = useRuleText(record);
  const flagText = useFlagText();
  const setFix = useCurriculumFix();
  const notContinuingItems = useNotContinuing(record, plan, undoable);
  const [showHidden, setShowHidden] = usePlaceState("planner.hidden", false);
  // The sheet keeps what it shows while it slides away.
  const [opened, setOpened] = useState<{ open: boolean; rule: Opened | null }>({ open: false, rule: null });
  const minor = activeMinor(record, plan);
  const spec = activeSpecialization(record, plan);
  const shownAgain = (title: string, edit: (p: StudyPlan) => StudyPlan) => () => undoable(edit, t("planner.shownDone", { title }));
  const hidden: SetAside[] = rules
    .filter((rule) => isHidden(rule, plan))
    .map((rule) => {
      const key = ruleKey(rule)!;
      const { title } = text(rule);
      return { key, anchor: ruleAnchor(rule), title, reason: plan.hidden?.[key]?.reason ?? "other", show: shownAgain(title, (p) => showRule(p, key)) };
    });
  // Not continuing still counts once the warning is gone (every course covered, or the minor no longer followed): it stays here to be taken back.
  const registeredSpec = record.specialization;
  const specKey = registeredSpec ? packageKey("specialization", registeredSpec.name) : null;
  if (registeredSpec && specKey && !spec && !hidden.some((h) => h.key === specKey))
    hidden.push({
      key: specKey,
      anchor: specKey,
      title: registeredSpec.name,
      reason: "not-continuing",
      show: shownAgain(registeredSpec.name, (p) => showRule(p, specKey)),
    });
  const registeredMinor = record.minors.find((m) => m.key === record.registeredMinor);
  if (registeredMinor && notContinuing(plan, "minor", registeredMinor.name)) {
    const key = packageKey("minor", registeredMinor.name);
    const title = t("rule.minor", { name: registeredMinor.name });
    hidden.push({ key, anchor: key, title, reason: "not-continuing", show: shownAgain(title, (p) => planMinor(p, registeredMinor)) });
  }
  for (const course of record.byProgram) {
    const title = `${course.code} ${course.name}`;
    hidden.push({
      key: `program-adds|${course.code}`,
      anchor: `program-adds-${course.code}`,
      title,
      reason: "program-adds",
      show: () => {
        const before = setFix(course.code, null);
        undoable.offer(() => setFix(course.code, before), t("planner.shownDone", { title }));
      },
    });
  }
  /** A required course the Student's program will add: covered from now on, with the curriculum corrections, until they take it back. */
  const settle = (course: { code: string; name: string; slot: string }) => {
    const before = setFix(course.slot, { kind: "program-adds", at: Date.now() });
    undoable.offer(() => setFix(course.slot, before), t("planner.programAddsDone", { course: `${course.code} ${course.name}` }));
  };
  const hideItems = (rule: Rule, key: string, title: string): SheetChoice[] =>
    hideReasons(rule).flatMap((reason): SheetChoice[] => {
      if (reason === "not-continuing" && (rule.id === "specialization" || rule.id === "minor")) {
        const codes = rule.id === "specialization" ? (record.specialization?.courses.map((c) => c.code) ?? []) : (minor?.courses ?? []);
        // A course the other package still asks for stays.
        const keep = rule.id === "specialization" ? (minor?.courses ?? []) : (spec?.courses.map((c) => c.code) ?? []);
        const label = t(rule.id === "minor" ? "planner.hideReason.not-continuingMinor" : "planner.hideReason.not-continuing");
        return notContinuingItems({ key, title, codes, keep, label });
      }
      return [
        {
          label: t(`planner.hideReason.${reason}`),
          onPress: () => undoable((p) => hideRule(p, key, reason, Date.now()), t("planner.hiddenDone", { title })),
          testID: `action.hideRule.${key}.${reason}`,
        },
      ];
    });
  const shown = rules.filter((rule) => !isHidden(rule, plan));
  return (
    <View testID="card.rules">
      <SectionHeading title={t("mobile.planner.rules")} first />
      <Group>
        {shown.map((rule, i) => {
          const { title, detail } = text(rule);
          const mark = LEVEL_MARK[rule.level];
          const key = ruleKey(rule);
          // A course's own warning says it in a few words here; the curriculum's whole reason is in its sheet.
          const line = rule.id === "parity" || rule.id === "early" ? flagText(rule) : detail;
          const settleable = rule.id === "required" ? rule.missing.filter((c): c is { code: string; name: string; slot: string } => c.slot !== null) : [];
          const hide = key ? hideItems(rule, key, title) : [];
          // The one way an error is settled here: the program adds the course (Kerja Praktik, say), so it isn't the Student's to plan.
          const settles: SheetChoice[] = settleable.map((c) => ({
            label: t("planner.programAddsCode", { course: `${c.code} ${c.name}` }),
            icon: <Icons.ClipboardCheck size={20} color={v.fg2} />,
            onPress: () => settle(c),
            testID: "action.programAdds",
          }));
          const deeper = hide.length > 0 || settles.length > 0 || line !== detail || detail.length > 90;
          return (
            <GroupRow
              key={ruleAnchor(rule)}
              first={i === 0}
              leading={
                <View accessibilityLabel={t(mark.label)}>
                  <IconTile
                    tone={mark.tone}
                    icon={(color) =>
                      rule.level === "ok" ? (
                        <Icons.Check size={20} color={color} weight="bold" />
                      ) : (
                        <Icons.AlertTriangle size={20} color={color} weight="bold" />
                      )
                    }
                  />
                </View>
              }
              title={title}
              meta={
                <Text size="bodyMedium" numberOfLines={2} style={{ color: v.muted }}>
                  {line}
                </Text>
              }
              trailing={deeper ? <Icons.ChevronRight size={16} color={v.muted} /> : undefined}
              onPress={deeper ? () => setOpened({ open: true, rule: { title, detail, hide, settle: settles } }) : undefined}
              testID={`rule.${rule.id}`}
            />
          );
        })}
        {hidden.length > 0 && (
          <GroupRow
            first={shown.length === 0}
            leading={<IconTile tone="plain" icon={(color) => <Icons.EyeOff size={20} color={color} />} />}
            title={
              <Text size="bodyMedium" style={{ color: v.muted }}>
                {t("planner.hidden", { count: hidden.length })}
              </Text>
            }
            trailing={
              <Text size="labelLarge" weight="semibold" style={{ color: v.brandInk }}>
                {t(showHidden ? "planner.hiddenClose" : "planner.hiddenShow")}
              </Text>
            }
            onPress={() => setShowHidden(!showHidden)}
            accessibilityState={{ expanded: showHidden }}
            testID="action.hiddenRules"
          />
        )}
        {showHidden &&
          hidden.map(({ anchor, title, reason, show }) => (
            <GroupRow
              key={anchor}
              leading={<View style={{ width: 44 }} />}
              title={
                <Text size="bodyMedium" weight="medium" style={{ color: v.fg }}>
                  {title}
                </Text>
              }
              meta={t(`planner.reasonShort.${reason}`)}
              trailing={
                <Button size="sm" variant="ghost" label={t("planner.showAgainRule", { title })} onPress={show}>
                  {t("planner.showAgain")}
                </Button>
              }
            />
          ))}
      </Group>
      <RuleSheet open={opened.open} opened={opened.rule} onClose={() => setOpened({ open: false, rule: opened.rule })} />
    </View>
  );
}

/** A rule up close: the whole of what it says, then hiding it (with a reason) or settling it, when it can be. */
function RuleSheet({ open, opened, onClose }: { open: boolean; opened: Opened | null; onClose: () => void }) {
  const t = useT();
  const v = useTheme().v4;
  // Toasts are drawn under a sheet: a choice closes it first, so its Undo is in view.
  const choose = (choice: SheetChoice) => () => {
    onClose();
    choice.onPress();
  };
  const row = (choice: SheetChoice) => (
    <PressScale
      key={choice.label}
      onPress={choose(choice)}
      testID={choice.testID}
      style={{ minHeight: TOUCH + 8, flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2] }}
    >
      {choice.icon ?? <Icons.EyeOff size={20} color={v.fg2} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="bodyLarge" style={{ color: v.fg }}>
          {choice.label}
        </Text>
        {choice.hint ? (
          <Text size="bodyMedium" style={{ color: v.muted }}>
            {choice.hint}
          </Text>
        ) : null}
      </View>
    </PressScale>
  );
  return (
    <Sheet open={open && opened !== null} onClose={onClose} title={opened?.title} background={v.card} testID="sheet.rule">
      {opened ? (
        <View style={{ gap: space[4], paddingBottom: space[2] }}>
          <Text size="bodyLarge" style={{ color: v.fg2 }}>
            {opened.detail}
          </Text>
          {opened.settle.length > 0 && <View>{opened.settle.map(row)}</View>}
          {opened.hide.length > 0 && (
            <View>
              <Text size="labelLarge" weight="semibold" style={{ color: v.muted }}>
                {t("planner.hide")}
              </Text>
              {opened.hide.map(row)}
            </View>
          )}
        </View>
      ) : null}
    </Sheet>
  );
}
