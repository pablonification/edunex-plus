// A day said inside a sentence: "kumpulkan hari ini, 15:00–23:59", "Berikutnya besok". Format's relativeDay
// starts a line ("Hari ini"), so mid-sentence its capital reads as a typo.
import type { Translate } from "../../../src/app/i18n";
import type { Format } from "../../../src/core/format";

/** A date's words held together, so a line never ends on "Jum, 16" with "Okt" on the next. */
export const together = (date: string) => date.replace(/ /g, "\u00a0");

/**
 * A day and its time in a sentence, held together ("Kam 15 Okt, 11:00"), so the time never starts the next
 * line alone. Not for a narrow column, where the break after the comma is what makes it fit.
 */
export const dayAt = (day: string, time: string) => together(`${day}, ${time}`);

/** "hari ini" / "besok" / "kemarin", else "Kam, 8 Okt" (held together). */
export function dayWord(f: Format, t: Translate, at: number): string {
  const offset = f.dayOffset(at);
  if (offset === 0) return t("time.todayWord");
  if (offset === 1) return t("time.tomorrowWord");
  if (offset === -1) return t("time.yesterdayWord");
  return together(f.relativeDay(at));
}
