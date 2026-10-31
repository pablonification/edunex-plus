import { useT } from "../../../src/app/i18n";
import { usePerfFocused } from "../../src/perf";
import { ScheduleScreen } from "../../src/screens/schedule/schedule-screen";
import { TabHeader, usePullToRefresh } from "../../src/shell/source-status";
import { TabClock } from "../../src/ui/tab-clock";

export default function Screen() {
  const t = useT();
  const pull = usePullToRefresh();
  usePerfFocused("schedule");
  return (
    <TabClock>
      <ScheduleScreen header={<TabHeader title={t("nav.schedule")} />} {...pull} />
    </TabClock>
  );
}
