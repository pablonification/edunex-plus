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

/** A comment mark in front of a licence copied from source code ("// ", "%%Copyright: ", " * "), and the lines that open and close a C comment. */
const COMMENT = /^(?:\/\/ ?|%%Copyright: ?| \*(?: |$)|\/\*+\s*$|\s*\*+\/\s*$)/;
/** A line that starts something of its own: a list item or clause ("* ", "1. ", "(a) "), or another copyright line. */
const ITEM = /^\s*(?:[-*•]\s|\(?\d+[.)]\s|\([a-z]\)\s)/i;
const COPYRIGHT = /^\s*(?:Copyright\b|\(c\)|©)/;
/** How far a line is set in: a centred title (the next licence's "Apache License") is set in far more than the line before it. */
const indent = (line: string) => line.length - line.trimStart().length;

/**
 * A licence text as paragraphs for the page's narrow column. Licence files
 * break their lines at 60 to 80 characters, wider than the column, which
 * would break them again and leave one word on a line: within a paragraph,
 * a line that reaches near the paragraph's width runs on into the next, and
 * the column wraps it. A short line (a title, the end of a clause), one
 * that starts something of its own, and one set far in from the line before
 * it (a centred title) keep their break. Comment marks in front of the lines
 * are left out. The words themselves never change.
 */
export function licenceParagraphs(text: string): string[] {
  const paragraphs: string[][] = [[]];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(COMMENT, "").trimEnd();
    const current = paragraphs[paragraphs.length - 1];
    if (line.trim()) current.push(line);
    else if (current.length) paragraphs.push([]);
  }
  return paragraphs
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const width = Math.max(...lines.map((line) => line.trim().length));
      return lines
        .map((line, i) => {
          if (i === 0) return line.trim();
          const runsOn =
            lines[i - 1].trim().length >= Math.max(45, width - 15) && indent(line) - indent(lines[i - 1]) < 8 && !ITEM.test(line) && !COPYRIGHT.test(line);
          return `${runsOn ? " " : "\n"}${line.trim()}`;
        })
        .join("");
    });
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
