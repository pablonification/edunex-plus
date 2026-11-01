// v4's lists (round 2, DESIGN.md "v4"): rows on a white card over the grey page, the card's ends round, a hairline
// between rows from the text's edge (past the 44 dp course tile), as Beranda's "Nanti hari ini". A list drawn row by
// row (a FlashList) gives each row its own slice of the card (`CardSlice`); a short list wraps its rows in `CardList`.
// A section's title is Plus Jakarta Sans (`SectionTitle`), with how many in it when that helps.
import { Children, type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { Text } from "./text";
import { space, useTheme } from "./theme";

export const CARD_RADIUS = 20;
/** Where the hairline between two rows starts: past the row's tile (14 + 44 + 12 dp). */
export const LINE_INSET = 70;

/** One row's part of a card: round at the card's ends, a hairline over every row but the first. */
export function CardSlice({ first, last, inset = LINE_INSET, children }: { first: boolean; last: boolean; inset?: number; children: ReactNode }) {
  const v = useTheme().v4;
  const top = first ? CARD_RADIUS : 0;
  const bottom = last ? CARD_RADIUS : 0;
  return (
    <View
      style={{
        backgroundColor: v.card,
        overflow: "hidden",
        borderTopLeftRadius: top,
        borderTopRightRadius: top,
        borderBottomLeftRadius: bottom,
        borderBottomRightRadius: bottom,
      }}
    >
      {children}
      {!first && <View pointerEvents="none" style={{ position: "absolute", top: 0, left: inset, right: 0, height: 1, backgroundColor: v.line }} />}
    </View>
  );
}

/** A short list's card: its rows with the hairlines between them. */
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
      style={{ fontSize: 17, letterSpacing: -0.2, color: v.fg, marginTop: first ? 0 : space[6], marginBottom: space[3], marginLeft: space[1] }}
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
 * A section's white card on a v4 page (a Task's instructions, its files, the answer): radius 20, 16 dp in, no shadow
 * (the one card that leads a screen has its own). `flush`: no padding, for rows that bring their own.
 */
export function Panel({ children, flush = false, testID, style }: { children: ReactNode; flush?: boolean; testID?: string; style?: ViewStyle }) {
  const v = useTheme().v4;
  return (
    <View testID={testID} style={[{ backgroundColor: v.card, borderRadius: CARD_RADIUS, padding: flush ? 0 : space[4], overflow: "hidden" }, style]}>
      {children}
    </View>
  );
}
