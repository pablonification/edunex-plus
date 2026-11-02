// Round 2's one big button (v4): 52 dp, a pill, full width under a card or at a sheet's end. "filled" is the screen's
// one main action (the brand's blue, #a9c4ff on dark with dark text); "done" its tonal green once done; "outline" a
// second way. It gives on a press and springs back (./press.tsx). `busy`: the work it started is on its way (a spinner in
// place of its icon); `disabled`: it can't be used yet, a grey pill whose label still reads (4.5:1, never faded out).
import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { PressScale } from "./press";
import { Text } from "./text";
import { space, useTheme } from "./theme";

export function BigButton({
  variant = "filled",
  icon,
  onPress,
  label,
  hint,
  testID,
  disabled = false,
  busy = false,
  flex,
  children,
}: {
  variant?: "filled" | "done" | "outline";
  icon?: ReactNode;
  onPress?: () => void;
  /** What a screen reader says, when the words alone don't say it all. */
  label?: string;
  /** What a screen reader adds after the name: why it can't be pressed yet. */
  hint?: string;
  testID?: string;
  disabled?: boolean;
  busy?: boolean;
  /** Its share of a row of buttons. */
  flex?: number;
  children: ReactNode;
}) {
  const v = useTheme().v4;
  const background = disabled ? (variant === "outline" ? "transparent" : v.page) : variant === "filled" ? v.brand : variant === "done" ? v.okBg : "transparent";
  const color = disabled ? v.muted : variant === "filled" ? v.onBrand : variant === "done" ? v.okFg : v.fg;
  return (
    <PressScale
      onPress={onPress}
      disabled={!onPress || disabled || busy}
      testID={testID}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !onPress || disabled, busy }}
      style={{
        flex,
        minHeight: 52,
        borderRadius: 26,
        backgroundColor: background,
        borderWidth: variant === "outline" ? 1 : 0,
        borderColor: v.line,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space[2],
        paddingHorizontal: space[4],
        paddingVertical: space[2],
      }}
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : icon ? <View>{icon}</View> : null}
      <Text size="bodyLarge" weight="semibold" style={{ color, textAlign: "center", flexShrink: 1 }}>
        {children}
      </Text>
    </PressScale>
  );
}
