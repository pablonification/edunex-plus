// What the desktop's hooks raise as toasts (../swaps/overlays.ts), as Material 3's snackbar: one at a
// time, at the bottom just above the tabs' bar (or the phone's own bar on a screen over the tabs),
// what happened in a line or two with Undo where there is one. It rises and fades in (only fades with
// less motion asked for). Errors that need reading belong in a banner on the page, not here
// (DESIGN.md, "Patterns").
import { useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dismissToast, useToasts } from "../swaps/overlays";
import { useTabsBottom } from "./insets";
import { reduceMotion } from "./motion";
import { Text } from "./text";
import { motion, shape, space, TOUCH, useTheme } from "./theme";

export function Toasts() {
  const toasts = useToasts();
  const theme = useTheme();
  const c = theme.color;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const tabsBottom = useTabsBottom();
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
  if (!item) return null;
  const bottom = (onTab && tabsBottom > 0 ? height - tabsBottom : insets.bottom) + space[3];
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: space[3], right: space[3], bottom }}>
      <Animated.View
        key={item.id}
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[2],
          minHeight: TOUCH,
          borderRadius: shape.xs,
          paddingLeft: space[4],
          paddingRight: item.action ? space[2] : space[4],
          paddingVertical: space[1.5],
          backgroundColor: c.inverseSurface,
          elevation: 3,
          shadowColor: "#000",
          opacity: rise,
          transform: reduceMotion() ? [] : [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        }}
      >
        <Text size="bodyMedium" tone="inverse" numberOfLines={2} style={{ flex: 1, paddingVertical: space[1] }}>
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
            <Text size="labelLarge" style={{ color: c.inversePrimary }}>
              {item.action.label}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}
