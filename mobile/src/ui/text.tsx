// Text in the app's type scale and tones: every word on screen goes through here (theme.ts, DESIGN.md).
// `size` is a Material 3 style ("titleMedium", "bodyLarge", …) or one of the older names mapped onto
// one; a tone names what the color means, never the color itself.
import type { ReactNode } from "react";
import { Text as NativeText, type TextProps, type TextStyle, useWindowDimensions } from "react-native";
import { m3type, m3weight, type Palette, type, useTheme, weight } from "./theme";

export type TextSize = keyof typeof type;
export type TextTone =
  | "fg"
  | "muted"
  | "faint"
  | "accent"
  | "primary"
  | "danger"
  | "warning"
  | "success"
  | "info"
  | "onAccent"
  | "onPrimary"
  | "onPrimaryContainer"
  | "onSecondaryContainer"
  | "inverse"
  | "live";
export type TextWeight = keyof typeof weight;

const TONE: Record<TextTone, keyof Palette> = {
  fg: "onSurface",
  muted: "onSurfaceVariant",
  faint: "onSurfaceVariant",
  accent: "primary",
  primary: "primary",
  danger: "error",
  warning: "warningFg",
  success: "successFg",
  info: "infoFg",
  onAccent: "onAccent",
  onPrimary: "onPrimary",
  onPrimaryContainer: "onPrimaryContainer",
  onSecondaryContainer: "onSecondaryContainer",
  inverse: "inverseOnSurface",
  live: "live",
};

export interface AppTextProps extends TextProps {
  size?: TextSize;
  tone?: TextTone;
  /** Emphasis over the style's own weight (M3 Expressive's emphasized styles). */
  weight?: TextWeight;
  /** Figures that line up in a column (times, counts). */
  tabular?: boolean;
  children?: ReactNode;
}

export function Text({ size = "body", tone = "fg", weight: w, tabular = false, style, children, ...rest }: AppTextProps) {
  const theme = useTheme();
  const base: TextStyle = {
    ...type[size],
    color: theme.color[TONE[tone]],
    // Android draws each weight from the system font's own (API 28 and later). An M3 style has its own weight (Title M,
    // Title S and the labels are Medium); `weight` emphasizes.
    fontWeight: w ? weight[w] : size in m3type ? m3weight[size as keyof typeof m3type] : weight.regular,
    ...(tabular ? { fontVariant: ["tabular-nums"] } : {}),
    // Android pads a line's top by the font's own extra room, more for bigger text: without it a line sits in its
    // line height as on the web, so an icon or a smaller code beside a title lines up with it.
    includeFontPadding: false,
  };
  return (
    <NativeText style={[base, style]} {...rest}>
      {children}
    </NativeText>
  );
}

/**
 * A column's width for text set in it, `dp` at the normal font size: it grows with Android's font size, so
 * "Kam, 10 Sep" stays on one line at "Besar", and every row's column still lines up.
 */
export function useTextWidth(dp: number): number {
  return dp * Math.max(1, useWindowDimensions().fontScale);
}

/** A text field's cursor, selection and handles in the app's blue (Android's default is its own teal): spread on every TextInput. */
export function useFieldColors() {
  const theme = useTheme();
  return { cursorColor: theme.color.primary, selectionHandleColor: theme.color.primary, selectionColor: `${theme.color.primary}4d` } as const;
}
