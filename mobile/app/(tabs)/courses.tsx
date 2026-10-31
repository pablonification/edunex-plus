// Kuliah: the term's courses, each with its absences left and its next class, the ones at risk first
// (Presensi's page, src/screens/presence); a course opens its page. Tap and hold one for its colour.
import { useT } from "../../../src/app/i18n";
import { usePerfFocused } from "../../src/perf";
import { PresenceContent } from "../../src/screens/presence/presence-screen";
import { TabHeader, usePullToRefresh } from "../../src/shell/source-status";
import { Page } from "../../src/ui/layout";

export default function Screen() {
  const t = useT();
  const pull = usePullToRefresh();
  usePerfFocused("courses");
  return (
    <Page testID="screen.courses" header={<TabHeader title={t("mobile.tab.courses")} />} {...pull}>
      <PresenceContent />
    </Page>
  );
}
