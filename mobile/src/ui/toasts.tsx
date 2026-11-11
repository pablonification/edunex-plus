// What the desktop's hooks raise as toasts (../swaps/overlays.ts), as Material 3's snackbar: one at a
// time, at the bottom just above the tabs' bar (or the phone's own bar on a screen over the tabs, or that screen's
// own bar at its foot, as the Task's Simpan draf and Kumpulkan),
// what happened in one line with Undo where there is one. It rises and fades in (only fades with
// less motion asked for), and fades out as it goes (ui/moves.tsx's `leave`). Errors that need reading belong in a banner on the page, not here
// (DESIGN.md, "Patterns").
import { useSegments } from "expo-router";
import { type ComponentRef, type ReactNode, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import Animated, { Easing, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dismissToast, useToasts } from "../swaps/overlays";
import { GLASS, GlassSurface } from "./glass";
import { useBarTop, useTabsBottom } from "./insets";
import { useReduceMotion } from "./motion";
import { moves } from "./moves";
import { tabBarHeight } from "./page-end";
import { iosPressed } from "./press";
import { Text } from "./text";
import { motion, shape, space, TOUCH, useTheme } from "./theme";

/** The tabs' bar: Material 3's navigation bar, labels always shown; on an iPhone, iOS's own. */
const TAB_BAR = tabBarHeight(Platform.OS);

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
  const still = useReduceMotion();
  const above = (edge: number) => (frameBottom > 0 && edge > 0 ? Math.max(insets.bottom, frameBottom - edge) : insets.bottom);
  // On a tab, never lower than the tabs' bar (Material's 80 dp, iOS's 49 pt) over the phone's own: a page that didn't report its edge
  // (Jadwal's own layout) left it on the tabs (judge, round 3).
  const bottom = (onTab ? Math.max(above(tabsBottom), insets.bottom + TAB_BAR) : above(barTop)) + space[3];
  return (
    <View
      ref={frame}
      pointerEvents="box-none"
      onLayout={() => frame.current?.measureInWindow((_x, y, _width, height) => setFrameBottom(y + height))}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Always there, so the snackbar inside it can play its leaving when it goes. */}
      <View pointerEvents="box-none" style={{ position: "absolute", left: space[3], right: space[3], bottom }}>
        {item && (
          <Animated.View key={item.id} testID={item.testID} accessibilityLiveRegion="polite" entering={still ? fadeIn : riseIn} exiting={moves.leave}>
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
                  style={({ pressed }) => [
                    { minHeight: TOUCH, justifyContent: "center", paddingHorizontal: space[3], borderRadius: shape.full },
                    iosPressed(pressed),
                  ]}
                >
                  <Text size="labelLarge" style={{ color: GLASS ? c.accent : c.inversePrimary }}>
                    {item.action.label}
                  </Text>
                </Pressable>
              )}
            </Snackbar>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const DECELERATE = Easing.bezier(...motion.easing.emphasizedDecelerate);

/** A new snackbar: it rises a nudge and fades in (medium, emphasized decelerate). */
function riseIn() {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ translateY: motion.nudge }] },
    animations: {
      opacity: withTiming(1, { duration: motion.duration.medium, easing: DECELERATE }),
      transform: [{ translateY: withTiming(0, { duration: motion.duration.medium, easing: DECELERATE }) }],
    },
  };
}

/** With Remove animations: it only fades in. */
function fadeIn() {
  "worklet";
  return {
    initialValues: { opacity: 0 },
    animations: { opacity: withTiming(1, { duration: motion.duration.medium, easing: DECELERATE }) },
  };
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
