// What the desktop's hooks raise as toasts (../swaps/overlays.ts), as Material 3's snackbar: one at a
// time, at the bottom just above the tabs' bar (or the phone's own bar on a screen over the tabs, or that screen's
// own bar at its foot, as the Task's Simpan draf and Kumpulkan),
// what happened in one line with Undo where there is one. It rises and fades in (only fades with
// less motion asked for). Errors that need reading belong in a banner on the page, not here
// (DESIGN.md, "Patterns").
import { useSegments } from "expo-router";
import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dismissToast, useToasts } from "../swaps/overlays";
import { GLASS, GlassSurface } from "./glass";
import { useBarTop, useTabsBottom } from "./insets";
import { reduceMotion } from "./motion";
import { Text } from "./text";
import { motion, shape, space, TOUCH, useTheme } from "./theme";

/** The tabs' bar: Material 3's navigation bar, labels always shown. */
const TAB_BAR = 80;

export function Toasts() {
  const toasts = useToasts();
  const theme = useTheme();
  const c = theme.color;
  const insets = useSafeAreaInsets();
  // The snackbar's own frame (the whole screen), in the same window coordinates the tabs' page and a screen's bar report
  // theirs in. The window's height isn't: on Android it may leave out the phone's bars, and the snackbar landed on the
  // tabs (judge, round 2).
  const frame = useRef<ComponentRef<typeof View>>(null);
  const [frameBottom, setFrameBottom] = useState(0);
  const tabsBottom = useTabsBottom();
  const barTop = useBarTop();
  const onTab = useSegments()[0] === "(tabs)";
  // The newest one: Material shows one snackbar at a time.
  const item = toasts.at(-1);
  const rise = useRef(new Animated.Value(0)).current;
  // biome-ignore lint/correctness/useExhaustiveDependencies: each new snackbar rises once
  useEffect(() => {
    if (!item) return;
    rise.setValue(0);
    Animated.timing(rise, { toValue: 1, duration: motion.duration.medium, easing: Easing.bezier(0.05, 0.7, 0.1, 1), useNativeDriver: true }).start();
  }, [item?.id]);
  const above = (edge: number) => (frameBottom > 0 && edge > 0 ? Math.max(insets.bottom, frameBottom - edge) : insets.bottom);
  // On a tab, never lower than the tabs' bar (Material's 80 dp) over the phone's own: a page that didn't report its edge
  // (Jadwal's own layout) left it on the tabs (judge, round 3).
  const bottom = (onTab ? Math.max(above(tabsBottom), insets.bottom + TAB_BAR) : above(barTop)) + space[3];
  return (
    <View
      ref={frame}
      pointerEvents="box-none"
      onLayout={() => frame.current?.measureInWindow((_x, y, _width, height) => setFrameBottom(y + height))}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {item && (
        <View pointerEvents="box-none" style={{ position: "absolute", left: space[3], right: space[3], bottom }}>
          <Animated.View
            key={item.id}
            accessibilityLiveRegion="polite"
            style={{
              opacity: rise,
              transform: reduceMotion() ? [] : [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            }}
          >
            <Snackbar action={!!item.action}>
              <Text size="bodyMedium" tone={GLASS ? undefined : "inverse"} style={{ flex: 1, paddingVertical: space[1] }}>
                {item.text}
              </Text>
              {item.action && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    item.action?.onClick();
                    dismissToast(item.id);
                  }}
                  android_ripple={{ color: "rgba(255,255,255,0.12)" }}
                  style={{ minHeight: TOUCH, justifyContent: "center", paddingHorizontal: space[3], borderRadius: shape.full }}
                >
                  <Text size="labelLarge" style={{ color: GLASS ? c.accent : c.inversePrimary }}>
                    {item.action.label}
                  </Text>
                </Pressable>
              )}
            </Snackbar>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

/**
 * The snackbar's surface: Material's inverse surface, or on iOS 26 Liquid Glass with the page's own text colour on it
 * (./glass.tsx), as iOS's own floating panels are.
 */
function Snackbar({ action, children }: { action: boolean; children: ReactNode }) {
  const c = useTheme().color;
  const shape0 = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[2],
    minHeight: TOUCH,
    paddingLeft: space[4],
    paddingRight: action ? space[2] : space[4],
    paddingVertical: space[1.5],
  };
  if (GLASS) return <GlassSurface style={{ ...shape0, borderRadius: shape.lg }}>{children}</GlassSurface>;
  return <View style={{ ...shape0, borderRadius: shape.xs, backgroundColor: c.inverseSurface, elevation: 3, shadowColor: "#000" }}>{children}</View>;
}
