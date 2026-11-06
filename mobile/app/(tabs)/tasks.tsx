import { useParam } from "../../src/nav";
import { usePerfFocused } from "../../src/perf";
import { TasksScreen } from "../../src/screens/tasks/list";
import { TaskClock } from "../../src/screens/tasks/task-clock";
import { TabClock } from "../../src/ui/tab-clock";

export default function Screen() {
  usePerfFocused("tasks");
  const show = useParam("show") === "done" ? "done" : undefined;
  return (
    <TabClock>
      {/* The list redraws on a minute's tick only when it can look different (task-clock.tsx). */}
      <TaskClock>
        <TasksScreen show={show} />
      </TaskClock>
    </TabClock>
  );
}
