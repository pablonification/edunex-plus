import { useParam } from "../../src/nav";
import { TaskScreen } from "../../src/screens/tasks/task-page";

export default function Screen() {
  return <TaskScreen taskId={Number(useParam("taskId"))} />;
}
