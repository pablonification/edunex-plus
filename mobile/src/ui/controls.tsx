// Interactive controls, the phone's versions of src/app/ui/controls.tsx: buttons, icon buttons, the
// switch, the segmented control and filter chips. Every target is at least 44 pt, every control has
// a name a screen reader reads, and a press answers at once (ripple, then the work's spinner).
import { type ReactNode, useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { Spinner } from "./display";
import { Text } from "./text";
import { radius, space, useTheme } from "./theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const HEIGHT: Record<Size, number> = { sm: 36, md: 44, lg: 50 };

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
  const look: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: disabled ? { bg: c.edge, fg: c.faint } : { bg: c.accent, fg: c.onAccent },
    secondary: { bg: c.surface, fg: c.fg, border: c.edge },
    ghost: { bg: "transparent", fg: c.muted },
    danger: { bg: c.surface, fg: c.dangerFg, border: c.edge },
  };
  const { bg, fg, border } = look[variant];
  const off = disabled || busy;
  return (
    <Pressable
      testID={testID}
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      android_ripple={{ color: variant === "primary" ? "rgba(255,255,255,0.25)" : c.selected, foreground: true }}
      style={({ pressed }) => [
        styles.button,
        {
          height: HEIGHT[size],
          paddingHorizontal: size === "sm" ? space[3] : space[4],
          backgroundColor: bg,
          borderColor: border ?? "transparent",
          borderWidth: border ? StyleSheet.hairlineWidth * 2 : 0,
          // Busy keeps its colours, dimmed, beside its turning spinner (the desktop's): at work, not off.
          opacity: disabled && variant !== "primary" ? 0.5 : busy ? 0.7 : 1,
          transform: [{ scale: pressed && !off ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {busy ? <Spinner size={16} color={fg} /> : icon}
      {children !== undefined &&
        (typeof children === "string" ? (
          <Text size={size === "lg" ? "body" : "small"} weight="semibold" style={{ color: fg }} numberOfLines={1}>
            {children}
          </Text>
        ) : (
          children
        ))}
    </Pressable>
  );
}

/** A button that's only an icon: its name is required, and its target is 44 pt however small the glyph. */
export function IconButton({
  label,
  onPress,
  children,
  testID,
  selected = false,
}: {
  label: string;
  onPress?: () => void;
  children: ReactNode;
  testID?: string;
  selected?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      android_ripple={{ color: theme.color.selected, borderless: true, radius: 22 }}
      style={[styles.icon, selected && { backgroundColor: theme.color.selected }]}
    >
      {children}
    </Pressable>
  );
}

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
  const at = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(at, { toValue: value ? 1 : 0, duration: 150, useNativeDriver: false }).start();
  }, [at, value]);
  // The desktop's switch: calm when on (ink, not accent), so a list of ten doesn't shout; off, the field edge (3:1 on
  // every surface). A little bigger than the desktop's for a thumb, with the touch area of a row's control.
  const track = at.interpolate({ inputRange: [0, 1], outputRange: [theme.color.fieldEdge, theme.color.fg] });
  const knob = at.interpolate({ inputRange: [0, 1], outputRange: ["#ffffff", theme.color.surface] });
  const x = at.interpolate({ inputRange: [0, 1], outputRange: [2, SWITCH.width - SWITCH.knob - 2] });
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      hitSlop={12}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View style={{ width: SWITCH.width, height: SWITCH.height, borderRadius: SWITCH.height / 2, backgroundColor: track, justifyContent: "center" }}>
        <Animated.View
          style={{
            width: SWITCH.knob,
            height: SWITCH.knob,
            borderRadius: SWITCH.knob / 2,
            backgroundColor: knob,
            transform: [{ translateX: x }],
            elevation: 1,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

const SWITCH = { width: 40, height: 24, knob: 20 } as const;

/** A choice of a few views of one thing ("Belum selesai 6 / Selesai 5", "Minggu / Bulan"). */
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
  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: theme.color.fill }]}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}.${option.value}` : undefined}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, on && { backgroundColor: theme.color.segment, elevation: theme.scheme === "dark" ? 0 : 1 }]}
          >
            <Text size="small" weight={on ? "semibold" : "medium"} tone={on ? "fg" : "muted"} numberOfLines={1}>
              {option.label}
              {option.count !== undefined && (
                <Text size="small" weight="medium" tone={on ? "muted" : "faint"} tabular>
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
      contentContainerStyle={{ gap: space[2], paddingHorizontal: space.page }}
      style={{ marginHorizontal: -space.page }}
    >
      {children}
    </ScrollView>
  );
}

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
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      // 36 dp to see, 48 to touch.
      hitSlop={{ top: 6, bottom: 6 }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: theme.color.fill, borderColor: theme.color.fill }
          : { backgroundColor: theme.color.surface, borderColor: theme.color.edge },
      ]}
    >
      {typeof children === "string" ? (
        <Text size="small" weight="medium" tone={selected ? "fg" : "muted"}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2], borderRadius: radius.lg, overflow: "hidden" },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  segmented: { flexDirection: "row", borderRadius: radius.lg, padding: 3, gap: 2 },
  segment: { flex: 1, minHeight: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: space[3] },
  chip: {
    height: 36,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
