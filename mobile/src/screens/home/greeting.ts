// Beranda's greeting's part of the day ("Pagi", "Siang", "Sore", "Malam"): the desktop's hours (src/core/format.ts
// greeting), and night until 04:00, so 01:34 says "Malam", never "Pagi" before dawn.

export type PartOfDay = "morning" | "midday" | "afternoon" | "evening";

/** The part of the day at `hour` (0–23, the phone's clock), as each language splits it. */
export function partOfDay(hour: number, lang: "id" | "en"): PartOfDay {
  if (hour < 4) return "evening";
  if (lang === "id") return hour < 11 ? "morning" : hour < 15 ? "midday" : hour < 18 ? "afternoon" : "evening";
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}
