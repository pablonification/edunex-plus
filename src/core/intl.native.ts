// The phone's plural rules, relative times and lists: Hermes on Android has only Intl's Collator,
// DateTimeFormat and NumberFormat (lib/VM/JSLib/Intl.cpp in Hermes), so these give the words Node's
// Intl gives for the two languages the app speaks. The desktop uses ./intl.ts;
// test/engine/intl.test.ts checks the two agree.
import type { Lang } from "./strings";

export type RelativeUnit = "minute" | "hour" | "day";

/** Indonesian has no plural; English's "one" is exactly one (CLDR). */
export function pluralOf(lang: Lang): (count: number) => string {
  return (count) => (lang === "en" && Math.abs(count) === 1 ? "one" : "other");
}

const UNITS = {
  id: { minute: ["menit", "menit"], hour: ["jam", "jam"], day: ["hari", "hari"] },
  en: { minute: ["minute", "minutes"], hour: ["hour", "hours"], day: ["day", "days"] },
} as const;

/** What `numeric: "auto"` says in words instead of a number, by unit and value. */
const WORDS: Record<Lang, Record<RelativeUnit, Record<number, string>>> = {
  id: { minute: { 0: "menit ini" }, hour: { 0: "jam ini" }, day: { [-2]: "kemarin dulu", [-1]: "kemarin", 0: "hari ini", 1: "besok", 2: "lusa" } },
  en: { minute: { 0: "this minute" }, hour: { 0: "this hour" }, day: { [-1]: "yesterday", 0: "today", 1: "tomorrow" } },
};

/** A whole number with its thousands grouped: "1.234" / "1,234". */
const grouped = (value: number, lang: Lang) => String(value).replace(/\B(?=(\d{3})+$)/g, lang === "id" ? "." : ",");

/** "in 3 days", "kemarin", "this hour", for whole numbers as the app gives them. */
export function relativeTime(lang: Lang): (value: number, unit: RelativeUnit) => string {
  return (value, unit) => {
    const word = WORDS[lang][unit][value === 0 ? 0 : value];
    if (word !== undefined) return word;
    const count = Math.abs(value);
    const name = UNITS[lang][unit][count === 1 ? 0 : 1];
    const amount = `${grouped(count, lang)} ${name}`;
    if (lang === "id") return value > 0 ? `dalam ${amount}` : `${amount} yang lalu`;
    return value > 0 ? `in ${amount}` : `${amount} ago`;
  };
}

/** "UTS, Tugas, dan UAS" / "UTS, Tasks and UAS": Indonesian keeps the comma before "dan", British English drops it. */
export function listOf(locale: "id-ID" | "en-GB"): (items: readonly string[]) => string {
  const [and, comma] = locale === "id-ID" ? ["dan", ","] : ["and", ""];
  return (items) => {
    if (items.length <= 1) return items[0] ?? "";
    if (items.length === 2) return `${items[0]} ${and} ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}${comma} ${and} ${items.at(-1)}`;
  };
}
