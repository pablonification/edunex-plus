// The Mac's update info, whole again (scripts/join-mac-update-info.mjs): the release workflow builds each
// kind of Mac on a Mac of its own, and each writes a latest-mac.yml with only its own files. Joined, the
// app on either kind of Mac finds its own files and their sha512 in the one latest-mac.yml it reads,
// as it did when one build made both.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { joinedUpdateInfo, joinMacUpdateInfoIn, listedItems } from "../../scripts/join-mac-update-info.mjs";
import { listedFiles } from "../../scripts/update-info.mjs";
import { sha512From } from "../../src/desktop/self-update";

const root = path.resolve(import.meta.dirname, "../..");
const sha = (letter: string) => `${letter.repeat(86)}==`;

/** One Mac's latest-mac.yml as its own build leaves it: its zip, its smaller update and its app's chunk map. */
function half(arch: string, letter: string, version = "1.2.3") {
  const name = `Edunex-Plus-${version}-${arch}-mac`;
  return `version: ${version}
files:
  - url: ${name}.zip
    sha512: ${sha(letter)}
    size: 100
  - url: ${name}.tar.xz
    sha512: ${sha(letter.toLowerCase())}
    size: 80
  - url: ${name}.app.chunks.json
    sha512: ${sha("Z")}
    size: 2
path: ${name}.zip
sha512: ${sha(letter)}
releaseDate: '2026-11-04T03:32:19.993Z'
`;
}

describe("the Macs' update info, joined", () => {
  it("lists every file of both kinds of Mac with its own sha512 and size", () => {
    const joined = joinedUpdateInfo({ x64: half("x64", "A"), arm64: half("arm64", "B") });
    expect(listedFiles(joined)).toEqual([
      "Edunex-Plus-1.2.3-x64-mac.zip",
      "Edunex-Plus-1.2.3-x64-mac.tar.xz",
      "Edunex-Plus-1.2.3-x64-mac.app.chunks.json",
      "Edunex-Plus-1.2.3-arm64-mac.zip",
      "Edunex-Plus-1.2.3-arm64-mac.tar.xz",
      "Edunex-Plus-1.2.3-arm64-mac.app.chunks.json",
    ]);
    expect(sha512From(joined, "Edunex-Plus-1.2.3-arm64-mac.tar.xz")).toBe(sha("b"));
    expect(sha512From(joined, "Edunex-Plus-1.2.3-x64-mac.zip")).toBe(sha("A"));
    expect(listedItems(joined)["Edunex-Plus-1.2.3-arm64-mac.zip"]).toEqual({ sha512: sha("B"), size: 100 });
  });

  it("keeps Intel's zip at the top, as electron-builder wrote it when one build made both", () => {
    const joined = joinedUpdateInfo({ x64: half("x64", "A"), arm64: half("arm64", "B") });
    expect(joined).toMatch(/^path: Edunex-Plus-1\.2\.3-x64-mac\.zip$/m);
    expect(joined).toMatch(/^version: 1\.2\.3$/m);
    expect(joined.match(/^releaseDate:/gm)).toHaveLength(1);
  });

  it("refuses halves that are missing, for two versions, or list the same file", () => {
    expect(() => joinedUpdateInfo({ x64: half("x64", "A") })).toThrow("No update info for the arm64 Mac");
    expect(() => joinedUpdateInfo({ x64: half("x64", "A"), arm64: half("arm64", "B", "1.2.4") })).toThrow("two versions");
    expect(() => joinedUpdateInfo({ x64: half("x64", "A"), arm64: half("x64", "B") })).toThrow("Both Macs' update info list");
  });

  it("refuses a file listed without its sha512 and size", () => {
    expect(() => listedItems("files:\n  - url: a.zip\n    size: 1\n")).toThrow("a.zip without its sha512 and size");
  });

  describe("in a release's folder", () => {
    let folder: string;
    beforeEach(() => {
      folder = fs.mkdtempSync(path.join(os.tmpdir(), "join-mac-"));
    });
    afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

    it("becomes the one latest-mac.yml, and the halves go", async () => {
      fs.writeFileSync(path.join(folder, "latest-mac-x64.yml"), half("x64", "A"));
      fs.writeFileSync(path.join(folder, "latest-mac-arm64.yml"), half("arm64", "B"));
      await joinMacUpdateInfoIn(folder);
      expect(fs.readdirSync(folder)).toEqual(["latest-mac.yml"]);
      expect(listedFiles(fs.readFileSync(path.join(folder, "latest-mac.yml"), "utf8"))).toHaveLength(6);
    });

    it("says which Mac's build is missing", async () => {
      fs.writeFileSync(path.join(folder, "latest-mac-x64.yml"), half("x64", "A"));
      await expect(joinMacUpdateInfoIn(folder)).rejects.toThrow("No latest-mac-arm64.yml");
    });
  });
});

describe("the release workflow", () => {
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");

  it("builds each kind of Mac on a Mac of its own", () => {
    expect(workflow).toMatch(/id: mac-arm64\s+os: macos-latest\s+target: mac\s+arch: arm64/);
    expect(workflow).toMatch(/id: mac-x64\s+os: macos-latest\s+target: mac\s+arch: x64/);
    expect(workflow).toContain("MAC_ARCH: ${{ matrix.arch }}");
    expect(workflow).toContain("name: app-${{ matrix.id }}");
  });

  it("keeps each Mac's half under its own name, after the chunk maps are listed in it", () => {
    const renamed = workflow.indexOf('mv release/latest-mac.yml "release/latest-mac-$ARCH.yml"');
    expect(renamed).toBeGreaterThan(workflow.indexOf("scripts/chunk-maps.mjs release"));
    expect(renamed).toBeLessThan(workflow.indexOf("name: Keep the installers"));
  });

  it("joins the halves before summing and publishing the release", () => {
    const joined = workflow.indexOf("node scripts/join-mac-update-info.mjs installers");
    expect(joined).toBeGreaterThan(workflow.indexOf("name: Collect the installers"));
    expect(joined).toBeLessThan(workflow.indexOf("name: Write each file's SHA-256 checksum"));
  });
});
