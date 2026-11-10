// Where the first minute hands over to Beranda (./scene.tsx): the room's blue lifts until its lower edge rests on
// Beranda's own blue, the greeting already where Beranda's is, and the scene fades off the real screen under it. The
// scene knows nothing else about Beranda: a new Beranda re-points these and nothing more.
import type { EdgeInsets } from "react-native-safe-area-context";
import type { V4Palette } from "../../ui/palette";
import { space } from "../../ui/theme";
import { BAR_HEIGHT } from "../../ui/top-bar";

export const seam = {
  /** The room's colour: Beranda's header's. */
  color: (v: V4Palette) => v.head,
  /** What's written on it: the greeting's colour. */
  ink: (v: V4Palette) => v.onHead,
  /** Where the room's lower edge comes to rest, from the screen's top: the top of Beranda's first card. */
  restHeight: (insets: EdgeInsets) => insets.top + BAR_HEIGHT + space[6],
  /** The greeting's row, as Beranda's bar has it: under the status bar, this high, this far in from the left. */
  greeting: { height: BAR_HEIGHT, inset: space[4] },
} as const;
