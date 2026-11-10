// Beranda (round 4, the super-app layout): its parts are in src/screens/home. Its top bar is the screen's own (Edunex's
// blue, a short greeting, then the search bar and the bell; no avatar), fixed over the page as it scrolls, with the
// status bar's icons light over it while Beranda is in front (not under the welcome, which is drawn over the tabs on a
// white page).
//
// The first screen's height budget: a 1080 × 2400 phone at 420 dpi (411 × 914 dp), font scale 1.1, 3-button navigation.
// Every part fully in view, no scrolling, with 16 dp or more to spare above the tab bar (dp, text lines × 1.1):
//   status bar                                                   ~32
//   header: greeting row 48 (its status line fits in it), search row 48, 8 under it      104
//   blue band above the now card (BAND_GAP)                       12
//   now card, at its tallest (on now, a Presence open, its button):
//     16 + kicker 22 + 3 + name of two lines 53 + 16 + wave 20 + 8 + Presence 48 + 16 + button 57 + 16     ~275
//   gap 16, strip: 12 + number 35 + 2 + two lines of words 35 + 12                        16 + 96
//   gap 16, services: two rows of 4 + tile 52 + 6 + word 18 + 4, 8 between              16 + 176
//   total                                                        ~727
//   room above the tab bar: 914 − 48 (navigation) − 80 (tab bar) = 786, so ~59 dp to spare (a status line that wraps
//   or a bigger status bar still leaves 16).
import { useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { usePerfFocused } from "../../src/perf";
import { Home } from "../../src/screens/home";
import { HomeBar } from "../../src/screens/home/header";
import { useNobodyIn } from "../../src/shell/nobody";
import { usePullToRefresh } from "../../src/shell/source-status";
import { Page } from "../../src/ui/layout";
import { TabClock } from "../../src/ui/tab-clock";
import { useTheme } from "../../src/ui/theme";

export default function Screen() {
  const pull = usePullToRefresh();
  const v = useTheme().v4;
  const focused = useIsFocused();
  const nobody = useNobodyIn();
  usePerfFocused("home");
  return (
    <TabClock name="home">
      {focused && !nobody && <StatusBar style="light" />}
      <Page testID="screen.home" header={<HomeBar />} background={v.page} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }} {...pull}>
        <Home />
      </Page>
    </TabClock>
  );
}
