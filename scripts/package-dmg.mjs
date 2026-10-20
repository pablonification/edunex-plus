// The macOS disk image, packed smaller. electron-builder only writes zlib (UDZO) or bzip2 (UDBZ)
// images; macOS 10.15 and later also open LZMA ones (ULMO), about a quarter smaller, and Electron
// needs macOS 12. So once electron-builder has made a disk image, this hook converts it in place:
// same window, same contents. Nothing else names the disk image by its bytes (dmg.writeUpdateInfo
// is off: the app updates itself from the zip), and an ad-hoc build doesn't sign it.
import { execFile } from "node:child_process";
import { rename, rm } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);

/** hdiutil's arguments to write `from` again as an LZMA disk image at `to`. */
export function convertArgs(from, to) {
  return ["convert", from, "-format", "ULMO", "-o", to, "-ov", "-quiet"];
}

/** electron-builder hook, after each file it makes: disk images are packed again. */
export async function artifactBuildCompleted({ file }) {
  if (!file.endsWith(".dmg")) return;
  const packed = `${file.slice(0, -".dmg".length)}.lzma.dmg`;
  try {
    await run("/usr/bin/hdiutil", convertArgs(file, packed));
    await rename(packed, file);
  } finally {
    await rm(packed, { force: true });
  }
  console.log(`  • packed smaller  file=${file} format=ULMO`);
}
