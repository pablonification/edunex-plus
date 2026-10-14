// An old Excel workbook (.xls, Excel 97–2003) as the viewer shows it: each
// visible sheet's cells as the text Excel would show, the same as a .xlsx
// (./sheets.ts, whose rules for dates and numbers it shares). The file is a
// compound file (../../core/compound-file.ts) whose Workbook stream is a run
// of BIFF8 records: the workbook's own (its sheets, shared strings, number
// formats, cell styles), then each sheet's cells. Only the values are kept;
// a formula shows the result Excel saved with it. Loaded on first use, its own
// chunk. Nothing in it runs, and every length is checked against the bytes: a
// broken or hostile file throws, and the viewer offers Download instead.
import { readCompoundFile } from "../../core/compound-file";
import { excelDate, excelNumber, filled, isDateFormat, putCell, type Sheet } from "./sheets";

const BOF = 0x0809;
const EOF = 0x000a;
const CONTINUE = 0x003c;
/** The BOF of Excel 97 and later (BIFF8); Excel 95's is 0x0500. */
const BIFF8 = 0x0600;
/** How Excel shows an error a cell or formula holds, by its code. */
const ERRORS: Readonly<Record<number, string>> = {
  0: "#NULL!",
  7: "#DIV/0!",
  15: "#VALUE!",
  23: "#REF!",
  29: "#NAME?",
  36: "#NUM!",
  42: "#N/A",
};

/** A record: its type, its data, and its CONTINUE records' data after it. */
interface BiffRecord {
  type: number;
  data: Uint8Array;
  view: DataView;
  parts: Uint8Array[];
}

/** The workbook's visible sheets, in their order. Throws when it isn't an Excel 97–2003 workbook it can read: locked, from Excel 95 or older, or broken. */
export function readXls(bytes: Uint8Array): Sheet[] {
  const stream = readCompoundFile(bytes).stream("Workbook");
  if (!stream) throw new Error("Not an Excel 97–2003 workbook");
  const globals = records(stream, 0);
  const first = globals.next().value;
  if (!first || first.type !== BOF || first.data.length < 4 || first.view.getUint16(0, true) !== BIFF8) throw new Error("Not an Excel 97–2003 workbook");

  let since1904 = false;
  let shared: string[] = [];
  const formats = new Map<number, string>();
  /** Each cell style's number format, in their order (a cell names its style by its place here). */
  const styles: number[] = [];
  const sheets: { at: number; name: string }[] = [];
  for (const record of globals) {
    const { type, data, view } = record;
    if (type === EOF) break;
    if (type === 0x002f) throw new Error("A locked workbook");
    if (type === 0x0022 && data.length >= 2) since1904 = view.getUint16(0, true) === 1;
    else if (type === 0x041e && data.length >= 5) formats.set(view.getUint16(0, true), new Pieces(record.parts, 2).string());
    else if (type === 0x00e0 && data.length >= 4) styles.push(view.getUint16(2, true));
    // A sheet: where its records start, whether it's hidden (low two bits), what kind it is (0: a worksheet), its name.
    else if (type === 0x0085 && data.length >= 8 && (data[4] & 3) === 0 && data[5] === 0)
      sheets.push({ at: view.getUint32(0, true), name: new Pieces(record.parts, 6).string(true) });
    else if (type === 0x00fc && data.length >= 8) shared = readSharedStrings(record);
  }
  const dates = styles.map((format) => isDateFormat(format, formats.get(format)));
  const number = (style: number, value: number) => (dates[style] ? excelDate(value, since1904) : excelNumber(value));

  // Sheets each have their own stretch of the stream, so reading them all reads it about once. A file whose sheets all point at
  // the same big one would be read again and again: past twice over, it's broken.
  const budget = { records: stream.length / 2 };
  const read = sheets.map(({ at, name }) => ({ name, rows: readCells(stream, at, shared, number, budget) }));
  if (!read.length) throw new Error("No sheet to show");
  return read;
}

/** A sheet's cells as text, row by row, from its records at `at` to its EOF (a chart inside it has a BOF and EOF of its own). */
function readCells(
  stream: Uint8Array,
  at: number,
  shared: readonly string[],
  number: (style: number, value: number) => string,
  budget: { records: number },
): string[][] {
  const rows: string[][] = [];
  const set = (row: number, column: number, text: string) => putCell(rows, row, column, text);
  /** A formula whose text result comes in the STRING record after it. */
  let pending: { row: number; column: number } | null = null;
  let depth = 0;
  for (const record of records(stream, at)) {
    if (--budget.records < 0) throw new Error("A broken workbook");
    const { type, data, view } = record;
    if (depth === 0 && (type !== BOF || data.length < 4 || view.getUint16(0, true) !== BIFF8)) throw new Error("A broken workbook");
    if (type === BOF) {
      depth++;
      continue;
    }
    if (type === EOF && --depth <= 0) break;
    if (depth !== 1 || data.length < 6) continue;
    const row = view.getUint16(0, true);
    const column = view.getUint16(2, true);
    const style = view.getUint16(4, true);
    if (type === 0x00fd && data.length >= 10) set(row, column, shared[view.getUint32(6, true)] ?? "");
    else if (type === 0x0204 && data.length >= 9) set(row, column, new Pieces(record.parts, 6).string());
    else if (type === 0x0203 && data.length >= 14) set(row, column, number(style, view.getFloat64(6, true)));
    else if (type === 0x027e && data.length >= 10) set(row, column, number(style, rk(view.getUint32(6, true))));
    else if (type === 0x00bd) {
      // Several RK numbers in a row: a style and a number per cell from the first column, the last column at the end.
      for (let i = 0; 4 + i * 6 + 6 <= data.length - 2; i++) set(row, column + i, number(view.getUint16(4 + i * 6, true), rk(view.getUint32(6 + i * 6, true))));
    } else if (type === 0x0205 && data.length >= 8) set(row, column, data[7] ? (ERRORS[data[6]] ?? "#N/A") : data[6] ? "TRUE" : "FALSE");
    else if (type === 0x0006 && data.length >= 14) {
      pending = null;
      // The result Excel saved: a number, or (marked by 0xFFFF in its last two bytes) text that follows, TRUE or FALSE, an error, or nothing.
      if (view.getUint16(12, true) !== 0xffff) set(row, column, number(style, view.getFloat64(6, true)));
      else if (data[6] === 0) pending = { row, column };
      else if (data[6] === 1) set(row, column, data[8] ? "TRUE" : "FALSE");
      else if (data[6] === 2) set(row, column, ERRORS[data[8]] ?? "#N/A");
    } else if (type === 0x0207 && pending) {
      set(pending.row, pending.column, new Pieces(record.parts).string());
      pending = null;
    }
  }
  return filled(rows);
}

/** An RK number: a whole number or the top of a float, perhaps ×100. */
function rk(value: number): number {
  let n: number;
  if (value & 2) n = (value | 0) >> 2;
  else {
    const view = new DataView(new ArrayBuffer(8));
    view.setUint32(4, value & 0xfffffffc, true);
    n = view.getFloat64(0, true);
  }
  return value & 1 ? n / 100 : n;
}

/** The shared strings (SST): each string's text, read across the CONTINUE records it spills into. */
function readSharedStrings(record: BiffRecord): string[] {
  const unique = record.view.getUint32(4, true);
  const pieces = new Pieces(record.parts, 8);
  const strings: string[] = [];
  // Each string takes 3 bytes at least: no more strings than that.
  for (let i = 0; i < unique && !pieces.done(); i++) strings.push(pieces.richString());
  return strings;
}

/** The records from `at` on, each with its CONTINUE records' data. Throws when one runs past the stream's end. */
function* records(stream: Uint8Array, at: number): Generator<BiffRecord> {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  if (at > stream.length) throw new Error("A broken workbook");
  while (at + 4 <= stream.length) {
    const type = view.getUint16(at, true);
    const size = view.getUint16(at + 2, true);
    if (at + 4 + size > stream.length) throw new Error("A broken workbook");
    const data = stream.subarray(at + 4, at + 4 + size);
    const parts = [data];
    at += 4 + size;
    while (at + 4 <= stream.length && view.getUint16(at, true) === CONTINUE) {
      const more = view.getUint16(at + 2, true);
      if (at + 4 + more > stream.length) throw new Error("A broken workbook");
      parts.push(stream.subarray(at + 4, at + 4 + more));
      at += 4 + more;
    }
    yield { type, data, view: new DataView(data.buffer, data.byteOffset, data.byteLength), parts };
  }
}

/**
 * A record's data and its CONTINUE records', read as one: except that text
 * split between two records starts again in the next with a byte saying
 * whether it's one byte per character (Latin-1) or two (UTF-16).
 */
class Pieces {
  private part = 0;
  constructor(
    private readonly parts: readonly Uint8Array[],
    private at = 0,
  ) {}

  done(): boolean {
    while (this.part < this.parts.length && this.at >= this.parts[this.part].length) this.next();
    return this.part >= this.parts.length;
  }

  private next() {
    this.part++;
    this.at = 0;
  }

  byte(): number {
    if (this.done()) throw new Error("A broken workbook");
    return this.parts[this.part][this.at++];
  }

  u16(): number {
    return this.byte() | (this.byte() << 8);
  }

  u32(): number {
    return (this.u16() | (this.u16() << 16)) >>> 0;
  }

  skip(count: number) {
    while (count > 0) {
      if (this.done()) throw new Error("A broken workbook");
      const step = Math.min(count, this.parts[this.part].length - this.at);
      this.at += step;
      count -= step;
    }
  }

  /** `length` characters, the first in one or two bytes by `wide`, and so on after each record's flag byte. */
  chars(length: number, wide: boolean): string {
    let text = "";
    for (let i = 0; i < length; i++) {
      if (this.at >= (this.parts[this.part]?.length ?? 0)) {
        this.next();
        wide = (this.byte() & 1) === 1;
      }
      text += String.fromCharCode(wide ? this.u16() : this.byte());
    }
    return text;
  }

  /** A string: its length (16-bit, or 8-bit when `short`), a flag byte, its characters. */
  string(short = false): string {
    const length = short ? this.byte() : this.u16();
    return this.chars(length, (this.byte() & 1) === 1);
  }

  /** A shared string: its length, flags, the counts of its formatting runs and phonetic data, its characters, then those (skipped). */
  richString(): string {
    const length = this.u16();
    const flags = this.byte();
    const runs = flags & 0x08 ? this.u16() : 0;
    const phonetic = flags & 0x04 ? this.u32() : 0;
    const text = this.chars(length, (flags & 1) === 1);
    this.skip(runs * 4 + phonetic);
    return text;
  }
}
