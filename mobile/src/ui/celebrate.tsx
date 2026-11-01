// The few earned moments (DESIGN.md, "Motion"): something done that matters, answered with a check
// that draws itself in a green circle and the phone's own "success" haptic. Drawn on the UI thread
// (Reanimated); with Remove animations it only fades in, the check already drawn.
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useReduceMotion } from "./motion";
import { Text } from "./text";
import { motion, shape, space, useTheme } from "./theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The check in a 24 box, and a little more than its length, so it starts fully hidden. */
const CHECK = "M6.5 12.5l3.5 3.5 7.5-7.5";
const LENGTH = 17;

/** A green circle that springs in, then its check drawing itself; the success haptic as it starts. */
export function DrawnCheck({ size = 72 }: { size?: number }) {
  const theme = useTheme();
  const still = useReduceMotion();
  const scale = useSharedValue(still ? 1 : 0.5);
  const opacity = useSharedValue(0);
  const drawn = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    opacity.value = withTiming(1, { duration: motion.duration.short });
    if (still) return;
    scale.value = withSpring(1, motion.expressive);
    drawn.value = withDelay(140, withTiming(1, { duration: 380, easing: Easing.bezier(0.2, 0, 0, 1) }));
    // Once, as the moment starts: the values are the animation's own.
  }, [still, scale, opacity, drawn]);
  const circle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const stroke = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - drawn.value) }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.color.successBg, alignItems: "center", justifyContent: "center" },
        circle,
      ]}
    >
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
        <AnimatedPath
          d={CHECK}
          fill="none"
          stroke={theme.color.successFg}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[LENGTH, LENGTH]}
          animatedProps={stroke}
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * The moment itself, over the screen for a breath: the drawn check, what happened (`title`) and its one detail, said
 * to a screen reader too. It lets touches through and fades away by itself; `onDone` once it's gone.
 */
export function Celebration({ title, detail, onDone }: { title: string; detail?: string; onDone?: () => void }) {
  const theme = useTheme();
  const still = useReduceMotion();
  const shown = useSharedValue(0);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(detail ? `${title}. ${detail}` : title);
    shown.value = withTiming(1, { duration: motion.duration.short });
    const out = setTimeout(() => {
      shown.value = withTiming(0, { duration: motion.duration.medium });
    }, 1700);
    const done = setTimeout(
      () => {
        setGone(true);
        onDone?.();
      },
      1700 + motion.duration.medium + 50,
    );
    return () => {
      clearTimeout(out);
      clearTimeout(done);
    };
    // Once per moment: a new moment is a new element (its key).
  }, [shown, title, detail, onDone]);
  const card = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: still ? 0 : (1 - shown.value) * 12 }] }));
  if (gone) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", padding: space[6] }]}>
      <Animated.View
        testID="moment.done"
        style={[
          {
            alignItems: "center",
            gap: space[3],
            paddingHorizontal: space[8],
            paddingVertical: space[6],
            borderRadius: shape.xl,
            backgroundColor: theme.color.surfaceContainerHigh,
            // Floats over the page: the one place a shadow belongs (DESIGN.md).
            elevation: 6,
            maxWidth: 320,
          },
          card,
        ]}
      >
        <DrawnCheck />
        <Text size="titleLarge" style={{ textAlign: "center" }}>
          {title}
        </Text>
        {detail ? (
          <Text size="bodyMedium" tone="muted" style={{ textAlign: "center" }}>
            {detail}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}
