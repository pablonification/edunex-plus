// A day said inside a sentence: "kumpulkan hari ini, 15:00–23:59", "Berikutnya besok". Format's relativeDay
// starts a line ("Hari ini"), so mid-sentence its capital reads as a typo.
import type { Translate } from "../../../src/app/i18n";
import type { Format } from "../../../src/core/format";

/** A date's words held together, so a line never ends on "Jum, 16" with "Okt" on the next. */
export const together = (date: string) => date.replace(/ /g, "\u00a0");

/** "hari ini" / "besok" / "kemarin", else "Kam, 8 Okt" (held together). */
export function dayWord(f: Format, t: Translate, at: number): string {
  const offset = f.dayOffset(at);
  if (offset === 0) return t("time.todayWord");
  if (offset === 1) return t("time.tomorrowWord");
  if (offset === -1) return t("time.yesterdayWord");
  return together(f.relativeDay(at));
}
