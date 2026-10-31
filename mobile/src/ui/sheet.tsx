// Bottom sheets: what the desktop opens as a popover or a dialog (a class's detail, the snooze menu, a
// course's color), rising from the bottom within reach of a thumb. Android's own Material bottom sheet
// (react-native-screens' FormSheet, a BottomSheetDialog): the scrim fades in while the sheet slides up,
// it follows a drag down to close, and Back (the gesture too) closes it. `Sheet` holds any content;
// `ActionSheet` is a menu of choices. A sheet's main action goes in `footer`: it stays in view under
// the content however long that runs, as a dialog's buttons do on the desktop.
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FormSheet } from "react-native-screens/experimental";
import { Text } from "./text";
import { shape, space, useTheme } from "./theme";

/** How far under the status bar a sheet may reach at most: the page behind stays in sight above it. */
const TOP_GAP = 72;

export function Sheet({
  open,
  onClose,
  title,
  footer,
  children,
  testID,
}: {
  open: boolean;
  onClose(): void;
  title?: ReactNode;
  /** The sheet's main action (and its companions), fixed at the bottom while the content scrolls. */
  footer?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  const theme = useTheme();
  const c = theme.color;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // The native sheet lives while it's open and while it slides away; then it's gone, and with it its content.
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  if (!open && !shown) return null;
  return (
    <FormSheet
      isOpen={open}
      detents="fitToContents"
      prefersGrabberVisible
      preferredCornerRadius={shape.xl}
      nativeContainerStyle={{ backgroundColor: c.surfaceContainerLow }}
      onNativeDismiss={onClose}
      onDidDisappear={() => {
        if (!open) setShown(false);
      }}
    >
      <View
        testID={testID}
        accessibilityViewIsModal
        // Never taller than the screen less a strip of the page: the content scrolls, the title and the footer stay. The
        // native sheet already keeps clear of the navigation bar.
        style={{ maxHeight: height - insets.top - TOP_GAP, paddingBottom: space[4], backgroundColor: c.surfaceContainerLow }}
      >
        {title !== undefined && (
          <View style={{ paddingHorizontal: space[6], paddingBottom: space[3] }}>
            {typeof title === "string" ? (
              <Text size="titleLarge" accessibilityRole="header">
                {title}
              </Text>
            ) : (
              title
            )}
          </View>
        )}
        <ScrollView
          style={{ flexGrow: 0, flexShrink: 1 }}
          contentContainerStyle={{ paddingHorizontal: space[6], paddingBottom: footer !== undefined ? space[3] : 0 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {children}
        </ScrollView>
        {footer !== undefined && (
          <View
            style={{
              gap: space[2],
              paddingHorizontal: space[6],
              paddingTop: space[3],
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: c.outlineVariant,
            }}
          >
            {footer}
          </View>
        )}
      </View>
    </FormSheet>
  );
}

export interface SheetChoice {
  label: string;
  /** A second line: when it comes back, what it does. */
  hint?: string;
  icon?: ReactNode;
  tone?: "fg" | "danger";
  /** Shown but not pressable (nothing to do yet); its hint says why. */
  disabled?: boolean;
  onPress(): void;
  testID?: string;
}

/** A menu of choices in a sheet (a row's long-press menu); picking one closes it first. */
export function ActionSheet({
  open,
  onClose,
  title,
  choices,
  testID,
}: {
  open: boolean;
  onClose(): void;
  title?: string;
  choices: readonly SheetChoice[];
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Sheet open={open} onClose={onClose} title={title} testID={testID}>
      <View style={{ marginHorizontal: -space[6] }}>
        {choices.map((choice) => (
          <Pressable
            key={choice.label}
            testID={choice.testID}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!choice.disabled }}
            disabled={choice.disabled}
            onPress={() => {
              onClose();
              choice.onPress();
            }}
            android_ripple={{ color: theme.color.selected }}
            style={[styles.choice, choice.disabled && { opacity: 0.38 }]}
          >
            {choice.icon && <View style={{ width: 24, alignItems: "center" }}>{choice.icon}</View>}
            <View style={{ flex: 1 }}>
              <Text size="bodyLarge" tone={choice.tone === "danger" ? "danger" : "fg"}>
                {choice.label}
              </Text>
              {choice.hint && (
                <Text size="bodyMedium" tone="muted">
                  {choice.hint}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 56, paddingVertical: space[2], paddingHorizontal: space[6] },
});
