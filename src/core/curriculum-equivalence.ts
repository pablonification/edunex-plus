// Older courses that stand in for a required course of a newer curriculum
// (ITB's move from Kurikulum 2019 to 2024). SIX's graduation progress places
// most of them itself; these are the pairs it leaves for the Student to work
// out. Hand-checked: add a pair only with its source (ITB's transition list
// or a Student's confirmed record), since one wrong pair misleads everyone.

export interface Equivalent {
  /** The newer curriculum's course code. */
  slot: string;
  /** Older codes that count for it. */
  from: readonly string[];
  /** Where the pair comes from. */
  source: string;
}

export const EQUIVALENTS: readonly Equivalent[] = [
  // Institute-wide (KU → WI), so it holds for every program.
  { slot: "WI2005", from: ["KU1011"], source: "Tata Tulis Karya Ilmiah counts as Bahasa Indonesia: confirmed by a Student, Oct 2026" },
];

/** The older codes that stand in for a slot, if any. */
export const equivalentsOf = (slot: string): readonly string[] => EQUIVALENTS.find((e) => e.slot === slot)?.from ?? [];
