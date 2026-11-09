// A moment as short as a Perlu kamu urus card's line can hold ("Tutup Jum 23:59").
import type { Format } from "../../../../src/app/i18n";

/** Its day only when it isn't today: "23:59", "besok 23:59", "Jum 23:59" within the week, "12 Okt 23:59" further off. */
export function shortWhen(f: Format, at: number): string {
  return `${shortDay(f, at)}${f.time(at)}`;
}

/** The day part of `shortWhen`, with its space: "" today, "besok ", "Jum ", "12 Okt ". */
export function shortDay(f: Format, at: number): string {
  const offset = f.dayOffset(at);
  if (offset === 0) return "";
  if (offset === 1 || offset === -1) return `${f.relativeDay(at).toLocaleLowerCase()} `;
  if (Math.abs(offset) < 7) return `${f.weekdayShort(at)} `;
  return `${f.dayMonth(at)} `;
}
