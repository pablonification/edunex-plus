// Round 2's press (v4, DESIGN.md "Motion"): what's pressed answers in the frame the finger lands, Android's ripple over
// it (an iPhone's tint), and gives a little (`motion.give.card`) on M3's fast spatial spring, coming back on the
// expressive one, on the UI thread: ./moves.tsx's `Tap` as a card. A long press that runs plays the hold haptic. With
// Remove animations it doesn't move; the ripple or tint still answers. One target, one outcome: wrap the whole card or row.
import type { ReactNode } from "react";
import { type AccessibilityProps, type Insets, Platform, type StyleProp, type ViewStyle } from "react-native";
import { haptic } from "./haptics";
import { Tap } from "./moves";

export function PressScale({
  onPress,
  onLongPress,
  disabled = false,
  style,
  children,
  testID,
  hitSlop,
  ...a11y
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  testID?: string;
  /** What a part smaller than 48 dp adds to be 48 to touch (ui/sizes). */
  hitSlop?: Insets | number;
} & AccessibilityProps) {
  return (
    <Tap
      feel="card"
      testID={testID}
      {...a11y}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      onLongPress={
        onLongPress &&
        (() => {
          haptic.hold();
          onLongPress();
        })
      }
      style={style}
    >
      {children}
    </Tap>
  );
}

/**
 * What a plain row or button shows while pressed on an iPhone, which has no ripple: it dims, as UIKit's buttons and
 * cells do. Android keeps its ripple (null there). `Pressable`'s style as a function: `style={({ pressed }) => [base,
 * iosPressed(pressed)]}`.
 */
export function iosPressed(pressed: boolean): ViewStyle | null {
  return pressed && Platform.OS === "ios" ? IOS_PRESSED : null;
}

const IOS_PRESSED: ViewStyle = { opacity: 0.55 };
