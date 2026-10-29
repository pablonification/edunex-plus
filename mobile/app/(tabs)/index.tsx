// Beranda: the screen's parts are in src/screens/home.
import { Home } from "../../src/screens/home";
import { TabHeader, usePullToRefresh } from "../../src/shell/source-status";
import { Page } from "../../src/ui/layout";

export default function Screen() {
  const pull = usePullToRefresh();
  return (
    <Page testID="screen.home" header={<TabHeader />} {...pull}>
      <Home />
    </Page>
  );
}
