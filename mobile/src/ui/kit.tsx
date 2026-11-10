// The super-app layout's shared parts (mobile/DESIGN.md, "The kit"): the few things every screen says the same way.
// One presence button, one plain progress bar, one clash sign, one tappable figure, one heading, one flat row. Each
// is views and one-Path icons, moves only through PressScale (the UI thread; still with Remove animations), and does
// no work until it's drawn.
import type { AccessibilityProps } from "react-native";
import { View } from "react-native";
import { useT } from "../../../src/app/i18n";
import { BHeading, BRow, CountCell } from "./b";
import { Icons } from "./icons";
import { PressScale } from "./press";
import { Text } from "./text";
import { space, useTheme } from "./theme";

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/**
 * The one presence button (testID `action.presence`): the raised hand, the word ("Isi Presensi"; pass "Tandai Hadir"
 * as its child for SIX), and when it matters the one time on the same line ("tutup 09:30"). A 48 dp pill, like
 * `BigButton`. Two tones, final:
 *  - "page": on the page. The brand's blue, white words (dark: the pale blue, navy words). The look to keep on Kuliah.
 *  - "course": on a block of a course's colour. White, the hand and the words in `ink`, the course's colour.
 * `quiet` is the same part outlined, for when nobody can say it counts (no SIX). `wide` fills its row.
 *
 *   <PresenceButton tone="course" ink={courseColor} time={t("…closes", { time })} onPress={fill} />
 */
export function PresenceButton({
  onPress,
  children,
  label,
  tone = "page",
  ink,
  time,
  quiet = false,
  wide = false,
  disabled = false,
  testID = "action.presence",
  ...a11y
}: {
  onPress(): void;
  /** The word, when it isn't "Isi Presensi" ("Tandai Hadir" in SIX). */
  children?: string;
  /** What a screen reader says (the course, and where it opens); the word and the time when left out. */
  label?: string;
  tone?: "page" | "course";
  /** On a course's block: the course's colour, for the words and the hand (4.5:1 on white). */
  ink?: string;
  /** The one time that matters, already in words ("tutup 09:30"). */
  time?: string;
  /** Outlined, not filled. */
  quiet?: boolean;
  wide?: boolean;
  disabled?: boolean;
  testID?: string;
} & AccessibilityProps) {
  const t = useT();
  const v = useTheme().v4;
  const word = children ?? t("presence.open.fill");
  const onCourse = tone === "course";
  const fill = quiet ? "transparent" : onCourse ? "#ffffff" : v.brand;
  const fg = quiet ? (onCourse ? v.onCourse : v.fg) : onCourse ? (ink ?? "#14171c") : v.onBrand;
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityLabel={label ?? (time ? `${word}, ${time}` : word)}
      {...a11y}
      style={{
        minHeight: 48,
        borderRadius: 24,
        backgroundColor: fill,
        borderWidth: quiet ? 1.5 : 0,
        borderColor: onCourse ? v.onCourse : v.line,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space[2],
        paddingHorizontal: space[5],
        paddingVertical: space[2],
        alignSelf: wide ? "stretch" : "flex-start",
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Icons.Hand size={20} color={fg} weight="fill" />
      <Text size="labelLarge" weight="bold" numberOfLines={1} style={{ color: fg, fontSize: 15, lineHeight: 20, letterSpacing: 0, flexShrink: 0 }}>
        {word}
      </Text>
      {time ? (
        <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: fg, fontSize: 14, lineHeight: 20, letterSpacing: 0, flexShrink: 1 }}>
          {`· ${time}`}
        </Text>
      ) : null}
    </PressScale>
  );
}

/**
 * A plain progress bar: a track, filled to `value` (0 to 1), and at most one short label at its end (the one time that
 * matters). No wave, no dot, nothing that moves by itself. In a row it takes the room left (`flex: 1`).
 * A screen reader hears `label`.
 */
export function PlainBar({
  value,
  color,
  track,
  label,
  end,
  endColor,
  height = 4,
}: {
  value: number;
  /** The fill; the brand's blue when left out. */
  color?: string;
  /** The empty part; the page's hairline grey when left out. On a course's block: the ink at about 30%. */
  track?: string;
  label: string;
  /** Words after the bar ("tutup 09:30"). */
  end?: string;
  endColor?: string;
  height?: number;
}) {
  const v = useTheme().v4;
  const share = clamp(value);
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 20 }}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}
        style={{ flex: 1, height, borderRadius: height / 2, backgroundColor: track ?? v.line, overflow: "hidden" }}
      >
        <View style={{ width: `${share * 100}%`, height, borderRadius: height / 2, backgroundColor: color ?? v.brand }} />
      </View>
      {end ? (
        <Text size="bodyMedium" weight="medium" tabular numberOfLines={1} style={{ color: endColor ?? v.fg2, fontSize: 13, lineHeight: 18, letterSpacing: 0 }}>
          {end}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The one clash sign: the overlap icon and the word "Bentrok", in amber, on one line. `detail` adds what it clashes
 * with or when, after the word ("Bentrok 16:00"). The same on Beranda, Jadwal and Kuliah.
 */
export function ClashMark({ detail, color }: { detail?: string; color?: string }) {
  const t = useT();
  const v = useTheme().v4;
  const fg = color ?? v.ambFg;
  const word = t("home.today.overlap");
  return (
    <View
      accessible
      accessibilityLabel={detail ? `${word} ${detail}` : word}
      style={{ flexDirection: "row", alignItems: "center", gap: space[1], flexShrink: 1 }}
    >
      <Icons.Overlap size={16} color={fg} weight="fill" />
      <Text size="bodyMedium" weight="semibold" numberOfLines={1} style={{ color: fg, fontSize: 13, lineHeight: 18, letterSpacing: 0, flexShrink: 1 }}>
        {detail ? `${word} ${detail}` : word}
      </Text>
    </View>
  );
}

/**
 * One of the strip's three: a figure (or a check for good news, never "0"), what it counts, and a small chevron that
 * says it opens something. The figure sits in a fixed 32 dp line and the label is always one line (it shrinks a
 * little, then is cut: give it two words), so three cells share a baseline whatever their labels' length. The whole tile is one target. `tone`: "danger" (red) and "warn" (amber) colour the figure
 * only; the label stays quiet. Side by side inside b.tsx's `CountStrip`.
 */
export function StatTile({
  value,
  label,
  mark = false,
  tone = "plain",
  pending = false,
  onPress,
  testID,
  ...a11y
}: {
  value: string;
  label: string;
  mark?: boolean;
  tone?: "plain" | "warn" | "danger";
  pending?: boolean;
  onPress(): void;
  testID?: string;
} & AccessibilityProps) {
  const v = useTheme().v4;
  const ink = tone === "danger" ? v.redFg : tone === "warn" ? v.ambFg : undefined;
  return <CountCell value={value} label={label} mark={mark} ink={ink} pending={pending} onPress={onPress} testID={testID} {...a11y} />;
}

/** A section's heading on the page: b.tsx's `BHeading` under the name the screens ask for. Use either; they are one part. */
export const SectionHeading = BHeading;

/**
 * A flat row on the page: a leading slot, the title, one meta line, one trailing slot, an inset hairline under all but
 * the `last`, the whole row one target (64 dp). b.tsx's `BRow` under the name the screens ask for; they are one part.
 */
export const FlatRow = BRow;
