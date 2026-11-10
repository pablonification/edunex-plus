// What the planner's parts share (round 2, v4): a change to the plan that can be taken back, the haptic a change
// commits with, the words for what stands between the plan and graduating, and a section's heading with its one line.
import type { ReactNode } from "react";
import { View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import type { StudyPlan } from "../../../../src/core/models";
import type { Shortfall } from "../../../../src/core/planner";
import { haptic } from "../../ui/haptics";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";

/** Changes the plan, offering to take it back; `offer` offers taking back a change made elsewhere. */
export type Undoable = ((edit: (plan: StudyPlan) => StudyPlan, message: string) => void) & { offer(undo: () => void, message: string): void };

/** The tick a change to the plan commits with (a grade picked, a course added, moved or removed, a semester added). */
export function commitHaptic(): void {
  haptic.confirm();
}

/** "kurang 5 SKS dan 2 mata kuliah wajib": what stands between the plan and graduating. */
export function useShortfallText(): (shortfall: Shortfall) => string {
  const t = useT();
  const f = useFormat();
  return (s) =>
    f.list(
      [
        s.sks > 0 && t("planner.short.sks", { n: s.sks }),
        s.required > 0 && t("planner.short.required", { n: s.required, count: s.required }),
        s.electives > 0 && t("planner.short.electives", { n: s.electives }),
        s.other > 0 && t("planner.short.other", { n: s.other, count: s.other }),
      ].filter((part): part is string => Boolean(part)),
    );
}

/**
 * A section's heading over its card (v4's `Heading`), with at most one quiet line under it (a semester's SKS, IP and
 * the IPK after it) and one thing at its end (a pill, the way to remove the semester).
 */
export function SectionHeading({
  title,
  meta,
  metaTone = "muted",
  metaIcon,
  trailing,
  first = false,
}: {
  title: string;
  meta?: string | null;
  metaTone?: "muted" | "red";
  metaIcon?: (color: string) => ReactNode;
  trailing?: ReactNode;
  first?: boolean;
}) {
  const v = useTheme().v4;
  const metaColor = metaTone === "red" ? v.redFg : v.muted;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[2],
        marginTop: first ? 0 : space[3],
        marginBottom: space[3],
        marginLeft: space[1],
        minHeight: meta ? 44 : undefined,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="titleMedium" face="display" weight="bold" accessibilityRole="header" style={{ fontSize: 17, letterSpacing: -0.2, color: v.fg }}>
          {title}
        </Text>
        {meta ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], marginTop: 2 }}>
            {metaIcon?.(metaColor)}
            <Text size="bodyMedium" tabular style={{ color: metaColor, flexShrink: 1 }}>
              {meta}
            </Text>
          </View>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}
