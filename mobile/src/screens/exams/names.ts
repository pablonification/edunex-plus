// An exam's one name on Ujian: "<kind> <the course's name>" ("UTS Komunikasi Pemasaran"), and, as a quiet word beside
// it, what tells two exams of one course apart ("Take-home"). The same rule the Tugas tab is moving to; when its shared
// function lands in ../tasks, this file gives way to it (two lines to swap in exams-screen.tsx).
import type { Translate } from "../../../../src/app/i18n";
import type { Exam } from "../../../../src/core/exams";
import type { ExamItem } from "./view";

export const examName = (t: Translate, exam: Exam, courseName: string): string => `${t(`exam.kind.${exam.kind}`)} ${courseName}`;

/** The quiet word that sets this exam apart from its course's sat one; null when its name alone is enough. */
export const examApart = (t: Translate, item: ExamItem): string | null => (item.part?.kind === "takehome" ? t("exam.takeHome") : null);
