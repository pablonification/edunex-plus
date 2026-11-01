// A v4 tile that isn't a course's (DESIGN.md "v4", beside tile.tsx's CourseTile): the same rounded square at a TileRow's
// start, in one of v4's tonal pairs, holding an icon or a short number in the pair's ink: a file's kind (PDF red, Word
// blue, slides amber, sheets green, anything else neutral), a module's number in its course's tint.
import type { ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "./theme";

export type TileTone = "red" | "amber" | "ok" | "brand" | "neutral";

/** A tone's ink (the icon, the number) and tint (the tile), from v4's tonal pairs (each measured as a chip's). */
export function useToneTile(): (tone: TileTone) => { ink: string; tint: string } {
  const v = useTheme().v4;
  return (tone) => {
    switch (tone) {
      case "red":
        return { ink: v.redFg, tint: v.redBg };
      case "amber":
        return { ink: v.ambFg, tint: v.ambBg };
      case "ok":
        return { ink: v.okFg, tint: v.okBg };
      case "brand":
        return { ink: v.brandInk, tint: v.brandTint };
      default:
        return { ink: v.fg2, tint: v.page };
    }
  };
}

/** The tile: `tint` behind what it holds; hidden from a screen reader (the row says what it is). */
export function IconTile({ tint, size = 44, children }: { tint: string; size?: number; children: ReactNode }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        backgroundColor: tint,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {children}
    </View>
  );
}
