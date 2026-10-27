// The rows a read left out, as the page wrote them (ADR 0014): each found in its scrubbed page by
// its text, with its table's header row, so a report can show the exact markup that didn't fit (a
// tooltip, a second value in a cell) without the rest of the page. And the row's shape, from what
// SIX really wrote before anything was scrubbed: every word an "a", every number a "9". Nothing of
// the Student's is left in it, and its form ("9.9% / 9.9%") stays, even where scrubbing made up the
// value in the page.
import { load } from "cheerio/slim";
import type { Element } from "domhandler";
import type { ReportCell, ReportPage, SkippedRow } from "../../core/models";
import { sameText } from "./reread";

/** The most of a row or a header a report carries. */
const MAX_HTML = 2_000;

/** "4 · PL-3002 · Ekonomi · 85.71%" → "9 · a-9 · a · 9.9%" */
export const shapeOf = (text: string) => text.replace(/[\p{L}\p{M}]+/gu, "a").replace(/\p{Nd}+/gu, "9");

/**
 * Each row left out (`real`, with `scrubbed` its words in the report), found in the scrubbed pages:
 * its markup and its table's header, or "" for one no table row reads as (a panel's title).
 */
export function findCells(rows: readonly { real: SkippedRow; scrubbed: SkippedRow }[], pages: readonly ReportPage[]): ReportCell[] {
  if (!rows.length) return [];
  const tables = pages.filter((page) => page.system === "six").map(tableRows);
  return rows.map(({ real, scrubbed }) => {
    const found = tables.flatMap((rowsOfPage) => rowsOfPage.find((row) => sameText(row.text, scrubbed.row)) ?? []).at(0);
    return { row: scrubbed.row, html: clip(found?.html ?? "", MAX_HTML), header: clip(found?.header ?? "", MAX_HTML), shape: shapeOf(real.row) };
  });
}

interface FoundRow {
  /** The row as a reader writes it: its cells' text, the empty ones left out, joined by " · ". */
  text: string;
  html: string;
  header: string;
}

/** Every table row of a page, with its markup as written and its table's header row. */
function tableRows(page: ReportPage): FoundRow[] {
  // HTML as the readers parse it, with where each element starts and ends in the page as written.
  const $ = load(page.body, { xml: { xmlMode: false, withStartIndices: true, withEndIndices: true } });
  const source = (element: Element) => page.body.slice(element.startIndex ?? 0, (element.endIndex ?? -1) + 1);
  const clean = (text: string) => text.replace(/\s+/g, " ").trim();
  return $("tr")
    .toArray()
    .map((tr) => {
      const cells = $(tr).children("th,td");
      const table = $(tr).closest("table");
      const header = table
        .find("tr")
        .filter((_, row) => $(row).closest("table").is(table))
        .toArray()
        .find((row) => row !== tr && $(row).children("th,td").length > 0 && $(row).children("td").length === 0);
      const text = cells
        .toArray()
        .map((cell) => clean($(cell).text()))
        .filter(Boolean)
        .join(" · ");
      return { text: clip(text, ROW_LENGTH), html: source(tr), header: header ? source(header) : "" };
    });
}

/** As a reader keeps a row (src/engine/sources/skipped.ts). */
const ROW_LENGTH = 120;

/** `text` cut to `max` characters, "…" last. */
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
