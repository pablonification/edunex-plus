// Fluent UI System Icons by Fluent's own names: one glyph, drawn with react-native-svg at the size Fluent made it for
// (the number in its name), filled where the Student is and on service tiles, regular elsewhere. A thin wrapper beside
// ui/icons.tsx, loading the same way: each glyph's path is its own module, loaded when that glyph is first drawn
// (./fluent-paths.ts), never all of them at once.
import Svg, { Path } from "react-native-svg";
import { FLUENT, type FluentName } from "./fluent-paths";
import { useTheme } from "./theme";

export type { FluentName };

/** The size a glyph was drawn for: the digits in its name ("Ribbon28Filled" is 28). */
function drawnAt(name: FluentName): number {
  return Number(name.match(/\d+/)?.[0] ?? 24);
}

export function Fluent({ name, color, size }: { name: FluentName; color?: string; size?: number }) {
  const theme = useTheme();
  const box = drawnAt(name);
  const shown = size ?? box;
  return (
    <Svg width={shown} height={shown} viewBox={`0 0 ${box} ${box}`} accessibilityElementsHidden importantForAccessibility="no">
      <Path d={FLUENT[name]()} fill={color ?? theme.color.onSurface} />
    </Svg>
  );
}
