// Tiny made-up old Office files for tests (Word, Excel and PowerPoint
// 97–2003: .doc, .xls, .ppt), written here byte by byte: a compound file
// holding only the streams and records a reader needs, in the real shape. No
// real course content.

const END_OF_CHAIN = 0xfffffffe;
const FREE = 0xffffffff;
const NO_ENTRY = 0xffffffff;

/** Little-endian bytes, appended to as it's written. */
class Bytes {
  readonly out: number[] = [];
  get length() {
    return this.out.length;
  }
  u8(...values: number[]) {
    for (const v of values) this.out.push(v & 0xff);
    return this;
  }
  u16(...values: number[]) {
    for (const v of values) this.u8(v, v >> 8);
    return this;
  }
  u32(...values: number[]) {
    for (const v of values) this.u8(v, v >> 8, v >> 16, v >>> 24);
    return this;
  }
  f64(value: number) {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value, true);
    return this.u8(...new Uint8Array(view.buffer));
  }
  utf16(text: string) {
    for (let i = 0; i < text.length; i++) this.u16(text.charCodeAt(i));
    return this;
  }
  latin1(text: string) {
    for (let i = 0; i < text.length; i++) this.u8(text.charCodeAt(i));
    return this;
  }
  add(bytes: ArrayLike<number>) {
    for (let i = 0; i < bytes.length; i++) this.out.push(bytes[i]);
    return this;
  }
  pad(to: number, value = 0) {
    while (this.out.length < to) this.out.push(value);
    return this;
  }
  set32(at: number, value: number) {
    for (let i = 0; i < 4; i++) this.out[at + i] = (value >>> (i * 8)) & 0xff;
  }
  bytes() {
    return new Uint8Array(this.out);
  }
}

/**
 * A compound file with these streams at its root: version 3 (512-byte
 * sectors) unless `version` is 4 (4096), streams under 4096 bytes in the mini
 * stream. `fatSectors`: at least this many FAT sectors (more than 109 need
 * DIFAT sectors of their own).
 */
export function aCompoundFile(streams: Record<string, Uint8Array>, { version = 3, fatSectors = 0 } = {}): Uint8Array {
  const size = version === 4 ? 4096 : 512;
  const per = size / 4;
  const names = Object.keys(streams);
  const sectorsOf = (length: number, unit = size) => Math.ceil(length / unit);

  // Small streams go in the mini stream, one after the other, chained in the mini FAT.
  const mini = new Bytes();
  const miniFat: number[] = [];
  const starts = new Map<string, number>();
  for (const name of names) {
    const data = streams[name];
    if (data.length >= 4096 || data.length === 0) continue;
    const first = mini.length / 64;
    starts.set(name, first);
    const count = sectorsOf(data.length, 64);
    for (let i = 0; i < count; i++) miniFat.push(i === count - 1 ? END_OF_CHAIN : first + i + 1);
    mini.add(data).pad(mini.length + ((64 - (data.length % 64)) % 64));
  }
  const miniFatBytes = new Bytes();
  miniFatBytes.u32(...miniFat).pad(sectorsOf(miniFat.length * 4) * size, 0xff);

  // The directory: the root, then each stream, as a balanced tree of siblings.
  const entryCount = names.length + 1;
  const directory = new Bytes();
  const left = new Array<number>(entryCount).fill(NO_ENTRY);
  const right = new Array<number>(entryCount).fill(NO_ENTRY);
  const tree = (low: number, high: number): number => {
    if (low > high) return NO_ENTRY;
    const middle = (low + high) >> 1;
    left[middle] = tree(low, middle - 1);
    right[middle] = tree(middle + 1, high);
    return middle;
  };
  const rootChild = tree(1, names.length);

  // The sectors after the FAT and DIFAT: the directory, the mini FAT, the mini stream, then the big streams.
  const regions: { bytes: ArrayLike<number>; name?: string }[] = [
    { bytes: new Uint8Array(sectorsOf(entryCount * 128) * size) },
    { bytes: miniFatBytes.out },
    { bytes: mini.out },
    ...names.filter((name) => streams[name].length >= 4096).map((name) => ({ bytes: streams[name], name })),
  ];
  const dataSectors = regions.reduce((sum, region) => sum + sectorsOf(region.bytes.length), 0);
  const difatFor = (fat: number) => Math.max(0, Math.ceil((fat - 109) / (per - 1)));
  let fatCount = 1;
  while (fatCount * per < fatCount + difatFor(fatCount) + dataSectors) fatCount++;
  fatCount = Math.max(fatCount, fatSectors);
  const difatCount = difatFor(fatCount);

  const fat = new Array<number>(fatCount * per).fill(FREE);
  for (let i = 0; i < fatCount; i++) fat[i] = 0xfffffffd;
  for (let i = 0; i < difatCount; i++) fat[fatCount + i] = 0xfffffffc;
  let next = fatCount + difatCount;
  const firstSector: number[] = [];
  for (const region of regions) {
    const count = sectorsOf(region.bytes.length);
    firstSector.push(count ? next : END_OF_CHAIN);
    for (let i = 0; i < count; i++) fat[next + i] = i === count - 1 ? END_OF_CHAIN : next + i + 1;
    next += count;
  }
  const [dirStart, miniFatStart, miniStart] = firstSector;

  const entry = (name: string, type: number, index: number, start: number, length: number) => {
    const at = directory.length;
    directory.utf16(name).pad(at + 64);
    directory.u16((name.length + 1) * 2).u8(type, 1);
    directory.u32(left[index], right[index], index === 0 ? rootChild : NO_ENTRY);
    directory.pad(at + 116).u32(start, length, 0);
  };
  entry("Root Entry", 5, 0, miniStart, mini.length);
  names.forEach((name, i) => {
    const length = streams[name].length;
    const big = regions.findIndex((region) => region.name === name);
    entry(name, 2, i + 1, length === 0 ? END_OF_CHAIN : big >= 0 ? firstSector[big] : starts.get(name)!, length);
  });
  directory.pad(sectorsOf(directory.length) * size);
  for (let i = entryCount; i < directory.length / 128; i++) for (const at of [68, 72, 76]) directory.set32(i * 128 + at, NO_ENTRY);
  regions[0].bytes = directory.out;

  const file = new Bytes();
  file.u8(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1).pad(24);
  file.u16(0x3e, version, 0xfffe, version === 4 ? 12 : 9, 6).pad(40);
  file.u32(version === 4 ? sectorsOf(directory.length) : 0, fatCount, dirStart, 0, 4096);
  file.u32(miniFat.length ? miniFatStart : END_OF_CHAIN, sectorsOf(miniFat.length * 4));
  file.u32(difatCount ? fatCount : END_OF_CHAIN, difatCount);
  for (let i = 0; i < 109; i++) file.u32(i < fatCount ? i : FREE);
  file.pad(size);
  for (let i = 0; i < fatCount * per; i++) file.u32(fat[i]);
  // Each DIFAT sector: the FAT's next sectors, then the next DIFAT sector.
  for (let d = 0; d < difatCount; d++) {
    for (let i = 0; i < per - 1; i++) {
      const sector = 109 + d * (per - 1) + i;
      file.u32(sector < fatCount ? sector : FREE);
    }
    file.u32(d === difatCount - 1 ? END_OF_CHAIN : fatCount + d + 1);
  }
  for (const region of regions) file.add(region.bytes).pad(file.length + ((size - (region.bytes.length % size)) % size));
  return file.bytes();
}

/** Where the FAT's first sector is, and sets FAT entry `sector` to `value` (to break a chain on purpose). */
export function setFatEntry(file: Uint8Array, sector: number, value: number): Uint8Array {
  const copy = file.slice();
  const view = new DataView(copy.buffer);
  const size = 1 << view.getUint16(30, true);
  view.setUint32((view.getUint32(76, true) + 1) * size + sector * 4, value, true);
  return copy;
}

const CP1252_OUT: Readonly<Record<string, number>> = { "€": 0x80, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "–": 0x96, "—": 0x97 };

/**
 * A Word 97–2003 document: paragraphs (`{ newPage }`: one set to start a
 * page), and tables (rows of cells; "\r" in a cell is a second paragraph in
 * it), with Word's own marks (fields, breaks) left in the strings. Its text is split in two pieces, the first a byte per
 * character (cp1252) and the second UTF-16, unless `wide` (all UTF-16).
 * `marks: false` leaves out where the paragraphs' properties are (which say
 * what's in a table).
 */
export function aDoc(
  blocks: (string | { newPage: string } | string[][])[],
  { wide = false, marks = true, locked = false, word95 = false }: { wide?: boolean; marks?: boolean; locked?: boolean; word95?: boolean } = {},
): Uint8Array {
  let text = "";
  const paragraphs: { at: number; inTable: boolean; rowEnd: boolean; cells: number; newPage?: boolean }[] = [];
  const end = (mark: string, inTable: boolean, rowEnd = false, cells = 0, newPage = false) => {
    paragraphs.push({ at: text.length, inTable, rowEnd, cells, newPage });
    text += mark;
  };
  for (const block of blocks) {
    if (typeof block === "string" || "newPage" in block) {
      text += typeof block === "string" ? block : block.newPage;
      end("\r", false, false, 0, typeof block !== "string");
      continue;
    }
    for (const row of block) {
      for (const cell of row) {
        const lines = cell.split("\r");
        lines.forEach((line, i) => {
          text += line;
          end(i === lines.length - 1 ? "\u0007" : "\r", true);
        });
      }
      end("\u0007", true, true, row.length);
    }
  }

  // The text: from 0x800, in one or two pieces.
  const split = wide ? 0 : Math.ceil(text.length / 2);
  const pieces = [
    { from: 0, to: split, width: 1 },
    { from: split, to: text.length, width: 2 },
  ].filter((piece) => piece.to > piece.from);
  const word = new Bytes().pad(0x800);
  const placed = pieces.map((piece) => {
    const at = word.length;
    for (const char of text.slice(piece.from, piece.to)) {
      if (piece.width === 2) word.utf16(char);
      else word.u8(CP1252_OUT[char] ?? char.charCodeAt(0));
    }
    word.pad(word.length + (word.length % 2));
    return { ...piece, at };
  });
  const fcOf = (cp: number) => {
    const piece = placed.find((p) => cp >= p.from && cp < p.to)!;
    return { fc: piece.at + (cp - piece.from) * piece.width, width: piece.width };
  };

  // The paragraphs' properties: pages of up to 10 runs, each run ending at a paragraph's mark, runs alike sharing theirs.
  const fkpFirst = Math.ceil(word.length / 512);
  word.pad(fkpFirst * 512);
  const plcFcs: number[] = [];
  const plcPages: number[] = [];
  let runStart = placed[0]?.at ?? 0x800;
  for (let p = 0; p < paragraphs.length; p += 10) {
    const group = paragraphs.slice(p, p + 10);
    const page = new Bytes().pad(512);
    const fcs = [runStart];
    const written = new Map<string, number>();
    let papxAt = 511;
    group.forEach((paragraph, i) => {
      const { fc, width } = fcOf(paragraph.at);
      fcs.push(fc + width);
      const sprms = new Bytes().u16(0);
      if (paragraph.inTable) sprms.u16(0x2416).u8(1);
      if (paragraph.newPage) sprms.u16(0x2407).u8(1);
      // A row's end also carries the row's own properties (sprmTDefTable, of variable length) before its mark.
      if (paragraph.rowEnd) {
        const rest = 1 + (paragraph.cells + 1) * 2 + paragraph.cells * 20;
        sprms
          .u16(0xd608)
          .u16(rest + 1)
          .u8(paragraph.cells)
          .pad(sprms.length + rest - 1);
        sprms.u16(0x2417).u8(1);
      }
      const papx = sprms.length % 2 ? [(sprms.length + 1) / 2, ...sprms.out] : [0, sprms.length / 2, ...sprms.out];
      if (!written.has(papx.join())) {
        papxAt = (papxAt - papx.length) & ~1;
        if (papxAt < (group.length + 1) * 4 + group.length * 13) throw new Error("Too much in one FKP page");
        for (let b = 0; b < papx.length; b++) page.out[papxAt + b] = papx[b];
        written.set(papx.join(), papxAt);
      }
      page.out[(group.length + 1) * 4 + i * 13] = written.get(papx.join())! / 2;
    });
    fcs.forEach((fc, i) => {
      page.set32(i * 4, fc);
    });
    page.out[511] = group.length;
    plcFcs.push(runStart);
    plcPages.push(fkpFirst + p / 10);
    runStart = fcs[fcs.length - 1];
    word.add(page.out);
  }
  plcFcs.push(runStart);
  // Word's own streams are at least 4096 bytes.
  word.pad(Math.max(word.length, 4096));

  const table = new Bytes();
  const clx = new Bytes().u32(...placed.map((p) => p.from), text.length);
  for (const piece of placed)
    clx
      .u16(0)
      .u32(piece.width === 1 ? (piece.at * 2) | 0x40000000 : piece.at)
      .u16(0);
  table.u8(2).u32(clx.length).add(clx.out);
  const plcAt = table.length;
  table.u32(...plcFcs, ...plcPages);

  // The File Information Block.
  const fib = new Bytes();
  fib.u16(0xa5ec, word95 ? 0x65 : 0xc1, 0, 0x0409, 0, 0x0200 | (locked ? 0x0100 : 0), 0xbf).pad(32);
  fib
    .u16(14)
    .pad(34 + 28)
    .u16(22);
  const longs = fib.length;
  fib
    .u32(word.length, 0, 0, text.length)
    .pad(longs + 88)
    .u16(0x5d);
  const pairs = fib.length;
  fib.pad(pairs + 0x5d * 8);
  fib.set32(pairs + 13 * 8, plcAt);
  fib.set32(pairs + 13 * 8 + 4, marks ? (plcFcs.length + plcPages.length) * 4 : 0);
  fib.set32(pairs + 33 * 8, 0);
  fib.set32(pairs + 33 * 8 + 4, plcAt);
  for (let i = 0; i < fib.length; i++) word.out[i] = fib.out[i];
  return aCompoundFile({ WordDocument: word.bytes(), "1Table": table.bytes() });
}

/** A cell of an old workbook: text (a shared string), a number, TRUE or FALSE, a date (Excel's day number), an RK number, a formula's saved result, an inline string (LABEL), an error. */
export type XlsCell =
  | string
  | number
  | boolean
  | null
  | { date: number; custom?: boolean }
  | { rk: number }
  | { formula: number | string | boolean }
  | { label: string }
  | { error: number };

const record = (out: Bytes, type: number, data: Bytes | number[]) => {
  const bytes = data instanceof Bytes ? data.out : data;
  out.u16(type, bytes.length).add(bytes);
};
const xlString = (text: string, short = false) => {
  const wide = [...text].some((c) => c.charCodeAt(0) > 0xff);
  const out = short ? new Bytes().u8(text.length, wide ? 1 : 0) : new Bytes().u16(text.length).u8(wide ? 1 : 0);
  return wide ? out.utf16(text) : out.latin1(text);
};

/**
 * An Excel 97–2003 workbook: each sheet's rows of cells, by name; `hidden`
 * sheets are in it but hidden. Its records are cut at `recordSize` bytes,
 * as Excel cuts them at 8224, the shared strings carrying on in CONTINUE
 * records (a string cut in two starts again with its flag byte).
 */
export function anXls(
  sheets: Record<string, XlsCell[][]>,
  {
    hidden = [] as string[],
    date1904 = false,
    locked = false,
    excel95 = false,
    recordSize = 8224,
  }: { hidden?: string[]; date1904?: boolean; locked?: boolean; excel95?: boolean; recordSize?: number } = {},
): Uint8Array {
  const shared: string[] = [];
  const names = Object.keys(sheets);
  const bof = (kind: number) => new Bytes().u16(excel95 ? 0x0500 : 0x0600, kind, 0x0dbb, 0x07cc).u32(0, 6);

  const sheetStreams = names.map((name) => {
    const out = new Bytes();
    record(out, 0x0809, bof(0x0010));
    sheets[name].forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        const head = (style: number) => new Bytes().u16(r, c, style);
        if (cell === null || cell === "") continue;
        if (typeof cell === "string") {
          if (!shared.includes(cell)) shared.push(cell);
          record(out, 0x00fd, head(0).u32(shared.indexOf(cell)));
        } else if (typeof cell === "number") record(out, 0x0203, head(0).f64(cell));
        else if (typeof cell === "boolean") record(out, 0x0205, head(0).u8(cell ? 1 : 0, 0));
        else if ("date" in cell) record(out, 0x0203, head(cell.custom ? 2 : 1).f64(cell.date));
        else if ("label" in cell) record(out, 0x0204, head(0).add(xlString(cell.label).out));
        else if ("error" in cell) record(out, 0x0205, head(0).u8(cell.error, 1));
        else if ("rk" in cell) {
          // A run of RK numbers in one MULRK; a lone one in an RK record.
          const rk = (n: number) => (Number.isInteger(n) ? (n << 2) | 2 : (Math.round(n * 100) << 2) | 3);
          let last = c;
          while (last + 1 < row.length && typeof row[last + 1] === "object" && row[last + 1] !== null && "rk" in (row[last + 1] as object)) last++;
          if (last === c) record(out, 0x027e, head(0).u32(rk(cell.rk)));
          else {
            const data = new Bytes().u16(r, c);
            for (let i = c; i <= last; i++) data.u16(0).u32(rk((row[i] as { rk: number }).rk));
            record(out, 0x00bd, data.u16(last));
            c = last;
          }
        } else if ("formula" in cell) {
          const value = cell.formula;
          const data = head(0);
          if (typeof value === "number") data.f64(value);
          else data.u8(typeof value === "string" ? 0 : 1, 0, typeof value === "boolean" && value ? 1 : 0, 0, 0, 0).u16(0xffff);
          // Its flags, a cache, then the formula itself (here a lone number: tInt 1).
          record(out, 0x0006, data.u16(0).u32(0).u16(3).u8(0x1e).u16(1));
          if (typeof value === "string") record(out, 0x0207, xlString(value));
        }
      }
    });
    record(out, 0x000a, []);
    return out;
  });

  // The shared strings, cut into a record and its CONTINUE records at `recordSize` bytes.
  const sst: Bytes[] = [new Bytes().u32(shared.length, shared.length)];
  const room = () => recordSize - sst[sst.length - 1].length;
  for (const text of shared) {
    if (room() < 3) sst.push(new Bytes());
    let wide = [...text].some((c) => c.charCodeAt(0) > 0xff);
    sst[sst.length - 1].u16(text.length).u8(wide ? 1 : 0);
    let left = text;
    for (;;) {
      const fits = Math.min(left.length, Math.floor(room() / (wide ? 2 : 1)));
      const part = left.slice(0, fits);
      if (wide) sst[sst.length - 1].utf16(part);
      else sst[sst.length - 1].latin1(part);
      left = left.slice(fits);
      if (!left) break;
      wide = [...left].some((c) => c.charCodeAt(0) > 0xff);
      sst.push(new Bytes().u8(wide ? 1 : 0));
    }
  }

  const globals = (positions: number[]) => {
    const out = new Bytes();
    record(out, 0x0809, bof(0x0005));
    if (locked) record(out, 0x002f, new Bytes().u16(0).pad(54));
    record(out, 0x0022, new Bytes().u16(date1904 ? 1 : 0));
    record(out, 0x041e, new Bytes().u16(164).add(xlString("dd/mm/yyyy").out));
    // Cell styles: 0 plain, 1 Excel's own date format (14), 2 the workbook's own date format (164).
    for (const format of [0, 14, 164]) record(out, 0x00e0, new Bytes().u16(0, format).pad(20));
    names.forEach((name, i) => {
      record(
        out,
        0x0085,
        new Bytes()
          .u32(positions[i])
          .u8(hidden.includes(name) ? 1 : 0, 0)
          .add(xlString(name, true).out),
      );
    });
    sst.forEach((part, i) => {
      record(out, i === 0 ? 0x00fc : 0x003c, part);
    });
    record(out, 0x000a, []);
    return out;
  };
  const start = globals(names.map(() => 0)).length;
  const positions = sheetStreams.map((_, i) => start + sheetStreams.slice(0, i).reduce((sum, s) => sum + s.length, 0));
  const stream = globals(positions);
  for (const sheet of sheetStreams) stream.add(sheet.out);
  return aCompoundFile({ Workbook: stream.bytes() });
}

/** A slide of an old presentation: its title, its body's paragraphs (both placeholders), and text boxes of its own. */
export interface PptSlide {
  title?: string;
  body?: string[];
  boxes?: string[];
}

const pptRecord = (type: number, data: Bytes | number[], { container = false, instance = 0 } = {}) => {
  const bytes = data instanceof Bytes ? data.out : data;
  return new Bytes()
    .u16((instance << 4) | (container ? 0xf : 0), type)
    .u32(bytes.length)
    .add(bytes);
};
const pptContainer = (type: number, children: Bytes[], instance = 0) => {
  const data = new Bytes();
  for (const child of children) data.add(child.out);
  return pptRecord(type, data, { container: true, instance });
};
/** A text box's text: what it is (TextHeaderAtom), then its text, a byte per character when it can be (TextBytesAtom), else UTF-16. */
const pptText = (type: number, text: string) => {
  const wide = [...text].some((c) => c.charCodeAt(0) > 0xff);
  return [pptRecord(0x0f9f, new Bytes().u32(type)), pptRecord(wide ? 0x0fa0 : 0x0fa8, wide ? new Bytes().utf16(text) : new Bytes().latin1(text))];
};
/** A slide's drawing: a shape per text box, and one for a placeholder that points at the slide list's text (OutlineTextRefAtom). */
const pptSlide = (boxes: string[]) => {
  const shape = (inside: Bytes[]) => pptContainer(0xf004, [pptRecord(0xf00a, new Bytes().pad(8)), pptContainer(0xf00d, inside)]);
  const shapes = [shape([pptRecord(0x0f9e, new Bytes().u32(0))]), ...boxes.map((box) => shape(pptText(4, box)))];
  return pptContainer(0x03ee, [pptRecord(0x03ef, new Bytes().pad(24)), pptContainer(0x040c, [pptContainer(0xf002, [pptContainer(0xf003, shapes)])])]);
};

/**
 * A PowerPoint 97–2003 presentation, its slides in this order. The slides'
 * own records are written in the stream last first, so only the slide list
 * gives their order. `edit`: a second save that changes one slide's text
 * boxes (the newer slide record is the one to read). `currentUser: false`
 * leaves out the stream that says where the last save is.
 */
export function aPpt(
  slides: PptSlide[],
  { locked = false, currentUser = true, edit }: { locked?: boolean; currentUser?: boolean; edit?: { slide: number; boxes: string[] } } = {},
): Uint8Array {
  const list: Bytes[] = [];
  slides.forEach((slide, i) => {
    list.push(pptRecord(0x03f3, new Bytes().u32(2 + i, 0, 0, 256 + i, 0)));
    if (slide.title !== undefined) list.push(...pptText(0, slide.title));
    if (slide.body) list.push(...pptText(1, slide.body.join("\r")));
  });
  const document = pptContainer(0x03e8, [pptRecord(0x03e9, new Bytes().pad(40)), pptContainer(0x0ff0, list, 0), pptRecord(0x03ea, [])]);

  const stream = new Bytes();
  const offsets: number[] = [stream.length];
  stream.add(document.out);
  const slideOffsets: number[] = [];
  for (let i = slides.length - 1; i >= 0; i--) {
    slideOffsets[i] = stream.length;
    stream.add(pptSlide(slides[i].boxes ?? []).out);
  }
  offsets.push(...slideOffsets);
  const save = (entries: { id: number; at: number[] }[], previous: number) => {
    const directoryAt = stream.length;
    const directory = new Bytes();
    for (const { id, at } of entries) directory.u32(id | (at.length << 20)).u32(...at);
    stream.add(pptRecord(0x1772, directory).out);
    const editAt = stream.length;
    stream.add(
      pptRecord(
        0x0ff5,
        new Bytes()
          .u32(256, 0)
          .u32(previous, directoryAt, 1, slides.length + 1)
          .u16(1, 0),
      ).out,
    );
    return editAt;
  };
  let last = save([{ id: 1, at: offsets }], 0);
  if (edit) {
    const at = stream.length;
    stream.add(pptSlide(edit.boxes).out);
    last = save([{ id: 2 + edit.slide, at: [at] }], last);
  }

  const user = new Bytes();
  const author = "Penyusun";
  user.u16(0, 0x0ff6).u32(0);
  user
    .u32(0x14, locked ? 0xf3d1c4df : 0xe391c05f, last)
    .u16(author.length, 0x03f4)
    .u8(3, 0)
    .u16(0)
    .latin1(author)
    .u32(8);
  user.set32(4, user.length - 8);
  return aCompoundFile({ ...(currentUser ? { "Current User": user.bytes() } : {}), "PowerPoint Document": stream.bytes() });
}
