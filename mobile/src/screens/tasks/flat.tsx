// The Task's and the exam's pages in the new look: a white page (one dark surface in dark), sections flat on it under
// their headings, the same in both themes. A fill is kept only for one thing you can pick up (the deadline's card in
// its course's colour, the answer), a soft step off the page.
import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { CARD_RADIUS } from "../../ui/card-list";
import { space, type Theme } from "../../ui/theme";

/** The page: white in light, the dark surface in dark (../../ui/b.tsx's `page`, without a hook of its own). */
export const pageOf = (theme: Theme): string => (theme.scheme === "dark" ? theme.v4.page : theme.v4.card);

/** A soft fill a step off the page, for the one thing a section holds. */
export const softOf = (theme: Theme): string => (theme.scheme === "dark" ? theme.v4.card : theme.v4.page);

/**
 * A section's content, flat on the page: nothing around it, no padding of its own. Given a fill (`style.backgroundColor`:
 * a course's tint) it's a card, with the card's radius and padding (`flush`: none). The same props as ../../ui/card-list's
 * Panel, which it stands in for on these pages.
 */
export function Flat({ children, flush = false, testID, style }: { children: ReactNode; flush?: boolean; testID?: string; style?: ViewStyle }) {
  const card = style?.backgroundColor !== undefined;
  return (
    <View testID={testID} style={[card ? { borderRadius: CARD_RADIUS, padding: flush ? 0 : space[4], overflow: "hidden" } : null, style]}>
      {children}
    </View>
  );
}
