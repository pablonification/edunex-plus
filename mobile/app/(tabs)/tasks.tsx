import { useParam } from "../../src/nav";
import { usePerfFocused } from "../../src/perf";
import { TasksScreen } from "../../src/screens/tasks/list";

export default function Screen() {
  usePerfFocused("tab");
  return <TasksScreen show={useParam("show") === "done" ? "done" : undefined} />;
}
