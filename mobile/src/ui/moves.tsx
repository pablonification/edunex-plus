// The app's shared moves (DESIGN.md, "Motion"; the audit in qa/superapp-motion.md): small parts every screen drops in so
// the whole app moves one way. Every touch answers (`Tap`); every change the Student causes is shown moving from where
// it was to where it is (`Appear`, `CrossFade`, `RollTo`, `useSlidingMark`); a list's first showing arrives once
// (`Arrive`). All of it runs on the UI thread (Reanimated), on the tokens in ./theme's `motion` only, and keeps still
// with Remove animations (`useReduceMotion`). None of it loops. Joy (an overshoot) stays in ./celebrate.tsx and
// ./expressive.tsx, for earned moments.
import { NavigationContext } from "expo-router/react-navigation";
import { type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  type AccessibilityProps,
  type Insets,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  TextInput,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  type EntryAnimationsValues,
  type ExitAnimationsValues,
  LinearTransition,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { firstFrameShown } from "../shell/first-frame";
import { useReduceMotion } from "./motion";
import { motion, useTheme } from "./theme";

/** Material's standard easing (./theme's `motion.easing.standard`), for the few moves on a duration rather than a spring. */
const STANDARD = Easing.bezier(...motion.easing.standard);
/** How far a thing that arrives or leaves travels (dp; `motion.nudge`). */
const NUDGE = motion.nudge;

// ─── Tap ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** How far each kind gives under the finger (`motion.give`). A row is the page's full width: it doesn't shrink, it tints. */
const GIVE = { card: motion.give.card, tile: motion.give.tile, row: 1, icon: motion.give.icon } as const;

/**
 * Anything the Student can tap that isn't a `Button`, `IconButton`, `Chip` or `PressScale` already: a tile, a link, a
 * header that opens a panel, a chart's point, a "show more". It answers in the frame the finger lands: Android's ripple
 * (drawn by the system, so a busy JS thread can't hold it up), an iPhone's tint (no ripple there), and for a card, a
 * tile or an icon a small give on M3's fast spring, back on the expressive one. With Remove animations: the ripple or
 * tint only. One target, one outcome: wrap the whole thing.
 *
 * Not for: a `Button` or `IconButton` (they ripple already), a swipe row's surface (`SwipeRow` owns its touch), or
 * text inside a paragraph (a link there is `Text onPress`).
 * Cost: one Animated view and one shared value; the tint is one more view on an iPhone only.
 */
export function Tap({
  onPress,
  onLongPress,
  feel = "card",
  disabled = false,
  borderless = false,
  style,
  children,
  testID,
  hitSlop,
  ...a11y
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  /** card or tile: gives a little; row: tints only; icon: gives more, its ripple round and unbounded. */
  feel?: keyof typeof GIVE;
  disabled?: boolean;
  /** A ripple that spreads past the thing (a bare icon or a word): Material's borderless ripple. */
  borderless?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  testID?: string;
  /** What a part smaller than 48 dp adds to be 48 to touch (ui/sizes). */
  hitSlop?: Insets | number;
} & AccessibilityProps) {
  const theme = useTheme();
  const still = useReduceMotion();
  const down = useSharedValue(0);
  const give = GIVE[feel];
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: 1 - (1 - give) * down.value }] }));
  const tint = useAnimatedStyle(() => ({ opacity: down.value * 0.1 }));
  const round = feel === "icon" || borderless;
  const radius = (StyleSheet.flatten(style)?.borderRadius as number | undefined) ?? 0;
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      {...a11y}
      accessibilityState={{ disabled, ...a11y.accessibilityState }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={disabled ? undefined : { color: theme.color.selected, foreground: !round, borderless: round, radius: round ? 24 : undefined }}
      onPressIn={() => {
        down.value = still || give === 1 ? withTiming(1, { duration: 0 }) : withSpring(1, motion.spatialFast);
      }}
      onPressOut={() => {
        down.value = still || give === 1 ? withTiming(0, { duration: motion.duration.short }) : withSpring(0, motion.expressive);
      }}
      style={[style, !still && give !== 1 && pressed]}
    >
      {children}
      {Platform.OS === "ios" && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: theme.color.onSurface }, tint]} />
      )}
    </AnimatedPressable>
  );
}

// ─── Appear (entering, leaving, changing size) ────────────────────────────────────────────────────────────────────

/**
 * Reanimated's layout animations, tuned to the tokens: hand them to any `Animated.View` (`entering=`, `exiting=`,
 * `layout=`), or use `Appear` below. Arrive: fades in on the effects spring while rising 8 dp on the default spatial
 * one. Leave: fades out quickly in place (the space it held closes with `resize` on what's below). Resize: a change of
 * size or place springs there (spatialDefault). With Remove animations, use none of them: `Appear` already doesn't.
 */
function arrive(_values: EntryAnimationsValues) {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ translateY: NUDGE }] },
    animations: {
      opacity: withTiming(1, { duration: motion.duration.medium, easing: STANDARD }),
      transform: [{ translateY: withSpring(0, motion.spatialDefault) }],
    },
  };
}

function leave(_values: ExitAnimationsValues) {
  "worklet";
  return {
    initialValues: { opacity: 1 },
    animations: { opacity: withTiming(0, { duration: motion.duration.short, easing: STANDARD }) },
  };
}

export const moves = {
  arrive,
  leave,
  resize: LinearTransition.springify().damping(motion.spatialDefault.damping).stiffness(motion.spatialDefault.stiffness).mass(motion.spatialDefault.mass),
};

/**
 * A thing that comes and goes with the Student's doing: a row's detail opening, a banner (offline, a problem), a
 * section after a refresh, a "done" mark. It arrives, leaves, and springs to a new height; with `shifts` on the parts
 * below it too, so they slide down rather than jump (give each of them a plain `<Appear shifts>` or `layout=
 * {moves.resize}`). Mount it with what it shows (`{open && <Appear>…</Appear>}`): it plays on mount and unmount only.
 *
 * Not for: a screen's first draw (use `Arrive`, which runs once), content that replaces content in the same place
 * (`CrossFade`), anything in a long FlashList (its recycled cells mount all the time: Reanimated's layout animations
 * and recycling don't mix).
 * Cost: one Animated view; Reanimated measures it on the UI thread when it mounts, leaves or changes size. Free at rest.
 */
export function Appear({
  children,
  shifts = false,
  style,
  testID,
}: {
  children: ReactNode;
  /** Also spring to a new place or size (it's above or around something that changes). */
  shifts?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const still = useReduceMotion();
  // Chosen at mount, with the screen in front: a layout animation started on a hidden tab with animations off never
  // finished (expressive.tsx, `Rise`), so a part mounting on a hidden screen is simply there.
  const navigation = useContext(NavigationContext);
  const [live] = useState(() => !still && (navigation?.isFocused() ?? true));
  return (
    <Animated.View
      testID={testID}
      entering={live ? moves.arrive : undefined}
      exiting={still ? undefined : moves.leave}
      layout={!still && shifts ? moves.resize : undefined}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
// ─── CrossFade ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Content that replaces content in the same place: a skeleton becoming data, one filter's list becoming another's, a
 * course tab's panel, a day's timeline after the strip is tapped. Material's "fade through": the old goes at once, the
 * new fades in (short) from 98% of its size, so the eye sees "this is new" without a slide that says "elsewhere". Keyed
 * by `id`: the same id redraws in place; a new one plays it. The first showing doesn't (that's `Arrive`'s job).
 *
 * Not for: a thing appearing where nothing was (`Appear`), a number (`RollTo`), the now card changing its whole kind
 * (that one deserves `Appear shifts` so the page under it moves with it).
 * Cost: the new content mounts once more inside an Animated view; nothing at rest.
 */
export function CrossFade({ id, children, style }: { id: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const still = useReduceMotion();
  // Once the id has changed, every later id plays too (back to the first filter fades like any other).
  const first = useRef(id);
  const moved = useRef(false);
  if (id !== first.current) moved.current = true;
  const changed = moved.current;
  return (
    <Animated.View key={id} entering={changed && !still ? fadeThrough : undefined} style={style}>
      {children}
    </Animated.View>
  );
}

function fadeThrough() {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.98 }] },
    animations: {
      opacity: withTiming(1, { duration: motion.duration.medium, easing: STANDARD }),
      transform: [{ scale: withSpring(1, motion.spatialFast) }],
    },
  };
}

// ─── RollTo ──────────────────────────────────────────────────────────────────────────────────────────────────────

const AnimatedInput = Animated.createAnimatedComponent(TextInput);
const IOS = Platform.OS === "ios";

/**
 * A number that changes while the Student watches (a count after a Task is done, IPK after a refresh, the minutes left
 * on the now card): it counts from where it was to where it is (medium, easing out) with a 3 dp nod, so the eye catches
 * that it changed and by how much. Its first value is simply there (`CountUp` in ./expressive.tsx counts up once on a
 * first showing: use one or the other, not both). TalkBack reads the new value, once. With Remove animations it
 * changes in place.
 *
 * Not for: a clock that ticks each second (a nod a second is noise), a figure inside a sentence (use Text).
 * Cost: a read-only TextInput (heavier than Text: use it for the one or two big numbers on a screen, not every row);
 * the UI thread rewrites its text each frame of a change only.
 */
export function RollTo({
  value,
  style,
  decimals = 0,
  comma = false,
  testID,
}: {
  value: number;
  style: StyleProp<TextStyle>;
  decimals?: number;
  /** The language's decimal comma ("3,42" in Indonesian). */
  comma?: boolean;
  testID?: string;
}) {
  const still = useReduceMotion();
  const shown = useSharedValue(value);
  const nod = useSharedValue(0);
  const was = useRef(value);
  useEffect(() => {
    if (was.current === value) return;
    was.current = value;
    if (still) {
      shown.value = value;
      return;
    }
    shown.value = withTiming(value, { duration: motion.duration.medium, easing: Easing.out(Easing.cubic) });
    nod.value = withSequence(withTiming(-3, { duration: motion.duration.short / 2 }), withSpring(0, motion.spatialFast));
  }, [value, still, shown, nod]);
  const written = (n: number) => {
    "worklet";
    const fixed = decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
    return comma ? fixed.replace(".", ",") : fixed;
  };
  const text = useAnimatedProps(() => {
    const now = written(shown.value);
    return { text: now, defaultValue: now } as never;
  });
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: nod.value }] }));
  // An iPhone draws it as plain text, told each new figure as the count passes it (as CountUp, ./expressive.tsx): its
  // read-only field kept the first figure's width, and a figure wider than that lost its last digit on the way.
  const [said, setSaid] = useState(() => written(value));
  useAnimatedReaction(
    () => written(shown.value),
    (now, before) => {
      if (IOS && now !== before) runOnJS(setSaid)(now);
    },
  );
  if (IOS)
    return (
      <Animated.Text testID={testID} accessibilityLabel={written(value)} style={[style, lift]}>
        {said}
      </Animated.Text>
    );
  return (
    <AnimatedInput
      key={`${decimals}:${comma}`}
      testID={testID}
      editable={false}
      underlineColorAndroid="transparent"
      accessibilityLabel={written(value)}
      accessibilityLiveRegion="polite"
      defaultValue={written(value)}
      animatedProps={text}
      style={[{ padding: 0, margin: 0, includeFontPadding: false }, style, lift]}
    />
  );
}

// ─── useSlidingMark ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The mark under a picked option (a segment, a course tab's pill, the day strip's picked day) sliding from the old one
 * to the new one on M3's fast spatial spring, instead of switching at once: the Student sees where they went. Give each
 * option `onLayout={mark.measure(key)}`, and draw `<Animated.View style={[{ position: "absolute", top, bottom,
 * borderRadius, backgroundColor }, mark.style]} />` first inside the row, under the options. Until the picked option
 * is measured the mark is hidden; the first place is simply there; with Remove animations it moves at once.
 *
 * Not for: the bottom tabs (Android's own bar), a row that scrolls its options out of view (keep the mark inside the
 * scrolled content so they move together).
 * Cost: two shared values; the width is a layout property, so Yoga lays out this one absolute view per frame of a move.
 */
export function useSlidingMark(picked: string) {
  const still = useReduceMotion();
  const places = useRef(new Map<string, { x: number; width: number }>());
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const placed = useRef(false);
  const go = useCallback(
    (key: string) => {
      const place = places.current.get(key);
      if (!place) return;
      if (!placed.current || still) {
        placed.current = true;
        x.value = place.x;
        width.value = place.width;
        return;
      }
      x.value = withSpring(place.x, motion.spatialFast);
      width.value = withSpring(place.width, motion.spatialFast);
    },
    [still, x, width],
  );
  useEffect(() => go(picked), [picked, go]);
  const measure = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      const { x: at, width: wide } = event.nativeEvent.layout;
      places.current.set(key, { x: at, width: wide });
      if (key === picked) go(key);
    },
    [picked, go],
  );
  const style = useAnimatedStyle(() => ({ left: 0, width: width.value, opacity: width.value > 0 ? 1 : 0, transform: [{ translateX: x.value }] }));
  return { measure, style };
}

// ─── Arrive ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** When each list first arrived in this run; a part that mounts this long after its list's first is simply there. */
const arrived = new Map<string, number>();
const ARRIVE_WINDOW = 900;
/** The stagger between items (ms; `motion.stagger`), and how many items take part: the rest are there with the last step. */
const STEP = motion.stagger;
const STEPS = 6;

/**
 * A list's (or a sheet's, or a search's) items arriving in a short stagger on its first showing in this run only:
 * each fades in rising 8 dp, 40 ms after the one before, the first six taking part. After that (a tab switch, a
 * redraw, a refresh) they're simply there. Never on a cold start's first frame (Beranda under the splash), never on a
 * hidden tab, never with Remove animations.
 *
 * Not for: a screen's big parts (`Rise` in ./expressive.tsx does those per screen), rows that come and go later
 * (`Appear`), FlashList cells beyond the first screenful (pass the index, items past `STEPS` don't move anyway).
 * Cost: one Animated view per item at mount and nothing after; a plain View when it doesn't play.
 */
export function Arrive({ list, index, children, style }: { list: string; index: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const still = useReduceMotion();
  const navigation = useContext(NavigationContext);
  const [delay] = useState(() => {
    if (still || !firstFrameShown() || !(navigation?.isFocused() ?? true)) {
      if (!arrived.has(list)) arrived.set(list, Number.NEGATIVE_INFINITY);
      return null;
    }
    const now = Date.now();
    const first = arrived.get(list);
    if (first === undefined) arrived.set(list, now);
    const since = first === undefined ? 0 : now - first;
    return since < ARRIVE_WINDOW ? Math.max(0, Math.min(index, STEPS) * STEP - since) : null;
  });
  if (delay === null) return <View style={style}>{children}</View>;
  const entering = (values: EntryAnimationsValues) => {
    "worklet";
    return {
      initialValues: arrive(values).initialValues,
      animations: {
        opacity: withDelay(delay, withTiming(1, { duration: motion.duration.medium, easing: STANDARD })),
        transform: [{ translateY: withDelay(delay, withSpring(0, motion.spatialDefault)) }],
      },
    };
  };
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
