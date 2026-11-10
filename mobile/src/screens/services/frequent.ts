// "Sering kamu buka" on "Semua layanan": the services this Student opens most, from counts kept on the phone only
// (./opens.ts). It shows only once the phone has really counted (`FREQUENT_AFTER` opens in all), and then only counted
// services, so the row never repeats Beranda's grid for a Student who hasn't used the page yet. Pure, so it's tested
// without a phone (test/mobile/services.test.ts).

/** The most services the row shows. */
export const FREQUENT_COUNT = 4;
/** Opens counted in all before the row shows. */
export const FREQUENT_AFTER = 5;

/**
 * The ids to show: counted ones, most opened first (a tie keeps `known`'s order), at most `FREQUENT_COUNT`; none until
 * `known`'s counts add up to `FREQUENT_AFTER`. An id that isn't `known` (a service since removed) is skipped.
 */
export function frequent<Id extends string>(counts: Readonly<Record<string, number>>, known: readonly Id[]): Id[] {
  const total = known.reduce((sum, id) => sum + (counts[id] ?? 0), 0);
  if (total < FREQUENT_AFTER) return [];
  return known
    .filter((id) => (counts[id] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || known.indexOf(a) - known.indexOf(b))
    .slice(0, FREQUENT_COUNT);
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
