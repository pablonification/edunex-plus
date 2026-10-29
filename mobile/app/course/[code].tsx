import { useParam } from "../../src/nav";
import { CourseScreen } from "../../src/screens/course/course-screen";

export default function Screen() {
  const module = useParam("module");
  return <CourseScreen code={useParam("code") ?? ""} tab={useParam("tab")} module={module === undefined || module === "" ? undefined : Number(module)} />;
}
