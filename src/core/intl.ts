// The Intl pieces the phone's JavaScript engine (Hermes) doesn't have: plural rules, "in 3 days",
// and "A, B and C". The desktop uses Intl itself, here; the phone gets ./intl.native.ts (picked by
// Metro), which gives the same words for what the app asks of them (test/engine/intl.test.ts).
import type { Lang } from "./strings";

export type RelativeUnit = "minute" | "hour" | "day";

/** Whether a count reads as one thing or many ("1 tugas", "2 tasks"): Intl.PluralRules' category. */
export function pluralOf(lang: Lang): (count: number) => string {
  const rules = new Intl.PluralRules(lang);
  return (count) => rules.select(count);
}

/** "in 3 days", "kemarin", "this hour": Intl.RelativeTimeFormat with `numeric: "auto"`. */
export function relativeTime(lang: Lang): (value: number, unit: RelativeUnit) => string {
  const format = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  return (value, unit) => format.format(value, unit);
}

/** "UTS, Tugas, dan UAS" / "UTS, Tasks and UAS": Intl.ListFormat's conjunction for `locale`. */
export function listOf(locale: "id-ID" | "en-GB"): (items: readonly string[]) => string {
  const format = new Intl.ListFormat(locale, { type: "conjunction" });
  return (items) => format.format(items);
}
