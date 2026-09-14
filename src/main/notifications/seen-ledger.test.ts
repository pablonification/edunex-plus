import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSeenLedger } from "./seen-ledger";
import { nodeFileSystem, nodePath, systemClock, systemRandom } from "../platform/node";

const roots: string[] = [];
const persistence = { fileSystem: nodeFileSystem, path: nodePath, clock: systemClock, random: systemRandom };
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "edunex-ledger-"));
  roots.push(root);
  return root;
}

describe("seen ledger", () => {
  it("starts uninitialized so the first sync can baseline silently", () => {
    const ledger = createSeenLedger(tempRoot(), "190136", persistence);
    expect(ledger.initialized).toBe(false);
    expect(ledger.has("113986")).toBe(false);
  });

  it("persists seen ids across restarts", () => {
    const root = tempRoot();
    const first = createSeenLedger(root, "190136", persistence);
    first.add(["113986"]);
    first.save();

    const second = createSeenLedger(root, "190136", persistence);
    expect(second.initialized).toBe(true);
    expect(second.has("113986")).toBe(true);
    expect(second.has("113987")).toBe(false);
  });

  it("scopes ledgers per account", () => {
    const root = tempRoot();
    const a = createSeenLedger(root, "190136", persistence);
    a.add(["113986"]);
    a.save();

    expect(createSeenLedger(root, "190137", persistence).has("113986")).toBe(false);
  });
});
