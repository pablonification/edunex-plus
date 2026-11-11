// The marks people already know, as on the desktop (src/app/ui/brand.tsx): Edunex's and SIX's own logos
// wherever the app stands for one of them (connecting, its status, its account). The ITB calendar has no
// logo of its own: a calendar stands for it. The logos are the desktop's own files. Edunex Plus's own mark is
// drawn here as vectors (BrandMark), from the icon's numbers (scripts/make-icons.mjs).
import { Image, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { SourceId } from "../../../src/core/models";
import { Icons } from "./icons";
import { useTheme } from "./theme";

const EDUNEX = require("../../../src/app/assets/edunex.png");
const SIX = require("../../../src/app/assets/six.png");

/** A source's logo as a small rounded tile, `size` dp square. */
export function SourceLogo({ source, size = 32 }: { source: SourceId; size?: number }) {
  const theme = useTheme();
  if (source === "six")
    return <Image source={SIX} style={{ width: size, height: size, borderRadius: size * 0.22 }} accessibilityIgnoresInvertColors accessible={false} />;
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        // Edunex's elephant sits on white in both themes, like its own site.
        backgroundColor: source === "edunex" ? "#ffffff" : theme.color.sourceItbBg,
        borderWidth: source === "edunex" ? 1 : 0,
        borderColor: "rgba(0,0,0,0.1)",
      }}
    >
      {source === "edunex" ? (
        <Image source={EDUNEX} style={{ width: size * 0.84, height: size * 0.84 }} resizeMode="contain" accessibilityIgnoresInvertColors />
      ) : (
        <Icons.Calendar size={size * 0.55} color={theme.color.sourceItbFg} weight="bold" />
      )}
    </View>
  );
}

/** The icon's blue (scripts/make-icons.mjs's gradient at its middle): the same in light and dark, as the app's icon is. */
const MARK_BLUE = "#2f6feb";

/**
 * Edunex Plus's own mark, the icon's "e" and its "+" on the blue tile, `size` dp square: vectors, so nothing is decoded
 * for it (Beranda's header draws it on the first frame). The numbers are scripts/make-icons.mjs's (a 1024 drawing whose
 * tile spans 100 to 924), flat: no gradient or shadow at this size. `label`: the app's name for a screen reader, or
 * leave it out where the name is said beside it.
 */
export function BrandMark({ size = 32, label, testID }: { size?: number; label?: string; testID?: string }) {
  return (
    <View
      testID={testID}
      accessible={Boolean(label)}
      accessibilityRole={label ? "image" : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="100 100 824 824">
        <Rect x={100} y={100} width={824} height={824} rx={196} fill={MARK_BLUE} />
        {/* The "e": a ring open at the lower right with a round end, and its bar. */}
        <Path d="M630,566 A170,170 0 1 0 573.8,692.3" fill="none" stroke="#ffffff" strokeWidth={96} />
        <Circle cx={573.8} cy={692.3} r={48} fill="#ffffff" />
        <Rect x={246} y={525} width={428} height={82} fill="#ffffff" />
        {/* The raised "+". */}
        <Path d="M640,338 H776 M708,270 V406" fill="none" stroke="#ffffff" strokeWidth={64} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
