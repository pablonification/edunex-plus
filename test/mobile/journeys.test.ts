// The seven journeys (mobile/flows/journeys/) are counted by mobile/qa/journeys.sh from their own comments: a limit, numbered
// taps and a goal. This keeps them countable, and keeps a flow from quietly growing past the hill it measures.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.resolve(import.meta.dirname, "../../mobile/flows/journeys");
const flows = fs
  .readdirSync(dir)
  .filter((f) => /^0\d-.*\.yaml$/.test(f))
  .sort();

/** The most taps any one goal took, and the flow's limit, as journeys.sh counts them. */
function count(text: string) {
  let n = 0;
  let most = 0;
  let goals = 0;
  let limit = -1;
  for (const line of text.split("\n")) {
    const l = /^# limit: (\d+)/.exec(line);
    if (l) limit = Number(l[1]);
    if (/^# tap \d+/.test(line)) n++;
    if (/^# goal/.test(line)) {
      most = Math.max(most, n);
      n = 0;
      goals++;
    }
  }
  return { taps: most, limit, goals };
}

describe("the journeys", () => {
  it("are seven", () => expect(flows).toHaveLength(7));

  for (const file of flows) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    describe(file, () => {
      it("is for the demo app, in Indonesian, and starts the same way", () => {
        expect(text).toContain("appId: io.github.pablonification.edunexplus.demo");
        expect(text).toContain("EDUNEX_DEMO=signed-in&EDUNEX_DEMO_LANG=id");
        expect(text).not.toMatch(/appId: io\.github\.pablonification\.edunexplus\s*$/m);
      });
      it("says its limit, marks its goal, and stays within the limit", () => {
        const { taps, limit, goals } = count(text);
        expect(limit).toBeGreaterThanOrEqual(0);
        expect(goals).toBeGreaterThanOrEqual(1);
        expect(taps).toBeLessThanOrEqual(limit);
      });
      it("waits for what it taps: no sleeps, no coordinates", () => {
        expect(text).not.toMatch(/^- (sleep|tapOn:\s*\n\s+point)/m);
        expect(text).not.toMatch(/point:/);
      });
      it("has no tap number out of order", () => {
        let last = 0;
        for (const line of text.split("\n")) {
          const t = /^# tap (\d+)/.exec(line);
          if (t) {
            const n = Number(t[1]);
            expect(n === 1 || n === last + 1).toBe(true);
            last = n;
          }
          if (/^# goal/.test(line)) last = 0;
        }
      });
    });
  }
});
