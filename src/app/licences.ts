// The open-source software Edunex Plus is built on, each with its licence: the
// list the build writes next to the window (licences.json, made by
// scripts/third-party-notices.mjs). Settings reads it only when the Student
// opens it, so none of it loads with the window.
import { z } from "zod";

export const Licence = z
  .object({
    name: z.string().min(1),
    /** None for what has no version of its own (pdf.js's fonts, Chromium). */
    version: z.string().nullable(),
    /** As the software states it: "MIT", "(MIT OR Apache-2.0)". */
    licence: z.string().min(1),
    /** The web page of its source code. */
    source: z.string().nullable(),
    text: z.string().optional(),
    /** Where the licences are when there are too many to copy (Chromium's): a file beside the app. */
    file: z.string().optional(),
  })
  .refine((entry) => entry.text !== undefined || entry.file !== undefined, "an entry needs its licence text or the file that has it");
export type Licence = z.infer<typeof Licence>;

/** The list, read from the app's own files each time the page opens (a few milliseconds). */
export async function loadLicences(): Promise<Licence[]> {
  const response = await fetch(new URL("licences.json", document.baseURI));
  if (!response.ok) throw new Error(`licences.json: ${response.status}`);
  return z.array(Licence).parse(await response.json());
}

/** The entries whose name, version or licence hold every word typed ("radix dialog", "bsd"). */
export function findLicences(list: readonly Licence[], query: string): readonly Licence[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((entry) => {
    const text = [entry.name, entry.version, entry.licence].join(" ").toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
