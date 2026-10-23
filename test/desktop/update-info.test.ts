// The update info files after the Windows installers were signed outside electron-builder
// (scripts/update-info.mjs). Signing changes an installer's bytes, so the sha512 electron-builder
// wrote no longer matches it, and the app's own updater would refuse the update. Each file's new
// sha512 goes where the old one was, and the updater reads the new one.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listedFiles, sha512Of, updateInfoIn, withSignedFiles } from "../../scripts/update-info.mjs";
import { sha512From } from "../../src/desktop/self-update";

const UNSIGNED = `${"A".repeat(86)}==`;
const SIGNED = `${"B".repeat(86)}==`;
const OTHER = `${"C".repeat(86)}==`;

/** latest.yml as electron-builder writes it for a one-click installer (no size: no blockmap). */
const windows = `version: 1.2.0
files:
  - url: Edunex-Plus-Setup-1.2.0.exe
    sha512: ${UNSIGNED}
path: Edunex-Plus-Setup-1.2.0.exe
sha512: ${UNSIGNED}
releaseDate: '2026-10-22T10:04:50.728Z'
`;

/** latest-linux.yml: two files, each with a size. */
const linux = `version: 1.2.0
files:
  - url: Edunex-Plus-1.2.0-x86_64.AppImage
    sha512: ${UNSIGNED}
    size: 126093283
    blockMapSize: 133111
  - url: edunex-plus_1.2.0_amd64.deb
    sha512: ${OTHER}
    size: 99874680
path: Edunex-Plus-1.2.0-x86_64.AppImage
sha512: ${UNSIGNED}
releaseDate: '2026-10-22T08:51:48.871Z'
`;

describe("the update info after signing", () => {
  it("lists the files electron-builder put in it", () => {
    expect(listedFiles(windows)).toEqual(["Edunex-Plus-Setup-1.2.0.exe"]);
    expect(listedFiles(linux)).toEqual(["Edunex-Plus-1.2.0-x86_64.AppImage", "edunex-plus_1.2.0_amd64.deb"]);
  });

  it("gives the signed installer its new sha512, in its item and at the top, and the app's updater reads that one", () => {
    const updated = withSignedFiles(windows, { "Edunex-Plus-Setup-1.2.0.exe": { sha512: SIGNED, size: 123 } });
    expect(updated).toBe(windows.replaceAll(UNSIGNED, SIGNED));
    expect(sha512From(updated, "Edunex-Plus-Setup-1.2.0.exe")).toBe(SIGNED);
  });

  it("changes only the file it's given, and its size where the item lists one", () => {
    const updated = withSignedFiles(linux, { "Edunex-Plus-1.2.0-x86_64.AppImage": { sha512: SIGNED, size: 126099999 } });
    expect(updated).toBe(linux.replaceAll(UNSIGNED, SIGNED).replace("size: 126093283", "size: 126099999"));
    expect(sha512From(updated, "edunex-plus_1.2.0_amd64.deb")).toBe(OTHER);
  });

  it("keeps Windows line endings", () => {
    const crlf = windows.replaceAll("\n", "\r\n");
    expect(withSignedFiles(crlf, { "Edunex-Plus-Setup-1.2.0.exe": { sha512: SIGNED } })).toBe(crlf.replaceAll(UNSIGNED, SIGNED));
  });

  it("stops when the file isn't listed, or the hash isn't a sha512", () => {
    expect(() => withSignedFiles(windows, { "Edunex-Plus-1.2.0-arm64.exe": { sha512: SIGNED } })).toThrow("lists none of Edunex-Plus-1.2.0-arm64.exe");
    expect(() => withSignedFiles(windows, { "Edunex-Plus-Setup-1.2.0.exe": { sha512: "abc" } })).toThrow("Not a sha512");
  });

  it("rewrites each latest*.yml in a folder from the files there now", async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "update-info-"));
    try {
      const installer = Buffer.from("a signed installer");
      fs.writeFileSync(path.join(folder, "Edunex-Plus-Setup-1.2.0.exe"), installer);
      fs.writeFileSync(path.join(folder, "latest.yml"), windows);
      // Listed, but not in the folder: left as it was.
      fs.writeFileSync(path.join(folder, "latest-linux.yml"), linux);
      const log = console.log;
      console.log = () => {};
      await updateInfoIn(folder).finally(() => (console.log = log));
      const sha512 = createHash("sha512").update(installer).digest("base64");
      expect(await sha512Of(path.join(folder, "Edunex-Plus-Setup-1.2.0.exe"))).toBe(sha512);
      expect(sha512From(fs.readFileSync(path.join(folder, "latest.yml"), "utf8"), "Edunex-Plus-Setup-1.2.0.exe")).toBe(sha512);
      expect(fs.readFileSync(path.join(folder, "latest-linux.yml"), "utf8")).toBe(linux);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});
