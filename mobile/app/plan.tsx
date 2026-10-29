import { useParam } from "../src/nav";
import { PlanScreen } from "../src/screens/plan/plan-screen";

export default function Screen() {
  return <PlanScreen tab={useParam("tab")} />;
}
