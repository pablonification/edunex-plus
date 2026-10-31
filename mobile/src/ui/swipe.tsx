// A row the Student can swipe for its quick actions ("Ingatkan nanti", "Sudah beres"), the phone's
// way of the desktop row's faint control. Swiping is a shortcut, never the only way: every action
// here is also in the row's long-press menu (sheet.tsx) for anyone who doesn't swipe.
import { type ReactNode, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Swipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { Text } from "./text";
import { type Palette, space, useTheme } from "./theme";

export interface SwipeAction {
  label: string;
  icon?: ReactNode;
  tone: "neutral" | "success" | "warning" | "danger" | "accent";
  onPress(): void;
  testID?: string;
}

const TONE: Record<SwipeAction["tone"], [keyof Palette, keyof Palette]> = {
  neutral: ["neutralBg", "neutralFg"],
  success: ["successBg", "successFg"],
  warning: ["warningBg", "warningFg"],
  danger: ["dangerBg", "dangerFg"],
  accent: ["infoBg", "infoFg"],
};

export function SwipeRow({ actions, children, testID }: { actions: readonly SwipeAction[]; children: ReactNode; testID?: string }) {
  const theme = useTheme();
  const ref = useRef<SwipeableMethods>(null);
  if (!actions.length) return <>{children}</>;
  return (
    <Swipeable
      ref={ref}
      testID={testID}
      friction={1.6}
      rightThreshold={36}
      overshootRight={false}
      renderRightActions={() => (
        <View style={{ flexDirection: "row" }}>
          {actions.map((action) => {
            const [bg, fg] = TONE[action.tone];
            return (
              <Pressable
                key={action.label}
                testID={action.testID}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => {
                  ref.current?.close();
                  action.onPress();
                }}
                style={[styles.action, { backgroundColor: theme.color[bg] }]}
              >
                {action.icon}
                <Text size="caption" weight="semibold" style={{ color: theme.color[fg], textAlign: "center" }} numberOfLines={2}>
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      <View style={{ backgroundColor: theme.color.surfaceContainerLow }}>{children}</View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  action: { width: 92, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: space[2] },
});
