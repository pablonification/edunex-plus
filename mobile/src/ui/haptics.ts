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

export const haptic = { tick, confirm, toggle };
