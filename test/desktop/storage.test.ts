// The disk the engine writes to: atomic writes, and the sweep that removes
// temporary files a quit or crash mid-write left behind.
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileStorage } from "../../src/desktop/storage";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "edunex-storage-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("FileStorage", () => {
  it("writes, reads back and lists keys, never listing temporary files", async () => {
    const storage = new FileStorage(root);
    await storage.write("datasets/edunex.courses.json", "[1]");
    await fs.writeFile(path.join(root, "datasets", "edunex.courses.json.abc123.tmp"), "half");
    expect(await storage.read("datasets/edunex.courses.json")).toBe("[1]");
    expect(await storage.list("datasets/")).toEqual(["datasets/edunex.courses.json"]);
  });

  it("sweeps temporary files left by an interrupted write, keeping recent ones and the data", async () => {
    const storage = new FileStorage(root);
    await storage.write("window.json", "{}");
    await storage.write("datasets/itb.calendar.json", "{}");
    const old = [path.join(root, "window.json.aaaaaa.tmp"), path.join(root, "datasets", "itb.calendar.json.bbbbbb.tmp")];
    const recent = path.join(root, "window.json.cccccc.tmp");
    for (const file of [...old, recent]) await fs.writeFile(file, "");
    const hourAgo = new Date(Date.now() - 3_600_000);
    for (const file of old) await fs.utimes(file, hourAgo, hourAgo);

    expect(await storage.sweep()).toBe(2);
    for (const file of old) await expect(fs.stat(file)).rejects.toThrow();
    await expect(fs.stat(recent)).resolves.toBeTruthy();
    expect(await storage.read("window.json")).toBe("{}");
    expect(await storage.read("datasets/itb.calendar.json")).toBe("{}");
  });
});
