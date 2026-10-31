import { useParam } from "../../src/nav";
import { usePerfDrawn } from "../../src/perf";
import { ExamScreen } from "../../src/screens/tasks/exam-page";

export default function Screen() {
  usePerfDrawn(true);
  return <ExamScreen examId={useParam("examId") ?? ""} />;
}
