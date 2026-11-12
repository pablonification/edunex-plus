// Beranda: its parts are in src/screens/home. Its top is the search bar and the bell, fixed over the white page as it
// scrolls; the class on now starts right under it.
import { usePerfFocused } from "../../src/perf";
import { Home } from "../../src/screens/home";
import { HomeBar } from "../../src/screens/home/header";
import { usePullToRefresh } from "../../src/shell/source-status";
import { useB } from "../../src/ui/b";
import { Page } from "../../src/ui/layout";
import { TabClock } from "../../src/ui/tab-clock";

export default function Screen() {
  const pull = usePullToRefresh();
  const b = useB();
  usePerfFocused("home");
  return (
    <TabClock name="home">
      <Page testID="screen.home" header={<HomeBar />} background={b.page} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }} {...pull}>
        <Home />
      </Page>
    </TabClock>
  );
}
