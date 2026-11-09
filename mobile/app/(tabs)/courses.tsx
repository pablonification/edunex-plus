// Kuliah (round 2, v4): the term's courses, the ones at risk first, each with what's left of its absences, under one
// big number; a course opens its page (src/screens/presence). Tap and hold one for its colour.
import { usePerfFocused } from "../../src/perf";
import { CoursesScreen } from "../../src/screens/presence/presence-screen";
import { usePullToRefresh } from "../../src/shell/source-status";
import { TabClock } from "../../src/ui/tab-clock";

export default function Screen() {
  const pull = usePullToRefresh();
  usePerfFocused("courses");
  return <TabClock>{() => <CoursesScreen {...pull} />}</TabClock>;
}
