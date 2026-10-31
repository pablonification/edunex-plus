import { useParam } from "../../src/nav";
import { ExamScreen } from "../../src/screens/tasks/exam-page";
import { usePerfDrawn } from "../../src/perf";

export default function Screen() {
  usePerfDrawn(true);
  return <ExamScreen examId={useParam("examId") ?? ""} />;
}
