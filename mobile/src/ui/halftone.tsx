// A quiet halftone in a corner: square dots on a regular grid, one colour at one alpha, biggest in the top-right corner
// and shrinking to nothing toward the left and the bottom (Beranda's blue header). The size carries the fade, so the
// alpha is the most any pixel is lifted, which is what the contrast test checks. Drawn once as one SVG path (a few
// hundred squares at most), redrawn only when its size or colour changes; never touched, never read by TalkBack.
import { memo, useMemo } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

/** The grid's step and a full-strength dot's side, in dp. */
const CELL = 8;
const DOT = 6;

/** The path of every dot: column 0 hugs the right edge, row 0 the top, each dot centred in its cell. */
export function halftonePath(width: number, height: number): string {
  const cols = Math.floor(width / CELL);
  const rows = Math.floor(height / CELL);
  let d = "";
  for (let r = 0; r < rows; r++) {
    const down = 1 - (r * CELL + CELL / 2) / height;
    for (let c = 0; c < cols; c++) {
      const left = 1 - (c * CELL + CELL / 2) / width;
      const size = Math.round(DOT * left ** 0.8 * down ** 0.5 * 2) / 2;
      if (size < 1) continue;
      const x = width - (c + 1) * CELL + (CELL - size) / 2;
      const y = r * CELL + (CELL - size) / 2;
      d += `M${x} ${y}h${size}v${size}h-${size}z`;
    }
  }
  return d;
}

/** Sits in its parent's top-right corner, behind what the parent draws after it. */
export const Halftone = memo(function Halftone({ width, height, color }: { width: number; height: number; color: string }) {
  const d = useMemo(() => halftonePath(width, height), [width, height]);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", top: 0, right: 0, width, height }}
    >
      <Svg width={width} height={height}>
        <Path d={d} fill={color} />
      </Svg>
    </View>
  );
});
