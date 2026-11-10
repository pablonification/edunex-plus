// Where the first minute hands over to Beranda (./scene.tsx), and all the scene knows about Beranda. The stage is
// Beranda's header colour from the first frame; at the hand-over it draws up until its lower edge rests on Beranda's
// own header, the greeting written where Beranda's is, the two doors small beside one status line where Beranda's
// status line lives. Then the scene fades off the real screen under it. A new Beranda re-points these and nothing more:
//
//   color, ink      the header's colour and what's written on it (the stage's and the first frame's, ../welcome.tsx)
//   restHeight      where the header ends, from the screen's top
//   greeting        the greeting's row: how high, how far in from the left, how much room the header's actions keep
//                   on the right; `shown: false` if Beranda has none (the doors then fade with the stage's words)
//   holdMs          how long the small doors and the status line stay in the header before the scene goes
import type { EdgeInsets } from "react-native-safe-area-context";
import type { V4Palette } from "../../ui/palette";
import { space, TOUCH } from "../../ui/theme";
import { BAR_HEIGHT } from "../../ui/top-bar";

export const seam = {
  /** The stage's colour: Beranda's header's, light and dark. */
  color: (v: V4Palette) => v.head,
  /** What's written on it: the greeting's colour. */
  ink: (v: V4Palette) => v.onHead,
  /** Where the stage's lower edge comes to rest, from the screen's top: the top of Beranda's first card. */
  restHeight: (insets: EdgeInsets) => insets.top + BAR_HEIGHT + space[6],
  /** The greeting's row, as Beranda's bar has it: under the status bar, this high, this far in from the left. */
  greeting: { shown: true as boolean, height: BAR_HEIGHT, inset: space[4], end: space[1] + 3 * TOUCH },
  /** The small doors and the status line stay this long once the stage has settled, then Beranda's own line carries on. */
  holdMs: 1_400,
} as const;
