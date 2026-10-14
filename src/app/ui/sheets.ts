// A spreadsheet as the viewer shows it: each sheet's cells as the text Excel
// would show, row by row. An Excel workbook (.xlsx) is unpacked with JSZip
// (loaded on first use, its own chunk) and its XML read with the browser's own
// parser; nothing in it runs, and only the values are kept, not formulas or
// styles. A CSV is split here by hand.

export interface Sheet {
  /** Its tab's name; empty for a CSV, which has one. */
  name: string;
  /** Rows of cells, as text; a row ends at its last filled cell. */
  rows: string[][];
}

const RELATIONSHIPS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
/** Excel's own number formats that show a date or time. */
const DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

const parse = (text: string) => new DOMParser().parseFromString(text, "application/xml");
/** Elements by their name, whatever namespace prefix the file gives them. */
const all = (node: Document | Element, name: string) => [...node.getElementsByTagNameNS("*", name)];

/** The workbook's visible sheets, in their order. Throws when the file isn't a workbook it can read. */
export async function readWorkbook(bytes: Uint8Array): Promise<Sheet[]> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(bytes);
  const xml = async (path: string) => {
    const file = zip.file(path);
    return file ? parse(await file.async("string")) : null;
  };
  const workbook = await xml("xl/workbook.xml");
  if (!workbook || workbook.getElementsByTagName("parsererror").length) throw new Error("Not a workbook");
  const targets = new Map(
    all((await xml("xl/_rels/workbook.xml.rels")) ?? parse("<r/>"), "Relationship").map((r) => [r.getAttribute("Id"), r.getAttribute("Target") ?? ""]),
  );
  const shared = all((await xml("xl/sharedStrings.xml")) ?? parse("<r/>"), "si").map(cellText);
  const dates = dateStyles(await xml("xl/styles.xml"));
  const date1904 = all(workbook, "workbookPr")[0]?.getAttribute("date1904");
  const since1904 = date1904 === "1" || date1904 === "true";

  const sheets: Sheet[] = [];
  for (const sheet of all(workbook, "sheet")) {
    if (sheet.getAttribute("state") === "hidden" || sheet.getAttribute("state") === "veryHidden") continue;
    const target = targets.get(sheet.getAttributeNS(RELATIONSHIPS, "id") ?? sheet.getAttribute("r:id"));
    if (!target) continue;
    // Targets are relative to xl/, or from the ZIP's root when they start with a slash.
    const doc = await xml(target.startsWith("/") ? target.slice(1) : `xl/${target}`);
    if (doc) sheets.push({ name: sheet.getAttribute("name") ?? "", rows: readRows(doc, shared, dates, since1904) });
  }
  if (!sheets.length) throw new Error("No sheet to show");
  return sheets;
}

/** A shared or inline string's text: its runs' text, without the phonetic guides some languages add. */
function cellText(element: Element): string {
  return all(element, "t")
    .filter((t) => t.parentElement?.localName !== "rPh")
    .map((t) => t.textContent ?? "")
    .join("");
}

/** Which of the workbook's cell styles show a date: by Excel's own formats, or a format of its own written with days, months or years. */
function dateStyles(styles: Document | null): Set<number> {
  const found = new Set<number>();
  if (!styles) return found;
  const custom = new Map(all(styles, "numFmt").map((f) => [Number(f.getAttribute("numFmtId")), f.getAttribute("formatCode") ?? ""]));
  const cellXfs = all(styles, "cellXfs")[0];
  if (!cellXfs) return found;
  [...cellXfs.children].forEach((xf, index) => {
    const id = Number(xf.getAttribute("numFmtId") ?? 0);
    // Quoted text and [colours] aside, a format with d, m or y in it is a date.
    const code = (custom.get(id) ?? "").replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
    if (DATE_FORMATS.has(id) || /[dmy]/i.test(code)) found.add(index);
  });
  return found;
}

/** "BC12" → 54 (from 0). */
function columnIndex(ref: string): number {
  let index = 0;
  for (const letter of /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? "") index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

function readRows(doc: Document, shared: readonly string[], dates: ReadonlySet<number>, since1904: boolean): string[][] {
  const rows: string[][] = [];
  for (const row of all(doc, "row")) {
    const number = Number(row.getAttribute("r")) || rows.length + 1;
    const cells: string[] = [];
    for (const cell of all(row, "c")) {
      const at = cell.getAttribute("r") ? columnIndex(cell.getAttribute("r")!) : cells.length;
      const value = all(cell, "v")[0]?.textContent ?? "";
      const type = cell.getAttribute("t");
      let text: string;
      if (type === "s") text = shared[Number(value)] ?? "";
      else if (type === "inlineStr") text = cellText(cell);
      else if (type === "b") text = value === "1" ? "TRUE" : "FALSE";
      else if (type === "str" || type === "e" || value === "") text = value;
      else if (dates.has(Number(cell.getAttribute("s") ?? 0))) text = excelDate(Number(value), since1904);
      // Excel shows 15 significant digits; the file may hold the float's last few.
      else text = String(Number(Number(value).toPrecision(15)));
      if (at >= 0 && text !== "") cells[at] = text;
    }
    rows[number - 1] = Array.from(cells, (text) => text ?? "");
  }
  return Array.from(rows, (row) => row ?? []);
}

/** Excel's day number as "2026-10-14", with the time when it has one ("2026-10-14 13:30"). */
function excelDate(serial: number, since1904: boolean): string {
  if (!Number.isFinite(serial)) return "";
  // Day 25569 is 1 January 1970 in Excel's count from 1900; 1462 days fewer from 1904.
  const date = new Date(Math.round((serial - (since1904 ? 24107 : 25569)) * 86_400_000));
  const iso = date.toISOString();
  const time = iso.slice(11, 16);
  if (serial < 1) return time;
  return time === "00:00" ? iso.slice(0, 10) : `${iso.slice(0, 10)} ${time}`;
}

/**
 * A CSV's rows, quotes and line breaks in quotes as spreadsheets write them.
 * The separator is a tab for .tsv; else a comma, or a semicolon when the first
 * line has more of those (as Excel writes CSV where a comma is the decimal mark).
 */
export function readCsv(text: string, tabs = false): string[][] {
  const firstLine = text.slice(0, text.indexOf("\n") + 1 || undefined);
  const separator = tabs ? "\t" : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === separator) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length) rows.push([...row, cell]);
  return rows;
}
