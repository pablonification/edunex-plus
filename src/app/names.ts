// People's names as Edunex stores them can be all capitals; show them the way
// people write them.

export function displayName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean !== clean.toUpperCase()) return clean;
  return clean.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
}

export function firstName(name: string): string {
  return displayName(name).split(" ")[0] ?? "";
}

/** A lecturer's name without the titles around it ("Dr. Siti Rahma, S.T., M.T." → "Siti Rahma"): for initials, and where space is short. */
export const bareName = (name: string) => name.split(",")[0]!.replace(/^((prof|dr|ir|drs|dra|hj?)\.?\s+)+/i, "");

export function initials(name: string): string {
  return displayName(bareName(name))
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}
