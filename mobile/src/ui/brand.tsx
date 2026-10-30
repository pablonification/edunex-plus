// The marks people already know, as on the desktop (src/app/ui/brand.tsx): Edunex's and SIX's own logos
// wherever the app stands for one of them (connecting, its status, its account). The ITB calendar has no
// logo of its own: a calendar stands for it. The logos are the desktop's own files.
import { Image, View } from "react-native";
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
