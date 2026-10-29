// Text in the app's ramp and tones: every word on screen goes through here, so sizes and colors
// stay the desktop's (theme.ts). A tone names what the color means, never the color itself.
import type { ReactNode } from "react";
import { Text as NativeText, type TextProps, type TextStyle } from "react-native";
import { type Palette, type, useTheme, weight } from "./theme";

export type TextSize = keyof typeof type;
export type TextTone = "fg" | "muted" | "faint" | "accent" | "danger" | "warning" | "success" | "info" | "onAccent" | "live";
export type TextWeight = keyof typeof weight;

const TONE: Record<TextTone, keyof Palette> = {
  fg: "fg",
  muted: "muted",
  faint: "faint",
  accent: "accentFg",
  danger: "dangerFg",
  warning: "warningFg",
  success: "successFg",
  info: "infoFg",
  onAccent: "onAccent",
  live: "live",
};

export interface AppTextProps extends TextProps {
  size?: TextSize;
  tone?: TextTone;
  weight?: TextWeight;
  /** Figures that line up in a column (times, counts). */
  tabular?: boolean;
  children?: ReactNode;
}

export function Text({ size = "body", tone = "fg", weight: w = "regular", tabular = false, style, children, ...rest }: AppTextProps) {
  const theme = useTheme();
  const base: TextStyle = {
    ...type[size],
    color: theme.color[TONE[tone]],
    // Android draws each weight from the system font's own (API 28 and later).
    fontWeight: weight[w],
    ...(tabular ? { fontVariant: ["tabular-nums"] } : {}),
  };
  return (
    <NativeText style={[base, style]} {...rest}>
      {children}
    </NativeText>
  );
}
