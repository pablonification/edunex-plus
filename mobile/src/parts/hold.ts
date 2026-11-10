// The buzz of a long press that opens something (a row's menu, its "Ingatkan nanti" times, a file's share sheet, a
// course's colours), so the Student knows the hold took before the sheet is up. It is the kit's one hold haptic
// (ui/haptics.ts), which buzzes once per long press even when the press part under the finger plays it too.
import { haptic } from "../ui/haptics";

/** A long press took. A phone that can't, or has haptics off, stays still. */
export function hold(): void {
  haptic.hold();
}
