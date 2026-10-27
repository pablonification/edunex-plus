// The test data is public. These checks fail the run if anything personal
// from the recorded account made it into test/fixtures.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allFixtureFiles, FIXTURES_DIR } from "./fixtures";
import { PRIVATE_PAGES, personalHits } from "./privacy-rules";

const files = allFixtureFiles().filter((file) => !file.includes(`${path.sep}pub${path.sep}`));
const texts = files.map((file) => ({ file: path.relative(FIXTURES_DIR, file), text: fs.readFileSync(file, "utf8") }));

// Written by scripts/scrub-recording.mjs on the machine that holds the recordings; git-ignored.
const identityFile = path.resolve(FIXTURES_DIR, "..", "..", ".scratch", "private-identity.json");
const privateValues: string[] = fs.existsSync(identityFile) ? JSON.parse(fs.readFileSync(identityFile, "utf8")).values : [];

describe("committed test data holds nothing personal", () => {
  it.runIf(privateValues.length > 0)("contains none of the recorded account's real identity values", () => {
    const leaks: string[] = [];
    for (const { file, text } of texts) {
      const lower = text.toLowerCase();
      for (const value of privateValues) if (lower.includes(value.toLowerCase())) leaks.push(`${file}: ${value.slice(0, 3)}…`);
    }
    expect(leaks).toEqual([]);
  });

  // The same rules hold what the app sends in a report (test/engine/report-scrub.test.ts).
  it("has only the fake student numbers, links, tokens, emails and phone numbers, and no staff numbers or named photos", () => {
    expect(texts.flatMap(({ file, text }) => personalHits(text).map((hit) => `${file}: ${hit}`))).toEqual([]);
  });

  it("has none of the pages that hold passwords or family data", () => {
    const names = texts.map((t) => t.file).join("\n");
    expect(names).not.toMatch(PRIVATE_PAGES);
  });
});
