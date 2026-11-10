// The buzz of a long press that opens something (a row's menu, its "Ingatkan nanti" times, a file's share sheet, a
// course's colours): the phone's own long-press feel, so the Student knows the hold took before the sheet is up.
// Called by the screens where a long press opens something, until `ui/haptics.ts` has a `haptic.hold()` that the
// press parts play themselves (then these calls go, or a long press buzzes twice).
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const quiet = () => undefined;

/** A long press took. Android: Long_Press; an iPhone: a medium tap. A phone that can't, or has them off, stays still. */
export function hold(): void {
  if (Platform.OS === "ios") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(quiet);
  else void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press).catch(quiet);
}
