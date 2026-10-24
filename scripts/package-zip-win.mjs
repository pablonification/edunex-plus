// Each Windows installer in a zip of its own, beside it on the release (WINDOWS_ZIPS in
// electron-builder.config.mjs), to try whether browsers warn less about a zip than about the
// installer itself. The release workflow runs it once the installers are final, signed or not, so
// each zip holds the very file beside it:
//
//   node scripts/package-zip-win.mjs release
//
// The zip is written here: Node has none of its own, and a zip of one file is three short records.
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";
import config, { WINDOWS_ARM_INSTALLER, WINDOWS_ZIPS } from "../electron-builder.config.mjs";

/** A time as a zip keeps it (MS-DOS's: from 1980, in two-second steps, no time zone). */
function dosTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    day: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

const u16 = (value) => Buffer.from([value & 0xff, value >> 8]);
const u32 = (value) => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
};

/** A zip holding one file, `name`, deflated: its header, the file, then the zip's one-entry list and the record that ends it. */
function zipOf(name, data, modified) {
  if (data.length >= 0xffffffff) throw new Error(`${name} is too big for a plain zip`);
  const packed = deflateRawSync(data, { level: 9 });
  const { time, day } = dosTime(modified);
  const nameBytes = Buffer.from(name, "utf8");
  // What the file's header and its entry in the list share: version 2.0 needed, a UTF-8 name,
  // deflated, its time, CRC-32 and sizes, its name's length, no extra field.
  const shared = Buffer.concat([
    u16(20),
    u16(0x0800),
    u16(8),
    u16(time),
    u16(day),
    u32(crc32(data)),
    u32(packed.length),
    u32(data.length),
    u16(nameBytes.length),
    u16(0),
  ]);
  const header = Buffer.concat([u32(0x04034b50), shared, nameBytes]);
  // Made by version 2.0; then no comment, disk 0, no attributes, and the file's header at the very start.
  const entry = Buffer.concat([u32(0x02014b50), u16(20), shared, Buffer.alloc(14), nameBytes]);
  const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(1), u16(1), u32(entry.length), u32(header.length + packed.length), u16(0)]);
  return Buffer.concat([header, packed, entry, end]);
}

/** Zips both Windows installers in `folder` for `version`, each under its WINDOWS_ZIPS name; the zips' names. */
export async function zipInstallersIn(folder, version) {
  const installers = { x64: config.nsis.artifactName, arm64: WINDOWS_ARM_INSTALLER };
  // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
  const named = (pattern) => pattern.replace("${version}", version).replace("${ext}", "exe");
  const zips = [];
  for (const [arch, pattern] of Object.entries(installers)) {
    const installer = named(pattern);
    const zip = named(WINDOWS_ZIPS[arch]);
    const file = path.join(folder, installer);
    const [data, { mtime }] = await Promise.all([readFile(file), stat(file)]);
    await writeFile(path.join(folder, zip), zipOf(installer, data, mtime));
    console.log(`  • zipped  file=${zip} holds=${installer}`);
    zips.push(zip);
  }
  return zips;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const folder = process.argv[2];
  if (!folder) {
    console.error("usage: node scripts/package-zip-win.mjs <folder with the Windows installers>");
    process.exit(2);
  }
  const { version } = JSON.parse(await readFile("package.json", "utf8"));
  zipInstallersIn(path.resolve(folder), version).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
