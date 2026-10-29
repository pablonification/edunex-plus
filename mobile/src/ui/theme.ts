// The desktop's look on the phone: the same colors (src/app/styles.css, light and dark), the
// same type ramp a step larger for a hand-held screen, the same corners. Screens read it through
// useTheme(); nothing types a color of its own.
import { createContext, useContext } from "react";
import { type ColorSchemeName, Platform } from "react-native";

const light = {
  canvas: "#ffffff",
  sidebar: "#f5f5f7",
  surface: "#ffffff",
  raised: "#ffffff",
  edge: "#e4e4e9",
  line: "#ededf0",
  fill: "#f4f4f6",
  hover: "#f1f1f4",
  selected: "rgba(0,0,0,0.055)",
  sunken: "#f7f7f9",
  scrim: "rgba(0,0,0,0.25)",
  track: "#d4d4da",
  fieldEdge: "#8d8d92",
  segment: "#ffffff",
  fg: "#1d1d1f",
  muted: "#5b5b61",
  faint: "#68686e",
  accent: "#2f6feb",
  accentActive: "#2258c4",
  accentFg: "#2862d6",
  onAccent: "#ffffff",
  dangerBg: "#fde7e4",
  dangerFg: "#b42318",
  warningBg: "#fdf2d6",
  warningFg: "#855000",
  successBg: "#dcf4e5",
  successFg: "#166240",
  infoBg: "#e6eefe",
  infoFg: "#2a58b8",
  neutralBg: "#f0f0f2",
  neutralFg: "#4f4f56",
  live: "#22a35a",
  meterTrack: "#ececef",
  meterWarning: "#b26b00",
  meterSuccess: "#1e8f4f",
  pipRing: "#7a7a80",
  hatch: "rgba(0,0,0,0.07)",
  statusDraftBg: "#fdf2d6",
  statusDraftFg: "#855000",
  statusSubmittedBg: "#dcf4e5",
  statusSubmittedFg: "#166240",
  statusOverdueBg: "#fde4e2",
  statusOverdueFg: "#b42318",
  statusClosedBg: "#e8e8eb",
  statusClosedFg: "#3f3f46",
  statusReviewBg: "#ebe7fd",
  statusReviewFg: "#5a33c8",
  sourceItbBg: "#f3ecfd",
  sourceItbFg: "#6338b8",
};

export type Palette = typeof light;

const dark: Palette = {
  canvas: "#161618",
  sidebar: "#1b1b1e",
  surface: "#1c1c1f",
  raised: "#1f1f23",
  edge: "#2a2a2f",
  line: "#26262b",
  fill: "#232327",
  hover: "#222226",
  selected: "rgba(255,255,255,0.07)",
  sunken: "#19191c",
  scrim: "rgba(0,0,0,0.45)",
  track: "#3a3a40",
  fieldEdge: "#6c6c72",
  segment: "#34343a",
  fg: "#ececef",
  muted: "#a8a8b0",
  faint: "#97979d",
  accent: "#2f6feb",
  accentActive: "#2763d8",
  accentFg: "#7aa2ff",
  onAccent: "#ffffff",
  dangerBg: "#3a1c19",
  dangerFg: "#ff9c8f",
  warningBg: "#382d10",
  warningFg: "#f2c862",
  successBg: "#12301f",
  successFg: "#80e0a9",
  infoBg: "#1b2742",
  infoFg: "#9ab8ff",
  neutralBg: "#27272b",
  neutralFg: "#bdbdc5",
  live: "#2fbf6c",
  meterTrack: "#2c2c30",
  meterWarning: "#f2c862",
  meterSuccess: "#2fbf6c",
  pipRing: "#77777d",
  hatch: "rgba(255,255,255,0.08)",
  statusDraftBg: "#382d10",
  statusDraftFg: "#f2c862",
  statusSubmittedBg: "#12301f",
  statusSubmittedFg: "#80e0a9",
  statusOverdueBg: "#3a1817",
  statusOverdueFg: "#ff9c94",
  statusClosedBg: "#2a2a2f",
  statusClosedFg: "#c6c6ce",
  statusReviewBg: "#272042",
  statusReviewFg: "#c4b5ff",
  sourceItbBg: "#271d3a",
  sourceItbFg: "#c4b0f5",
};

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
 * The type ramp: the desktop's (text-micro … text-display), one step up for a phone held at
 * arm's length, as Android's own body text is 16.
 */
export const type = {
  micro: { fontSize: 12, lineHeight: 16 },
  caption: { fontSize: 13, lineHeight: 18 },
  small: { fontSize: 14, lineHeight: 19 },
  body: { fontSize: 16, lineHeight: 22 },
  lead: { fontSize: 16, lineHeight: 23 },
  title: { fontSize: 18, lineHeight: 24 },
  heading: { fontSize: 21, lineHeight: 27 },
  figure: { fontSize: 28, lineHeight: 34 },
  display: { fontSize: 28, lineHeight: 34 },
} as const;

/** Corners: md 6, lg 8, xl 12 (cards and lists), 2xl 16 (raised cards, sheets), and tags. */
export const radius = { tag: 5, md: 6, lg: 8, xl: 12, xxl: 16, full: 999 } as const;

/** Spacing on a 4-pt grid; the page's sides are 16 (the desktop's 40 is for a window). */
export const space = { 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, page: 16 } as const;

export const weight = { regular: "400", medium: "500", semibold: "600", bold: "700" } as const;

export const font = {
  sans: Platform.select({ android: "sans-serif", default: undefined }),
  medium: Platform.select({ android: "sans-serif-medium", default: undefined }),
  mono: Platform.select({ android: "monospace", default: "Menlo" }),
};

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
      return id && COURSE[id] ? COURSE[id][index] : color.faint;
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
