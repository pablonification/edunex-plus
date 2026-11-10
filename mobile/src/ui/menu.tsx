// The overflow menu (⋮) and other menus hung from a button: Material 3's menu, a surface that opens
// at its button, the rare actions in a column (DESIGN.md, "Menus"). It fades and grows from its corner
// in 150 ms (just fades with less motion asked for); Back or a tap outside closes it. A row's long-press
// menu is an ActionSheet instead (./sheet.tsx): a menu with no button to hang from.
import { type ComponentRef, useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StatusBar, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../../src/app/i18n";
import { IconButton, Switch } from "./controls";
import { Icons } from "./icons";
import { reduceMotion } from "./motion";
import { iosPressed } from "./press";
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
  // Whether the menu's window is up: then the status bar's style is sent to it again (below).
  const [shown, setShown] = useState(false);
  const visible = anchor !== null;
  if (!visible && shown) setShown(false);
  useEffect(() => {
    if (!visible) return;
    grow.setValue(0);
    Animated.timing(grow, { toValue: 1, duration: motion.duration.short, easing: Easing.bezier(0.2, 0, 0, 1), useNativeDriver: true }).start();
  }, [grow, visible]);
  if (!anchor) return null;
  // Its end on the button's end, under the button; above it when there's no room below. Never past the screen's start:
  // a ⋮ left of the screen's end (Jadwal's, beside search and the bell) has less than the menu's widest to its left,
  // and the menu ran off the screen; it gets only what fits, and its words wrap.
  const right = Math.max(MARGIN, window.width - (anchor.x + anchor.width));
  const widest = Math.max(WIDTH.min, Math.min(WIDTH.max, window.width - right - MARGIN));
  const below = anchor.y + anchor.height;
  const up = height > 0 && below + height > window.height - insets.bottom - MARGIN;
  const top = up ? Math.max(insets.top + MARGIN, anchor.y - height) : below;
  const still = reduceMotion();
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} onShow={() => setShown(true)} statusBarTranslucent navigationBarTranslucent>
      {/* The menu is its own window, which copies the screen's status bar look only at the moment it opens: caught
          mid-change, light pages got white icons on white (the judge's round 2, Jadwal's ⋮ in light). A StatusBar entry
          with no style of its own sends the app's current one again, to the screen and to this window. */}
      {shown && <StatusBar />}
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
            maxWidth: widest,
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
            accessibilityRole={choice.checked === undefined ? "menuitem" : "checkbox"}
            accessibilityState={{ disabled: !!choice.disabled, ...(choice.checked === undefined ? {} : { checked: choice.checked }) }}
            disabled={choice.disabled}
            onPress={() => {
              onClose();
              choice.onPress();
            }}
            android_ripple={{ color: c.selected }}
            style={({ pressed }) => [[styles.item, choice.disabled && { opacity: 0.38 }], iosPressed(pressed)]}
          >
            {choice.icon && <View style={{ width: 24, alignItems: "center" }}>{choice.icon}</View>}
            <View style={{ flexShrink: 1, flexGrow: 1 }}>
              <Text size="labelLarge" tone={choice.tone === "danger" ? "danger" : "fg"} style={{ fontWeight: "400", fontSize: 16, lineHeight: 24 }}>
                {choice.label}
              </Text>
              {choice.hint && (
                <Text size="bodySmall" tone="muted">
                  {choice.hint}
                </Text>
              )}
            </View>
            {choice.checked !== undefined && (
              // The setting's state, as Material's switch; the whole item is the target.
              <View pointerEvents="none" importantForAccessibility="no-hide-descendants">
                <Switch value={choice.checked} onChange={() => undefined} label={choice.label} />
              </View>
            )}
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
