// Interactive controls, Material 3's (DESIGN.md, "Components"): buttons (filled, tonal, outlined,
// text), icon buttons, the switch, segmented buttons and filter chips. Every target is at least 48 dp
// whatever it looks like, every control has a name a screen reader reads, and a press answers at once
// (Android's ripple, then the work's spinner).
import { requireNativeView, requireOptionalNativeModule } from "expo";
import { type ComponentType, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Switch as SystemSwitch, View, type ViewStyle } from "react-native";
import Reanimated, { interpolateColor, type SharedValue, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Spinner } from "./display";
import { Icons } from "./icons";
import { useReduceMotion } from "./motion";
import { useSlidingMark } from "./moves";
import { BUSY_OPACITY } from "./palette";
import { iosPressed } from "./press";
import { segmentLines } from "./segment-lines";
import { BUTTON_HEIGHT, CHIP_HEIGHT, SEGMENT_HEIGHT, SWITCH, SWITCH_SLOP, slopY } from "./sizes";
import { Text } from "./text";
import { motion, shape, space, TOUCH, useTheme } from "./theme";

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);
const ios = Platform.OS === "ios";

/**
 * A press held as a shared value (0 up, 1 down), for a control whose style also moves: an iPhone's dim (./press's
 * `iosPressed`, as a value), and a filled button's give. Down on the fast spatial spring (as ./moves.tsx's `Tap`), back
 * on the effects one; with Remove animations a dim only, at once. Free at rest.
 */
function usePressed() {
  const still = useReduceMotion();
  const down = useSharedValue(0);
  return {
    down,
    onPressIn: () => {
      down.value = still ? withTiming(1, { duration: 0 }) : withSpring(1, motion.spatialFast);
    },
    onPressOut: () => {
      down.value = withSpring(0, motion.effectsFast);
    },
  };
}

/** An iPhone's dim while pressed (Android keeps its ripple), in a worklet. */
function dimmed(down: SharedValue<number>): number {
  "worklet";
  return ios ? 1 - 0.45 * down.value : 1;
}

/**
 * primary: Filled, the screen's one main action. tonal: Filled tonal, a strong second. secondary: Outlined. ghost:
 * Text, the least. danger: Outlined in the error colour (a destructive action that's still confirmed).
 */
type Variant = "primary" | "tonal" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export function Button({
  variant = "secondary",
  size = "md",
  busy = false,
  disabled = false,
  icon,
  onPress,
  label,
  testID,
  style,
  children,
}: {
  variant?: Variant;
  size?: Size;
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onPress?: () => void;
  /** The accessible name when the text alone isn't clear. */
  label?: string;
  testID?: string;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const c = theme.color;
  const look: Record<Variant, { bg: string; fg: string; border?: string; ripple: string }> = {
    primary: { bg: c.primary, fg: c.onPrimary, ripple: "rgba(255,255,255,0.24)" },
    tonal: { bg: c.secondaryContainer, fg: c.onSecondaryContainer, ripple: c.selected },
    secondary: { bg: "transparent", fg: c.primary, border: c.outline, ripple: c.selected },
    ghost: { bg: "transparent", fg: c.primary, ripple: c.selected },
    danger: { bg: "transparent", fg: c.error, border: c.outline, ripple: c.selected },
  };
  const off = disabled || busy;
  // Disabled, as Material draws it: the label at 38% and a filled container at 12% of the text colour.
  const { bg, fg, border, ripple } = disabled
    ? {
        bg: variant === "primary" || variant === "tonal" ? `${c.onSurface}1f` : "transparent",
        fg: `${c.onSurface}61`,
        border: look[variant].border ? `${c.onSurface}1f` : undefined,
        ripple: "transparent",
      }
    : look[variant];
  const height = BUTTON_HEIGHT[size];
  const still = useReduceMotion();
  const press = usePressed();
  // A filled or tonal button gives a little under the finger (`motion.give.button`); the others only ripple or dim.
  const give = !off && !still && (variant === "primary" || variant === "tonal") ? 1 - motion.give.button : 0;
  const busyOpacity = busy ? BUSY_OPACITY : 1;
  const pressed = useAnimatedStyle(() => ({
    opacity: busyOpacity * dimmed(press.down),
    transform: [{ scale: 1 - give * press.down.value }],
  }));
  return (
    <AnimatedPressable
      testID={testID}
      onPress={off ? undefined : onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      // 48 to touch however small it looks.
      hitSlop={slopY(height)}
      android_ripple={{ color: ripple, foreground: true }}
      style={[
        styles.button,
        {
          height,
          paddingHorizontal: size === "sm" ? space[3] : size === "lg" ? space[6] : space[4],
          paddingLeft: icon || busy ? (size === "sm" ? space[2] + 2 : space[4]) : undefined,
          backgroundColor: bg,
          borderColor: border ?? "transparent",
          borderWidth: border ? 1 : 0,
        },
        style,
        // Busy keeps its colours beside its turning spinner: at work, not off (BUSY_OPACITY, checked for contrast).
        pressed,
      ]}
    >
      {busy ? <Spinner size={size === "lg" ? 20 : 16} color={fg} /> : icon}
      {children !== undefined &&
        (typeof children === "string" ? (
          <Text size={size === "lg" ? "titleMedium" : "labelLarge"} style={{ color: fg }} numberOfLines={1}>
            {children}
          </Text>
        ) : (
          children
        ))}
    </AnimatedPressable>
  );
}

/**
 * A button that's only an icon (M3's standard icon button): its name is required, its target 48 dp. `selected` for
 * a toggle (a tonal circle behind it).
 */
export function IconButton({
  label,
  onPress,
  onLongPress,
  children,
  testID,
  selected = false,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
  children: ReactNode;
  testID?: string;
  selected?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, ...(selected ? { selected } : {}) }}
      android_ripple={{ color: theme.color.selected, borderless: true, radius: TOUCH / 2 }}
      style={({ pressed }) => [
        [styles.icon, selected && { backgroundColor: theme.color.secondaryContainer }, disabled && { opacity: 0.38 }],
        iosPressed(pressed),
      ]}
    >
      {children}
    </Pressable>
  );
}

interface NativeSwitchProps {
  value: boolean;
  enabled: boolean;
  label: string;
  colors: Record<"trackOn" | "trackOff" | "thumbOn" | "thumbOff" | "outline" | "icon", string>;
  sync: number;
  onValueChange: (event: { nativeEvent: { value: boolean } }) => void;
  testID?: string;
  /** The testID again, on the switch itself: the box around it is hidden from accessibility, and UI tests look there. */
  testId?: string;
  style?: ViewStyle;
  importantForAccessibility?: "no";
}

/** Android's own MaterialSwitch (modules/material-switch); missing on a build without it (tests): the drawn one stands in. */
const NativeSwitch: ComponentType<NativeSwitchProps> | null = requireOptionalNativeModule("MaterialSwitch")
  ? requireNativeView<NativeSwitchProps>("MaterialSwitch")
  : null;

/**
 * Material 3's switch: an outlined track with a small thumb when off, the primary track with a big thumb and its check
 * when on. Android's own (MaterialSwitch, W9): its animation, ripple and TalkBack's "switch, on" are the system's. A tap
 * moves it at once and asks `onChange`; a value the screen didn't take (an error) puts it back.
 */
export function Switch(props: { value: boolean; onChange: (value: boolean) => void; label: string; testID?: string; disabled?: boolean }) {
  if (Platform.OS === "ios") return <IosSwitch {...props} />;
  return NativeSwitch ? <MaterialSwitch {...props} Native={NativeSwitch} /> : <DrawnSwitch {...props} />;
}

/** iOS's own switch (UISwitch, React Native's Switch): MaterialSwitch is Android's only. */
function IosSwitch({
  value,
  onChange,
  label,
  testID,
  disabled,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  testID?: string;
  disabled?: boolean;
}) {
  const c = useTheme().color;
  return (
    <SystemSwitch
      testID={testID}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      accessibilityLabel={label}
      trackColor={{ true: c.primary, false: c.surfaceContainerHighest }}
    />
  );
}

function MaterialSwitch({
  value,
  onChange,
  label,
  testID,
  disabled,
  Native,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  testID?: string;
  disabled?: boolean;
  Native: ComponentType<NativeSwitchProps>;
}) {
  const c = useTheme().color;
  const colors = useMemo(
    () => ({
      trackOn: c.primary,
      trackOff: c.surfaceContainerHighest,
      thumbOn: c.onPrimary,
      thumbOff: c.outline,
      outline: c.outline,
      icon: c.onPrimaryContainer,
    }),
    [c],
  );
  // Bumped when a tap wasn't taken: the native switch goes back to `value`.
  const [sync, setSync] = useState(0);
  const latest = useRef(value);
  latest.current = value;
  const waiting = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (waiting.current && clearTimeout(waiting.current)), []);
  return (
    <Native
      testID={testID}
      testId={testID}
      value={value}
      enabled={!disabled}
      label={label}
      colors={colors}
      sync={sync}
      onValueChange={({ nativeEvent }) => {
        const was = latest.current;
        onChange(nativeEvent.value);
        // Settings are saved through the engine: give it a moment, then put the switch back if nothing changed.
        if (waiting.current) clearTimeout(waiting.current);
        waiting.current = setTimeout(() => {
          if (latest.current === was) setSync((n) => n + 1);
        }, 1500);
      }}
      style={{ width: SWITCH.width, height: TOUCH, opacity: disabled ? 0.38 : 1 }}
    />
  );
}

/** The switch drawn in JS, where the native one isn't built in. */
function DrawnSwitch({
  value,
  onChange,
  label,
  testID,
  disabled,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  testID?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const c = theme.color;
  const at = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(at, { toValue: value ? 1 : 0, useNativeDriver: false, stiffness: 1400, damping: 67, mass: 1 }).start();
  }, [at, value]);
  const track = at.interpolate({ inputRange: [0, 1], outputRange: [c.surfaceContainerHighest, c.primary] });
  const edge = at.interpolate({ inputRange: [0, 1], outputRange: [c.outline, c.primary] });
  const knobColor = at.interpolate({ inputRange: [0, 1], outputRange: [c.outline, c.onPrimary] });
  const knob = at.interpolate({ inputRange: [0, 1], outputRange: [16, 24] });
  const x = at.interpolate({ inputRange: [0, 1], outputRange: [8, SWITCH.width - 24 - 4 - 2] });
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      hitSlop={SWITCH_SLOP}
      style={{ opacity: disabled ? 0.38 : 1 }}
    >
      <Animated.View
        style={{
          width: SWITCH.width,
          height: SWITCH.height,
          borderRadius: SWITCH.height / 2,
          backgroundColor: track,
          borderColor: edge,
          borderWidth: 2,
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            left: x,
            width: knob,
            height: knob,
            borderRadius: 12,
            backgroundColor: knobColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {value && <Icons.Check size={14} color={c.primary} weight="bold" />}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/** Material 3's segmented buttons: a few views of one thing ("Belum selesai 6 / Selesai 5", "Minggu / Bulan"). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  testID,
  check = true,
}: {
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  testID?: string;
  /** The check beside the picked one; false where its fill says it alone (Tugas: the fill and a tick said it twice). */
  check?: boolean;
}) {
  const theme = useTheme();
  const c = theme.color;
  // The picked fill: on the picked segment itself until the Student picks another, then a mark sliding from the old to
  // the new (./moves.tsx's `useSlidingMark`), so the first frame draws as before and only a pick moves.
  const mark = useSlidingMark(value);
  const first = useRef(value);
  const moved = useRef(false);
  if (value !== first.current) moved.current = true;
  const sliding = moved.current;
  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { borderColor: c.outline }]}>
      {sliding && <Reanimated.View pointerEvents="none" style={[styles.mark, { backgroundColor: c.picked }, mark.style]} />}
      {options.map((option, i) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onLayout={mark.measure(option.value)}
            testID={testID ? `${testID}.${option.value}` : undefined}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.value)}
            // 40 to see, 48 to touch.
            hitSlop={slopY(SEGMENT_HEIGHT)}
            android_ripple={{ color: c.selected }}
            style={({ pressed }) => [
              [styles.segment, i > 0 && { borderLeftWidth: 1, borderLeftColor: c.outline }, on && !sliding && { backgroundColor: c.picked }],
              iosPressed(pressed),
            ]}
          >
            {on && check && <Icons.Check size={16} color={c.onSecondaryContainer} weight="bold" />}
            {/* One word (a number: "3,50") never breaks: one line, a little smaller if the tick left it short. */}
            <Text
              size="labelLarge"
              tone={on ? "onSecondaryContainer" : "fg"}
              numberOfLines={segmentLines(option.label)}
              adjustsFontSizeToFit={segmentLines(option.label) === 1}
              minimumFontScale={0.8}
              style={{ flexShrink: 1, textAlign: "center" }}
            >
              {option.label}
              {option.count !== undefined && (
                <Text size="labelLarge" tone={on ? "onSecondaryContainer" : "muted"} tabular>
                  {` ${option.count}`}
                </Text>
              )}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Filter chips that scroll sideways ("Semua · DK4073 · II4091"): one picked at a time. */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space[2], paddingHorizontal: space.page, paddingVertical: space[2] }}
      style={{ marginHorizontal: -space.page, marginVertical: -space[2] }}
    >
      {children}
    </ScrollView>
  );
}

/** Material 3's filter chip: 32 dp to see (48 to touch), outlined; picked, the tonal fill and a check. */
export function Chip({
  selected,
  onPress,
  children,
  testID,
  label,
  check = true,
}: {
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
  testID?: string;
  label?: string;
  /** The check on the picked chip; false where its fill says it alone. */
  check?: boolean;
}) {
  const theme = useTheme();
  const c = theme.color;
  const still = useReduceMotion();
  const press = usePressed();
  // The picked fill fades in and out on the effects spring (never overshooting); at once with Remove animations.
  const picked = useSharedValue(selected ? 1 : 0);
  const was = useRef(selected);
  useEffect(() => {
    if (was.current === selected) return;
    was.current = selected;
    picked.value = still ? (selected ? 1 : 0) : withSpring(selected ? 1 : 0, motion.effectsFast);
  }, [selected, still, picked]);
  const { secondaryContainer, outline } = c;
  const fill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(picked.value, [0, 1], [`${secondaryContainer}00`, secondaryContainer]),
    borderColor: interpolateColor(picked.value, [0, 1], [outline, secondaryContainer]),
    opacity: dimmed(press.down),
  }));
  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={slopY(CHIP_HEIGHT)}
      android_ripple={{ color: c.selected }}
      style={[styles.chip, selected && { paddingLeft: check ? space[2] : space[4] }, fill]}
    >
      {selected && check && <Icons.Check size={16} color={c.onSecondaryContainer} weight="bold" />}
      {typeof children === "string" ? (
        // Never cut short: a chip row scrolls, so a chip keeps its whole name.
        <Text size="labelLarge" tone={selected ? "onSecondaryContainer" : "muted"} style={{ flexShrink: 0 }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2], borderRadius: shape.full, overflow: "hidden" },
  icon: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: "center", justifyContent: "center" },
  segmented: { flexDirection: "row", borderRadius: shape.full, borderWidth: 1, overflow: "hidden" },
  mark: { position: "absolute", top: 0, bottom: 0 },
  segment: {
    flex: 1,
    minHeight: SEGMENT_HEIGHT,
    flexDirection: "row",
    // The tick's gap and the sides are tight so a picked segment's label keeps its room ("✓ 3,50" in a third of the
    // row); the label is centred, so a segment with room to spare looks as before.
    gap: space[1.5],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  chip: {
    height: CHIP_HEIGHT,
    paddingHorizontal: space[4],
    borderRadius: shape.sm,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    overflow: "hidden",
  },
});
