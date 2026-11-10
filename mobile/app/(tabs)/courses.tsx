// Kuliah (round 4): the term's courses in one list, the ones at risk first, each with its own tile and what's left of
// its absences as dots; a row opens its course (src/screens/presence). Tap and hold one for its colour.
import { usePerfFocused } from "../../src/perf";
import { CoursesScreen } from "../../src/screens/presence/presence-screen";
import { usePullToRefresh } from "../../src/shell/source-status";
import { TabClock } from "../../src/ui/tab-clock";

export default function Screen() {
  const pull = usePullToRefresh();
  usePerfFocused("courses");
  return <TabClock name="courses">{() => <CoursesScreen {...pull} />}</TabClock>;
}
