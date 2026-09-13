import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSeenLedger } from "./seen-ledger";

const roots: string[] = [];
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
    const ledger = createSeenLedger(tempRoot(), "190136");
    expect(ledger.initialized).toBe(false);
    expect(ledger.has("113986")).toBe(false);
  });

  it("persists seen ids across restarts", () => {
    const root = tempRoot();
    const first = createSeenLedger(root, "190136");
    first.add(["113986"]);
    first.save();

    const second = createSeenLedger(root, "190136");
    expect(second.initialized).toBe(true);
    expect(second.has("113986")).toBe(true);
    expect(second.has("113987")).toBe(false);
  });

  it("scopes ledgers per account", () => {
    const root = tempRoot();
    const a = createSeenLedger(root, "190136");
    a.add(["113986"]);
    a.save();

    expect(createSeenLedger(root, "190137").has("113986")).toBe(false);
  });
});
