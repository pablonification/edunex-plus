// Round 2's press (v4, DESIGN.md "Motion"): what's pressed gives a little (to 96.5%, quickly) and comes back on M3
// Expressive's spring, on the UI thread; Android's ripple is left to plain rows and buttons. With Remove animations it
// doesn't move. One target, one outcome: wrap the whole card or row.
import type { ReactNode } from "react";
import { type AccessibilityProps, Pressable, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useReduceMotion } from "./motion";
import { motion } from "./theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressScale({
  onPress,
  onLongPress,
  disabled = false,
  style,
  children,
  testID,
  ...a11y
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  testID?: string;
} & AccessibilityProps) {
  const still = useReduceMotion();
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      {...a11y}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        if (!still) scale.value = withTiming(0.965, { duration: 120 });
      }}
      onPressOut={() => {
        if (!still) scale.value = withSpring(1, motion.expressive);
      }}
      style={[style, pressed]}
    >
      {children}
    </AnimatedPressable>
  );
}
