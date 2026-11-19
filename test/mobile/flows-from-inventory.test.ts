// The phone's data flows (mobile/scripts/flows-from-inventory.mjs) as Maestro reads them: a key Maestro doesn't know,
// like a "$comment" note in screens.json, stops every flow of the group before the first one runs.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXPECTED, flowsFor, SCREENS } from "../../mobile/scripts/flows-from-inventory.mjs";

const config = JSON.parse(fs.readFileSync(SCREENS, "utf8"));
const inventories = fs.readdirSync(EXPECTED).filter((file) => file.endsWith(".json"));

/** Every key in a command, at any depth, that starts with "$". */
function notes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(notes);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, inner]) => [...(key.startsWith("$") ? [key] : []), ...notes(inner)]);
}

describe("the phone's data flows", () => {
  it("has inventories to read", () => {
    expect(inventories.length).toBeGreaterThan(0);
  });

  it.each(inventories)("%s: gives Maestro only commands, no screens.json notes", (file) => {
    const inventory = JSON.parse(fs.readFileSync(path.join(EXPECTED, file), "utf8"));
    const found: string[] = [];
    for (const [screen, yaml] of flowsFor(inventory, config))
      for (const line of yaml.split("\n").filter((text) => text.startsWith("- {")))
        for (const key of notes(JSON.parse(line.slice(2)))) found.push(`${screen}: ${key}`);
    expect(found).toEqual([]);
  });
});
