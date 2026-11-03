// Every colour pair the phone's screens draw reads in both themes (WCAG AA): 4.5:1 for text, 3:1 for large text
// (≥ 18 sp, or 14 sp bold) and for icons, dots, meters and a control's only edge. The colours are read from
// mobile/src/ui/palette.ts, so a token change that breaks one fails here. A pair a screen starts drawing goes in
// the list below, with the place it's drawn.
import { describe, expect, it } from "vitest";
import { BUSY_OPACITY, COURSE, COURSE_TILE, dark, GREY_TILE, light, NOW, type Palette, V4, type V4Palette } from "../../mobile/src/ui/palette";

type Scheme = "light" | "dark";
interface Tones {
  c: Palette;
  v: V4Palette;
  now: { now: string; on: string };
}
/** A colour in a theme: a token, or a see-through one already laid over what it sits on. */
type Pick = (t: Tones) => string;

const TONES: Record<Scheme, Tones> = { light: { c: light, v: V4.light, now: NOW.light }, dark: { c: dark, v: V4.dark, now: NOW.dark } };

/** The sheets' scrim (react-native-screens' DimmingView: black at 30%) and Android's status bar icons. */
const SCRIM = "#000000";
const SCRIM_ALPHA = 0.3;
const STATUS_DARK = "#00000099";
const STATUS_LIGHT = "#ffffff";

const TEXT = 4.5;
const LARGE = 3;
const MARK = 3;

function channels(color: string): [number, number, number, number] {
  const hex = color.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255, hex[2] ? Number.parseInt(hex[2], 16) / 255 : 1];
  }
  const rgba = color.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])];
  throw new Error(`not a colour: ${color}`);
}

/** `top` laid over `under` at `alpha` (times its own alpha, for an rgba or #rrggbbaa token). */
function over(top: string, under: string, alpha = 1): string {
  const [r, g, b, a] = channels(top);
  const [r2, g2, b2] = channels(under);
  const k = a * alpha;
  return `#${[r * k + r2 * (1 - k), g * k + g2 * (1 - k), b * k + b2 * (1 - k)].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(color: string): number {
  const [r, g, b, a] = channels(color);
  if (a !== 1) throw new Error(`${color} is see-through: lay it over its background first`);
  const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const COURSES = Object.keys(COURSE) as (keyof typeof COURSE)[];
const tile = (id: keyof typeof COURSE_TILE | "grey", s: Scheme) => {
  const t = id === "grey" ? GREY_TILE : COURSE_TILE[id];
  return { ink: t[s === "dark" ? 1 : 0], tint: t[s === "dark" ? 3 : 2] };
};

/** [what, foreground, background, least ratio, where it's drawn]. */
type Pair = [string, Pick, Pick, number, string];

const card: Pick = (t) => t.v.card;
const page: Pick = (t) => t.v.page;
const BARS: [string, Pick][] = [
  ["v4.page", page],
  ["v4.card", card],
  ["surface", (t) => t.c.surface],
  ["surfaceContainer", (t) => t.c.surfaceContainer],
];
const SURFACES: [string, Pick][] = [...BARS, ["surfaceContainerLow", (t) => t.c.surfaceContainerLow]];
const each = (what: string, fg: Pick, on: [string, Pick][], min: number, where: string): Pair[] =>
  on.map(([name, bg]) => [`${what} on ${name}`, fg, bg, min, where]);

const PAIRS: Pair[] = [
  // The blue header (Beranda).
  ["v4.onHead on v4.head (status line, icons)", (t) => t.v.onHead, (t) => t.v.head, TEXT, "screens/home/header.tsx"],
  ["v4.bellDot on v4.head", (t) => t.v.bellDot, (t) => t.v.head, MARK, "screens/home/header.tsx"],

  // Top bars, the tabs' bar and the plain surfaces under them.
  ...each("onSurface", (t) => t.c.onSurface, SURFACES, TEXT, "ui/top-bar.tsx, shell/source-status.tsx"),
  ...each("onSurfaceVariant", (t) => t.c.onSurfaceVariant, SURFACES, TEXT, "the status line, ⋮, the tabs at rest"),
  ...each("error", (t) => t.c.error, SURFACES, TEXT, "the status line, a row's note"),
  ...each("warningFg", (t) => t.c.warningFg, SURFACES, TEXT, "the status line, Fact, RowNote"),
  ...each("successFg", (t) => t.c.successFg, SURFACES, TEXT, "Fact, needs"),
  ...each("primary", (t) => t.c.primary, SURFACES, TEXT, "links, ghost buttons"),
  ...each("infoFg", (t) => t.c.infoFg, SURFACES, TEXT, "screens/plan/planner.tsx"),
  ...each("sourceItbFg", (t) => t.c.sourceItbFg, SURFACES, TEXT, "screens/schedule/month.tsx"),
  ...each("live", (t) => t.c.live, SURFACES, MARK, "LiveDot"),
  ...each("outline", (t) => t.c.outline, SURFACES, MARK, "Segmented, Chip, Button secondary, fields, the switch off"),
  ...each("fieldEdge", (t) => t.c.fieldEdge, SURFACES, MARK, "a field's edge: course/grades.tsx, plan/projection.tsx"),
  ...each("v4.fg", (t) => t.v.fg, SURFACES, TEXT, "v4 rows (also on surfaceContainerLow in a course's tasks)"),
  ...each("v4.fg2", (t) => t.v.fg2, SURFACES, TEXT, "v4 meta lines"),
  ...each("v4.muted", (t) => t.v.muted, SURFACES, TEXT, "v4 meta lines, placeholders, chevrons"),
  ...each("v4.brandInk", (t) => t.v.brandInk, SURFACES, TEXT, "links, notes"),
  ...each("v4.okFg", (t) => t.v.okFg, SURFACES, TEXT, "screens/plan/curriculum.tsx, home/urus.tsx"),
  ...each("v4.redFg", (t) => t.v.redFg, SURFACES, TEXT, "plan/bills.tsx, planner-kit.tsx"),
  ...each("v4.ambFg", (t) => t.v.ambFg, SURFACES, TEXT, "course/attendance-line.tsx, widget"),
  ...each("v4.brand", (t) => t.v.brand, SURFACES, MARK, "unread dot, radio, checkbox, switch on"),
  ...each("v4.live", (t) => t.v.live, SURFACES, MARK, "PulseDot"),
  ...each("today's colour", (t) => t.now.now, SURFACES, TEXT, "schedule/day.tsx now-line time, strip.tsx, widget"),
  ["onSurfaceVariant on sunken", (t) => t.c.onSurfaceVariant, (t) => t.c.sunken, TEXT, "screens/home/needs.tsx"],
  ["successFg on sunken", (t) => t.c.successFg, (t) => t.c.sunken, TEXT, "screens/home/needs.tsx"],
  ["faint on surfaceContainerHigh (placeholder)", (t) => t.c.faint, (t) => t.c.fill, TEXT, "licences-screen.tsx"],
  ["onSurface on selected over v4.card", (t) => t.v.fg, (t) => over(t.c.selected, t.v.card), TEXT, "schedule/month.tsx"],
  ["v4.muted on selected over v4.card", (t) => t.v.muted, (t) => over(t.c.selected, t.v.card), TEXT, "schedule/month.tsx"],
  ["v4.fg on sourceItbBg", (t) => t.v.fg, (t) => t.c.sourceItbBg, TEXT, "schedule/month.tsx"],
  ["v4.muted on sourceItbBg", (t) => t.v.muted, (t) => t.c.sourceItbBg, TEXT, "schedule/month.tsx"],
  ["v4.fg on sunken", (t) => t.v.fg, (t) => t.c.sunken, TEXT, "schedule/month.tsx"],
  ["v4.muted on sunken", (t) => t.v.muted, (t) => t.c.sunken, TEXT, "schedule/month.tsx"],
  ["v4.muted on v4.card (checkbox off)", (t) => t.v.muted, card, MARK, "settings/alerts.tsx"],

  // Filled and tonal pairs.
  ["onPrimary on primary", (t) => t.c.onPrimary, (t) => t.c.primary, TEXT, "Button primary"],
  // Busy, as drawn over the page at BUSY_OPACITY (the welcome's sign-in while Microsoft's page opens).
  [
    "onPrimary on primary, busy",
    (t) => over(t.c.onPrimary, t.c.surface, BUSY_OPACITY),
    (t) => over(t.c.primary, t.c.surface, BUSY_OPACITY),
    TEXT,
    "Button primary busy, shell/welcome.tsx",
  ],
  ["primary on v4.card", (t) => t.c.primary, card, MARK, "Switch on"],
  ["onAccent on accent", (t) => t.c.onAccent, (t) => t.c.accent, TEXT, "widget pill"],
  ...each("accent", (t) => t.c.accent, SURFACES, MARK, "the IPK chart's line, spinners"),
  ["fg on fill", (t) => t.c.fg, (t) => t.c.fill, TEXT, "Notice, ProblemBanner, widget"],
  ["fg at 0.92 on fill", (t) => over(t.c.fg, t.c.fill, 0.92), (t) => t.c.fill, TEXT, "Notice body"],
  ["onPrimaryContainer on primaryContainer", (t) => t.c.onPrimaryContainer, (t) => t.c.primaryContainer, TEXT, "the avatar, first-run"],
  ["primary on primaryContainer", (t) => t.c.primary, (t) => t.c.primaryContainer, TEXT, "first-run ghost button"],
  ["onSecondaryContainer on secondaryContainer", (t) => t.c.onSecondaryContainer, (t) => t.c.secondaryContainer, TEXT, "tabs' indicator, chips"],
  ["onTertiaryContainer on tertiaryContainer", (t) => t.c.onTertiaryContainer, (t) => t.c.tertiaryContainer, TEXT, "schedule/day.tsx"],
  ["onError on error", (t) => t.c.onError, (t) => t.c.error, TEXT, "badges"],
  ["onErrorContainer on errorContainer", (t) => t.c.onErrorContainer, (t) => t.c.errorContainer, TEXT, "hand-in.tsx"],
  ["error on v4.page (badge)", (t) => t.c.error, page, MARK, "the bell's badge"],
  ["inverseOnSurface on inverseSurface", (t) => t.c.inverseOnSurface, (t) => t.c.inverseSurface, TEXT, "snackbar"],
  ["inversePrimary on inverseSurface", (t) => t.c.inversePrimary, (t) => t.c.inverseSurface, TEXT, "snackbar's Undo"],
  ["sourceItbFg on sourceItbBg", (t) => t.c.sourceItbFg, (t) => t.c.sourceItbBg, MARK, "ui/brand.tsx"],
  ["fg on warningBg", (t) => t.c.fg, (t) => t.c.warningBg, TEXT, "parts/lecturer-html.tsx highlight"],
  ...(["danger", "warning", "success", "info", "neutral"] as const).flatMap((tone): Pair[] => [
    [`${tone}Fg on ${tone}Bg`, (t) => t.c[`${tone}Fg`], (t) => t.c[`${tone}Bg`], TEXT, "Badge, Tag, Notice, swipe"],
    [`${tone}Fg at 0.92 on ${tone}Bg`, (t) => over(t.c[`${tone}Fg`], t.c[`${tone}Bg`], 0.92), (t) => t.c[`${tone}Bg`], TEXT, "Notice body"],
  ]),
  ...(["Draft", "Submitted", "Overdue", "Closed", "Review"] as const).flatMap((s): Pair[] => [
    [`status${s}Fg on status${s}Bg`, (t) => t.c[`status${s}Fg`], (t) => t.c[`status${s}Bg`], TEXT, "StatusTag"],
    [`status${s}Fg on v4.card`, (t) => t.c[`status${s}Fg`], card, MARK, "tasks/hand-in.tsx glyph"],
  ]),

  // Meters on their track.
  ["primary on meterTrack", (t) => t.c.primary, (t) => t.c.meterTrack, MARK, "ProgressBar"],
  ["meterWarning on meterTrack", (t) => t.c.meterWarning, (t) => t.c.meterTrack, MARK, "parts/meter.tsx"],
  ["meterSuccess on meterTrack", (t) => t.c.meterSuccess, (t) => t.c.meterTrack, MARK, "plan/planner-summary.tsx"],
  ["meterWarning on v4.card", (t) => t.c.meterWarning, card, MARK, "parts/meter.tsx"],
  ["muted on v4.card (meter)", (t) => t.c.muted, card, MARK, "parts/meter.tsx"],
  ["pipRing on v4.card", (t) => t.c.pipRing, card, MARK, "parts/meter.tsx"],
  ["v4.brand on v4.page (meter track)", (t) => t.v.brand, page, MARK, "ui/meter.tsx"],
  ["v4.okFg on v4.page (meter track)", (t) => t.v.okFg, page, MARK, "ui/meter.tsx"],
  ["v4.redFg on v4.page (meter track)", (t) => t.v.redFg, page, MARK, "ui/meter.tsx"],

  // v4's tinted states.
  ["v4.onBrand on v4.brand", (t) => t.v.onBrand, (t) => t.v.brand, TEXT, "BigButton filled"],
  ["v4.brandInk on v4.brandTint", (t) => t.v.brandInk, (t) => t.v.brandTint, TEXT, "Pill brand, the picked day, Beranda's Semua siap"],
  ["v4.okFg on v4.okBg", (t) => t.v.okFg, (t) => t.v.okBg, TEXT, "Pill ok, BigButton done"],
  ["v4.redFg on v4.redBg", (t) => t.v.redFg, (t) => t.v.redBg, TEXT, "Pill red"],
  ["v4.ambFg on v4.ambBg", (t) => t.v.ambFg, (t) => t.v.ambBg, TEXT, "Pill amber"],
  ["v4.fg2 on v4.chip", (t) => t.v.fg2, (t) => t.v.chip, TEXT, "Pill plain, StatusChip neutral, tasks/row-parts.tsx StatusPill"],
  ...(["redFg", "ambFg"] as const).map(
    (k): Pair => [`v4.${k} at 0.8 on v4.card (pips)`, (t) => over(t.v[k], t.v.card, 0.8), card, MARK, "home/class-sheet.tsx"],
  ),
  ["v4.muted at 0.8 on v4.card (pips)", (t) => over(t.v.muted, t.v.card, 0.8), card, MARK, "home/class-sheet.tsx"],

  // Today's red.
  ["onNow on today's colour", (t) => t.now.on, (t) => t.now.now, TEXT, "schedule/strip.tsx, month.tsx"],
  ["today's colour on v4.card (the now-line and its time)", (t) => t.now.now, card, TEXT, "schedule/day.tsx"],

  // The status bar's icons while a sheet is open: the screen's style (dark icons in light, white in dark and on Beranda's
  // blue header) over what's under the sheet's scrim (react-native-screens' 30% black). Android draws dark icons 60% black.
  ...(
    [
      ["v4.page", page],
      ["v4.card", card],
      ["surface", (t) => t.c.surface],
    ] as [string, Pick][]
  ).map(
    ([name, under]): Pair => [
      `status bar icons on ${name} under a sheet's scrim`,
      (t) => (t === TONES.dark ? STATUS_LIGHT : over(STATUS_DARK, over(SCRIM, under(t), SCRIM_ALPHA))),
      (t) => over(SCRIM, under(t), SCRIM_ALPHA),
      MARK,
      "ui/sheet.tsx (patches/react-native-screens: the sheet takes the app's status bar style)",
    ],
  ),
  ["white status bar icons on v4.head under a sheet's scrim", () => STATUS_LIGHT, (t) => over(SCRIM, t.v.head, SCRIM_ALPHA), MARK, "Beranda's class sheet"],

  // The course tiles: the ink on its tint and on a card, the words on the tint, every colour and the grey.
  ...[...COURSES, "grey" as const].flatMap((id): Pair[] => {
    const ink: Pick = (t) => tile(id, t === TONES.dark ? "dark" : "light").ink;
    const tint: Pick = (t) => tile(id, t === TONES.dark ? "dark" : "light").tint;
    return [
      [`${id} ink on its tint`, ink, tint, TEXT, "ui/tile.tsx, home/urus.tsx"],
      [`${id} ink on v4.card`, ink, card, TEXT, "home/urus.tsx kind chip"],
      [`${id} ink on v4.page`, ink, page, MARK, "schedule/day.tsx"],
      [`v4.fg on ${id} tint`, (t) => t.v.fg, tint, TEXT, "schedule/day.tsx, home/urus.tsx"],
      [`v4.fg2 on ${id} tint`, (t) => t.v.fg2, tint, TEXT, "schedule/day.tsx"],
      [`v4.muted on ${id} tint`, (t) => t.v.muted, tint, MARK, "schedule/day.tsx status icon"],
      [`v4.ambFg on ${id} tint`, (t) => t.v.ambFg, tint, MARK, "schedule/day.tsx status icon"],
      [`v4.redFg on ${id} tint`, (t) => t.v.redFg, tint, LARGE, "home/urus.tsx late figure"],
      [`v4.fg on ${id} tint + 14% ink`, (t) => t.v.fg, (t) => over(ink(t), tint(t), 0.14), TEXT, "schedule/day.tsx class on now"],
      [`${id} ink on its tint + 14% ink`, ink, (t) => over(ink(t), tint(t), 0.14), MARK, "schedule/day.tsx"],
    ];
  }),
  // The course colour itself (a course's dot, the picker's swatch).
  ...COURSES.flatMap((id): Pair[] => {
    const tone: Pick = (t) => COURSE[id][t === TONES.dark ? 1 : 0];
    return [
      ...each(`${id} dot`, tone, SURFACES, MARK, "ui/display.tsx CourseDot"),
      [`${id} dot on secondaryContainer`, tone, (t) => t.c.secondaryContainer, MARK, "tasks/list.tsx chip"],
      [`check on ${id} swatch`, (t) => t.v.onCourse, tone, MARK, "parts/course-color-picker.tsx"],
    ];
  }),
];

// A neutral pill on a card is a step off the card, so it reads as a pill and not as a hole (in dark it was the page's
// black: judge round 5). Not a text pair: as far off the card as light's page grey is from its white card, or more.
describe("a neutral pill stands off its card", () => {
  it.each(["light", "dark"] as const)("%s", (scheme) => {
    const { v } = TONES[scheme];
    expect(ratio(v.chip, v.card)).toBeGreaterThanOrEqual(ratio(V4.light.page, V4.light.card));
  });
});

describe("every colour pair on the phone's screens", () => {
  for (const scheme of ["light", "dark"] as const) {
    describe(scheme, () => {
      it.each(PAIRS.map(([what, fg, bg, min, where]) => ({ what, fg, bg, min, where })))("$what ($where)", ({ fg, bg, min }) => {
        const t = TONES[scheme];
        expect(ratio(fg(t), bg(t))).toBeGreaterThanOrEqual(min);
      });
    });
  }
});
