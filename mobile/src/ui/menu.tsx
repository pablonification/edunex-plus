// The overflow menu (⋮) and other menus hung from a button: Material 3's menu, a surface that opens
// at its button, the rare actions in a column (DESIGN.md, "Menus"). It fades and grows from its corner
// in 150 ms (just fades with less motion asked for); Back or a tap outside closes it. A row's long-press
// menu is an ActionSheet instead (./sheet.tsx): a menu with no button to hang from.
import { type ComponentRef, useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../../src/app/i18n";
import { IconButton } from "./controls";
import { Icons } from "./icons";
import { reduceMotion } from "./motion";
import type { SheetChoice } from "./sheet";
import { Text } from "./text";
import { motion, shape, space, TOUCH, useTheme } from "./theme";

const WIDTH = { min: 168, max: 280 } as const;
const MARGIN = space[2];

/** The ⋮ button with its menu. `choices` as an ActionSheet's: label, hint, icon, tone, testID. */
export function OverflowMenu({ choices, label, testID }: { choices: readonly SheetChoice[]; label?: string; testID?: string }) {
  const t = useT();
  const theme = useTheme();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const open = useCallback(() => {
    anchor.current?.measureInWindow((x, y, width, height) => setAt({ x, y, width, height }));
  }, []);
  return (
    <>
      <View ref={anchor} collapsable={false}>
        <IconButton label={label ?? t("mobile.menu.more")} onPress={open} testID={testID}>
          <Icons.MoreVertical size={24} color={theme.color.onSurfaceVariant} />
        </IconButton>
      </View>
      <Menu anchor={at} onClose={() => setAt(null)} choices={choices} testID={testID ? `${testID}.menu` : undefined} />
    </>
  );
}

/** A menu open over `anchor` (its window rectangle) while it's set. */
export function Menu({
  anchor,
  onClose,
  choices,
  testID,
}: {
  anchor: { x: number; y: number; width: number; height: number } | null;
  onClose(): void;
  choices: readonly SheetChoice[];
  testID?: string;
}) {
  const theme = useTheme();
  const c = theme.color;
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const grow = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(0);
  const visible = anchor !== null;
  useEffect(() => {
    if (!visible) return;
    grow.setValue(0);
    Animated.timing(grow, { toValue: 1, duration: motion.duration.short, easing: Easing.bezier(0.2, 0, 0, 1), useNativeDriver: true }).start();
  }, [grow, visible]);
  if (!anchor) return null;
  // Its end on the button's end, under the button; above it when there's no room below.
  const right = Math.max(MARGIN, window.width - (anchor.x + anchor.width));
  const below = anchor.y + anchor.height;
  const up = height > 0 && below + height > window.height - insets.bottom - MARGIN;
  const top = up ? Math.max(insets.top + MARGIN, anchor.y - height) : below;
  const still = reduceMotion();
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="close" importantForAccessibility="no" />
      <Animated.View
        testID={testID}
        accessibilityViewIsModal
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        style={[
          styles.menu,
          {
            top,
            right,
            backgroundColor: c.surfaceContainer,
            opacity: grow,
            transform: still
              ? []
              : [
                  { translateY: grow.interpolate({ inputRange: [0, 1], outputRange: [up ? 8 : -8, 0] }) },
                  { scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                ],
          },
        ]}
      >
        {choices.map((choice) => (
          <Pressable
            key={choice.label}
            testID={choice.testID}
            accessibilityRole="menuitem"
            accessibilityState={{ disabled: !!choice.disabled }}
            disabled={choice.disabled}
            onPress={() => {
              onClose();
              choice.onPress();
            }}
            android_ripple={{ color: c.selected }}
            style={[styles.item, choice.disabled && { opacity: 0.38 }]}
          >
            {choice.icon && <View style={{ width: 24, alignItems: "center" }}>{choice.icon}</View>}
            <View style={{ flexShrink: 1 }}>
              <Text size="labelLarge" tone={choice.tone === "danger" ? "danger" : "fg"} style={{ fontWeight: "400", fontSize: 16, lineHeight: 24 }}>
                {choice.label}
              </Text>
              {choice.hint && (
                <Text size="bodySmall" tone="muted">
                  {choice.hint}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    minWidth: WIDTH.min,
    maxWidth: WIDTH.max,
    borderRadius: shape.lg,
    paddingVertical: space[2],
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
  },
  item: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: TOUCH, paddingVertical: space[2], paddingHorizontal: space[3] },
});
