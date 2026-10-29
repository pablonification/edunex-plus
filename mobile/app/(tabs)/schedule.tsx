import { ScheduleScreen } from "../../src/screens/schedule/schedule-screen";
import { TabHeader, usePullToRefresh } from "../../src/shell/source-status";

export default function Screen() {
  const pull = usePullToRefresh();
  return <ScheduleScreen header={<TabHeader />} {...pull} />;
}
