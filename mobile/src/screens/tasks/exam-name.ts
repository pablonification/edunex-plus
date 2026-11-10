// An exam's one name on every screen (Tugas, a Task's page, the exam's page, Ujian, search), in one place both Tugas
// and Ujian call: `import { examName, examNote, examTitle } from "../tasks/exam-name";`
import type { Translate } from "../../../../src/app/i18n";
import type { Exam } from "../../../../src/core/exams";
import { shortName } from "../home/parts";

/**
 * Its kind, then its course's one short name: "UTS Komunikasi Pemasaran". Never a take-home's own title ("UTS Markom").
 * `courseName`: the course list's name; without it SIX's, else the code.
 */
export const examName = (t: Translate, exam: Pick<Exam, "kind" | "courseCode" | "six">, courseName?: string): string =>
  `${t(`exam.kind.${exam.kind}`)} ${shortName(courseName ?? exam.six[0]?.courseName ?? exam.courseCode)}`;

/** What tells one course's exams apart, as a quiet word: "Take-home", "Di Edunex", else nothing. */
export function examNote(t: Translate, part: { kind: string; source?: string } | null | undefined): string | null {
  if (part?.kind === "takehome") return t("exam.takeHome");
  if (part?.kind === "window" || (part?.kind === "sitting" && part.source === "edunex")) return t("exam.onEdunex");
  return null;
}

/**
 * A row's title line: the name and, on the same line, the word that tells a course's two exams apart
 * ("UTS Komunikasi Pemasaran · Take-home" under "UTS Komunikasi Pemasaran"). The word is said there only.
 */
export function examTitle(
  t: Translate,
  exam: Pick<Exam, "kind" | "courseCode" | "six">,
  part: { kind: string; source?: string } | null | undefined,
  courseName?: string,
): string {
  const note = examNote(t, part);
  const name = examName(t, exam, courseName);
  return note ? `${name} · ${note}` : name;
}
