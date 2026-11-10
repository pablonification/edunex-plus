// Bottom sheets: what the desktop opens as a popover or a dialog (a class's detail, the snooze menu, a
// course's color), rising from the bottom within reach of a thumb. Android's own Material bottom sheet
// (react-native-screens' FormSheet, a BottomSheetDialog): the scrim fades in while the sheet slides up,
// it follows a drag down to close, and Back (the gesture too) closes it. `Sheet` holds any content;
// `ActionSheet` is a menu of choices. A sheet's main action goes in `footer`: it stays in view under
// the content however long that runs, as a dialog's buttons do on the desktop.
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, type TextStyle, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FormSheet } from "react-native-screens/experimental";
import { iosPressed } from "./press";
import { Text } from "./text";
import { shape, space, useTheme } from "./theme";

/** How far under the status bar a sheet may reach at most: the page behind stays in sight above it. */
const TOP_GAP = 72;

/**
 * The native grabber's height (Material's BottomSheetDragHandleView: a 48 dp target). react-native-screens 4.30's
 * FormSheet stacks it over the content in a box only as tall as the content (FormSheetContainer, fitToContents), so the
 * content's last 48 dp fall outside the sheet: the content ends with that much room to spare.
 */
const GRABBER = 48;

/**
 * How wide a sheet is: the window's, up to Material's cap for a bottom sheet (material_bottom_sheet_max_width). The
 * content is laid out at this width from its first render. The native sheet tells React Native its width only once it
 * is on screen, and until then laid the content out in no width at all: too tall (every line broken), so the sheet rose
 * empty to near the top of the screen and snapped down to its real height a round trip later. With the width known up
 * front, the content's height is right before the sheet appears, and the native sheet takes it before it slides
 * (patches/react-native-screens…): it rises once, straight to its height, with its content in it.
 */
const MAX_WIDTH = 640;

export function Sheet({
  open,
  onClose,
  title,
  footer,
  background,
  children,
  testID,
}: {
  open: boolean;
  onClose(): void;
  title?: ReactNode;
  /** The sheet's main action (and its companions), fixed at the bottom while the content scrolls. */
  footer?: ReactNode;
  /** The sheet's colour, when it isn't surfaceContainerLow (round 2's v4 sheets: the white card). */
  background?: string;
  children: ReactNode;
  testID?: string;
}) {
  const theme = useTheme();
  const c = theme.color;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // The native sheet lives while it's open and while it slides away; then it's gone, and with it its content.
  const [shown, setShown] = useState(open);
  const [appeared, setAppeared] = useState(false);
  if (open && !shown) setShown(true);
  if (!open && !shown) return null;
  return (
    <FormSheet
      isOpen={open}
      detents="fitToContents"
      prefersGrabberVisible
      preferredCornerRadius={shape.xl}
      nativeContainerStyle={{ backgroundColor: background ?? c.surfaceContainerLow }}
      onNativeDismiss={onClose}
      onDidAppear={() => setAppeared(true)}
      onDidDisappear={() => {
        setAppeared(false);
        if (!open) setShown(false);
      }}
    >
      <View
        testID={testID}
        accessibilityViewIsModal
        // Never taller than the screen less a strip of the page: the content scrolls, the title and the footer stay. The
        // native sheet already keeps the content clear of the navigation bar (it runs under it, plugins/sheet-theme.js),
        // but cuts the content's end by the grabber's height (GRABBER). That cut once matched the bar's height on mid
        // (three-button navigation, 48 dp), so padding by the bar hid it there and not with gesture navigation (24 dp).
        style={{
          width: Math.min(width, MAX_WIDTH),
          maxHeight: height - insets.top - TOP_GAP,
          paddingBottom: space[4] + GRABBER,
          backgroundColor: background ?? c.surfaceContainerLow,
        }}
      >
        {/* The sheet is its own window, which takes the app's status bar style as it opens (patches/react-native-screens…).
            Once it's up, a StatusBar entry with no style of its own sends the app's current one again, to the screen and
            to the sheet, as the ⋮ menu does (./menu.tsx): dark icons on the light page's scrim. */}
        {appeared && <StatusBar />}
        {title !== undefined && (
          <View style={{ paddingHorizontal: space[6], paddingBottom: space[3] }}>{typeof title === "string" ? <SheetTitle>{title}</SheetTitle> : title}</View>
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

/**
 * A sheet's title in the one face for headings (v4: Plus Jakarta Sans bold), as every screen's (./top-bar.tsx). `Sheet`
 * uses it for a title given as words; a sheet that draws its own heading (with more under it) uses it too.
 */
export function SheetTitle({ children, style }: { children: string; style?: TextStyle }) {
  return (
    <Text size="titleLarge" face="display" weight="bold" accessibilityRole="header" style={style}>
      {children}
    </Text>
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
  /** A setting the choice turns on and off (Material's checkable menu item): a check at its end while it's on. */
  checked?: boolean;
  onPress(): void;
  testID?: string;
}

/** A menu of choices in a sheet (a row's long-press menu); picking one closes it first. */
export function ActionSheet({
  open,
  onClose,
  title,
  message,
  choices,
  testID,
}: {
  open: boolean;
  onClose(): void;
  title?: string;
  /** What the row it opened from leaves out (a date's meaning, what to do about a clash), under the title. */
  message?: string | null;
  choices: readonly SheetChoice[];
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Sheet open={open} onClose={onClose} title={title} testID={testID}>
      {message ? (
        <Text size="bodyMedium" tone="muted" style={{ marginBottom: space[2] }}>
          {message}
        </Text>
      ) : null}
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
            style={({ pressed }) => [[styles.choice, choice.disabled && { opacity: 0.38 }], iosPressed(pressed)]}
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
