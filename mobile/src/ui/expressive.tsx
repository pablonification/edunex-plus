// Round 2's few living parts (v4, DESIGN.md "Motion"), all moving on the UI thread (Reanimated; react-native-svg draws):
// a class's progress bar (plain: the wave is gone), M3's cookie shape holding a check that draws itself, a pulsing "now" dot, a
// number that counts up once, and the stagger a screen's cards rise in on its first showing. With Remove animations
// they keep still or fade.
import { NavigationContext } from "expo-router/react-navigation";
import { type ReactNode, useContext, useEffect, useState } from "react";
import { type StyleProp, StyleSheet, TextInput, type TextStyle, View, type ViewStyle } from "react-native";
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
import Svg, { Path } from "react-native-svg";
import { firstFrameShown } from "../shell/first-frame";
import { useLoopWhileShown, useReduceMotion } from "./motion";
import { motion } from "./theme";

/** The height the progress bar's row takes (the wave's old height, so the callers' rows keep theirs). */
const WAVE_HEIGHT = 14;

/**
 * A class's progress as a plain bar: `track` filled with `ink` to how far along (`progress`, 0–1). It was a moving
 * wave; the wave is gone ("reads as ornament": no wave anywhere), and the name stays until its callers move to
 * kit.tsx's `PlainBar`, which is this bar with an end label. Nothing here moves or measures.
 */
export function WavyProgress({ progress, ink, track, label }: { progress: number; ink: string; track: string; label: string }) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      style={{ flex: 1, height: WAVE_HEIGHT, justifyContent: "center" }}
    >
      <View style={{ height: 4, borderRadius: 2, backgroundColor: track, overflow: "hidden" }}>
        <View style={{ width: `${p * 100}%`, height: 4, borderRadius: 2, backgroundColor: ink }} />
      </View>
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

/**
 * "Now": a dot with a ring that breathes out from it a few times (`times`, 3 by default, two seconds each), then rests as
 * a plain dot: nothing redraws at rest (the decisions' "Beranda's budget"). Still with Remove animations.
 */
export function PulseDot({ color, size = 7, times = 3 }: { color: string; size?: number; times?: number }) {
  const run = useLoopWhileShown();
  // At rest the ring is fully out (1): nothing drawn, nothing running.
  const ring = useSharedValue(1);
  useEffect(() => {
    if (!run) return;
    ring.value = 0;
    // Each pass ends with the ring faded, so the last one leaves nothing drawn and nothing running.
    ring.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), Math.max(1, times), false);
    return () => {
      cancelAnimation(ring);
      ring.value = 1;
    };
  }, [run, ring, times]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - ring.value), transform: [{ scale: 1 + ring.value * 1.7 }] }));
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {run && <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color }, halo]} />}
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
      // A read-only field keeps the text it started with: a new format (the language arriving after a tab was drawn
      // ahead, "3.47" → "3,47") draws it again.
      key={`${decimals}:${comma}`}
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

/**
 * When each screen's cards first rose in this run (never, drawn out of sight: -Infinity): on a later showing (a tab
 * switch) they're just there.
 */
const risen = new Map<string, number>();
/** A part drawn this long after its screen's first is just there: it's a later showing, not the first one. */
const RISE_WINDOW = 1_500;

/** How long ago `screen`'s first part rose, for a part now mounting that rises with it; null when it's just there. */
function risingSince(screen: string, shown: boolean): number | null {
  const now = Date.now();
  const first = risen.get(screen);
  if (first === undefined) {
    risen.set(screen, shown ? now : Number.NEGATIVE_INFINITY);
    return shown ? 0 : null;
  }
  const since = now - first;
  return since < RISE_WINDOW ? since : null;
}

/**
 * A screen's part rising into place on its first showing, `index` steps after the first (55 ms apart, on M3
 * Expressive's spring); just there with Remove animations, and the next time `screen` is drawn in this run. (A fade in
 * its place was now and then left at nothing on the emulator with animations off: Kuliah drawn blank.) A part drawn a
 * moment after the rest (./parts.tsx: a tab's lower parts) still rises in the same stagger, its delay counted from the
 * screen's first part. A cold start's Beranda is just there as the splash goes, with nothing rising.
 */
export function Rise({ screen, index, style, children }: { screen: string; index: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const still = useReduceMotion();
  // Only on the screen in front: native tabs mount every tab at the start, hidden, before Android has said whether
  // animations are off, and an entrance started on a hidden tab with animations off never finished: its parts stayed
  // invisible (Akademik's rows, Jadwal's days, on CI's emulator and with "Remove animations"). A hidden tab's parts
  // are simply there when it's first shown.
  const shown = useShownAtMount();
  const [since] = useState(() => (firstFrameShown() ? risingSince(screen, shown) : coldStart(screen)));
  // A cold start's first frame (Beranda under the splash): its cards are just there, in plain views. An entrance's
  // Animated.View and its layout animation, one per card, were work the splash waited for, for a rise mostly behind it.
  // Chosen once, at mount: a part that turned into another kind of view would be drawn again whole.
  if (since === null) return <View style={style}>{children}</View>;
  const entering = still
    ? undefined
    : FadeInDown.delay(Math.max(0, 80 + index * 55 - since))
        .springify()
        .damping(16)
        .stiffness(170);
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

/** `screen` drawn in a cold start's first frame: its parts, now and after it, are just there, as on a later showing. */
function coldStart(screen: string): null {
  risen.set(screen, Number.NEGATIVE_INFINITY);
  return null;
}
