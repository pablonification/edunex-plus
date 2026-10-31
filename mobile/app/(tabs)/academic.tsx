// Akademik: IPK and SKS, then Nilai and the study plan's screens (src/screens/academic).
import { useT } from "../../../src/app/i18n";
import { usePerfFocused } from "../../src/perf";
import { AcademicContent } from "../../src/screens/academic/academic-screen";
import { TabHeader, usePullToRefresh } from "../../src/shell/source-status";
import { Page } from "../../src/ui/layout";
import { TabFreeze } from "../../src/ui/tab-freeze";

export default function Screen() {
  const t = useT();
  const pull = usePullToRefresh();
  usePerfFocused("academic");
  return (
    <TabFreeze>
      <Page testID="screen.academic" header={<TabHeader title={t("mobile.tab.academic")} />} {...pull}>
        <AcademicContent />
      </Page>
    </TabFreeze>
  );
}
