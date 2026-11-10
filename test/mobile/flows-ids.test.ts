// Every id a Maestro flow or QA script taps, asserts or waits for still exists in the phone app's source
// (mobile/qa/flows-check.mjs: it prints the flow, the line, the missing id and the closest id that exists).
// A step that waits for a screen not built yet says `# pending: <who>` and is reported, not failed.
import { describe, expect, it } from "vitest";
import { appIds, check, idExists } from "../../mobile/qa/flows-check.mjs";

interface Row {
  line: number;
  id: string;
  found: boolean;
  failing: boolean;
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

  it("tell an id the app draws from one it doesn't", () => {
    expect(idExists("tab.profile")).toBe(true);
    expect(idExists("row\\.task\\..*")).toBe(true); // a Maestro regex over a templated id
    expect(idExists("row.task.117003")).toBe(true);
    expect(idExists("action.service.krs")).toBe(true); // from the service list
    expect(idExists("segment.theme.dark")).toBe(true); // built by the shared control from segment.theme
    expect(idExists("tab.academic")).toBe(false); // Akademik is no tab any more
    expect(idExists("card.nope")).toBe(false);
  });

  it("name only ids the app draws", () => {
    const missing = flows.flatMap((f) => f.ids.filter((r) => r.failing).map((r) => `${f.file}:${r.line}  ${r.id}  (closest: ${r.closest ?? "none"})`));
    expect(missing).toEqual([]);
  });
});
