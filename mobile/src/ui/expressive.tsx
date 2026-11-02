// Round 2's few living parts (v4, DESIGN.md "Motion"), all moving on the UI thread (Reanimated; react-native-svg draws):
// Material 3 Expressive's wavy progress, its cookie shape holding a check that draws itself, a pulsing "now" dot, a
// number that counts up once, and the stagger a screen's cards rise in on its first showing. With Remove animations
// they keep still or fade.
import { NavigationContext } from "expo-router/react-navigation";
import { type ReactNode, useContext, useEffect, useState } from "react";
import { type LayoutChangeEvent, type StyleProp, StyleSheet, TextInput, type TextStyle, View, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { useLoopWhileShown, useReduceMotion } from "./motion";
import { motion } from "./theme";

/** One wavelength of the wave (dp), its rise (about 4 dp either way, M3's), and the height it's drawn in. */
const WAVE = 32;
const RISE = 8;
const WAVE_HEIGHT = 14;
/** A wave long enough for any phone's card, drawn once: q (rise) t (fall) per wavelength. */
const WAVE_PATH = (() => {
  let d = `M0 ${WAVE_HEIGHT / 2}`;
  for (let i = 0; i < 40; i++) d += ` q${WAVE / 4} -${RISE} ${WAVE / 2} 0 t${WAVE / 2} 0`;
  return d;
})();

/**
 * M3 Expressive's wavy progress: the wave up to how far along (`progress`, 0–1), moving along itself; after it, the
 * flat track to the stop dot, drawn in full from the start. `ink` draws the wave and the dot, `track` the rest (give it
 * enough contrast to read as a track on its card).
 */
export function WavyProgress({ progress, ink, track, label }: { progress: number; ink: string; track: string; label: string }) {
  const run = useLoopWhileShown();
  const [width, setWidth] = useState(0);
  const shift = useSharedValue(0);
  useEffect(() => {
    if (!run) return;
    shift.value = 0;
    shift.value = withRepeat(withTiming(-WAVE, { duration: 1100, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(shift);
  }, [run, shift]);
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));
  const p = Math.max(0, Math.min(1, progress));
  // At least a wavelength and a half drawn (48 dp), so a class just started reads as a wave starting, not a squiggle.
  const done = Math.min(width - 12, Math.max(WAVE * 1.5, width * p - 2));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={{ flex: 1, height: WAVE_HEIGHT, justifyContent: "center" }}
    >
      {width > 0 && (
        <>
          <View style={{ position: "absolute", left: 0, top: 0, width: done, height: WAVE_HEIGHT, overflow: "hidden" }}>
            <Animated.View style={[{ width: done + WAVE * 2, height: WAVE_HEIGHT }, moving]}>
              <Svg width={done + WAVE * 2} height={WAVE_HEIGHT}>
                <Path d={WAVE_PATH} stroke={ink} strokeWidth={4} strokeLinecap="round" fill="none" />
              </Svg>
            </Animated.View>
          </View>
          {done + 8 < width - 6 && <View style={{ position: "absolute", left: done + 8, right: 6, height: 4, borderRadius: 2, backgroundColor: track }} />}
          <Svg style={{ position: "absolute", right: 0 }} width={4} height={4}>
            <Circle cx={2} cy={2} r={2} fill={ink} />
          </Svg>
        </>
      )}
    </View>
  );
}

/** M3's cookie shape (a circle with nine soft scallops), for a badge. */
const COOKIE = (() => {
  let d = "";
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const r = 12.4 + 1.3 * Math.cos(a * 9);
    d += `${i ? "L" : "M"}${(14 + r * Math.cos(a)).toFixed(2)} ${(14 + r * Math.sin(a)).toFixed(2)} `;
  }
  return `${d}Z`;
})();
const CHECK = "M9 14.5l3.4 3.4L19.5 10.6";
const CHECK_LENGTH = 16;
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The cookie badge with its check: it scales in turning (a spring that overshoots), then the check draws itself. */
export function CookieCheck({ color, check, size = 28 }: { color: string; check: string; size?: number }) {
  const still = useReduceMotion();
  const grow = useSharedValue(still ? 1 : 0.3);
  const seen = useSharedValue(still ? 0 : 0);
  const drawn = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    seen.value = withTiming(1, { duration: motion.duration.short });
    if (still) return;
    grow.value = withSpring(1, motion.expressive);
    drawn.value = withDelay(350, withTiming(1, { duration: 350, easing: Easing.bezier(0.2, 0, 0, 1) }));
  }, [still, grow, seen, drawn]);
  const badge = useAnimatedStyle(() => ({ opacity: seen.value, transform: [{ scale: grow.value }, { rotate: `${(1 - grow.value) * -129}deg` }] }));
  const stroke = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - drawn.value) }));
  return (
    <Animated.View style={[{ width: size, height: size }, badge]}>
      <Svg width={size} height={size} viewBox="0 0 28 28">
        <Path d={COOKIE} fill={color} />
        <AnimatedPath
          d={CHECK}
          fill="none"
          stroke={check}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_LENGTH}
          animatedProps={stroke}
        />
      </Svg>
    </Animated.View>
  );
}

/** "Now": a dot with a ring that breathes out from it every two seconds (still with Remove animations). */
export function PulseDot({ color, size = 7 }: { color: string; size?: number }) {
  const still = useReduceMotion();
  const run = useLoopWhileShown();
  const ring = useSharedValue(0);
  useEffect(() => {
    if (!run) return;
    ring.value = 0;
    ring.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(ring);
  }, [run, ring]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - ring.value), transform: [{ scale: 1 + ring.value * 1.7 }] }));
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {!still && <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color }, halo]} />}
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

const AnimatedInput = Animated.createAnimatedComponent(TextInput);
/** Numbers already counted in this run: a number counts up the first time it's shown, never on a redraw. */
const counted = new Set<string>();

/**
 * A number that counts up from zero once (700 ms, easing out), the first time `id` is shown in this run; after that,
 * and with Remove animations, it's simply there. Drawn as a read-only field the UI thread can rewrite each frame.
 * `decimals` for a figure like an IPK (2), with the language's `comma` ("3,42" in Indonesian).
 */
export function CountUp({
  id,
  value,
  style,
  decimals = 0,
  comma = false,
}: {
  id: string;
  value: number;
  style: StyleProp<TextStyle>;
  decimals?: number;
  comma?: boolean;
}) {
  const still = useReduceMotion();
  const [first] = useState(() => !still && !counted.has(id));
  const shown = useSharedValue(first ? 0 : value);
  useEffect(() => {
    counted.add(id);
    if (first) shown.value = withDelay(250, withTiming(value, { duration: 700, easing: Easing.out(Easing.cubic) }));
    else shown.value = value;
  }, [id, value, first, shown]);
  const written = (n: number) => {
    "worklet";
    const fixed = decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
    return comma ? fixed.replace(".", ",") : fixed;
  };
  const text = useAnimatedProps(() => {
    const now = written(shown.value);
    return { text: now, defaultValue: now } as never;
  });
  return (
    <AnimatedInput
      editable={false}
      underlineColorAndroid="transparent"
      accessibilityLabel={written(value)}
      defaultValue={written(first ? 0 : value)}
      animatedProps={text}
      style={[{ padding: 0, margin: 0, includeFontPadding: false }, style]}
    />
  );
}

/** Whether this screen is in front when a part mounts; true outside the route tree (a part where no screen holds focus). */
function useShownAtMount(): boolean {
  const navigation = useContext(NavigationContext);
  const [shown] = useState(() => navigation?.isFocused() ?? true);
  return shown;
}

/** Screens whose cards have risen once in this run: on a later showing (a tab switch) they're just there. */
const risen = new Set<string>();

/**
 * A screen's part rising into place on its first showing, `index` steps after the first (55 ms apart, on M3
 * Expressive's spring); just there with Remove animations, and the next time `screen` is drawn in this run. (A fade in
 * its place was now and then left at nothing on the emulator with animations off: Kuliah drawn blank.)
 */
export function Rise({ screen, index, style, children }: { screen: string; index: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const still = useReduceMotion();
  // Only on the screen in front: native tabs mount every tab at the start, hidden, before Android has said whether
  // animations are off, and an entrance started on a hidden tab with animations off never finished: its parts stayed
  // invisible (Akademik's rows, Jadwal's days, on CI's emulator and with "Remove animations"). A hidden tab's parts
  // are simply there when it's first shown.
  const shown = useShownAtMount();
  const [first] = useState(() => shown && !risen.has(screen));
  useEffect(() => {
    risen.add(screen);
  }, [screen]);
  const entering =
    !first || still
      ? undefined
      : FadeInDown.delay(80 + index * 55)
          .springify()
          .damping(16)
          .stiffness(170);
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
