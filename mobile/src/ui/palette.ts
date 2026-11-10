// The app's colours (mobile/DESIGN.md, "Colour"), apart from theme.ts so a test in Node can read them without
// React Native: Material 3's roles, the meaning colours, the course colours and tiles, and round 2's v4 look. Every
// pair the screens draw is checked in test/mobile/contrast.test.ts (WCAG: 4.5:1 for text, 3:1 for large text and marks).

/** Material 3's colour roles, light. Brand blue as primary; surfaces neutral with a touch of its hue. */
export const lightRoles = {
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

export const darkRoles: Roles = {
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
export function legacy(r: Roles, scheme: "light" | "dark") {
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
    live: light ? "#209b56" : "#2fbf6c",
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

export const light: Palette = { ...lightRoles, ...legacy(lightRoles, "light") };
export const dark: Palette = { ...darkRoles, ...legacy(darkRoles, "dark") };

/** The ten course colors, each with its light and dark tone (`--course-<id>-light/-dark`). */
/**
 * How strongly a busy button draws (its label, spinner and fill), over the page: full. Dimmed to 72%, the welcome's
 * "Masuk dengan akun ITB" read 2.5:1 while signing in.
 */
export const BUSY_OPACITY = 1;

export const COURSE = {
  cyan: ["#028dab", "#06bfe7"],
  indigo: ["#6e46fb", "#8370ff"],
  berry: ["#a80165", "#d55191"],
  blue: ["#015f98", "#3c8bc8"],
  orchid: ["#be49d8", "#eb95ff"],
  magenta: ["#b10ca6", "#dc4ece"],
  purple: ["#8500c2", "#ac5ee0"],
  pink: ["#d6459b", "#ff7ac3"],
  plum: ["#843e8b", "#ac69b2"],
  lavender: ["#8d61bf", "#b381ed"],
} as const;

/**
 * Each course colour as a tile (round 2, v4: DESIGN.md "Course tiles"): [ink on light, ink on dark, tint on light, tint
 * on dark]. The ink is the course colour darkened (light) or lightened (dark) until it reads at 4.5:1 or more on its
 * tint and on a card; the tint is the colour mixed into the card. Measured with contrast.py (mobile/qa/home-notes.md).
 */
export const COURSE_TILE = {
  cyan: ["#02748c", "#06bfe7", "#e3f2f6", "#143b48"],
  indigo: ["#6c45f6", "#9787ff", "#efebff", "#2d2b4d"],
  berry: ["#a80165", "#dd71a5", "#f5e3ee", "#3d2436"],
  blue: ["#015f98", "#5b9ed1", "#e3edf4", "#1e3142"],
  orchid: ["#a03db5", "#eb95ff", "#f8ebfb", "#41334d"],
  magenta: ["#b10ca6", "#e167d5", "#f6e4f5", "#3e2443"],
  purple: ["#8500c2", "#bb7be5", "#f2e3f8", "#332546"],
  pink: ["#b43a82", "#ff7ac3", "#faebf4", "#452d41"],
  plum: ["#843e8b", "#bb84c0", "#f1eaf2", "#352a3d"],
  lavender: ["#7f57ac", "#b889ee", "#f2eef8", "#362f49"],
} as const;
/** A course with no colour yet: the same in grey. */
export const GREY_TILE = ["#5f6673", "#9aa1ae", "#edeef0", "#31353c"] as const;

/**
 * Round 2's look (v4, chosen by Arqila; mobile/design/r2-directions/v4): the page, its cards, the blue header, the
 * one filled button and the tinted states. Every text pair through contrast.py (mobile/qa/home-notes.md).
 */
export const V4 = {
  light: {
    // The page and a card are one colour in both themes (the super-app layout): a list is flat on the page with
    // hairlines between its rows, never flat in light and boxed in dark. What must stand off the page takes `chip`.
    page: "#ffffff",
    card: "#ffffff",
    // A neutral pill's fill on a card ("7 hari", "Belum ditagih", "Tidak wajib"): a step off the card in both themes.
    chip: "#f1f3f7",
    line: "#e6e9ef",
    // A bar's empty part where it must read on its own (Akademik's and Nilai's SKS bar): 3:1 on the card (round 3).
    track: "#8a909c",
    fg: "#14171c",
    fg2: "#3f4652",
    muted: "#5f6673",
    brand: "#1f63e0",
    onBrand: "#ffffff",
    head: "#1f63e0",
    onHead: "#ffffff",
    // The strong block (Profil's card, any one block of full colour): the same saturated blue in both themes, white on
    // it at 5.4:1. Never `brand` for a block: dark's `brand` is the pale blue made for a button on the dark page.
    strong: "#1f63e0",
    onStrong: "#ffffff",
    // Beranda's header texture (screens/home/header.tsx): one alpha for every dot, low enough that the white greeting
    // and icons over a dot keep 4.5:1 (contrast test); the dots' size, not their alpha, carries the fade.
    headDots: "rgba(255,255,255,0.18)",
    brandTint: "#dbe6ff",
    brandInk: "#1450c4",
    okBg: "#e3f4e8",
    okFg: "#11692f",
    redBg: "#fde7e6",
    redFg: "#a8201a",
    ambBg: "#fff0d9",
    ambFg: "#7f4500",
    live: "#1e9e5a",
    bellDot: "#ffcc4d",
    onCourse: "#ffffff",
  },
  dark: {
    // One dark surface (the roles' `surface`), page and card alike, as in light.
    page: "#161618",
    card: "#161618",
    // Lighter than the card, not the page's black: on the page's colour a pill read as a hole in the card (judge round 5).
    chip: "#2a2f39",
    // A hairline between flat rows: as far off the dark surface as light's is off white.
    line: "#2e323b",
    track: "#646b78",
    fg: "#eef0f4",
    fg2: "#c8cdd6",
    muted: "#9aa1ae",
    brand: "#a9c4ff",
    onBrand: "#0a2a66",
    // Dark: a deep, desaturated blue rather than Edunex's bright one (Arqila's review); the status bar's strip takes it too.
    head: "#1a3158",
    onHead: "#ffffff",
    // The strong block: light's blue, unchanged, so it stays as vivid as the course and exam blocks (round 2's charge).
    strong: "#1f63e0",
    onStrong: "#ffffff",
    headDots: "rgba(255,255,255,0.14)",
    brandTint: "#22355f",
    brandInk: "#b9ceff",
    okBg: "#14301f",
    okFg: "#8fe0a8",
    redBg: "#3d1b1a",
    redFg: "#ffb4ab",
    ambBg: "#3a2a12",
    ambFg: "#ffcf8a",
    live: "#3cc77d",
    bellDot: "#ffcc4d",
    // On a course's colour (the picker's check): dark, as the dark tones are light.
    onCourse: "#0c0e12",
  },
} as const;
export type V4Palette = { [K in keyof (typeof V4)["light"]]: string };

/**
 * Today's colour: the today mark and the now-line, its one meaning; `on` reads on its circle. The brand's blue (v4's
 * `brand`), never the error red: red on Jadwal read as something wrong (judge, round 2).
 */
export const NOW = {
  light: { now: "#1f63e0", on: "#ffffff" },
  dark: { now: "#a9c4ff", on: "#0a2a66" },
} as const;

/**
 * A service's colour, light then dark: its solid tile (a white glyph reads on it at 3:1 or more), the tile's slightly
 * darker lower edge, and the same colour as an ink and a tint for what isn't a tile (a word, a soft fill).
 *
 * The rule (mobile/qa/superapp-decisions.md, "Service colours"): colour belongs to Beranda's seven, one each. None is
 * red or amber: those say a state (late, at risk), never a place. Each sits on its own step of lightness as well as
 * its own hue (light: 32, 37, 44, 49, 53, 56, 60; dark: 43, 46, 49, 52, 55, 58.5, 61), so they tell apart without
 * hue too. Dark can't spread wider: a tile must stand 3:1 off the dark page (lightness 42 or more) and keep its white
 * glyph at 3:1 (61.8 or less), so its seven share that band in even steps of about three. Every other service takes `grey`, the neutral tile: a soft grey square with its glyph in grey ink, the
 * same family in both themes, so no colour is ever used for two services. Checked in test/mobile/contrast.test.ts.
 */
export const SERVICE_TONES = {
  indigo: { solid: ["#3d32bd", "#584ee4"], edge: ["#2d2496", "#433ac0"], ink: ["#3d32bd", "#c0b8ff"], tint: ["#e6e3ff", "#2a2752"] },
  green: { solid: ["#0d652f", "#0e7e3c"], edge: ["#094d23", "#07602c"], ink: ["#0d652f", "#8fe0a8"], tint: ["#dcf3e3", "#14301f"] },
  violet: { solid: ["#8a3fd6", "#974fe3"], edge: ["#6f2fb3", "#793cbd"], ink: ["#7a2fc4", "#d9b8ff"], tint: ["#f0e4ff", "#33204d"] },
  blue: { solid: ["#1f6fe5", "#2c79ee"], edge: ["#1757b8", "#1f60c4"], ink: ["#1450c4", "#b9ceff"], tint: ["#dbe6ff", "#22355f"] },
  magenta: { solid: ["#d63ca2", "#dc4cac"], edge: ["#ad2a80", "#b13288"], ink: ["#a3157f", "#ffaede"], tint: ["#fbdcf0", "#43203a"] },
  lime: { solid: ["#6f9300", "#749900"], edge: ["#577300", "#597600"], ink: ["#4a6200", "#c5e384"], tint: ["#e6f2c4", "#2a3312"] },
  teal: { solid: ["#0a9eb8", "#0ca2bc"], edge: ["#087c91", "#097f95"], ink: ["#00697a", "#7fdbe8"], tint: ["#d3f0f4", "#10353b"] },
  // The neutral tile: `tint` is the square, `edge` its lower edge, `ink` its glyph. `solid` is kept for a word or a dot.
  grey: { solid: ["#5f6673", "#565d6b"], edge: ["#dde0e7", "#20242c"], ink: ["#3f4652", "#c8cdd6"], tint: ["#eceef2", "#2a2f39"] },
} as const;
/** What's drawn on a service's solid tile, in both themes. */
export const ON_SERVICE = "#ffffff";
