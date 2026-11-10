// "Sering kamu buka" on "Semua layanan": the four services this Student opens most, from counts kept on the phone only
// (./opens.ts). Before anything is counted (or with fewer than four counted), Beranda's first tiles fill the rest, so the
// row is never empty or short. Pure, so it's tested without a phone (test/mobile/services.test.ts).

/** How many services the row shows. */
export const FREQUENT_COUNT = 4;

/**
 * The ids to show: counted ones first, most opened first (a tie keeps `fallback`'s order, then `known`'s), then
 * `fallback`'s until there are `FREQUENT_COUNT`. An id that isn't `known` (a service since removed) is skipped.
 */
export function frequent<Id extends string>(counts: Readonly<Record<string, number>>, known: readonly Id[], fallback: readonly Id[]): Id[] {
  const order = (id: Id) => {
    const at = fallback.indexOf(id);
    return at >= 0 ? at : fallback.length + known.indexOf(id);
  };
  const counted = known
    .filter((id) => (counts[id] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || order(a) - order(b))
    .slice(0, FREQUENT_COUNT);
  for (const id of fallback) {
    if (counted.length >= FREQUENT_COUNT) break;
    if (known.includes(id) && !counted.includes(id)) counted.push(id);
  }
  return counted;
}

/** `counts` with one more open of `id`. */
export function counted(counts: Readonly<Record<string, number>>, id: string): Record<string, number> {
  return { ...counts, [id]: (counts[id] ?? 0) + 1 };
}

/** What a saved file holds, kept only where it's a count. */
export function readCounts(text: string | null): Record<string, number> {
  if (!text) return {};
  try {
    const saved: unknown = JSON.parse(text);
    if (!saved || typeof saved !== "object") return {};
    const counts: Record<string, number> = {};
    for (const [id, n] of Object.entries(saved as Record<string, unknown>)) {
      if (typeof n === "number" && Number.isFinite(n) && n > 0) counts[id] = Math.floor(n);
    }
    return counts;
  } catch {
    return {};
  }
}
