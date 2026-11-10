// How a row ends (mobile/qa/superapp-decisions.md, "Rows you can tap"): a row that opens something ends in the same
// quiet chevron on every screen, and a row that does nothing has none. The shared rows (b.tsx's BRow / kit's FlatRow,
// group.tsx's GroupRow, v4-list.tsx's TileRow, settings-list.tsx's SettingRow) draw it themselves when they have an
// `onPress` and nothing else at their end; a row whose end is already taken (a status pill, a switch, an arrow out
// of the app) keeps that, and asks for the chevron after it with `chevron`. `chevron={false}` opts out.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Icons } from "./icons";
import { useTheme } from "./theme";

/**
 * A flat row's side padding, and a heading's left margin: 4 dp (theme's `space[1]`). Rows sit on the page itself (no
 * card), so a row's first thing (its tile or its title) starts on the edge of the heading over it, 20 dp from the
 * screen's side, where the screens' own lines under a heading already sit. (It was 14: a card's inner padding, kept
 * after the cards went, which set every row about 10 dp right of its heading.)
 */
export const ROW_SIDE = 4;

/** The one chevron at a row's end: 20 dp, the muted ink, not read aloud (the row's role says it opens). */
export function RowChevron() {
  const v = useTheme().v4;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexShrink: 0 }}>
      <Icons.ChevronRight size={20} color={v.muted} />
    </View>
  );
}

const nothing = (end: ReactNode) => end === undefined || end === null || end === false || end === "";

/** A row's end: what the caller put there, then the chevron when the row opens something and its end is free (or `chevron` asks). */
export function rowEnd(end: ReactNode, opens: boolean, chevron: boolean | undefined): ReactNode {
  const show = chevron ?? (opens && nothing(end));
  if (!show) return end;
  return nothing(end) ? (
    <RowChevron />
  ) : (
    <>
      {end}
      <RowChevron />
    </>
  );
}
