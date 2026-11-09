import { usePerfFocused } from "../../src/perf";
import { ScheduleScreen } from "../../src/screens/schedule/schedule-screen";
import { usePullToRefresh } from "../../src/shell/source-status";
import { TabClock } from "../../src/ui/tab-clock";

export default function Screen() {
  const pull = usePullToRefresh();
  usePerfFocused("schedule");
  return <TabClock>{() => <ScheduleScreen {...pull} />}</TabClock>;
}
