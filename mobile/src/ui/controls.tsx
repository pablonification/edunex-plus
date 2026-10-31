// Interactive controls, Material 3's (DESIGN.md, "Components"): buttons (filled, tonal, outlined,
// text), icon buttons, the switch, segmented buttons and filter chips. Every target is at least 48 dp
// whatever it looks like, every control has a name a screen reader reads, and a press answers at once
// (Android's ripple, then the work's spinner).
import { type ReactNode, useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { Spinner } from "./display";
import { Icons } from "./icons";
import { Text } from "./text";
import { shape, space, TOUCH, useTheme } from "./theme";

/**
 * primary: Filled, the screen's one main action. tonal: Filled tonal, a strong second. secondary: Outlined. ghost:
 * Text, the least. danger: Outlined in the error colour (a destructive action that's still confirmed).
 */
type Variant = "primary" | "tonal" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

/** Container heights: M3 Expressive's XS (32), S (40, the default) and M (56). Each is 48 to touch. */
const HEIGHT: Record<Size, number> = { sm: 32, md: 40, lg: 56 };

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
  const height = HEIGHT[size];
  return (
    <Pressable
      testID={testID}
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      // 48 to touch however small it looks.
      hitSlop={height < TOUCH ? { top: (TOUCH - height) / 2, bottom: (TOUCH - height) / 2 } : undefined}
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
          // Busy keeps its colours, dimmed, beside its turning spinner (the desktop's): at work, not off.
          opacity: busy ? 0.72 : 1,
        },
        style,
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
    </Pressable>
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
      android_ripple={{ color: theme.color.selected, borderless: true, radius: 20 }}
      style={[styles.icon, selected && { backgroundColor: theme.color.secondaryContainer }, disabled && { opacity: 0.38 }]}
    >
      {children}
    </Pressable>
  );
}

/**
 * Material 3's switch: an outlined track with a small thumb when off, the primary track with a big thumb when on.
 * Drawn here (React Native's Switch is the older AppCompat one), with the target of a row's control.
 */
export function Switch({
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
      hitSlop={8}
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

const SWITCH = { width: 52, height: 32 } as const;

/** Material 3's segmented buttons: a few views of one thing ("Belum selesai 6 / Selesai 5", "Minggu / Bulan"). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  testID,
}: {
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  testID?: string;
}) {
  const theme = useTheme();
  const c = theme.color;
  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { borderColor: c.outline }]}>
      {options.map((option, i) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}.${option.value}` : undefined}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.value)}
            android_ripple={{ color: c.selected }}
            style={[styles.segment, i > 0 && { borderLeftWidth: 1, borderLeftColor: c.outline }, on && { backgroundColor: c.secondaryContainer }]}
          >
            {on && <Icons.Check size={16} color={c.onSecondaryContainer} weight="bold" />}
            <Text size="labelLarge" tone={on ? "onSecondaryContainer" : "fg"} numberOfLines={1} style={{ flexShrink: 1 }}>
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
}: {
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
  testID?: string;
  label?: string;
}) {
  const theme = useTheme();
  const c = theme.color;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={{ top: 8, bottom: 8 }}
      android_ripple={{ color: c.selected }}
      style={[
        styles.chip,
        selected ? { backgroundColor: c.secondaryContainer, borderColor: c.secondaryContainer, paddingLeft: space[2] } : { borderColor: c.outline },
      ]}
    >
      {selected && <Icons.Check size={16} color={c.onSecondaryContainer} weight="bold" />}
      {typeof children === "string" ? (
        <Text size="labelLarge" tone={selected ? "onSecondaryContainer" : "muted"}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2], borderRadius: shape.full, overflow: "hidden" },
  icon: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: "center", justifyContent: "center" },
  segmented: { flexDirection: "row", borderRadius: shape.full, borderWidth: 1, overflow: "hidden" },
  segment: { flex: 1, minHeight: 40, flexDirection: "row", gap: space[2], alignItems: "center", justifyContent: "center", paddingHorizontal: space[3] },
  chip: {
    height: 32,
    paddingHorizontal: space[4],
    borderRadius: shape.sm,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    overflow: "hidden",
  },
});
