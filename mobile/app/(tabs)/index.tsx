// Beranda (round 2, v4): its parts are in src/screens/home. The header is the screen's own (Edunex's blue, the
// greeting, search and the bell), so the page has no top bar: a strip of the header's blue stays under the status bar
// as the page scrolls, with the status bar's icons light over it while Beranda is in front.
import { useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePerfFocused } from "../../src/perf";
import { Home } from "../../src/screens/home";
import { usePullToRefresh } from "../../src/shell/source-status";
import { Page } from "../../src/ui/layout";
import { TabClock } from "../../src/ui/tab-clock";
import { useTheme } from "../../src/ui/theme";

export default function Screen() {
  const pull = usePullToRefresh();
  const v = useTheme().v4;
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  usePerfFocused("home");
  return (
    <TabClock>
      {focused && <StatusBar style="light" />}
      <Page
        testID="screen.home"
        header={<View style={{ height: insets.top, backgroundColor: v.head }} />}
        background={v.page}
        contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
        {...pull}
      >
        <Home />
      </Page>
    </TabClock>
  );
}
