// Beranda: the screen's parts are in src/screens/home. The bell lives in its top bar.
import { useT } from "../../../src/app/i18n";
import { usePerfFocused } from "../../src/perf";
import { Home } from "../../src/screens/home";
import { TabHeader, usePullToRefresh } from "../../src/shell/source-status";
import { Page } from "../../src/ui/layout";
import { TabFreeze } from "../../src/ui/tab-freeze";

export default function Screen() {
  const t = useT();
  const pull = usePullToRefresh();
  usePerfFocused("home");
  return (
    <TabFreeze>
      <Page testID="screen.home" header={<TabHeader title={t("nav.home")} bell />} {...pull}>
        <Home />
      </Page>
    </TabFreeze>
  );
}
