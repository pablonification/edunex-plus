// Where each tab of the bottom bar is, from a dump (uiautomator XML or Maestro JSON): one line per tab, left to right,
// "testID x y" with the middle of its box in pixels. phone.sh taps tabs with it.
//
//   node mobile/qa/tab-centres.mjs <dump>      exits 1 when the dump has no tab.* nodes
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { readDump, widthOf } from "./dump-lib.mjs";

/** @param {ReturnType<typeof readDump>} dump */
export function tabCentres(dump) {
  const seen = new Set();
  return dump.nodes
    .filter((node) => !node.system && /^tab\.[a-z]+$/.test(node.id) && widthOf(node) > 0 && !seen.has(node.id) && seen.add(node.id))
    .sort((a, b) => a.x1 - b.x1)
    .map((node) => ({ id: node.id, x: Math.round((node.x1 + node.x2) / 2), y: Math.round((node.y1 + node.y2) / 2) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error("usage: node mobile/qa/tab-centres.mjs <dump.xml|hierarchy.json>");
    process.exit(2);
  }
  const tabs = tabCentres(readDump(fs.readFileSync(file, "utf8")));
  for (const tab of tabs) console.log(`${tab.id} ${tab.x} ${tab.y}`);
  process.exit(tabs.length ? 0 : 1);
}
