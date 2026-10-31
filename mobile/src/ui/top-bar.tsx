// Material 3's small top app bar, over a screen a tab opened (a Task, a course, Settings): Android's
// back arrow at the start, then the screen's title (or the part of the app it belongs to, when the
// page carries its own big title), the screen's actions at the end (one or two; more go in ⋮,
// menu.tsx). It sits on the page's colour and takes a tone once the page scrolls under it. The tabs'
// own pages use `TabHeader` (shell/source-status.tsx): the tab's name, search, the bell, the avatar.
import type { ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../../src/app/i18n";
import { useNav } from "../nav";
import { IconButton } from "./controls";
import { Icons } from "./icons";
import { useScrolledUnder } from "./layout";
import { Text } from "./text";
import { space, useTheme } from "./theme";

/** The bar's own height under the status bar (M3's small top app bar). */
export const BAR_HEIGHT = 64;

export function TopBar({ title, actions, onBack }: { title?: string; actions?: ReactNode; onBack?: () => void }) {
  const t = useT();
  const nav = useNav();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <BarSurface>
      <View style={[styles.bar, { marginTop: insets.top }]}>
        <IconButton label={t("action.back")} onPress={onBack ?? nav.back} testID="action.back">
          <Icons.ArrowLeft size={24} color={theme.color.onSurface} />
        </IconButton>
        <Text size="titleLarge" numberOfLines={1} accessibilityRole="header" style={{ flex: 1, marginLeft: space[1] }}>
          {title ?? ""}
        </Text>
        {actions && <View style={{ flexDirection: "row", alignItems: "center" }}>{actions}</View>}
      </View>
    </BarSurface>
  );
}

/**
 * A top bar's surface, edge to edge under the status bar: the page's colour at rest, surfaceContainer once the page
 * scrolls under it (faded on the UI thread from the page's offset).
 */
export function BarSurface({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const under = useScrolledUnder();
  return (
    <View style={{ backgroundColor: theme.color.surface }}>
      {under && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.color.surfaceContainer, opacity: under }]} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: space[1], minHeight: BAR_HEIGHT },
});
