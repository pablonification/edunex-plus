// A course's absences, the one way the phone says them (the decisions' "Absences, everywhere"). One rule, read with no
// key (round 4: "is a filled dot used or left?"): a ring is an absence still left, a filled grey dot is one used, a red
// dot, set a little apart, is one over the limit. Colour on a dot means over and nothing else: a used absence is never
// green. Then one short label with the noun, in the state's colour ("sisa 1 absen", "absen habis", "lewat 1 absen":
// Beranda's strip says "absen habis" in the same words). Never a count or a sentence beside them: the whole sentence
// is the row's accessible name. Kuliah's rows and a course's header both draw this.
import { memo } from "react";
import { View } from "react-native";
import type { Translate } from "../../../../src/app/i18n";
import type { MeterModel } from "../../parts/attendance-meter";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";

/** Past this many the dots would run off a row: the label alone says it. */
const MOST = 12;

/** The short label: what's left, none, or how many over. A course without a count of absences keeps its own words. */
export function absenceShort(t: Translate, model: MeterModel): string | null {
  const { bar } = model;
  if (bar?.estimate) return null;
  if (!bar) return model.final || model.tone === "neutral" ? model.word : t("mobile.absence.dots.none");
  if (bar.over > 0) return t("mobile.absence.dots.over", { count: bar.over });
  const left = bar.allowed - bar.used;
  return left > 0 ? t("mobile.absence.dots.left", { count: left }) : t("mobile.absence.dots.none");
}

export const AbsenceDots = memo(function AbsenceDots({ model, label, testID }: { model: MeterModel; label: string | null; testID?: string }) {
  const theme = useTheme();
  const v = theme.v4;
  const ink = model.tone === "red" ? v.redFg : model.tone === "amber" ? v.ambFg : model.tone === "ok" ? v.okFg : v.fg2;
  const { bar } = model;
  const allowed = bar ? Math.max(bar.allowed, 0) : 0;
  const over = bar ? bar.over : 0;
  const drawn = bar !== null && allowed + over > 0 && allowed + over <= MOST;
  if (!drawn && !label) return null;
  return (
    <View testID={testID} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[2] }}>
      {drawn && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {Array.from({ length: allowed + over }, (_, i) => {
            const past = i >= allowed;
            const used = past || (!bar.estimate && i < bar.used);
            return (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: dots are positions, nothing else tells them apart
                key={i}
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  // The first one over stands a dot's gap away from the allowed ones: "these, and one more".
                  marginLeft: past && i === allowed && allowed > 0 ? 4 : 0,
                  backgroundColor: used ? (past ? v.redFg : v.fg2) : "transparent",
                  borderWidth: used ? 0 : 1.5,
                  borderColor: v.fg2,
                }}
              />
            );
          })}
        </View>
      )}
      {label ? (
        // Over the limit is the worst state in both themes: the only label in bold, beside the only coloured dots.
        <Text size="bodyMedium" weight={over > 0 ? "bold" : "semibold"} tabular style={{ color: ink }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
});
