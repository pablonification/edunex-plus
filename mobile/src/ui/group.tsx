// Building blocks for a screen past Beranda (DESIGN.md, "Surfaces"): a section's heading in Plus Jakarta Sans, a
// section's block flat on the page (`Panel`: the page's own colour in light and dark, a fill only with a `tint`), rows
// flat on the page with hairlines inset past the leading tile (`Group`, `GroupRow`), a tonal pill for a row's one status (`Pill`), a tinted icon tile for what isn't a
// course (`IconTile`), and a big number that counts up once (`Figure`; side by side in a `FigureRow`). Every target springs (press.tsx). A screen that
// uses them sets its `Page`'s `background` to `theme.v4.page`, so its top bar sits on the same colour.
import { createContext, type ReactNode, useContext } from "react";
import { type AccessibilityProps, type StyleProp, View, type ViewStyle } from "react-native";
import { CountUp } from "./expressive";
import { PressScale } from "./press";
import { ROW_SIDE, rowEnd } from "./row-end";
import { Text } from "./text";
import { font, space, useTheme, type V4Palette } from "./theme";

/** The card's corner (v4: 20–24) and a row's least height. */
export const CARD_RADIUS = 20;
const ROW_MIN = 64;

/** A section's heading over its card (v4's "Nanti hari ini"). */
export function Heading({ children, first = false, trailing }: { children: string; first?: boolean; trailing?: ReactNode }) {
  const v = useTheme().v4;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: first ? space[2] : space[6],
        marginBottom: space[3],
        marginLeft: ROW_SIDE,
        gap: space[2],
      }}
    >
      <Text size="titleMedium" face="display" weight="bold" accessibilityRole="header" style={{ flex: 1, fontSize: 17, letterSpacing: -0.2, color: v.fg }}>
        {children}
      </Text>
      {trailing}
    </View>
  );
}

/**
 * A section's block, flat on the page in both themes (no box, no shadow); with a `tint` it is a card: the one thing
 * that leads. With `onPress` the whole block is one target that gives on a press.
 */
export function Panel({
  children,
  onPress,
  onLongPress,
  style,
  testID,
  tint,
  ...a11y
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** A card: a course's tint, a state's background. Without it the block is flat. */
  tint?: string;
} & AccessibilityProps) {
  // Flat: no fill at all unless tinted, so nothing can box it should page and card ever part again. The corner stays
  // for a caller that fills it through `style`.
  const surface: ViewStyle = { backgroundColor: tint, borderRadius: CARD_RADIUS, overflow: "hidden" };
  if (onPress || onLongPress)
    return (
      <PressScale onPress={onPress} onLongPress={onLongPress} testID={testID} style={[surface, style]} {...a11y}>
        {children}
      </PressScale>
    );
  return (
    <View testID={testID} style={[surface, style]} {...a11y}>
      {children}
    </View>
  );
}

/** Rows that belong together, flat on the page: an inset hairline between them, no card. */
export function Group({ children, testID, style }: { children: ReactNode; testID?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Panel testID={testID} style={style}>
      {children}
    </Panel>
  );
}

/**
 * A row in a `Group`: a leading tile, the title, at most one short meta line, at most one status at the end (a `Pill`
 * or an icon, never a sentence). One target, one outcome. Every row but the `first` has a hairline above it, inset past
 * the tile.
 */
export function GroupRow({
  leading,
  title,
  meta,
  metaTone = "muted",
  trailing,
  chevron,
  first = false,
  onPress,
  onLongPress,
  testID,
  children,
  ...a11y
}: {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** The meta line's colour: muted, or a state's ink. */
  metaTone?: "muted" | "red" | "amber" | "ok";
  trailing?: ReactNode;
  /** The chevron at the row's end (ui/row-end.tsx): by itself with `onPress` and no `trailing`; true adds it after a `trailing`, false leaves it out. */
  chevron?: boolean;
  first?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  testID?: string;
  children?: ReactNode;
} & AccessibilityProps) {
  const v = useTheme().v4;
  const metaColor = metaTone === "red" ? v.redFg : metaTone === "amber" ? v.ambFg : metaTone === "ok" ? v.okFg : v.muted;
  const body = (
    <>
      {!first && (
        <View style={{ position: "absolute", top: 0, left: leading ? ROW_SIDE + 44 + space[3] : ROW_SIDE, right: 0, height: 1, backgroundColor: v.line }} />
      )}
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === "string" ? (
          <Text size="bodyLarge" weight="medium" style={{ color: v.fg, lineHeight: 21 }}>
            {title}
          </Text>
        ) : (
          title
        )}
        {meta !== undefined && meta !== null && meta !== false && meta !== "" && (
          <View style={{ marginTop: 2 }}>
            {typeof meta === "string" ? (
              <Text size="bodyMedium" tabular style={{ color: metaColor }}>
                {meta}
              </Text>
            ) : (
              meta
            )}
          </View>
        )}
        {children}
      </View>
      {rowEnd(trailing, Boolean(onPress), chevron)}
    </>
  );
  const style: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: ROW_SIDE,
    paddingVertical: space[3],
    minHeight: ROW_MIN,
  };
  if (onPress || onLongPress)
    return (
      <PressScale onPress={onPress} onLongPress={onLongPress} testID={testID} style={style} {...a11y}>
        {body}
      </PressScale>
    );
  return (
    <View testID={testID} style={style} {...a11y}>
      {body}
    </View>
  );
}

export type PillTone = "red" | "amber" | "ok" | "brand" | "plain";

/** A tone's fill and ink; a plain pill on `chip` (a step off the card in dark too), a plain tile on the page's grey. */
function pillColors(v: V4Palette, tone: PillTone, plain = v.chip): { bg: string; fg: string } {
  switch (tone) {
    case "red":
      return { bg: v.redBg, fg: v.redFg };
    case "amber":
      return { bg: v.ambBg, fg: v.ambFg };
    case "ok":
      return { bg: v.okBg, fg: v.okFg };
    case "brand":
      return { bg: v.brandTint, fg: v.brandInk };
    case "plain":
      return { bg: plain, fg: v.fg2 };
  }
}

/** A row's one status as a tonal pill ("Jatah absen habis", "Lunas"); a few words at most. */
export function Pill({ tone, children, icon }: { tone: PillTone; children: string; icon?: (color: string) => ReactNode }) {
  const v = useTheme().v4;
  const { bg, fg } = pillColors(v, tone);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[1],
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: bg,
        flexShrink: 0,
      }}
    >
      {icon?.(fg)}
      <Text size="labelMedium" weight="semibold" style={{ color: fg }}>
        {children}
      </Text>
    </View>
  );
}

/**
 * A tinted square holding an icon, for a row that isn't a course (Nilai, UKT, a setting): `tone` picks the tint and
 * the ink; `icon` draws itself in the ink it's given. A plain one is a neutral pill's chip colour, a step off its card
 * in dark too (on the page's black it read as a hole in the card: judge round 6).
 */
export function IconTile({ icon, tone = "brand", size = 44 }: { icon: (color: string) => ReactNode; tone?: PillTone; size?: number }) {
  const v = useTheme().v4;
  // Bare: the icon in its tone's ink, no pale circle behind it (the box keeps its size, so rows line up).
  const { fg } = pillColors(v, tone);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      {icon(fg)}
    </View>
  );
}

/** The size every figure in a `FigureRow` takes, whatever its own `size`. */
const RowSize = createContext<number | null>(null);

/**
 * A screen's key number, big, in Plus Jakarta Sans: counts up once per run (`id`), then a smaller `unit` after it
 * ("3,42", "112 dari 144 SKS"). `color` for a state's ink (red when overdue); else the page's text colour.
 */
export function Figure({
  id,
  value,
  decimals = 0,
  comma = false,
  unit,
  color,
  size = 44,
}: {
  id: string;
  value: number;
  decimals?: number;
  comma?: boolean;
  unit?: string;
  color?: string;
  size?: number;
}) {
  const v = useTheme().v4;
  const ink = color ?? v.fg;
  const px = useContext(RowSize) ?? size;
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: space[2] }}>
      <CountUp
        id={id}
        value={value}
        decimals={decimals}
        comma={comma}
        style={{ fontFamily: font.display.extrabold, fontSize: px, lineHeight: Math.round(px * 1.15), letterSpacing: -1, color: ink }}
      />
      {unit ? (
        <Text size="bodyLarge" weight="medium" style={{ color: ink }}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

/** A quiet label over a figure ("IPK", "SKS lulus"). */
export function FigureLabel({ children }: { children: string }) {
  const v = useTheme().v4;
  return (
    <Text size="labelLarge" style={{ color: v.muted }}>
      {children}
    </Text>
  );
}

/**
 * Figures side by side ("IPK" 3,26 beside "SKS lulus" 125 dari 144), each a `FigureCell`: the labels on one line, the
 * numbers on one baseline. Every figure (and `FigureDash`) in the row takes the row's one `size`, so they share a line
 * box, and with it a baseline, under labels of one height (judge round 5: labels in a stair-step, "8" lower than
 * "3,30"). Side by side while they fit; at a big font size the next one goes under.
 */
export function FigureRow({ children, size = 44 }: { children: ReactNode; size?: number }) {
  return (
    <RowSize.Provider value={size}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", columnGap: space[6], rowGap: space[4] }}>{children}</View>
    </RowSize.Provider>
  );
}

/** One figure in a `FigureRow`: its label, the figure, and at most one thing under it (a `Pill`). */
export function FigureCell({ label, children, under, ...a11y }: { label: string; children: ReactNode; under?: ReactNode } & AccessibilityProps) {
  return (
    <View style={{ gap: space[1] }} {...a11y}>
      <FigureLabel>{label}</FigureLabel>
      {children}
      {under ? <View style={{ alignSelf: "flex-start" }}>{under}</View> : null}
    </View>
  );
}

/** A figure with nothing to count: "-" in the figure's face and size (a `FigureRow`'s, inside one). */
export function FigureDash({ size = 44 }: { size?: number }) {
  const v = useTheme().v4;
  const px = useContext(RowSize) ?? size;
  return <Text style={{ fontFamily: font.display.extrabold, fontSize: px, lineHeight: Math.round(px * 1.15), color: v.fg }}>-</Text>;
}
