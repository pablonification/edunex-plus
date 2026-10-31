import { useParam } from "../../src/nav";
import { usePerfDrawn } from "../../src/perf";
import { TaskScreen } from "../../src/screens/tasks/task-page";

export default function Screen() {
  usePerfDrawn(true);
  return <TaskScreen taskId={Number(useParam("taskId"))} />;
}
