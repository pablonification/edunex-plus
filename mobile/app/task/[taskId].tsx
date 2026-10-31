import { useParam } from "../../src/nav";
import { TaskScreen } from "../../src/screens/tasks/task-page";
import { usePerfDrawn } from "../../src/perf";

export default function Screen() {
  usePerfDrawn(true);
  return <TaskScreen taskId={Number(useParam("taskId"))} />;
}
