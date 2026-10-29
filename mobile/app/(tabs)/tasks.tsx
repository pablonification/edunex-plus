import { useParam } from "../../src/nav";
import { TasksScreen } from "../../src/screens/tasks/list";

export default function Screen() {
  return <TasksScreen show={useParam("show") === "done" ? "done" : undefined} />;
}
