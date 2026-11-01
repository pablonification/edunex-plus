import { useParam } from "../../src/nav";
import { ExamScreen } from "../../src/screens/tasks/exam-page";

export default function Screen() {
  return <ExamScreen examId={useParam("examId") ?? ""} />;
}
