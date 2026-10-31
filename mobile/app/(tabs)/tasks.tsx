import { useParam } from "../../src/nav";
import { usePerfFocused } from "../../src/perf";
import { TasksScreen } from "../../src/screens/tasks/list";
import { TabFreeze } from "../../src/ui/tab-freeze";

export default function Screen() {
  usePerfFocused("tasks");
  const show = useParam("show") === "done" ? "done" : undefined;
  return (
    <TabFreeze>
      <TasksScreen show={show} />
    </TabFreeze>
  );
}
