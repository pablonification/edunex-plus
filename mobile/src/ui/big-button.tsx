// Round 2's one big button (v4): 52 dp, a pill, full width under a card or at a sheet's end. "filled" is the screen's
// one main action (the brand's blue, #a9c4ff on dark with dark text); "done" its tonal green once done; "outline" a
// second way. It gives on a press and springs back (./press.tsx). `busy`: the work it started is on its way (a spinner in
// place of its icon); `disabled`: it can't be used yet, drawn at M3's 38%.
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
  testID?: string;
  disabled?: boolean;
  busy?: boolean;
  /** Its share of a row of buttons. */
  flex?: number;
  children: ReactNode;
}) {
  const v = useTheme().v4;
  const background = variant === "filled" ? v.brand : variant === "done" ? v.okBg : "transparent";
  const color = variant === "filled" ? v.onBrand : variant === "done" ? v.okFg : v.fg;
  return (
    <PressScale
      onPress={onPress}
      disabled={!onPress || disabled || busy}
      testID={testID}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !onPress || disabled, busy }}
      style={{
        flex,
        opacity: disabled ? 0.38 : 1,
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
