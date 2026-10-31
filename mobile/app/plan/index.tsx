// Rencana studi's old address (/plan?tab=…), as alerts, notifications and saved links still name it:
// straight on to that part's own screen.
import { Redirect } from "expo-router";
import { useParam } from "../../src/nav";
import { partOf } from "../../src/screens/plan/plan-screen";

export default function Screen() {
  return <Redirect href={`/plan/${partOf(useParam("tab"))}` as never} />;
}
