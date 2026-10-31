import { useParam } from "../../src/nav";
import { usePerfFocused } from "../../src/perf";
import { TasksScreen } from "../../src/screens/tasks/list";
import { TabClock } from "../../src/ui/tab-clock";

export default function Screen() {
  usePerfFocused("tasks");
  const show = useParam("show") === "done" ? "done" : undefined;
  return (
    <TabClock>
      <TasksScreen show={show} />
    </TabClock>
  );
}
