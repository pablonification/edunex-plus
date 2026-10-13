// ITB's academic deadlines as they stand for this Student this term: the
// Rencana studi calendar tab lists them, and the sidebar counts the
// questionnaire running now.
import { academicDeadlines, currentTerm } from "../core/academic";
import { useNow } from "./i18n";
import { useDataset } from "./store";

/** This term: SIX's (the KRS page, then the status page), else from the calendar. */
export function useThisTerm(): string | null {
  const krs = useDataset("six.krs");
  const student = useDataset("six.student");
  const calendar = useDataset("itb.calendar");
  const now = useNow();
  return currentTerm(krs?.term ?? student?.term, calendar, now);
}

export function useDeadlines() {
  const calendar = useDataset("itb.calendar");
  const krs = useDataset("six.krs");
  const bills = useDataset("six.bills");
  const progress = useDataset("six.progress");
  const term = useThisTerm();
  const now = useNow();
  return { calendar, ...academicDeadlines({ calendar, term, now, krs, bills, progress }) };
}
