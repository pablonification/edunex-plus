import { Redirect } from "expo-router";
import { hrefOf, useParam } from "../../../src/nav";
import { CourseScreen } from "../../../src/screens/course/course-screen";

export default function Screen() {
  const code = useParam("code") ?? "";
  const module = useParam("module");
  const tab = useParam("tab");
  // The old address of a module (/course/<code>?module=<id>), as a saved link may still name it: its own screen now.
  if (module !== undefined && module !== "") return <Redirect href={hrefOf({ screen: "course", code, module: Number(module) }) as never} />;
  return <CourseScreen code={code} tab={tab} />;
}
