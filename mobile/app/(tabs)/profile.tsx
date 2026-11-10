// Profil (direction B): the Student, their IPK and SKS as counts, what's due this term, Nilai and the study plan's
// screens, then the account and Settings (src/screens/academic), on the white page. The page's title is the Student's
// name: the bar keeps only Search and the bell.
import { useT } from "../../../src/app/i18n";
import { BTabHeader } from "../../src/parts/b-header";
import { usePerfFocused } from "../../src/perf";
import { AcademicContent } from "../../src/screens/academic/academic-screen";
import { usePullToRefresh } from "../../src/shell/source-status";
import { useB } from "../../src/ui/b";
import { Page } from "../../src/ui/layout";
import { TabClock } from "../../src/ui/tab-clock";

export default function Screen() {
  const t = useT();
  const pull = usePullToRefresh();
  const b = useB();
  usePerfFocused("profile");
  return (
    <TabClock name="profile">
      {() => (
        <Page
          testID="screen.profile"
          header={<BTabHeader title={t("mobile.tab.profile")} />}
          background={b.page}
          contentStyle={{ paddingHorizontal: 20 }}
          {...pull}
        >
          <AcademicContent />
        </Page>
      )}
    </TabClock>
  );
}
