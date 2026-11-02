// The app's design tokens (mobile/DESIGN.md): Material 3's colour roles, type scale, shapes, spacing
// and motion, filled with the brand's colours (src/app/styles.css). Screens read them through
// useTheme(); nothing types a color of its own. Every pair the screens draw is checked in
// test/mobile/contrast.test.ts; the colours themselves live in palette.ts.
//
// `theme.color` holds the M3 roles (primary, surfaceContainer, onSurfaceVariant, …) and, under them,
// the names the screens were written with (fg, muted, edge, …), each now pointing at its role, so a
// screen built before the roles gets the new look without a change. New code uses the roles.
import { createContext, useContext } from "react";
import { type ColorSchemeName, Platform } from "react-native";
import { COURSE, COURSE_TILE, dark, GREY_TILE, light, type Palette, V4, type V4Palette } from "./palette";

export type { Palette, Roles, V4Palette } from "./palette";

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

export const weight = { regular: "400", medium: "500", semibold: "600", bold: "700", extrabold: "800" } as const;

export const font = {
  /** Headings and numbers (v4): Plus Jakarta Sans, bundled (plugins/fonts.js); one family per weight on Android. */
  display: { semibold: "PlusJakartaSans-SemiBold", bold: "PlusJakartaSans-Bold", extrabold: "PlusJakartaSans-ExtraBold" },
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
  /** Round 2's surfaces and states (v4). */
  v4: V4Palette;
  /** A course color as the desktop names it (`var(--course-blue)`), in this theme's tone. */
  course(tone: string | undefined): string;
  /** A course's tile colours (v4): its ink (icon, big numbers, a pill's word) and its tint (the tile, the card). */
  courseTile(tone: string | undefined): { ink: string; tint: string };
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
    v4: V4[scheme],
    courseTile(tone) {
      const id = tone?.match(/--course-([a-z]+)/)?.[1] as keyof typeof COURSE_TILE | undefined;
      const tile = id && COURSE_TILE[id] ? COURSE_TILE[id] : GREY_TILE;
      return { ink: tile[index], tint: tile[2 + index] };
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
