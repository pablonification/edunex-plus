// The chunk maps a release publishes (scripts/chunk-maps.mjs), run last in each packaging job: one
// for each installer and AppImage a latest*.yml lists, made from the file as it is then (signed, its
// sha512 written), and one with a chunk pack for each Mac app. Each is listed in the same latest*.yml
// with its sha512, which is how the app knows it's the release's own (src/desktop/partial-update.ts).
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chunkMapsIn, withListedFile } from "../../scripts/chunk-maps.mjs";
import { chunkMapName, chunkPackName, macAppName, parseChunkMap } from "../../src/desktop/chunks";
import { sha512From } from "../../src/desktop/self-update";

const sha512 = (data: Buffer) => createHash("sha512").update(data).digest("base64");
const OTHER = `${"C".repeat(86)}==`;

let folder: string;
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "chunk-maps-"));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(folder, { recursive: true, force: true });
});

const yml = (name: string, sha: string) =>
  `version: 1.2.0\nfiles:\n  - url: ${name}\n    sha512: ${sha}\n    size: 5\npath: ${name}\nsha512: ${sha}\nreleaseDate: '2026-10-24T00:00:00.000Z'\n`;

describe("the chunk maps on a release", () => {
  it("map each installer the update info lists, listed beside it with their own sha512", async () => {
    const installer = Buffer.from("a signed installer");
    fs.writeFileSync(path.join(folder, "Edunex-Plus-Setup-1.2.0.exe"), installer);
    fs.writeFileSync(path.join(folder, "latest.yml"), yml("Edunex-Plus-Setup-1.2.0.exe", sha512(installer)));
    await chunkMapsIn(folder);
    const name = chunkMapName("Edunex-Plus-Setup-1.2.0.exe");
    const map = fs.readFileSync(path.join(folder, name));
    const info = fs.readFileSync(path.join(folder, "latest.yml"), "utf8");
    expect(sha512From(info, name)).toBe(sha512(map));
    expect(sha512From(info, "Edunex-Plus-Setup-1.2.0.exe")).toBe(sha512(installer));
    expect(parseChunkMap(map.toString()).files).toEqual([
      expect.objectContaining({ path: "Edunex-Plus-Setup-1.2.0.exe", size: installer.length, sha512: sha512(installer) }),
    ]);
    // Run again (a job tried again), it lists the map once.
    await chunkMapsIn(folder);
    expect(fs.readFileSync(path.join(folder, "latest.yml"), "utf8")).toBe(info);
  });

  it("stop when the update info doesn't list the installer as it is now: its sha512 is written after signing, first", async () => {
    fs.writeFileSync(path.join(folder, "Edunex-Plus-Setup-1.2.0.exe"), "signed since");
    fs.writeFileSync(path.join(folder, "latest.yml"), yml("Edunex-Plus-Setup-1.2.0.exe", OTHER));
    await expect(chunkMapsIn(folder)).rejects.toThrow("run scripts/update-info.mjs first");
  });

  it("map each Mac app, with its chunk pack, named for its version and kind of Mac", async () => {
    const app = path.join(folder, "mac-arm64", "Edunex Plus.app", "Contents");
    fs.mkdirSync(path.join(app, "MacOS"), { recursive: true });
    fs.writeFileSync(path.join(app, "MacOS", "Edunex Plus"), "the program", { mode: 0o755 });
    fs.symlinkSync("MacOS", path.join(app, "Programs"));
    fs.writeFileSync(path.join(folder, "latest-mac.yml"), yml("Edunex-Plus-1.2.0-arm64-mac.zip", OTHER));
    await chunkMapsIn(folder);
    const named = macAppName("1.2.0", "arm64");
    const map = parseChunkMap(fs.readFileSync(path.join(folder, chunkMapName(named)), "utf8"));
    expect(map.source).toEqual({ name: chunkPackName(named), size: fs.statSync(path.join(folder, chunkPackName(named))).size });
    expect(map.files.map((entry) => [entry.path, entry.type])).toEqual([
      ["Edunex Plus.app", "dir"],
      ["Edunex Plus.app/Contents", "dir"],
      ["Edunex Plus.app/Contents/MacOS", "dir"],
      ["Edunex Plus.app/Contents/MacOS/Edunex Plus", "file"],
      ["Edunex Plus.app/Contents/Programs", "link"],
    ]);
    expect(map.files[3]).toMatchObject({ mode: 0o755 });
    const info = fs.readFileSync(path.join(folder, "latest-mac.yml"), "utf8");
    expect(sha512From(info, chunkMapName(named))).toBe(sha512(fs.readFileSync(path.join(folder, chunkMapName(named)))));
    expect(sha512From(info, "Edunex-Plus-1.2.0-arm64-mac.zip")).toBe(OTHER);
  });

  it("are listed after the last file, keeping the update info's line ends", () => {
    const crlf = yml("a.exe", OTHER).replaceAll("\n", "\r\n");
    const listed = withListedFile(crlf, "a.exe.chunks.json", { sha512: OTHER, size: 12 });
    expect(listed).toBe(crlf.replace("path: a.exe", ["  - url: a.exe.chunks.json", `    sha512: ${OTHER}`, "    size: 12", "path: a.exe"].join("\r\n")));
  });
});
