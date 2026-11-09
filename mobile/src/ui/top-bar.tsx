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
import { usePageColor, useScrolledPast, useScrolledUnder } from "./layout";
import { Text } from "./text";
import { space, useTheme } from "./theme";

/** The bar's own height under the status bar (M3's small top app bar). */
export const BAR_HEIGHT = 64;

/**
 * `titleFrom`: the page shows the title big at its top (a course's name), so the bar's title stays hidden until the
 * page has scrolled that far (dp), then fades in: M3's collapsing top app bar, without moving any layout.
 * `v4`: on round 2's v4 page (DESIGN.md "v4"): the bar in the page's grey, its title on one line. The title is in Plus
 * Jakarta Sans on every page.
 * `lines`: how many lines the title may take (a course's long name on two). Past one line the title steps down to the
 * Task bar's size (18 on 24, task-bar.tsx), since Plus Jakarta Sans at Title Large (22 on 28) draws taller than its line
 * and Android cut the last line at font size 1.1; the bar grows to hold both, and a longer name ends in "…".
 */
export function TopBar({
  title,
  actions,
  onBack,
  titleFrom,
  v4 = false,
  lines,
}: {
  title?: string;
  actions?: ReactNode;
  onBack?: () => void;
  titleFrom?: number;
  v4?: boolean;
  lines?: number;
}) {
  const t = useT();
  const nav = useNav();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const past = useScrolledPast(titleFrom ?? 0);
  const shown = titleFrom === undefined ? null : past;
  const wraps = (lines ?? 1) > 1;
  return (
    <BarSurface v4={v4}>
      <View style={[styles.bar, { marginTop: insets.top }]}>
        <IconButton label={t("action.back")} onPress={onBack ?? nav.back} testID="action.back">
          <Icons.ArrowLeft size={24} color={theme.color.onSurface} />
        </IconButton>
        <Animated.View style={{ flex: 1, minWidth: 0, marginLeft: space[1], opacity: shown ?? 1, paddingRight: wraps ? space[2] : 0 }}>
          {/* Every screen's title in the one face for headings (v4: Plus Jakarta Sans), whatever page it's on. */}
          <Text
            size="titleLarge"
            numberOfLines={lines ?? (v4 ? 1 : undefined)}
            ellipsizeMode="tail"
            face="display"
            weight="bold"
            accessibilityRole="header"
            style={wraps ? styles.wrapped : styles.title}
          >
            {title ?? ""}
          </Text>
        </Animated.View>
        {actions && <View style={{ flexDirection: "row", alignItems: "center" }}>{actions}</View>}
      </View>
    </BarSurface>
  );
}

/**
 * A top bar's surface, edge to edge under the status bar: the page's colour at rest (v4's grey with `v4`, or the
 * colour a page sets), surfaceContainer (v4: its card colour) once the page scrolls under it (faded on the UI thread
 * from the page's offset).
 */
export function BarSurface({ children, v4 = false }: { children: ReactNode; v4?: boolean }) {
  const theme = useTheme();
  const under = useScrolledUnder();
  const page = usePageColor();
  return (
    <View style={{ backgroundColor: v4 ? theme.v4.page : (page ?? theme.color.surface) }}>
      {under && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: v4 ? theme.v4.card : theme.color.surfaceContainer, opacity: under }]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: space[1], minHeight: BAR_HEIGHT },
  title: { paddingVertical: space[1], letterSpacing: -0.2 },
  wrapped: { fontSize: 18, lineHeight: 24, paddingVertical: space[2], letterSpacing: -0.2 },
});
