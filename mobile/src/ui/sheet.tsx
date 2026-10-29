// Bottom sheets: what the desktop opens as a popover or a dialog (a class's detail, the snooze
// menu, a course's color), rising from the bottom within reach of a thumb. `Sheet` holds any
// content; `ActionSheet` is a menu of choices. Android's Back and a tap outside close it.
import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./text";
import { radius, space, useTheme } from "./theme";

export function Sheet({ open, onClose, title, children, testID }: { open: boolean; onClose(): void; title?: ReactNode; children: ReactNode; testID?: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.color.scrim }]} onPress={onClose} accessibilityLabel="close" />
        <View
          testID={testID}
          style={[styles.sheet, { backgroundColor: theme.color.raised, paddingBottom: insets.bottom + space[3], borderColor: theme.color.edge }]}
          accessibilityViewIsModal
        >
          <View style={[styles.grip, { backgroundColor: theme.color.track }]} />
          {title !== undefined && (
            <View style={{ paddingHorizontal: space[5], paddingBottom: space[3] }}>
              {typeof title === "string" ? (
                <Text size="title" weight="semibold" accessibilityRole="header">
                  {title}
                </Text>
              ) : (
                title
              )}
            </View>
          )}
          <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ paddingHorizontal: space[5] }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export interface SheetChoice {
  label: string;
  /** A second line: when it comes back, what it does. */
  hint?: string;
  icon?: ReactNode;
  tone?: "fg" | "danger";
  onPress(): void;
  testID?: string;
}

/** A menu of choices in a sheet; picking one closes it first. */
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
      {choices.map((choice, i) => (
        <Pressable
          key={choice.label}
          testID={choice.testID}
          accessibilityRole="button"
          onPress={() => {
            onClose();
            choice.onPress();
          }}
          android_ripple={{ color: theme.color.selected }}
          style={[styles.choice, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.line }]}
        >
          {choice.icon && <View style={{ width: 24, alignItems: "center" }}>{choice.icon}</View>}
          <View style={{ flex: 1 }}>
            <Text size="body" weight="medium" tone={choice.tone === "danger" ? "danger" : "fg"}>
              {choice.label}
            </Text>
            {choice.hint && (
              <Text size="small" tone="muted">
                {choice.hint}
              </Text>
            )}
          </View>
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, borderWidth: StyleSheet.hairlineWidth, paddingTop: space[2] },
  grip: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: space[3] },
  choice: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56, paddingVertical: space[3] },
});
