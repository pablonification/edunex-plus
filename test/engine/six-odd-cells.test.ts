// Every recorded SIX page with one cell written another way, the way another Student's SIX might
// show it (#237: a second percentage on attendance for sick days). Each table's first row has each
// cell changed three ways, one at a time, and what the reader does is kept in
// __snapshots__/six-odd-cells.txt: the page reads the same, reads something else, keeps the row with
// that cell blank and noted, leaves the row out, refuses a part of the page (the status page's
// course table, ADR 0012), or refuses the page. A change to that file is a
// reader getting more or less forgiving, said in the diff. One rule is held outright: this term's
// courses are never lost over a cell other than their code and name, since a course SIX leaves out
// loses SIX's details everywhere, and shows only if Edunex has it.
import { type CheerioAPI, load } from "cheerio/slim";
import { describe, expect, it } from "vitest";
import { isEngineError, PartChanged } from "../../src/engine/errors";
import { readBills } from "../../src/engine/sources/six/readers/bills";
import { readCurriculumList } from "../../src/engine/sources/six/readers/curriculum-list";
import { readCurriculumStructure } from "../../src/engine/sources/six/readers/curriculum-structure";
import { readKrs } from "../../src/engine/sources/six/readers/krs";
import { readProgress } from "../../src/engine/sources/six/readers/progress";
import { readSchemes } from "../../src/engine/sources/six/readers/schemes";
import { readTranscript } from "../../src/engine/sources/six/readers/transcript";
import { readStatusPage } from "../../src/engine/sources/six/status";
import { readTimetable } from "../../src/engine/sources/six/timetable";
import { Skipped } from "../../src/engine/sources/skipped";
import { sixPage } from "../kit/fixtures";

const NIM = "18223901";
const IPK = { value: 3.26, sks: 125 };

/** `partName`: what a reader that can refuse one part of its page alone (PartChanged) calls that part. */
const PAGES: { name: string; path: RegExp; partName?: string; read: (html: string, skipped: Skipped) => unknown }[] = [
  {
    name: "status",
    path: /\/statusmhs$/,
    partName: "course table",
    read: (html, skipped) => {
      const page = readStatusPage(html, NIM);
      if (page.tableChanged) throw new PartChanged(page.tableChanged.message);
      skipped.rows.push(...page.skipped);
      return page;
    },
  },
  { name: "timetable", path: /\/kelas\/jadwal\/mahasiswa\/\d+$/, read: (html) => readTimetable(html, "202610") },
  { name: "transcript", path: /\/transkrip\/historis\/\d+$/, read: (html, skipped) => readTranscript(html, IPK, skipped) },
  { name: "curriculum position", path: /\/transkrip\/kurikulum\/\d+$/, read: (html, skipped) => readProgress(html, skipped) },
  { name: "KRS", path: /\/registrasi\/rencanastudi\/\d+$/, read: (html, skipped) => readKrs(html, skipped) },
  { name: "fees", path: /\/keuangan$/, read: (html, skipped) => readBills(html, skipped) },
  { name: "curriculum list", path: /\/kurikulum\/kurikulum\/list$/, read: (html, skipped) => readCurriculumList(html, skipped) },
  { name: "curriculum structure", path: /\/kurikulum\/kurikulum\/\d+\/struktur$/, read: (html, skipped) => readCurriculumStructure(html, skipped) },
  { name: "schemes", path: /\/program-integrasi\/riwayat\/\d+$/, read: (html, skipped) => readSchemes(html, skipped) },
];

/** How a cell's words change: its last piece of text, so a tooltip around it stays. */
const CHANGES: { name: string; change: (text: string) => string | null }[] = [
  { name: "second value", change: (text) => `${text} / ${text}` },
  { name: "extra words", change: (text) => `${text} (sakit)` },
  { name: "emptied", change: () => null },
];

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

interface Read {
  value: unknown;
  json: string;
  noted: number;
  error: string | null;
  /** What was refused: the page, or one part of it. */
  refused: string | null;
}

function read(page: (typeof PAGES)[number], html: string): Read {
  const skipped = new Skipped();
  try {
    const value = page.read(html, skipped);
    return { value, json: JSON.stringify(value), noted: skipped.rows.length, error: null, refused: null };
  } catch (error) {
    // Anything but "SIX changed something" is a crash, and fails the test.
    if (!isEngineError(error)) throw error;
    return { value: null, json: "", noted: 0, error: error.message, refused: error instanceof PartChanged && page.partName ? page.partName : "page" };
  }
}

/** How many things a read holds, all the way down: fewer means something was left out. */
function size(value: unknown): number {
  if (Array.isArray(value)) return 1 + value.reduce((sum: number, item) => sum + size(item), 0);
  if (value && typeof value === "object") return 1 + Object.values(value).reduce((sum: number, item) => sum + size(item), 0);
  return 1;
}

function verdict(before: Read, after: Read): string {
  if (after.refused) return `${after.refused} refused`;
  if (after.noted > before.noted) return size(after.value) < size(before.value) ? "row left out" : "kept, cell blank and noted";
  return after.json === before.json ? "same" : "reads differently";
}

/** The tables to try, one of each header (a page repeats one per semester), with each one's first row of cells. */
function tables($: CheerioAPI) {
  const seen = new Set<string>();
  return $("table")
    .toArray()
    .flatMap((table, index) => {
      const rows = $(table).find("tr").toArray();
      const header = rows.find((tr) => $(tr).children("td").length === 0);
      const first = rows.find((tr) => $(tr).children("td").length > 0);
      const headings = header
        ? $(header)
            .children("th")
            .toArray()
            .map((th) => clean($(th).text()))
        : [];
      const key = headings.join("|") || `#${index}`;
      if (!first || seen.has(key)) return [];
      seen.add(key);
      const title = clean($(table).closest(".panel").find(".panel-title").first().text()).replace(/\d{4}\/\d{4}/, "…");
      return [{ index, headings, title: title || `table ${index + 1}`, cells: $(first).children("td, th").length }];
    });
}

function changeCell(html: string, table: number, column: number, change: (text: string) => string | null): string | null {
  const $ = load(html);
  const row = $($("table").toArray()[table]!)
    .find("tr")
    .toArray()
    .find((tr) => $(tr).children("td").length > 0)!;
  const cell = $($(row).children("td, th").toArray()[column]!);
  const texts = cell
    .find("*")
    .addBack()
    .contents()
    .toArray()
    .filter((node) => node.type === "text" && clean(node.data) !== "");
  const last = texts.at(-1);
  if (last?.type !== "text") return null;
  const changed = change(clean(last.data));
  if (changed === null) cell.empty();
  else last.data = changed;
  return $.html();
}

describe("SIX's pages with one cell written another way", () => {
  it("never lose one of this term's courses over a cell other than its code and name", () => {
    const page = PAGES[0]!;
    const html = sixPage(page.path);
    const before = readStatusPage(html, NIM);
    const table = tables(load(html)).find((t) => t.headings.includes("Kehadiran"))!;
    // Row number, code, name, class, SKS, attendance, grade: all but the code and name.
    for (const column of [0, 3, 4, 5, 6]) {
      for (const { name, change } of CHANGES) {
        const changed = changeCell(html, table.index, column, change);
        if (!changed) continue;
        const after = readStatusPage(changed, NIM);
        expect(
          after.courses?.map((c) => c.code),
          `${table.headings[column]}, ${name}`,
        ).toEqual(before.courses!.map((c) => c.code));
      }
    }
  });

  it("are read as kept in __snapshots__/six-odd-cells.txt", async () => {
    const lines: string[] = [];
    for (const page of PAGES) {
      const html = sixPage(page.path);
      const before = read(page, html);
      if (before.error) throw new Error(`${page.name} doesn't read as recorded: ${before.error}`);
      lines.push(`## ${page.name}`);
      for (const table of tables(load(html))) {
        for (let column = 0; column < table.cells; column++) {
          const outcomes = CHANGES.flatMap(({ name, change }) => {
            const changed = changeCell(html, table.index, column, change);
            return changed ? [`${name}: ${verdict(before, read(page, changed))}`] : [];
          });
          if (!outcomes.length) continue;
          const heading = table.headings[column] || `column ${column + 1}`;
          lines.push(`${table.title} › ${heading}: ${outcomes.join(" · ")}`);
        }
      }
      lines.push("");
    }
    await expect(lines.join("\n")).toMatchFileSnapshot("__snapshots__/six-odd-cells.txt");
  });
});
