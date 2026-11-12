// Lists (DESIGN.md, "Surfaces"): rows flat on the page in light and dark, a hairline between rows from the text's
// edge (past the 44 dp course tile), as Beranda's "Nanti hari ini". A list drawn row by row (a FlashList) wraps each
// row in a `CardSlice` (the name is kept; it draws no card); a short list wraps its rows in `CardList`.
// A section's title is Plus Jakarta Sans (`SectionTitle`), with how many in it when that helps.
import { Children, type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { ROW_SIDE } from "./row-end";
import { Text } from "./text";
import { space, useTheme } from "./theme";

export const CARD_RADIUS = 20;
/** Where the hairline between two rows starts: past the row's tile (14 + 44 + 12 dp). */
export const LINE_INSET = 70;

/** One row of a flat list: no fill, a hairline over every row but the first. (`last` is kept for its callers.) */
export function CardSlice({ first, inset = LINE_INSET, children }: { first: boolean; last: boolean; inset?: number; children: ReactNode }) {
  const v = useTheme().v4;
  return (
    <View>
      {children}
      {!first && <View pointerEvents="none" style={{ position: "absolute", top: 0, left: inset, right: 0, height: 1, backgroundColor: v.line }} />}
    </View>
  );
}

/** A short flat list: its rows with the hairlines between them. */
export function CardList({ inset, children }: { inset?: number; children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View>
      {rows.map((row, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the rows keep their own keys inside; the slice is only its place
        <CardSlice key={i} first={i === 0} last={i === rows.length - 1} inset={inset}>
          {row}
        </CardSlice>
      ))}
    </View>
  );
}

/** A section's title over its card ("Minggu ini  3"), as Beranda's. */
export function SectionTitle({ title, count, first = false }: { title: string; count?: number; first?: boolean }) {
  const v = useTheme().v4;
  return (
    <Text
      size="titleMedium"
      face="display"
      weight="bold"
      accessibilityRole="header"
      style={{ fontSize: 17, letterSpacing: -0.2, color: v.fg, marginTop: first ? 0 : space[6], marginBottom: space[3], marginLeft: ROW_SIDE }}
    >
      {title}
      {count !== undefined && (
        <Text size="titleMedium" face="display" weight="semibold" tabular style={{ fontSize: 17, color: v.muted }}>
          {`  ${count}`}
        </Text>
      )}
    </Text>
  );
}

/**
 * A section's block (a Task's instructions, its files, the answer): flat on the page in light and dark, no fill, no
 * shadow. A caller that needs a card (the one thing that leads) gives it a fill in `style`; the corner is ready for it.
 * `flush`: no padding, for rows that bring their own.
 */
export function Panel({ children, flush = false, testID, style }: { children: ReactNode; flush?: boolean; testID?: string; style?: ViewStyle }) {
  return (
    <View testID={testID} style={[{ borderRadius: CARD_RADIUS, padding: flush ? 0 : space[4], overflow: "hidden" }, style]}>
      {children}
    </View>
  );
}
