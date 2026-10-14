// An old Word document (.doc, Word 97–2003) as the viewer shows it: its main
// text, paragraph by paragraph, its tables as rows of cells, split into pages
// where it breaks a page (a break character, or a paragraph set to start one).
// Only the text, no pictures, styles or layout (those are in the file,
// downloaded). The file is a compound file (../../core/compound-file.ts): the
// File Information Block at the start of its WordDocument stream says how long
// the text is and where its piece table is (in the 0Table or 1Table stream),
// and the piece table where each run of text is. Which paragraphs are in a
// table comes from their properties. Loaded on first use, its own chunk.
// Nothing in it runs, and every offset and count is checked against the bytes:
// a broken or hostile file throws, and the viewer offers Download instead.
import { readCompoundFile } from "../../core/compound-file";

/** A paragraph's text (its line breaks as "\n"), or a table's rows of cells. */
export type Block = string | { rows: string[][] };

/** cp1252's characters for 0x80–0x9F, where it differs from Latin-1: how Word writes text in a byte per character. */
const CP1252 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";

const PARAGRAPH = 0x0d;
const CELL = 0x07;
const FIELD_START = 0x13;
const FIELD_RESULT = 0x14;
const FIELD_END = 0x15;
/** The most paragraphs and table rows shown (a book's worth), and how deep fields may nest (Word allows 20). Past either, the file is downloaded instead. */
const MAX_BLOCKS = 100_000;
const MAX_FIELD_DEPTH = 256;
/** Marks with nothing to show: a picture's or drawing's anchor, a footnote's or comment's number, an optional hyphen. */
const DROPPED = new Set([0x01, 0x02, 0x05, 0x08, 0x1f]);

/** Where a paragraph sits: in a table's cell, or the mark that ends a row; on a new page. Null when its properties can't be found. */
type Place = { inTable: boolean; rowEnd: boolean; newPage: boolean } | null;

/**
 * The document's main text as pages of paragraphs and tables. Throws when it
 * isn't a Word 97–2003 document it can read: locked with a password, from Word
 * 95 or older, or broken.
 */
export function readDoc(bytes: Uint8Array): Block[][] {
  const file = readCompoundFile(bytes);
  const word = file.stream("WordDocument");
  if (!word || word.length < 154) throw new Error("Not a Word document");
  const view = new DataView(word.buffer, word.byteOffset, word.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  // The File Information Block: its base, then lists of 16-bit and 32-bit values, then pairs of an offset and a length.
  if (u16(0) !== 0xa5ec) throw new Error("Not a Word document");
  if (u16(2) < 106) throw new Error("A Word 95 or older document");
  const flags = u16(10);
  if (flags & 0x0100) throw new Error("A locked document");
  const longs = 34 + u16(32) * 2;
  const pairs = longs + 2 + u16(longs) * 4;
  if (u16(longs) < 4 || pairs + 2 + 34 * 8 > word.length || u16(pairs) < 34) throw new Error("A broken Word document");
  const ccpText = u32(longs + 2 + 12);
  const pair = (index: number) => ({ fc: u32(pairs + 2 + index * 8), lcb: u32(pairs + 2 + index * 8 + 4) });
  if (ccpText > word.length) throw new Error("A broken Word document");

  const table = file.stream(flags & 0x0200 ? "1Table" : "0Table");
  if (!table) throw new Error("A broken Word document");
  const slice = ({ fc, lcb }: { fc: number; lcb: number }) => {
    if (fc + lcb > table.length) throw new Error("A broken Word document");
    return table.subarray(fc, fc + lcb);
  };
  const pieces = readPieces(slice(pair(33)));
  const place = tablePlaces(word, slice(pair(13)), file.stream("Data"));

  const pages: Block[][] = [[]];
  let text = "";
  /** The paragraphs of the cell being read, the cells of the row, the rows of the table. */
  let cellParts: string[] = [];
  let row: string[] = [];
  let rows: string[][] = [];
  /** Each open field: whether its result has started (before that, it's the field's code). */
  const fields: boolean[] = [];
  let inCode = 0;
  let last = -1;
  let made = 0;
  const addBlock = () => {
    if (++made > MAX_BLOCKS) throw new Error("Too long to show");
  };
  const page = () => pages[pages.length - 1];
  const endRow = () => {
    if (row.length) {
      addBlock();
      rows.push(row);
    }
    row = [];
  };
  const endTable = () => {
    endRow();
    if (rows.length) page().push({ rows });
    cellParts = [];
    row = [];
    rows = [];
  };
  const endParagraph = (newPage = false) => {
    endTable();
    if (newPage && page().length) pages.push([]);
    // A page starts at its first line of text, not with the empty paragraphs after a break.
    if (text || page().length) {
      addBlock();
      page().push(text);
    }
    text = "";
  };

  let read = 0;
  for (const piece of pieces) {
    if (read >= ccpText) break;
    const length = Math.min(piece.end, ccpText) - piece.start;
    const width = piece.compressed ? 1 : 2;
    if (length < 0 || piece.fc + length * width > word.length) throw new Error("A broken Word document");
    read += length;
    for (let i = 0; i < length; i++) {
      const fc = piece.fc + i * width;
      const raw = piece.compressed ? word[fc] : u16(fc);
      const code = piece.compressed && raw >= 0x80 && raw <= 0x9f ? CP1252.charCodeAt(raw - 0x80) : raw;
      // A field shows its result, not its code (between its start and its separator).
      if (code === FIELD_START) {
        if (fields.length >= MAX_FIELD_DEPTH) throw new Error("Fields nested too deep");
        fields.push(false);
        inCode++;
      } else if (code === FIELD_RESULT && fields.length && !fields[fields.length - 1]) {
        fields[fields.length - 1] = true;
        inCode--;
      } else if (code === FIELD_END && fields.length) {
        if (!fields.pop()) inCode--;
      } else if (inCode > 0) {
        // The field's code.
      } else if (code === PARAGRAPH) {
        // A paragraph in a cell is a line of that cell; without its properties, it is while a row is open.
        const at = place(fc);
        if (at ? at.inTable : row.length > 0) {
          cellParts.push(text);
          text = "";
        } else endParagraph(at?.newPage);
      } else if (code === CELL) {
        // A row ends with a mark of its own after its last cell's; without properties, a mark straight after a cell's is taken as one.
        const at = place(fc);
        if (at ? at.rowEnd : last === CELL && !text && !cellParts.length) endRow();
        else {
          row.push([...cellParts, text].join("\n"));
          cellParts = [];
        }
        text = "";
      } else if (code === 0x0c) {
        // A page or section break: what follows starts a new page.
        if (text) endParagraph();
        endTable();
        if (page().length) pages.push([]);
      } else if (code === 0x0b) text += "\n";
      else if (code === 0x1e) text += "-";
      else if (code === 0x09 || (code >= 0x20 && !DROPPED.has(code))) text += String.fromCharCode(code);
      if (inCode === 0) last = code;
    }
  }
  if (text) endParagraph();
  endTable();
  // Empty paragraphs at a page's end are only space before the break.
  for (const blocks of pages) while (blocks.length && blocks[blocks.length - 1] === "") blocks.pop();
  const shown = pages.filter((blocks) => blocks.length);
  return shown.length ? shown : [[]];
}

/** The piece table, from the Clx: where each run of the text is in the WordDocument stream, in a byte (cp1252) or two (UTF-16) per character. */
function readPieces(clx: Uint8Array): { start: number; end: number; fc: number; compressed: boolean }[] {
  const view = new DataView(clx.buffer, clx.byteOffset, clx.byteLength);
  let at = 0;
  // Formatting kept with the pieces (Prc) comes first; it's skipped.
  while (at < clx.length && clx[at] === 0x01) {
    if (at + 3 > clx.length || view.getInt16(at + 1, true) < 0) throw new Error("A broken Word document");
    at += 3 + view.getInt16(at + 1, true);
  }
  if (clx[at] !== 0x02 || at + 5 > clx.length) throw new Error("A broken Word document");
  const lcb = view.getUint32(at + 1, true);
  const start = at + 5;
  const n = (lcb - 4) / 12;
  if (start + lcb > clx.length || !Number.isInteger(n) || n < 1) throw new Error("A broken Word document");
  const pieces = [];
  for (let i = 0; i < n; i++) {
    const fc = view.getUint32(start + (n + 1) * 4 + i * 8 + 2, true);
    const compressed = (fc & 0x40000000) !== 0;
    const offset = fc & 0x3fffffff;
    pieces.push({
      start: view.getUint32(start + i * 4, true),
      end: view.getUint32(start + (i + 1) * 4, true),
      fc: compressed ? Math.floor(offset / 2) : offset,
      compressed,
    });
  }
  return pieces;
}

/**
 * Where a paragraph sits in a table, by the stream offset of its mark: from
 * the paragraph properties in the 512-byte pages (FKPs) the PlcBtePapx lists.
 * Each run's answer is worked out once.
 */
function tablePlaces(word: Uint8Array, plc: Uint8Array, data: Uint8Array | null): (fc: number) => Place {
  const n = (plc.length - 4) / 8;
  if (!Number.isInteger(n) || n < 1) return () => null;
  const view = new DataView(plc.buffer, plc.byteOffset, plc.byteLength);
  const known = new Map<number, Place>();
  return (fc) => {
    // The page whose run of offsets holds this one.
    let low = 0;
    let high = n - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (view.getUint32(mid * 4, true) <= fc) low = mid;
      else high = mid - 1;
    }
    const pn = view.getUint32((n + 1) * 4 + low * 4, true) & 0x3fffff;
    const page = word.subarray(pn * 512, pn * 512 + 512);
    const runs = page[511];
    if (page.length < 512 || runs < 1 || runs > 0x1d) return null;
    const pageView = new DataView(page.buffer, page.byteOffset, 512);
    for (let i = 0; i < runs; i++) {
      if (fc < pageView.getUint32(i * 4, true) || fc >= pageView.getUint32(i * 4 + 4, true)) continue;
      const key = pn * 32 + i;
      if (!known.has(key)) known.set(key, readPlace(page, page[(runs + 1) * 4 + i * 13] * 2, data));
      return known.get(key) ?? null;
    }
    return null;
  };
}

/** Where one paragraph sits, from its properties (PapxInFkp at `offset` in its page): sprmPFInTable, sprmPFTtp, sprmPFPageBreakBefore. */
function readPlace(page: Uint8Array, offset: number, data: Uint8Array | null): Place {
  const place = { inTable: false, rowEnd: false, newPage: false };
  if (offset === 0) return place;
  // Its length in words: from its first byte, or the next when that's 0.
  const cb = page[offset];
  const start = cb ? offset + 1 : offset + 2;
  const end = Math.min(start + (cb ? cb * 2 - 1 : page[offset + 1] * 2), 511);
  // After the style's number come the properties (sprms).
  if (!readSprms(page, start + 2, end, place, data)) return null;
  return place;
}

/** Reads sprms from `at` to `end` into `place`; false when one can't be stepped over. */
function readSprms(bytes: Uint8Array, at: number, end: number, place: NonNullable<Place>, data: Uint8Array | null): boolean {
  while (at + 2 <= end) {
    const sprm = bytes[at] | (bytes[at + 1] << 8);
    at += 2;
    if (sprm === 0x2416) place.inTable = bytes[at] !== 0;
    else if (sprm === 0x2417) place.rowEnd = bytes[at] !== 0;
    else if (sprm === 0x2407) place.newPage = bytes[at] !== 0;
    // Properties too long for the page are in the Data stream: a 2-byte length, then the sprms.
    else if (sprm === 0x6646 && data && at + 4 <= end) {
      const from = (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)) + bytes[at + 3] * 0x1000000;
      if (from + 2 > data.length) return false;
      return readSprms(data, from + 2, Math.min(from + 2 + (data[from] | (data[from + 1] << 8)), data.length), place, null);
    }
    // The operand's size comes from the sprm's top three bits; a variable one says its own (sprmTDefTable in two bytes).
    const kind = sprm >> 13;
    if (kind !== 6) at += [1, 1, 2, 4, 2, 2, 0, 3][kind];
    else if (sprm === 0xd608 || sprm === 0xd606) at += (bytes[at] | (bytes[at + 1] << 8)) + 1;
    else if (sprm === 0xc615 && bytes[at] === 255) return true;
    else at += bytes[at] + 1;
  }
  return true;
}
