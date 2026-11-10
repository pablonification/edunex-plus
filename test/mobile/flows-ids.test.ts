// Every id a Maestro flow or QA script taps, asserts or waits for still exists in the phone app's source
// (mobile/qa/flows-check.mjs: it prints the flow, the line, the missing id and the closest id that exists).
// A step that waits for a screen not built yet says `# pending: <who>` and is reported, not failed.
import { describe, expect, it } from "vitest";
import { appIds, check } from "../../mobile/qa/flows-check.mjs";

interface Row {
  line: number;
  id: string;
  found: boolean;
  pending: string | null;
  closest?: string | null;
}
const flows = check() as { file: string; ids: Row[] }[];

describe("the phone's flows and scripts", () => {
  it("read the app's ids", () => {
    const ids = appIds();
    expect(ids).toContain("tab.home");
    expect(ids).toContain("tab.profile");
    expect(ids).toContain("home.grid");
    expect(flows.filter((f) => f.ids.length).length).toBeGreaterThan(20);
  });

  it("name only ids the app draws", () => {
    const missing = flows.flatMap((f) =>
      f.ids.filter((r) => !r.found && !r.pending).map((r) => `${f.file}:${r.line}  ${r.id}  (closest: ${r.closest ?? "none"})`),
    );
    expect(missing).toEqual([]);
  });
});
