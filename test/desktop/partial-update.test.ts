// Downloading only what changed (src/desktop/partial-update.ts), against chunk maps the release
// script really writes (scripts/chunk-maps.mjs): a new installer or AppImage put together from the
// old one and the few ranges of the new one it lacks, and a new Mac app from the old app's files and
// the release's chunk pack. Whatever doesn't line up (a map the release doesn't list, a chunk that
// isn't the one listed, a source that answers wrong) stops it, so the whole file is downloaded.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appMap, fileMap, withListedFile } from "../../scripts/chunk-maps.mjs";
import { CHUNKER, type ChunkMap, chunkMapName, chunkPackName, macAppName } from "../../src/desktop/chunks";
import { downloadPartial, isRangeAnswer, type PartialSource, type PartialUpdate, planDownload } from "../../src/desktop/partial-update";
import { MismatchError, type ReleaseFile } from "../../src/desktop/self-update";

const RELEASE = "https://github.com/pablonification/edunex-plus/releases/download/v1.2.0";
const sha512 = (data: Buffer) => createHash("sha512").update(data).digest("base64");
const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("base64");

/** Made-up bytes, the same on every run: sha256 in counter mode. */
const bytes = (size: number, seed: number | string = 1) => {
  const blocks: Buffer[] = [];
  for (let i = 0; i * 32 < size; i++) blocks.push(createHash("sha256").update(`${seed}:${i}`).digest());
  return Buffer.concat(blocks).subarray(0, size);
};

/** The release's files in memory, read as ./updater.ts reads GitHub: whole, or in ranges. */
function memory(files: Record<string, Buffer>, sendBack: (name: string, start: number, data: Buffer) => Buffer = (_, __, data) => data) {
  const asked: { name: string; start: number; end: number }[] = [];
  const source: PartialSource = {
    bytes: async (file) => files[file.name],
    range: async (file, start, end, onData) => {
      asked.push({ name: file.name, start, end });
      const data = sendBack(file.name, start, files[file.name].subarray(start, end));
      // In pieces, as a network answer comes.
      for (let at = 0; at < data.length; at += 7000) onData(data.subarray(at, at + 7000));
    },
  };
  const release = (): ReleaseFile[] => Object.entries(files).map(([name, data]) => ({ name, url: `${RELEASE}/${name}`, size: data.length }));
  return { source, asked, release };
}

let folder: string;
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "partial-update-"));
});
afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

/** The update info electron-builder writes for `name`, with its map listed beside it as the script lists it. */
function updateInfo(name: string, file: Buffer, map?: { name: string; text: string }): string {
  const yml = `version: 1.2.0\nfiles:\n  - url: ${name}\n    sha512: ${sha512(file)}\n    size: ${file.length}\npath: ${name}\nsha512: ${sha512(file)}\n`;
  return map ? withListedFile(yml, map.name, { sha512: sha512(Buffer.from(map.text)), size: map.text.length }) : yml;
}

describe("an installer or AppImage, from the old one", () => {
  const NAME = "Edunex-Plus-Setup-1.2.0.exe";
  const old = bytes(3 * 1024 * 1024, "old");
  // The next version: a few bytes changed, some added, some gone, the end signed again.
  const next = Buffer.concat([
    old.subarray(0, 600_000),
    Buffer.from("version 1.2.0"),
    old.subarray(600_000, 2_000_000),
    bytes(5_000, "new code"),
    old.subarray(2_100_000, 3_000_000),
    bytes(20_000, "new signature"),
  ]);

  async function setUp(options: { mapText?: (text: string) => string; listMap?: boolean; sendBack?: Parameters<typeof memory>[1]; have?: Buffer } = {}) {
    fs.writeFileSync(path.join(folder, NAME), next);
    const map = await fileMap(path.join(folder, NAME));
    fs.rmSync(path.join(folder, NAME));
    const text = options.mapText ? options.mapText(JSON.stringify(map)) : JSON.stringify(map);
    const mapName = chunkMapName(NAME);
    const yml = updateInfo(NAME, next, options.listMap === false ? undefined : { name: mapName, text: JSON.stringify(map) });
    const release = memory({ [NAME]: next, [mapName]: Buffer.from(text) }, options.sendBack);
    const have = path.join(folder, "installer.exe");
    fs.writeFileSync(have, options.have ?? old);
    const into = path.join(folder, "new");
    fs.mkdirSync(into);
    const shares: number[] = [];
    const update: PartialUpdate = {
      kind: "windows",
      arch: "x64",
      version: "1.2.0",
      release: release.release(),
      file: release.release()[0],
      yml,
      sha512: sha512(next),
      have,
      into,
      progress: (share) => shares.push(share),
    };
    return { update, release, map, shares, run: () => downloadPartial(update, release.source) };
  }

  it("downloads only the ranges it lacks, and puts together the very file the update info lists", async () => {
    const { run, release, shares } = await setUp();
    const made = await run();
    expect(made).toBe(path.join(folder, "new", NAME));
    expect(sha512(fs.readFileSync(made as string))).toBe(sha512(next));
    const downloaded = release.asked.reduce((sum, range) => sum + range.end - range.start, 0);
    expect(downloaded).toBeLessThan(next.length / 4);
    expect(release.asked.every((range) => range.name === NAME)).toBe(true);
    expect(shares.at(-1)).toBe(1);
    // Nothing else is left beside it.
    expect(fs.readdirSync(path.join(folder, "new"))).toEqual([NAME]);
  });

  it("isn't tried when the release doesn't list a map for the file (an older release)", async () => {
    const { run, release } = await setUp({ listMap: false });
    expect(await run()).toBeNull();
    expect(release.asked).toEqual([]);
  });

  it("isn't worth it when most of the file is missing: the whole file is downloaded instead", async () => {
    const { run, release } = await setUp({ have: bytes(3 * 1024 * 1024, "something else") });
    expect(await run()).toBeNull();
    expect(release.asked).toEqual([]);
  });

  it("stops at a map that isn't the one the update info lists", async () => {
    const { run } = await setUp({ mapText: (text) => text.replace('"format":1', '"format":1 ') });
    await expect(run()).rejects.toThrow(MismatchError);
  });

  it("stops at a map that's for another file than the one the update info lists", async () => {
    const { update, release } = await setUp();
    await expect(downloadPartial({ ...update, sha512: sha512(old) }, release.source)).rejects.toThrow("isn't for");
  });

  it("stops at a chunk that isn't the one the map lists, and asks no more", async () => {
    const { run, release } = await setUp({
      sendBack: (_, start, data) => (start > 0 ? Buffer.concat([Buffer.from([data[0] ^ 1]), data.subarray(1)]) : data),
    });
    await expect(run()).rejects.toThrow("isn't the one the map lists");
    // Not tried again: a wrong chunk is no network hiccup.
    expect(new Set(release.asked.map((range) => range.start)).size).toBe(release.asked.length);
  });

  it("tries a range that failed once more, its bar only going forward, and stops when it fails again", async () => {
    let failures = 1;
    const once = await setUp();
    const flaky: PartialSource = {
      ...once.release.source,
      range: async (file, start, end, onData) => {
        if (failures-- <= 0) return once.release.source.range(file, start, end, onData);
        // Half of it came, then the connection dropped.
        await once.release.source.range(file, start, start + Math.floor((end - start) / 2), onData);
        throw new Error("net::ERR_CONNECTION_RESET");
      },
    };
    expect(await downloadPartial(once.update, flaky)).toBe(path.join(folder, "new", NAME));
    expect(sha512(fs.readFileSync(path.join(folder, "new", NAME)))).toBe(sha512(next));
    expect(once.shares).toEqual([...once.shares].sort((a, b) => a - b));
    expect(once.shares.at(-1)).toBe(1);

    fs.rmSync(path.join(folder, "new"), { recursive: true });
    const down = await setUp();
    const offline: PartialSource = {
      ...down.release.source,
      range: async () => {
        throw new Error("net::ERR_INTERNET_DISCONNECTED");
      },
    };
    await expect(downloadPartial(down.update, offline)).rejects.toThrow("ERR_INTERNET_DISCONNECTED");
  });
});

describe("a Mac app, from its own files", () => {
  const APP = "Edunex Plus.app";
  const framework = bytes(1_500_000, "framework");
  const helper = bytes(200_000, "helper");

  /** An app as electron-builder lays one out: folders, programs, a framework's links. */
  function writeApp(root: string, files: Record<string, Buffer | { link: string } | { mode: number; data: Buffer }>) {
    fs.mkdirSync(path.join(root, APP), { recursive: true });
    for (const [name, what] of Object.entries(files)) {
      const target = path.join(root, APP, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if ("link" in what) fs.symlinkSync(what.link, target);
      else if ("mode" in what) fs.writeFileSync(target, what.data, { mode: what.mode });
      else fs.writeFileSync(target, what);
    }
  }
  const oldApp = {
    "Contents/Info.plist": Buffer.from("<plist>1.1.0</plist>"),
    "Contents/MacOS/Edunex Plus": { mode: 0o755, data: Buffer.concat([helper, Buffer.from("signed 1.1.0")]) },
    "Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework": { mode: 0o755, data: framework },
    "Contents/Frameworks/Electron Framework.framework/Versions/Current": { link: "A" },
    "Contents/Frameworks/Electron Framework.framework/Electron Framework": { link: "Versions/Current/Electron Framework" },
    "Contents/Resources/app.asar": bytes(400_000, "app 1.1.0"),
    "Contents/Resources/gone.txt": Buffer.from("only in 1.1.0"),
  };
  const newApp = {
    ...oldApp,
    "Contents/Info.plist": Buffer.from("<plist>1.2.0</plist>"),
    "Contents/MacOS/Edunex Plus": { mode: 0o755, data: Buffer.concat([helper, Buffer.from("signed 1.2.0")]) },
    // The same program twice (as the helper apps are): its chunks are in the pack once.
    "Contents/Frameworks/Edunex Plus Helper.app/Contents/MacOS/Edunex Plus Helper": { mode: 0o755, data: Buffer.concat([helper, Buffer.from("signed 1.2.0")]) },
    "Contents/Resources/app.asar": Buffer.concat([bytes(400_000, "app 1.1.0").subarray(0, 300_000), bytes(30_000, "app 1.2.0")]),
    "Contents/Resources/new.txt": Buffer.from("new in 1.2.0"),
  } as Record<string, Buffer | { link: string } | { mode: number; data: Buffer }>;
  delete newApp["Contents/Resources/gone.txt"];

  async function setUp() {
    writeApp(path.join(folder, "old"), oldApp);
    writeApp(path.join(folder, "built"), newApp);
    const named = macAppName("1.2.0", "arm64");
    const packFile = path.join(folder, chunkPackName(named));
    const map = await appMap(path.join(folder, "built", APP), packFile);
    const text = JSON.stringify(map);
    const zip = Buffer.alloc(2_000_000);
    const release = memory({
      "Edunex-Plus-1.2.0-arm64-mac.zip": zip,
      [chunkMapName(named)]: Buffer.from(text),
      [chunkPackName(named)]: fs.readFileSync(packFile),
    });
    const yml = updateInfo("Edunex-Plus-1.2.0-arm64-mac.zip", zip, { name: chunkMapName(named), text });
    const into = path.join(folder, "new");
    fs.mkdirSync(into);
    const update: PartialUpdate = {
      kind: "mac",
      arch: "arm64",
      version: "1.2.0",
      release: release.release(),
      file: release.release()[0],
      yml,
      sha512: sha512(zip),
      have: path.join(folder, "old", APP),
      into,
      progress: () => undefined,
    };
    return { update, release, map };
  }

  /** Every folder, file and link in an app, with its mode and what it holds or points to. */
  function contents(app: string): string[] {
    return (fs.readdirSync(app, { recursive: true }) as string[]).sort().map((name) => {
      const found = fs.lstatSync(path.join(app, name));
      const what = found.isSymbolicLink()
        ? `-> ${fs.readlinkSync(path.join(app, name))}`
        : found.isFile()
          ? sha256(fs.readFileSync(path.join(app, name)))
          : "folder";
      return `${name} ${(found.mode & 0o777).toString(8)} ${what}`;
    });
  }

  it("puts the new app together from the old app's files and the chunks it lacks, each only once", async () => {
    const { update, release, map } = await setUp();
    expect(await downloadPartial(update, release.source)).toBe(path.join(folder, "new"));
    expect(fs.readdirSync(path.join(folder, "new"))).toEqual([APP]);
    expect(contents(path.join(folder, "new", APP))).toEqual(contents(path.join(folder, "built", APP)));
    const downloaded = release.asked.reduce((sum, range) => sum + range.end - range.start, 0);
    expect(downloaded).toBeLessThan(map.source.size / 4);
    expect(release.asked.every((range) => range.name === chunkPackName(macAppName("1.2.0", "arm64")))).toBe(true);
    // The program and the helper are the same bytes: the pack holds them once.
    const program = map.files.find((entry) => entry.path.endsWith("MacOS/Edunex Plus"));
    const helperApp = map.files.find((entry) => entry.path.endsWith("MacOS/Edunex Plus Helper"));
    expect(program?.type === "file" && helperApp?.type === "file" && helperApp.chunks).toEqual(program?.type === "file" && program.chunks);
  });

  it("stops when the release's pack isn't the one the map was made with", async () => {
    const { update, release } = await setUp();
    const pack = chunkPackName(macAppName("1.2.0", "arm64"));
    const others = update.release.map((file) => (file.name === pack ? { ...file, size: file.size + 1 } : file));
    await expect(downloadPartial({ ...update, release: others }, release.source)).rejects.toThrow("no chunk pack");
  });
});

describe("what to download", () => {
  const chunk = (seed: number, size: number): [string, number] => [`${seed.toString().padStart(43, "A")}=`, size];
  const KB = 1024;
  const map = (sizes: number[]): ChunkMap => ({
    format: 1,
    chunker: CHUNKER,
    source: { name: "file", size: sizes.reduce((sum, size) => sum + size, 0) },
    chunks: sizes.map((size, index) => chunk(index, size)),
    files: [
      {
        path: "file",
        type: "file",
        mode: 0o644,
        size: sizes.reduce((sum, size) => sum + size, 0),
        sha512: `${"A".repeat(86)}==`,
        chunks: sizes.map((_, i) => i),
      },
    ],
  });

  it("is the chunks this computer lacks, neighbours (or nearly) in one range", () => {
    const plan = planDownload(
      map([100 * KB, 100 * KB, 50 * KB, 100 * KB, 100 * KB, 100 * KB]),
      (sha) => ![0, 1, 3, 5].includes(Number.parseInt(sha.replace(/^A+/, ""), 10) || 0),
    );
    // 0 and 1 side by side; 3 too, over the 50 kB chunk 2 in between; 5 apart, past 100 kB of chunk 4.
    expect(plan.ranges).toEqual([
      { start: 0, end: 350 * KB, first: 0, last: 3 },
      { start: 450 * KB, end: 550 * KB, first: 5, last: 5 },
    ]);
    expect([...plan.missing]).toEqual([0, 1, 3, 5]);
    expect(plan.bytes).toBe(450 * KB);
  });

  it("is never one range longer than 8 MB, so a few download at once", () => {
    const plan = planDownload(map(Array.from({ length: 100 }, () => 200 * KB)), () => false);
    expect(plan.ranges.length).toBe(3);
    expect(Math.max(...plan.ranges.map((range) => range.end - range.start))).toBeLessThanOrEqual(8 * 1024 * KB);
  });

  it("checks GitHub sent exactly the range asked for", () => {
    expect(isRangeAnswer("bytes 100-199/1000", 100, 200, 1000)).toBe(true);
    expect(isRangeAnswer("bytes 100-199/1001", 100, 200, 1000)).toBe(false);
    expect(isRangeAnswer("bytes 0-999/1000", 100, 200, 1000)).toBe(false);
    expect(isRangeAnswer(undefined, 100, 200, 1000)).toBe(false);
  });
});
