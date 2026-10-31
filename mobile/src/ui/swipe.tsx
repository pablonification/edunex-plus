// A row the Student can swipe for its quick actions, Android's way (Gmail's): the row follows the finger over the
// action's colour, a tick (a haptic, the icon growing) says when letting go will do it, and past that point letting
// go commits. A row that leaves (Sudah beres) slides out and folds away, then the action runs and its snackbar offers
// Urungkan; one that opens a choice (Ingatkan nanti) springs back and opens it. One direction per action: a "done"
// (success) swipes toward the end, anything else toward the start, the same on every screen. Swiping is a shortcut,
// never the only way: every action is also in the row's long-press menu (sheet.tsx) and its TalkBack actions. All of
// it runs on the UI thread; JS hears only of the tick and the commit.
import * as Haptics from "expo-haptics";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { I18nManager, type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { GestureDetector, type PanGestureConfig, usePanGesture } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useReduceMotion } from "./motion";
import { Text } from "./text";
import { motion, type Palette, space, useTheme } from "./theme";

export interface SwipeAction {
  label: string;
  icon?: ReactNode;
  tone: "neutral" | "success" | "warning" | "danger" | "accent";
  onPress(): void;
  testID?: string;
  /**
   * Which way the finger goes: "start" toward the row's end (right on a left-to-right phone), "end" back toward its
   * start. By default a "done" (success) goes toward the end and anything else toward the start, so one swipe means
   * one thing everywhere.
   */
  side?: "start" | "end";
  /** Whether the row leaves when it commits (it's put away). False: it springs back, as for a choice that opens. */
  leaves?: boolean;
}

const TONE: Record<SwipeAction["tone"], [keyof Palette, keyof Palette]> = {
  neutral: ["neutralBg", "neutralFg"],
  success: ["successBg", "successFg"],
  warning: ["warningBg", "warningFg"],
  danger: ["dangerBg", "dangerFg"],
  accent: ["infoBg", "infoFg"],
};

/** Past this share of the row's width, letting go commits. */
const COMMIT = 0.35;
/** A flick this fast (dp/s) past a quarter of the way commits too. */
const FLICK = 900;
/** A row that left but is still there this long after (the action failed, or didn't remove it) comes back. */
const RETURN_AFTER = 1500;

const sideOf = (action: SwipeAction): "start" | "end" => action.side ?? (action.tone === "success" ? "start" : "end");

const tick = () => void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick).catch(() => undefined);
const confirm = () => void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(() => undefined);

export function SwipeRow({ actions, children, testID }: { actions: readonly SwipeAction[]; children: ReactNode; testID?: string }) {
  if (!actions.length) return <>{children}</>;
  return (
    <Swiper actions={actions} testID={testID}>
      {children}
    </Swiper>
  );
}

function Swiper({ actions, children, testID }: { actions: readonly SwipeAction[]; children: ReactNode; testID?: string }) {
  const theme = useTheme();
  const still = useReduceMotion();
  const rtl = I18nManager.isRTL;
  const toEnd = actions.find((action) => sideOf(action) === "start") ?? null;
  const toStart = actions.find((action) => sideOf(action) === "end" && action !== toEnd) ?? null;
  // +x is toward the end on a left-to-right phone.
  const plus = rtl ? toStart : toEnd;
  const minus = rtl ? toEnd : toStart;
  // The worklets get plain facts, never the actions (their icons are React elements).
  const hasPlus = plus !== null;
  const hasMinus = minus !== null;
  const plusLeaves = plus?.leaves !== false;
  const minusLeaves = minus?.leaves !== false;

  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const fold = useSharedValue(0);
  const fade = useSharedValue(1);
  const armed = useSharedValue(0);
  const back = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (back.current && clearTimeout(back.current)), []);

  // The latest actions, for the stable `run` the gesture holds: a redraw (the minute's tick) mustn't rebuild the gesture
  // and its worklets, which cost the JS thread several ms a row.
  const latest = useRef({ plus, minus });
  latest.current = { plus, minus };
  const run = useCallback(
    (which: number) => {
      const { plus, minus } = latest.current;
      const action = which > 0 ? plus : minus;
      if (!action) return;
      confirm();
      action.onPress();
      if (action.leaves === false) return;
      // Still here a moment later: the action didn't take it away, so it comes back rather than leave a gap.
      back.current = setTimeout(() => {
        fold.value = withTiming(0, { duration: motion.duration.medium });
        fade.value = withTiming(1, { duration: motion.duration.medium });
        x.value = withSpring(0, motion.spatialDefault);
      }, RETURN_AFTER);
    },
    [fold, fade, x],
  );

  const config = useMemo(
    (): PanGestureConfig => ({
      activeOffsetX: [-12, 12],
      failOffsetY: [-10, 10],
      onUpdate: (event) => {
        "worklet";
        const dx = event.translationX;
        // The side with no action resists, as Android's overscroll does.
        x.value = (dx > 0 && !hasPlus) || (dx < 0 && !hasMinus) ? dx * 0.15 : dx;
        const past = Math.abs(x.value) > width.value * COMMIT && ((x.value > 0 && hasPlus) || (x.value < 0 && hasMinus)) ? 1 : 0;
        if (past !== armed.value) {
          armed.value = past;
          scheduleOnRN(tick);
        }
      },
      onDeactivate: (event) => {
        "worklet";
        const which = x.value > 0 ? 1 : -1;
        const has = which > 0 ? hasPlus : hasMinus;
        const leaves = which > 0 ? plusLeaves : minusLeaves;
        const far = Math.abs(x.value) > width.value * COMMIT;
        const flung = Math.abs(x.value) > width.value * 0.25 && Math.sign(event.velocityX) === which && Math.abs(event.velocityX) > FLICK;
        armed.value = 0;
        if (!has || !(far || flung)) {
          x.value = withSpring(0, motion.spatialDefault);
          return;
        }
        if (!leaves) {
          // A choice opens: the row bounces home (the earned spring) as the sheet comes up.
          x.value = withSpring(0, motion.expressive);
          scheduleOnRN(run, which);
          return;
        }
        const folded = (done?: boolean) => {
          "worklet";
          if (done) scheduleOnRN(run, which);
        };
        const gone = (done?: boolean) => {
          "worklet";
          if (done !== false) fold.value = withTiming(1, { duration: motion.duration.medium }, folded);
        };
        // Remove animations: it fades where it is, then folds.
        if (still) fade.value = withTiming(0, { duration: motion.duration.short }, gone);
        else x.value = withSpring(which * width.value, { ...motion.spatialFast, overshootClamping: true }, gone);
      },
    }),
    [hasPlus, hasMinus, plusLeaves, minusLeaves, still, run, x, width, armed, fold, fade],
  );
  const pan = usePanGesture(config);

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: fade.value }));
  const box = useAnimatedStyle(() => (fold.value > 0 ? { height: interpolate(fold.value, [0, 1], [height.value, 0]), overflow: "hidden" } : {}));
  const plusLayer = useAnimatedStyle(() => ({ opacity: x.value > 0 ? fade.value : 0 }));
  const minusLayer = useAnimatedStyle(() => ({ opacity: x.value < 0 ? fade.value : 0 }));
  // The icon grows once letting go would do it: the visible half of the tick.
  const plusMark = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(armed.value && x.value > 0 ? 1.15 : 0.9, motion.expressive) }] }));
  const minusMark = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(armed.value && x.value < 0 ? 1.15 : 0.9, motion.expressive) }] }));

  const measure = (event: LayoutChangeEvent) => {
    width.value = event.nativeEvent.layout.width;
    if (fold.value === 0) height.value = event.nativeEvent.layout.height;
  };

  const layer = (action: SwipeAction, from: "left" | "right", style: object, mark: object) => {
    const [bg, fg] = TONE[action.tone];
    return (
      <Animated.View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={[
          StyleSheet.absoluteFill,
          styles.under,
          { backgroundColor: theme.color[bg], justifyContent: from === "left" ? "flex-start" : "flex-end" },
          style,
        ]}
      >
        <Animated.View style={[styles.mark, mark]}>
          {action.icon}
          <Text size="labelLarge" style={{ color: theme.color[fg] }} numberOfLines={1}>
            {action.label}
          </Text>
        </Animated.View>
      </Animated.View>
    );
  };

  return (
    <Animated.View style={box} testID={testID}>
      <View onLayout={measure}>
        {plus && layer(plus, "left", plusLayer, plusMark)}
        {minus && layer(minus, "right", minusLayer, minusMark)}
        <GestureDetector gesture={pan}>
          <Animated.View style={[{ backgroundColor: theme.color.surfaceContainerLow }, row]}>{children}</Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  under: { flexDirection: "row", alignItems: "center", paddingHorizontal: space[6] },
  mark: { flexDirection: "row", alignItems: "center", gap: space[2] },
});
