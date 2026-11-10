// iOS 26's Liquid Glass, where the iPhone has it: the controls that float (a top bar's back button and actions, a
// snackbar) on glass, as the iPhone's own apps draw them. Android, and an iPhone before iOS 26, keep the Material look
// they had: `GLASS` is false there and nothing below draws.
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import { Platform, type StyleProp, StyleSheet, type ViewStyle } from "react-native";
import { useTheme } from "./theme";

/** Whether this phone draws Liquid Glass (iOS 26 or later). With Reduce Transparency on, iOS frosts the glass itself. */
export const GLASS = Platform.OS === "ios" && isLiquidGlassAvailable();

/** A top bar's buttons on glass: a circle round one, a capsule round several. Only where `GLASS`; else the buttons as they are. */
export function GlassButtons({ children }: { children: ReactNode }) {
  const scheme = useTheme().scheme;
  if (!GLASS) return <>{children}</>;
  // The app's own light or dark (Settings may differ from the phone's).
  return (
    <GlassView isInteractive glassEffectStyle="regular" colorScheme={scheme} style={styles.buttons}>
      {children}
    </GlassView>
  );
}

/** A floating surface on glass (a snackbar), its shape and padding from `style`. */
export function GlassSurface({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const scheme = useTheme().scheme;
  return (
    <GlassView glassEffectStyle="regular" colorScheme={scheme} style={style}>
      {children}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  // A 48 dp button inside, 2 dp of glass round it: iOS's 52 pt bar buttons.
  buttons: { flexDirection: "row", alignItems: "center", borderRadius: 999, padding: 2 },
});
