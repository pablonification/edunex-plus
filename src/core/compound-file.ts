// Old Office files (Word, Excel and PowerPoint 97–2003: .doc, .xls, .ppt) are
// "compound files": a small file system inside one file, its streams kept in
// fixed-size sectors chained through a table (the FAT), small ones in a
// stream of their own with smaller sectors (the mini stream). This reads the
// streams at its root by name. Main uses it to check a file is what it
// claims, the window to read one in to show, so it's plain TypeScript on
// bytes. The bytes come from anyone: every chain, count and sector number is
// checked, and a file that loops or points past its end throws.

/** Every compound file starts with these eight bytes. */
const COMPOUND_SIGNATURE: readonly number[] = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** Above this, a sector number marks a table's own sectors, a free one or a chain's end. */
const MAX_SECTOR = 0xfffffffa;
const END_OF_CHAIN = 0xfffffffe;
/** The FAT's first sectors are listed in the header; the rest in sectors of their own (the DIFAT). */
const HEADER_FAT_SECTORS = 109;
const ENTRY_SIZE = 128;
const NO_ENTRY = 0xffffffff;
const STREAM = 2;
const ROOT = 5;

export interface CompoundFile {
  /** Whether a stream with this name is at its root (names compare without case, as the format does). */
  has(name: string): boolean;
  /** The stream with this name at its root; null when there's none. Throws when its sectors are broken. */
  stream(name: string): Uint8Array | null;
}

/** The compound file in these bytes. Throws when they aren't one, or its header, tables or directory are broken. */
export function readCompoundFile(bytes: Uint8Array): CompoundFile {
  if (bytes.length < 512 || !COMPOUND_SIGNATURE.every((byte, i) => bytes[i] === byte)) throw new Error("Not a compound file");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  // Version 3 has 512-byte sectors, version 4 4096-byte ones; mini sectors are 64 bytes in both.
  const version = u16(26);
  const shift = u16(30);
  if (u16(28) !== 0xfffe || !((version === 3 && shift === 9) || (version === 4 && shift === 12)) || u16(32) !== 6) {
    throw new Error("Not a compound file this can read");
  }
  const size = 1 << shift;
  const perSector = size / 4;
  // The header takes the first sector's room; sector n follows at (n + 1) × size.
  const sectors = Math.ceil((bytes.length - size) / size);
  if (sectors < 1) throw new Error("Compound file cut short");
  const sectorAt = (n: number) => {
    if (n >= sectors) throw new Error("Sector past the end of the file");
    return (n + 1) * size;
  };

  // Where the FAT is: its first sectors from the header, the rest from the DIFAT's chain.
  const fatCount = u32(44);
  if (fatCount > sectors) throw new Error("More FAT sectors than the file has");
  const fatSectors: number[] = [];
  for (let i = 0; i < HEADER_FAT_SECTORS && fatSectors.length < fatCount; i++) fatSectors.push(u32(76 + i * 4));
  for (let next = u32(68), hops = 0; fatSectors.length < fatCount; hops++) {
    if (next > MAX_SECTOR || hops >= sectors) throw new Error("Broken DIFAT");
    const at = sectorAt(next);
    for (let i = 0; i < perSector - 1 && fatSectors.length < fatCount; i++) fatSectors.push(u32(at + i * 4));
    next = u32(at + size - 4);
  }
  const fat = new Uint32Array(fatCount * perSector);
  fatSectors.forEach((sector, i) => {
    if (sector > MAX_SECTOR) throw new Error("Broken FAT");
    const at = sectorAt(sector);
    for (let j = 0; j < perSector; j++) fat[i * perSector + j] = u32(at + j * 4);
  });

  /** A chain's sectors, in order; throws when it loops (runs longer than there are sectors) or leaves the table. */
  const chain = (table: Uint32Array, start: number, count: number): number[] => {
    const found: number[] = [];
    for (let n = start; n !== END_OF_CHAIN; n = table[n]) {
      if (n >= table.length || n >= count || found.length >= count) throw new Error("Broken sector chain");
      found.push(n);
    }
    return found;
  };
  /** `length` bytes from the chain at `start` of sectors `unit` bytes long, out of `source` (the file, or the mini stream). */
  const gather = (source: Uint8Array, table: Uint32Array, start: number, length: number, unit: number, offset: (n: number) => number) => {
    const list = chain(table, start, Math.ceil(source.length / unit));
    if (length > list.length * unit) throw new Error("Stream longer than its sectors");
    const out = new Uint8Array(length);
    for (let i = 0, done = 0; done < length; i++) {
      const part = source.subarray(offset(list[i]), offset(list[i]) + Math.min(unit, length - done));
      if (part.length < Math.min(unit, length - done)) throw new Error("Compound file cut short");
      out.set(part, done);
      done += part.length;
    }
    return out;
  };
  const fromFile = (start: number, length: number) => gather(bytes.subarray(size), fat, start, length, size, (n) => sectorAt(n) - size);

  // The directory: an entry of 128 bytes per stream or storage; it has no size of its own, so it's its whole chain.
  const directory = fromFile(u32(48), chain(fat, u32(48), sectors).length * size);
  const entries = directory.length / ENTRY_SIZE;
  const dir = new DataView(directory.buffer);
  const entry = (i: number) => {
    const at = i * ENTRY_SIZE;
    const nameBytes = Math.min(dir.getUint16(at + 64, true), 64);
    let name = "";
    for (let c = 0; c < nameBytes - 2; c += 2) name += String.fromCharCode(dir.getUint16(at + c, true));
    // Version 3 only uses the size's low half (its high half may hold leftovers).
    const high = dir.getUint32(at + 124, true);
    if (version === 4 && high !== 0) throw new Error("Stream too big");
    return {
      name,
      type: directory[at + 66],
      left: dir.getUint32(at + 68, true),
      right: dir.getUint32(at + 72, true),
      child: dir.getUint32(at + 76, true),
      start: dir.getUint32(at + 116, true),
      size: dir.getUint32(at + 120, true),
    };
  };
  if (entries < 1) throw new Error("No directory");
  const root = entry(0);
  if (root.type !== ROOT) throw new Error("No root entry");

  // The root's streams: a tree of siblings under its child, each visited once.
  const streams = new Map<string, ReturnType<typeof entry>>();
  const seen = new Set<number>();
  for (const todo = [root.child]; todo.length; ) {
    const i = todo.pop()!;
    if (i === NO_ENTRY) continue;
    if (i >= entries || seen.has(i)) throw new Error("Broken directory");
    seen.add(i);
    const found = entry(i);
    if (found.type === STREAM) streams.set(found.name.toUpperCase(), found);
    todo.push(found.left, found.right);
  }

  // Streams under the cutoff live in the mini stream (the root's own stream), chained through the mini FAT.
  const cutoff = u32(56);
  let mini: { stream: Uint8Array; fat: Uint32Array } | null = null;
  const miniStream = () => {
    if (mini) return mini;
    const start = u32(60);
    const table = start === END_OF_CHAIN ? new Uint8Array() : fromFile(start, chain(fat, start, sectors).length * size);
    const miniFat = new Uint32Array(table.length / 4);
    const tableView = new DataView(table.buffer);
    for (let i = 0; i < miniFat.length; i++) miniFat[i] = tableView.getUint32(i * 4, true);
    mini = { stream: fromFile(root.start, root.size), fat: miniFat };
    return mini;
  };

  return {
    has: (name) => streams.has(name.toUpperCase()),
    stream: (name) => {
      const found = streams.get(name.toUpperCase());
      if (!found) return null;
      if (found.size === 0) return new Uint8Array();
      if (found.size >= cutoff) return fromFile(found.start, found.size);
      const { stream, fat: miniFat } = miniStream();
      return gather(stream, miniFat, found.start, found.size, 64, (n) => n * 64);
    },
  };
}
