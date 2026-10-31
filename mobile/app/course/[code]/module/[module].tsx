import { useParam } from "../../../../src/nav";
import { ModuleScreen } from "../../../../src/screens/course/module-screen";

export default function Screen() {
  return <ModuleScreen code={useParam("code") ?? ""} module={Number(useParam("module"))} />;
}
