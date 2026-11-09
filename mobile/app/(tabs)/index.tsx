// Beranda (round 2, v4): its parts are in src/screens/home. Its top bar is the screen's own (Edunex's blue, the
// greeting, then Search, the bell and the avatar as on every tab), fixed over the page as it scrolls, with the status
// bar's icons light over it while Beranda is in front (not under the welcome, which is drawn over the tabs on a white
// page).
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
    <TabClock>
      {focused && !nobody && <StatusBar style="light" />}
      <Page testID="screen.home" header={<HomeBar />} background={v.page} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }} {...pull}>
        <Home />
      </Page>
    </TabClock>
  );
}
