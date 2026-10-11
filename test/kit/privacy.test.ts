// The test data is public. These checks fail the run if anything personal
// from the recorded account made it into test/fixtures.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURES_DIR, allFixtureFiles } from "./fixtures";

const files = allFixtureFiles().filter((file) => !file.includes(`${path.sep}pub${path.sep}`));
const texts = files.map((file) => ({ file: path.relative(FIXTURES_DIR, file), text: fs.readFileSync(file, "utf8") }));

// Written by scripts/scrub-recording.mjs on the machine that holds the recordings; git-ignored.
const identityFile = path.resolve(FIXTURES_DIR, "..", "..", ".scratch", "private-identity.json");
const privateValues: string[] = fs.existsSync(identityFile) ? JSON.parse(fs.readFileSync(identityFile, "utf8")).values : [];

const FAKE_NIM = /^18223(?:9\d\d)$/;

function hits(pattern: RegExp, allowed: (match: string) => boolean = () => false): string[] {
  const out: string[] = [];
  for (const { file, text } of texts) for (const match of text.matchAll(pattern)) if (!allowed(match[0])) out.push(`${file}: ${match[0].slice(0, 40)}`);
  return out;
}

describe("committed test data holds nothing personal", () => {
  it.runIf(privateValues.length > 0)("contains none of the recorded account's real identity values", () => {
    const leaks: string[] = [];
    for (const { file, text } of texts) {
      const lower = text.toLowerCase();
      for (const value of privateValues) if (lower.includes(value.toLowerCase())) leaks.push(`${file}: ${value.slice(0, 3)}…`);
    }
    expect(leaks).toEqual([]);
  });

  it("has only the fake student numbers", () => {
    expect(hits(/(?<!\d)1\d{2}(?:1[5-9]|2\d)\d{3}(?!\d)/g, (m) => FAKE_NIM.test(m))).toEqual([]);
  });

  it("has no real meeting links, file links or session tokens", () => {
    expect(hits(/teams\.(?:microsoft|live)\.com\/[^"'\s<]+/g, (m) => m.includes("000000000000"))).toEqual([]);
    expect(hits(/\.blob\.core\.windows\.net\/[^"'\s<]+/g, (m) => m.includes("/edunex/fixture-"))).toEqual([]);
    expect(hits(/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}/g)).toEqual([]);
  });

  it("has no real email addresses or phone numbers", () => {
    expect(hits(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (m) => m.endsWith("@example.com") || m === "dimas.pratama@mahasiswa.itb.ac.id")).toEqual([]);
    expect(hits(/(?<!\d)(?:\+62|62|0)8\d{7,11}(?!\d)/g, (m) => m === "080000000000")).toEqual([]);
  });

  it("has none of the pages that hold passwords or family data", () => {
    const names = texts.map((t) => t.file).join("\n");
    expect(names).not.toMatch(/controlpanel|datainduk|ktm|pddikti/);
  });
});
