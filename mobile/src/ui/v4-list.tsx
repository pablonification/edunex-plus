// Lists (DESIGN.md, "Surfaces"), as Beranda's "Nanti hari ini" draws them, for every screen: rows flat on the page in
// light and dark, no card around them (CardGroup), each row one target that gives on a press (TileRow: a leading tile, a title, at
// most one meta line, at most one status), the status as a tonal pill (StatusChip), and a section's title in Plus
// Jakarta Sans (SectionTitle). Dividers start after the tile, never across it.
import type { ReactNode } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { PressScale } from "./press";
import { ROW_SIDE, rowEnd } from "./row-end";
import { Text } from "./text";
import { space, useTheme } from "./theme";

/** Where a row's divider starts: the row's side padding, a 44 dp tile and the gap after it. */
export const ROW_INSET = ROW_SIDE + 44 + space[3];

/** Rows (or anything) that belong together, flat on the page: no fill, no corner, in light and dark. */
export function CardGroup({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={style}>
      {children}
    </View>
  );
}

/**
 * A row in a CardGroup: `leading` (a CourseTile, an icon tile), the title, one meta line, one status at the end. With
 * `onPress` the whole row is the one target and gives on a press; without, it's still. `first` drops the divider above.
 */
export function TileRow({
  leading,
  title,
  meta,
  status,
  chevron,
  first = false,
  inset = ROW_INSET,
  onPress,
  onLongPress,
  label,
  testID,
  dim = false,
  children,
}: {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  /** The chevron at the row's end (ui/row-end.tsx): by itself with `onPress` and no `status`; true adds it after a `status`, false leaves it out. */
  chevron?: boolean;
  first?: boolean;
  /** Where the divider starts (dp from the row's start). */
  inset?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  /** The whole row as a screen reader says it. */
  label?: string;
  testID?: string;
  /** Greyed (a module the lecturer hasn't opened): the title and meta in the muted tone. */
  dim?: boolean;
  /** Under the title and meta, inside the row (a note's text). */
  children?: ReactNode;
}) {
  const v = useTheme().v4;
  const body = (
    <>
      {!first && <View style={{ position: "absolute", top: 0, left: inset, right: 0, height: 1, backgroundColor: v.line }} />}
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === "string" ? (
          <Text size="bodyLarge" weight="medium" style={{ color: dim ? v.muted : v.fg, lineHeight: 21 }}>
            {title}
          </Text>
        ) : (
          title
        )}
        {meta !== undefined &&
          meta !== null &&
          meta !== "" &&
          (typeof meta === "string" ? (
            <Text size="bodyMedium" tabular style={{ color: v.muted, marginTop: 2 }}>
              {meta}
            </Text>
          ) : (
            <View style={{ marginTop: 2 }}>{meta}</View>
          ))}
        {children}
      </View>
      {rowEnd(status, Boolean(onPress), chevron)}
    </>
  );
  const style: ViewStyle = { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: ROW_SIDE, paddingVertical: space[3], minHeight: 68 };
  if (!onPress && !onLongPress)
    return (
      <View testID={testID} accessible={label !== undefined} accessibilityLabel={label} style={style}>
        {body}
      </View>
    );
  return (
    <PressScale onPress={onPress} onLongPress={onLongPress} testID={testID} accessibilityLabel={label} style={style}>
      {body}
    </PressScale>
  );
}

export type ChipTone = "red" | "amber" | "ok" | "neutral" | "brand";

/** A row's one status: a few words on a tonal pill (red: lost or none left, amber: watch it, ok: fine). */
export function StatusChip({ tone, children, testID }: { tone: ChipTone; children: string; testID?: string }) {
  const theme = useTheme();
  const v = theme.v4;
  const [bg, fg] =
    tone === "red"
      ? [v.redBg, v.redFg]
      : tone === "amber"
        ? [v.ambBg, v.ambFg]
        : tone === "ok"
          ? [v.okBg, v.okFg]
          : tone === "brand"
            ? [v.brandTint, v.brandInk]
            : [v.chip, v.fg2];
  return (
    <View testID={testID} style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: bg, flexShrink: 0 }}>
      <Text size="labelMedium" weight="semibold" tabular style={{ color: fg }}>
        {children}
      </Text>
    </View>
  );
}

/** A section's title over its card, in Plus Jakarta Sans; `end` holds its one action (a chevron to the whole list). */
export function SectionTitle({ children, end, first = false }: { children: string; end?: ReactNode; first?: boolean }) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", marginTop: first ? 0 : space[6], marginBottom: end ? space[1] : space[3], marginLeft: ROW_SIDE }}
    >
      <Text size="titleMedium" face="display" weight="bold" accessibilityRole="header" style={{ flex: 1, fontSize: 17, letterSpacing: -0.2 }}>
        {children}
      </Text>
      {end}
    </View>
  );
}
