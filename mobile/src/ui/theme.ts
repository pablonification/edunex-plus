// The app's design tokens (mobile/DESIGN.md): Material 3's colour roles, type scale, shapes, spacing
// and motion, filled with the brand's colours (src/app/styles.css). Screens read them through
// useTheme(); nothing types a color of its own. Every text/icon pair is checked with the design
// skill's contrast.py (mobile/qa/shell-notes.md, "Contrast").
//
// `theme.color` holds the M3 roles (primary, surfaceContainer, onSurfaceVariant, …) and, under them,
// the names the screens were written with (fg, muted, edge, …), each now pointing at its role, so a
// screen built before the roles gets the new look without a change. New code uses the roles.
import { createContext, useContext } from "react";
import { type ColorSchemeName, Platform } from "react-native";

/** Material 3's colour roles, light. Brand blue as primary; surfaces neutral with a touch of its hue. */
const lightRoles = {
  primary: "#245bcc",
  onPrimary: "#ffffff",
  primaryContainer: "#dbe6fe",
  onPrimaryContainer: "#0d3a91",
  secondary: "#4f5b73",
  onSecondary: "#ffffff",
  secondaryContainer: "#dce3f4",
  onSecondaryContainer: "#16264a",
  tertiary: "#6338b8",
  onTertiary: "#ffffff",
  tertiaryContainer: "#efe6fd",
  onTertiaryContainer: "#3a1580",
  error: "#b42318",
  onError: "#ffffff",
  errorContainer: "#fde7e4",
  onErrorContainer: "#7a1710",
  surface: "#ffffff",
  surfaceDim: "#dadce3",
  surfaceBright: "#ffffff",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f6f7fb",
  surfaceContainer: "#f0f2f7",
  surfaceContainerHigh: "#eaecf2",
  surfaceContainerHighest: "#e3e5ec",
  onSurface: "#1d1d1f",
  onSurfaceVariant: "#55565e",
  outline: "#7f8088",
  outlineVariant: "#dfe1e8",
  inverseSurface: "#2e3036",
  inverseOnSurface: "#f1f1f6",
  inversePrimary: "#aec6ff",
  scrim: "#000000",
};

export type Roles = typeof lightRoles;

const darkRoles: Roles = {
  primary: "#8fb0ff",
  onPrimary: "#0b2a6b",
  primaryContainer: "#1f3f86",
  onPrimaryContainer: "#dbe6ff",
  secondary: "#bcc6dd",
  onSecondary: "#253045",
  secondaryContainer: "#2d3851",
  onSecondaryContainer: "#dce3f7",
  tertiary: "#cbb6ff",
  onTertiary: "#3a1580",
  tertiaryContainer: "#3c2768",
  onTertiaryContainer: "#efe6fd",
  error: "#ff9c8f",
  onError: "#5c0f08",
  errorContainer: "#3a1c19",
  onErrorContainer: "#ffdad5",
  surface: "#161618",
  surfaceDim: "#161618",
  surfaceBright: "#38383d",
  surfaceContainerLowest: "#111113",
  surfaceContainerLow: "#1c1c1f",
  surfaceContainer: "#212125",
  surfaceContainerHigh: "#2a2a2f",
  surfaceContainerHighest: "#35353b",
  onSurface: "#ececef",
  onSurfaceVariant: "#b4b4bd",
  outline: "#8b8b94",
  outlineVariant: "#3a3a41",
  inverseSurface: "#e4e4ea",
  inverseOnSurface: "#2a2a2f",
  inversePrimary: "#245bcc",
  scrim: "#000000",
};

/**
 * The names the screens were written with (the desktop's tokens), each on its role, plus the colours that carry a
 * meaning of their own (warning, success, the status chips, the meters).
 */
function legacy(r: Roles, scheme: "light" | "dark") {
  const light = scheme === "light";
  return {
    canvas: r.surface,
    sidebar: r.surfaceContainer,
    raised: r.surfaceContainerLow,
    edge: r.outlineVariant,
    line: r.outlineVariant,
    fill: r.surfaceContainerHigh,
    hover: r.surfaceContainerHigh,
    selected: light ? "rgba(29,29,31,0.08)" : "rgba(236,236,239,0.10)",
    sunken: r.surfaceContainer,
    scrim: light ? "rgba(0,0,0,0.32)" : "rgba(0,0,0,0.5)",
    track: light ? "#d4d5dc" : "#3c3c43",
    fieldEdge: r.outline,
    segment: r.surfaceContainerLowest,
    fg: r.onSurface,
    muted: r.onSurfaceVariant,
    faint: r.onSurfaceVariant,
    accent: light ? "#2f6feb" : "#2f6feb",
    accentActive: light ? "#2258c4" : "#2763d8",
    accentFg: r.primary,
    onAccent: "#ffffff",
    dangerBg: r.errorContainer,
    dangerFg: r.error,
    warningBg: light ? "#fdf2d6" : "#382d10",
    warningFg: light ? "#855000" : "#f2c862",
    successBg: light ? "#dcf4e5" : "#12301f",
    successFg: light ? "#166240" : "#80e0a9",
    infoBg: r.primaryContainer,
    infoFg: light ? "#2a58b8" : "#a9c1ff",
    neutralBg: r.surfaceContainerHigh,
    neutralFg: light ? "#4b4c53" : "#c4c4cc",
    live: light ? "#22a35a" : "#2fbf6c",
    meterTrack: r.surfaceContainerHighest,
    meterWarning: light ? "#b26b00" : "#f2c862",
    meterSuccess: light ? "#1e8f4f" : "#2fbf6c",
    pipRing: r.outline,
    hatch: light ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)",
    statusDraftBg: light ? "#fdf2d6" : "#382d10",
    statusDraftFg: light ? "#855000" : "#f2c862",
    statusSubmittedBg: light ? "#dcf4e5" : "#12301f",
    statusSubmittedFg: light ? "#166240" : "#80e0a9",
    statusOverdueBg: light ? "#fde4e2" : "#3a1817",
    statusOverdueFg: light ? "#b42318" : "#ff9c94",
    statusClosedBg: r.surfaceContainerHighest,
    statusClosedFg: light ? "#3f3f46" : "#c6c6ce",
    statusReviewBg: light ? "#ebe7fd" : "#272042",
    statusReviewFg: light ? "#5a33c8" : "#c4b5ff",
    sourceItbBg: r.tertiaryContainer,
    sourceItbFg: light ? "#6338b8" : "#c4b0f5",
  };
}

export type Palette = Roles & ReturnType<typeof legacy>;

const light: Palette = { ...lightRoles, ...legacy(lightRoles, "light") };
const dark: Palette = { ...darkRoles, ...legacy(darkRoles, "dark") };

/** The ten course colors, each with its light and dark tone (`--course-<id>-light/-dark`). */
const COURSE = {
  cyan: ["#028dab", "#06bfe7"],
  indigo: ["#6e46fb", "#8370ff"],
  berry: ["#a80165", "#d44d8e"],
  blue: ["#015f98", "#3c8bc8"],
  orchid: ["#be49d8", "#eb95ff"],
  magenta: ["#b10ca6", "#dc4ece"],
  purple: ["#8500c2", "#a551dd"],
  pink: ["#d6459b", "#ff7ac3"],
  plum: ["#843e8b", "#ac69b2"],
  lavender: ["#8d61bf", "#b381ed"],
} as const;

/**
 * Material 3's type scale (size/line height in sp; Android scales them with the font size setting). Weights are
 * the scale's; `Text`'s `weight` overrides one for emphasis (M3 Expressive's emphasized styles).
 */
export const m3type = {
  displayLarge: { fontSize: 57, lineHeight: 64, letterSpacing: -0.25 },
  displayMedium: { fontSize: 45, lineHeight: 52, letterSpacing: 0 },
  displaySmall: { fontSize: 36, lineHeight: 44, letterSpacing: 0 },
  headlineLarge: { fontSize: 32, lineHeight: 40, letterSpacing: 0 },
  headlineMedium: { fontSize: 28, lineHeight: 36, letterSpacing: 0 },
  headlineSmall: { fontSize: 24, lineHeight: 32, letterSpacing: 0 },
  titleLarge: { fontSize: 22, lineHeight: 28, letterSpacing: 0 },
  titleMedium: { fontSize: 16, lineHeight: 24, letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, lineHeight: 24, letterSpacing: 0.15 },
  bodyMedium: { fontSize: 14, lineHeight: 20, letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  labelLarge: { fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, lineHeight: 16, letterSpacing: 0.5 },
} as const;

/** Each M3 style's own weight (Title M/S and Labels are Medium). */
export const m3weight: Record<keyof typeof m3type, "400" | "500"> = {
  displayLarge: "400",
  displayMedium: "400",
  displaySmall: "400",
  headlineLarge: "400",
  headlineMedium: "400",
  headlineSmall: "400",
  titleLarge: "400",
  titleMedium: "500",
  titleSmall: "500",
  bodyLarge: "400",
  bodyMedium: "400",
  bodySmall: "400",
  labelLarge: "500",
  labelMedium: "500",
  labelSmall: "500",
};

/**
 * The sizes the screens were written with, each on its M3 style: micro and caption → Body S, small → Body M, body and
 * lead → Body L, title → Title M, heading → Headline S, figure and display → Headline M.
 */
export const type = {
  micro: m3type.bodySmall,
  caption: m3type.bodySmall,
  small: m3type.bodyMedium,
  body: m3type.bodyLarge,
  lead: m3type.bodyLarge,
  title: m3type.titleMedium,
  heading: m3type.headlineSmall,
  figure: m3type.headlineMedium,
  display: m3type.headlineMedium,
  ...m3type,
} as const;

/**
 * Material 3's corner scale. Nested shapes take the outer radius less the padding between them. The old names:
 * tag → xs, md → sm, lg → md, xl → lg (cards, lists), xxl → xl (sheets).
 */
export const shape = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, lgPlus: 20, xl: 28, full: 999 } as const;
export const radius = { tag: shape.xs, md: shape.sm, lg: shape.md, xl: shape.lg, xxl: shape.xl, full: shape.full } as const;

/**
 * Spacing on the 4/8 grid: 4, 8, 12, 16, 24, 32, 40, 48; the page's sides are 16. (0.5, 1.5, 2.5 and 3.5 are left
 * from the desktop's ramp for screens not redrawn yet; new code stays on the grid.)
 */
export const space = { 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, page: 16 } as const;

/** The least a finger can hit (Material's 48 dp), whatever the control looks like. */
export const TOUCH = 48;

export const weight = { regular: "400", medium: "500", semibold: "600", bold: "700" } as const;

export const font = {
  sans: Platform.select({ android: "sans-serif", default: undefined }),
  medium: Platform.select({ android: "sans-serif-medium", default: undefined }),
  mono: Platform.select({ android: "monospace", default: "Menlo" }),
};

/**
 * Motion (DESIGN.md, "Motion"): Material 3's springs for the few things the app moves itself, as Reanimated's
 * withSpring configs (damping from M3's damping ratio: ratio × 2√stiffness). Effects (fades, colour) never overshoot.
 * Screens and sheets move with Android's own transitions, not these.
 */
const spring = (ratio: number, stiffness: number) => ({ damping: ratio * 2 * Math.sqrt(stiffness), stiffness, mass: 1 });
export const motion = {
  spatialFast: spring(0.9, 1400),
  spatialDefault: spring(0.9, 700),
  spatialSlow: spring(0.9, 300),
  /** M3 Expressive's bouncy spring, for an earned moment only (a hand-in, a check-in). */
  expressive: spring(0.6, 800),
  effectsFast: spring(1, 3800),
  effectsDefault: spring(1, 1600),
  duration: { short: 150, medium: 250, long: 400 },
} as const;

export interface Theme {
  scheme: "light" | "dark";
  color: Palette;
  /** A course color as the desktop names it (`var(--course-blue)`), in this theme's tone. */
  course(tone: string | undefined): string;
}

function makeTheme(scheme: "light" | "dark"): Theme {
  const color = scheme === "dark" ? dark : light;
  const index = scheme === "dark" ? 1 : 0;
  return {
    scheme,
    color,
    course(tone) {
      const id = tone?.match(/--course-([a-z]+)/)?.[1] as keyof typeof COURSE | undefined;
      return id && COURSE[id] ? COURSE[id][index] : color.onSurfaceVariant;
    },
  };
}

export const THEMES = { light: makeTheme("light"), dark: makeTheme("dark") } as const;

export function themeFor(setting: "system" | "light" | "dark" | undefined, system: ColorSchemeName | null): Theme {
  const scheme = setting === "light" || setting === "dark" ? setting : system === "dark" ? "dark" : "light";
  return THEMES[scheme];
}

export const ThemeContext = createContext<Theme>(THEMES.light);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
