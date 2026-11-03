// Real Edunex responses and SIX pages from a recorded session, with every
// personal detail replaced (scripts/scrub-recording.mjs). Tests read them
// through these helpers instead of hand-written samples, so they always see
// the shapes the real systems send. How they're looked up is ./recordings.ts;
// the phone's demo reads the same recordings from a bundle instead of the disk
// (mobile/src/demo/fixtures.ts, which Metro puts in place of this file).
import fs from "node:fs";
import path from "node:path";
import { recordings } from "./recordings";

export type { Exchange, System } from "./recordings";

export const FIXTURES_DIR = path.resolve(import.meta.dirname, "..", "fixtures");

export const { exchanges, exchange, bodyText, edunexJson, sixPage, publicPage, calendarFeed } = recordings((file) =>
  fs.readFileSync(path.join(FIXTURES_DIR, file), "utf8"),
);

/** Every committed fixture file, for checks that scan them all. */
export function allFixtureFiles(): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else out.push(full);
    }
  };
  visit(FIXTURES_DIR);
  return out;
}
