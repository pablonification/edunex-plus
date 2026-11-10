// A course's absences as a picture (round 3): one segment per absence its target allows, the used ones filled, the
// rest a ring; past the limit a short line, then a red segment per absence over it. Its tone is the app's one absence
// scale (ui/absence.ts, as Beranda's chips): red once the target is out of reach (or the course finished below it),
// amber with none left, green with some to spare. Beside it the state in plain words, the same words on every tab
// ("Absen lewat 2×", "Jatah absen habis", "Sisa 1×"): Kuliah's rows show only those words (round 3's blind review read
// them at once, the pips needed a key), a course's page draws the picture with them. The whole sentence is its
// accessible name.
import { memo } from "react";
import { View } from "react-native";
import type { CourseAttendance } from "../../../src/app/attendance";
import { budgetLabel } from "../../../src/app/attendance-labels";
import { type Translate, useT } from "../../../src/app/i18n";
import { type AttendanceHealth, absenceBudget, estimatedBudget, percent, presenceGroup } from "../../../src/core/attendance";
import { absenceName, absenceTone } from "../ui/absence";
import { Icons } from "../ui/icons";
import { Text } from "../ui/text";
import { useTheme } from "../ui/theme";
import { type MeterBar, meterMarks } from "./meter-marks";

export type MeterTone = "ok" | "amber" | "red" | "neutral";

/** The risk as a tone, the app's one absence scale (ui/absence.ts): grey before SIX has a count. */
export function meterTone(health: AttendanceHealth): MeterTone {
  return absenceTone(health.state) ?? "neutral";
}

/** "sisa 1×" → "Sisa 1×": the words stand alone at a row's end. */
const lead = (words: string) => words.charAt(0).toLocaleUpperCase() + words.slice(1);

export interface MeterModel {
  tone: MeterTone;
  /** The segments: allowed, used of them, over the limit; `estimate` before SIX counts (dashed rings, nothing used). */
  bar: MeterBar | null;
  /** The state in a few plain words ("Absen lewat 2×", "Jatah absen habis", "Sisa 1×"; null: the picture alone). */
  word: string | null;
  /** A finished course: its share, with a mark instead of segments. */
  final: { share: number; met: boolean } | null;
  /** The whole of it, for a screen reader. */
  label: string;
}

/** What the meter draws for a course, worked out once (no hooks: a row can memoize it). Null: nothing to draw. */
export function meterModel(t: Translate, item: Pick<CourseAttendance, "health">, soFar = false): MeterModel | null {
  const { health } = item;
  const tone = meterTone(health);
  const group = presenceGroup(health);
  if (group === "edunex") {
    if (!health.edunexClosed) return null;
    const words = t("presence.edunexTally", { recorded: health.edunexRecorded, closed: health.edunexClosed });
    return {
      tone: "neutral",
      bar: null,
      word: t("mobile.absence.edunex", { recorded: health.edunexRecorded, closed: health.edunexClosed }),
      final: null,
      label: words,
    };
  }
  if (health.state === "met" || health.state === "missed") {
    if (!health.held) return null;
    const share = percent(health.attended ?? 0, health.held);
    return {
      tone,
      bar: null,
      word: t("mobile.absence.final", { percent: share }),
      final: { share, met: health.state === "met" },
      label: t("presence.row.final", { percent: share }),
    };
  }
  const budget = absenceBudget(health);
  if (!budget) {
    if (health.state !== "unknown" || health.countedIn === "edunex" || health.countedIn === "noSix") return null;
    const about = estimatedBudget(health);
    if (!about) return null;
    return {
      tone: "neutral",
      bar: { allowed: about, used: 0, over: 0, estimate: true },
      word: null,
      final: null,
      label: t("presence.bar.a11yAbout", { count: about }),
    };
  }
  const missed = (health.held ?? 0) - (health.attended ?? 0);
  const { allowed, left, over } = budget;
  const bar = { allowed, used: budget.used, over, estimate: false };
  if (over > 0)
    return {
      tone,
      bar,
      word: absenceName(t, health) ?? lead(t("presence.bar.over", { count: over })),
      final: null,
      label: `${budgetLabel(t, health)}. ${t("presence.bar.a11yOver", { allowed, used: missed, over })}`,
    };
  if (left === 0)
    return {
      tone,
      bar: allowed > 0 ? bar : null,
      word: absenceName(t, health) ?? lead(t("presence.bar.noneLeft")),
      final: null,
      label: allowed > 0 ? t("presence.bar.a11yFull", { allowed }) : t("presence.bar.zero"),
    };
  return {
    tone,
    bar,
    word: lead(t("presence.bar.left", { count: left })),
    final: null,
    label: t(soFar ? "presence.bar.a11ySoFar" : "presence.bar.a11y", { allowed, used: missed, left }),
  };
}

const SIZE = {
  row: { width: 10, height: 6, gap: 3, joined: 56, word: "bodyMedium" as const, icon: 14 },
  header: { width: 18, height: 8, gap: 4, joined: 120, word: "bodyLarge" as const, icon: 18 },
};

/**
 * The meter and its word, on one line. `size`: "row" in a list row's meta line, "header" under a course's name.
 * `hideLabel`: the row says the whole sentence in its own name, so the meter isn't read twice.
 */
export const AttendanceMeter = memo(function AttendanceMeter({
  model,
  size = "row",
  hideLabel = false,
  testID,
}: {
  model: MeterModel;
  size?: keyof typeof SIZE;
  hideLabel?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const v = theme.v4;
  const s = SIZE[size];
  const ink = model.tone === "red" ? v.redFg : model.tone === "amber" ? v.ambFg : model.tone === "ok" ? v.okFg : v.muted;
  const { bar } = model;
  // The rings of what's left: 3:1 on the card (DESIGN.md's pipRing), so the count reads without the fills.
  const ring = theme.color.pipRing;
  const marks = meterMarks(bar);
  const segments = bar && marks && (
    <View style={{ flexDirection: "row", alignItems: "center", gap: s.gap }}>
      {marks.allowed > 0 &&
        (!marks.joined ? (
          Array.from({ length: marks.allowed }, (_, i) => {
            const used = !bar.estimate && i < bar.used;
            return (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: segments are positions, nothing else tells them apart
                key={i}
                style={{
                  width: s.width,
                  height: s.height,
                  borderRadius: s.height / 2,
                  ...(used ? { backgroundColor: ink } : { borderWidth: 1.5, borderColor: ring, ...(bar.estimate ? { borderStyle: "dashed" as const } : {}) }),
                }}
              />
            );
          })
        ) : (
          <View style={{ width: s.joined, height: s.height, borderRadius: s.height / 2, borderWidth: 1.5, borderColor: ring, overflow: "hidden" }}>
            {!bar.estimate && bar.used > 0 && (
              <View style={{ width: `${(Math.min(bar.used, bar.allowed) / bar.allowed) * 100}%`, height: "100%", backgroundColor: ink }} />
            )}
          </View>
        ))}
      {marks.over > 0 && (
        <>
          <View style={{ width: 2, height: s.height + 6, borderRadius: 1, backgroundColor: v.fg, marginHorizontal: 1 }} />
          {Array.from({ length: marks.over }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: segments are positions, nothing else tells them apart
            <View key={i} style={{ width: s.width, height: s.height, borderRadius: s.height / 2, backgroundColor: v.redFg }} />
          ))}
        </>
      )}
    </View>
  );
  const mark =
    model.final &&
    (model.final.met ? <Icons.CheckCircle size={s.icon} weight="fill" color={ink} /> : <Icons.AlertTriangle size={s.icon} weight="fill" color={ink} />);
  return (
    <View
      testID={testID}
      accessible={!hideLabel}
      accessibilityRole={hideLabel ? undefined : "image"}
      accessibilityLabel={hideLabel ? undefined : model.label}
      importantForAccessibility={hideLabel ? "no-hide-descendants" : "yes"}
      accessibilityElementsHidden={hideLabel}
      style={{ flexDirection: "row", alignItems: "center", gap: size === "row" ? 6 : 8, flexShrink: 0 }}
    >
      {segments}
      {mark}
      {model.word && (
        <Text size={s.word} weight="semibold" tabular numberOfLines={1} style={{ color: ink }}>
          {model.word}
        </Text>
      )}
    </View>
  );
});

/** The meter for a course with its words worked out here (a screen that draws one course). */
export function CourseMeter({
  item,
  soFar,
  size,
  testID,
}: {
  item: Pick<CourseAttendance, "health">;
  soFar?: boolean;
  size?: keyof typeof SIZE;
  testID?: string;
}) {
  const t = useT();
  const model = meterModel(t, item, soFar);
  return model ? <AttendanceMeter model={model} size={size} testID={testID} /> : null;
}
