// The app's haptics, each the phone's own: Android's named haptic constants, and on an iPhone the Taptic Engine's
// nearest feel (Android's constants do nothing there). A phone that can't, or has them turned off, stays still.
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const ios = Platform.OS === "ios";
const quiet = () => undefined;

/** A small step: a swipe passing its commit point, a pick in a list. iOS: the selection tick. */
function tick(): void {
  if (ios) void Haptics.selectionAsync().catch(quiet);
  else void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick).catch(quiet);
}

/** Something done: a swipe's action, a Task marked done, a correction kept. iOS: a medium tap. */
function confirm(): void {
  if (ios) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(quiet);
  else void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(quiet);
}

/** A switch turned on or off. iOS: a light tap for on, a softer one for off. */
function toggle(on: boolean): void {
  if (ios) void Haptics.impactAsync(on ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Soft).catch(quiet);
  else void Haptics.performAndroidHapticsAsync(on ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off).catch(quiet);
}

let heldAt = 0;

/**
 * A long press that runs (a menu, a pick-up). iOS: a medium tap. One long press buzzes once: the press part and the
 * screen it sits on may both call this for the same hold, so a second call inside half a second stays still.
 */
function hold(): void {
  const now = Date.now();
  if (now - heldAt < 500) return;
  heldAt = now;
  if (ios) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(quiet);
  else void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press).catch(quiet);
}

/** An earned moment: a hand-in, presence marked (ui/celebrate.tsx). The phone's own success pattern on both. */
function success(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(quiet);
}

export const haptic = { tick, confirm, toggle, hold, success };
