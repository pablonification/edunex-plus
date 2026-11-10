// Profil (round 4; a first cut that still shows Akademik's content, src/screens/profile replaces it): IPK and SKS, what's due this term, then Nilai and the study plan's screens
// (src/screens/academic), white cards on v4's grey page under the tab's bar.
import { useT } from "../../../src/app/i18n";
import { usePerfFocused } from "../../src/perf";
import { AcademicContent } from "../../src/screens/academic/academic-screen";
import { TabHeader, usePullToRefresh } from "../../src/shell/source-status";
import { Page } from "../../src/ui/layout";
import { TabClock } from "../../src/ui/tab-clock";
import { useTheme } from "../../src/ui/theme";

export default function Screen() {
  const t = useT();
  const pull = usePullToRefresh();
  const v = useTheme().v4;
  usePerfFocused("profile");
  return (
    <TabClock name="profile">
      {() => (
        <Page testID="screen.profile" header={<TabHeader v4 title={t("mobile.tab.profile")} />} background={v.page} {...pull}>
          <AcademicContent />
        </Page>
      )}
    </TabClock>
  );
}
